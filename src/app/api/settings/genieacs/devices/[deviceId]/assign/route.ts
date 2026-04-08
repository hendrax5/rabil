import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getGenieACSCredentials } from '../../../route';
import { getZteUncfgOnu, registerZteOnu } from '@/lib/oltAuth/zte';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  try {
    const deviceId = params.deviceId;
    const body = await request.json();
    const { pppoeUserId, saveWifi, wifiSsid, wifiPassword, macAddress } = body;

    if (!deviceId || !pppoeUserId) {
      return NextResponse.json(
        { error: 'deviceId and pppoeUserId are required' },
        { status: 400 }
      );
    }

    // 1. Fetch PPPoE User with OLT details
    const pppoeUser = await prisma.pppoeUser.findUnique({
      where: { id: pppoeUserId },
      include: {
        odpAssignment: {
          include: {
            odp: {
              include: {
                olt: true
              }
            }
          }
        }
      }
    });

    if (!pppoeUser) {
      return NextResponse.json(
        { error: 'PPPoE User not found' },
        { status: 404 }
      );
    }

    // 2. Fetch GenieACS Credentials
    const credentials = await getGenieACSCredentials();
    if (!credentials) {
      return NextResponse.json(
        { error: 'GenieACS not configured' },
        { status: 400 }
      );
    }

    const { host, username, password } = credentials;
    const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    // 3. Prepare parameters for GenieACS
    // In strict environments, we might want to check the specific device path, 
    // but the generic WANDevice.1 path is typical for 90% of ONTs. 
    const parameterValues: [string, any, string][] = [
      ['InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username', pppoeUser.username, 'xsd:string'],
      ['InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password', pppoeUser.password, 'xsd:string'],
    ];

    if (saveWifi && wifiSsid) {
      parameterValues.push(
        ['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID', wifiSsid, 'xsd:string'],
        ['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey', wifiPassword || '12345678', 'xsd:string']
      );
    }

    // Set ACS CWMP URL so the modem stays connected after provisioning
    const acsUrl = process.env.ACS_CWMP_URL || host.replace(/:\d+$/, ':7547');
    parameterValues.push(
      ['InternetGatewayDevice.ManagementServer.URL', acsUrl, 'xsd:string']
    );

    const taskPayload = {
      name: 'setParameterValues',
      parameterValues: parameterValues,
    };

    // 4. Send Task to GenieACS
    const response = await fetch(`${host}/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskPayload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('GenieACS tasks API returned:', response.status, text);
      throw new Error(`Failed to assign parameters via GenieACS`);
    }

    // 5. Update PPPoE User with assigned MAC Address (if provided)
    if (macAddress) {
      await prisma.pppoeUser.update({
        where: { id: pppoeUserId },
        data: { macAddress: macAddress },
      });
    }

    // 6. Try to register OLT automatically if ODP is assigned
    const odpAssignment = pppoeUser.odpAssignment;
    let oltRegistered = false;
    let oltMessage = '';

    if (odpAssignment?.odp?.olt) {
      const olt = odpAssignment.odp.olt;
      
      if (olt.vendor === 'zte' && olt.ipAddress && olt.username && olt.password) {
        try {
          const connStr = {
             host: olt.ipAddress,
             port: olt.port,
             username: olt.username,
             password: olt.password,
             protocol: olt.connection || 'ssh'
          };
          
          const uncfgs = await getZteUncfgOnu(connStr);
          
          // Try to match by SN (from deviceId or macAddress)
          const deviceSn = params.deviceId.split('-').pop() || '';
          let targetOnu = uncfgs.find(u => u.sn.toUpperCase() === deviceSn.toUpperCase());
          
          if (!targetOnu && macAddress) {
             const cleanMac = macAddress.replace(/[:.\-]/g, '').toUpperCase();
             targetOnu = uncfgs.find(u => u.sn.toUpperCase().includes(cleanMac) || cleanMac.includes(u.sn.toUpperCase()));
          }

          if (targetOnu) {
            const rawOut = await registerZteOnu(connStr, {
              board: targetOnu.board,
              port: targetOnu.port,
              sn: targetOnu.sn,
              name: pppoeUser.username,
              vlan: '100' // Default assumption if not provided
            });
            oltRegistered = true;
            console.log('[OLT Auto-Provisioning] Raw Output:', rawOut);
            oltMessage = ' ONU automatically registered on OLT. OLT Output:\n' + rawOut;
          } else {
            oltMessage = ' ONU SN not found on OLT (might be already registered).';
          }
        } catch (e: any) {
          console.warn('OLT Auto-registration failed:', e.message);
          oltMessage = ' OLT registration failed: ' + e.message;
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'ONT assigned successfully. Provisioning task sent.' + oltMessage,
      user: pppoeUser.username
    });

  } catch (error: any) {
    console.error('Assign device error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to assign device' },
      { status: 500 }
    );
  }
}
