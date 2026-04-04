import { NextRequest, NextResponse } from 'next/server';
import { getGenieACSCredentials } from '@/app/api/settings/genieacs/route';

interface RouteParams {
  params: Promise<{ deviceId: string }>;
}

// Security mode mapping to TR-069 values
const securityModeMap: Record<string, { beaconType: string; authMode: string; encryptionMode: string }> = {
  'None': { beaconType: 'None', authMode: 'None', encryptionMode: 'None' },
  'WPA-PSK': { beaconType: 'WPA', authMode: 'PSKAuthentication', encryptionMode: 'TKIPEncryption' },
  'WPA2-PSK': { beaconType: '11i', authMode: 'PSKAuthentication', encryptionMode: 'AESEncryption' },
  'WPA-WPA2-PSK': { beaconType: 'WPAand11i', authMode: 'PSKAuthentication', encryptionMode: 'TKIPandAESEncryption' },
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { deviceId } = await params;
    const body = await request.json();
    const { wlanIndex = 1, ssid, password, securityMode = 'WPA2-PSK', enabled = true } = body;

    // Validation
    if (!ssid || ssid.length < 1 || ssid.length > 32) {
      return NextResponse.json(
        { success: false, error: 'SSID harus 1-32 karakter' },
        { status: 400 }
      );
    }

    // Password only required when security mode is not None/Open
    if (securityMode !== 'None' && securityMode !== 'Open') {
      if (!password || password.length < 8 || password.length > 63) {
        return NextResponse.json(
          { success: false, error: 'Password harus 8-63 karakter' },
          { status: 400 }
        );
      }
    }

    // Get GenieACS credentials
    const credentials = await getGenieACSCredentials();

    if (!credentials) {
      return NextResponse.json(
        { success: false, error: 'GenieACS belum dikonfigurasi' },
        { status: 400 }
      );
    }

    const { host, username, password: geniePassword } = credentials;

    if (!host) {
      return NextResponse.json(
        { success: false, error: 'GenieACS host tidak dikonfigurasi' },
        { status: 400 }
      );
    }

    // Build TR-069 parameter paths for Huawei HG8145V5
    const basePath = `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${wlanIndex}`;
    const authHeader = Buffer.from(`${username}:${geniePassword}`).toString('base64');
    
    // STEP 1: Get current device parameters to check what's writable
    console.log('Fetching current device parameters...');
    const deviceQuery = encodeURIComponent(JSON.stringify({ _id: deviceId }));
    const deviceUrl = `${host}/devices?query=${deviceQuery}`;
    
    const deviceResponse = await fetch(deviceUrl, {
      method: 'GET',
      headers: { 'Authorization': `Basic ${authHeader}` }
    });
    
    if (!deviceResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Gagal mengambil data device dari GenieACS' },
        { status: deviceResponse.status }
      );
    }
    
    const devices = await deviceResponse.json();
    if (!devices || devices.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Device tidak ditemukan' },
        { status: 404 }
      );
    }

    // STEP 2: Build parameter values - ONLY writable parameters
    const securityConfig = securityModeMap[securityMode] || securityModeMap['WPA2-PSK'];
    const parameterValues: [string, string | boolean, string][] = [];

    // SSID - most important parameter
    parameterValues.push([`${basePath}.SSID`, ssid, 'xsd:string']);

    // Security and password for encrypted networks
    if (securityMode !== 'None' && securityMode !== 'Open') {
      // BeaconType
      parameterValues.push([`${basePath}.BeaconType`, securityConfig.beaconType, 'xsd:string']);
      
      // Authentication and Encryption based on mode
      if (securityMode.includes('WPA2') || securityMode.includes('WPA-WPA2')) {
        parameterValues.push([`${basePath}.IEEE11iAuthenticationMode`, securityConfig.authMode, 'xsd:string']);
        parameterValues.push([`${basePath}.IEEE11iEncryptionModes`, securityConfig.encryptionMode, 'xsd:string']);
      }
      
      if (securityMode.includes('WPA') && !securityMode.includes('WPA2')) {
        parameterValues.push([`${basePath}.WPAAuthenticationMode`, securityConfig.authMode, 'xsd:string']);
        parameterValues.push([`${basePath}.WPAEncryptionModes`, securityConfig.encryptionMode, 'xsd:string']);
      }
      
      // Password - KeyPassphrase for Huawei
      if (password) {
        parameterValues.push([`${basePath}.KeyPassphrase`, password, 'xsd:string']);
      }
    } else {
      // Open network
      parameterValues.push([`${basePath}.BeaconType`, 'None', 'xsd:string']);
    }
    
    // Enable/Disable
    parameterValues.push([`${basePath}.Enable`, enabled, 'xsd:boolean']);

    // STEP 3: Create and send task with connection_request
    const task = {
      name: 'setParameterValues',
      parameterValues: parameterValues
    };

    const taskUrl = `${host}/devices/${encodeURIComponent(deviceId)}/tasks?timeout=10000&connection_request`;

    console.log('Sending WiFi update task:', {
      url: taskUrl,
      parameters: parameterValues.map(([name, value]) => ({ name, value }))
    });

    const response = await fetch(taskUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authHeader}`
      },
      body: JSON.stringify(task)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GenieACS task error:', response.status, errorText);
      
      if (response.status === 404) {
        return NextResponse.json(
          { success: false, error: 'Device tidak ditemukan di GenieACS' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: `Gagal membuat task: ${errorText || response.status}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('Task created successfully:', result);

    // STEP 4: Wait a moment for connection request to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));

    // STEP 5: Check task status
    const taskStatusUrl = `${host}/tasks?query=${encodeURIComponent(JSON.stringify({ _id: result._id }))}`;
    const taskStatusResponse = await fetch(taskStatusUrl, {
      headers: { 'Authorization': `Basic ${authHeader}` }
    });

    let taskStatus = 'pending';
    if (taskStatusResponse.ok) {
      const taskData = await taskStatusResponse.json();
      if (taskData && taskData.length > 0) {
        taskStatus = taskData[0].fault ? 'fault' : (taskData[0].status || 'pending');
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Konfigurasi WiFi berhasil dikirim ke device',
      info: taskStatus === 'pending' 
        ? 'Task sedang diproses, refresh dalam beberapa saat'
        : 'Task berhasil dieksekusi',
      taskId: result._id,
      taskStatus,
      parameters: {
        ssid,
        securityMode,
        enabled,
        wlanIndex
      }
    });

  } catch (error) {
    console.error('Error updating WiFi config:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Terjadi kesalahan' },
      { status: 500 }
    );
  }
}

// GET - Get current WiFi configuration for a specific WLAN
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { deviceId } = await params;
    const { searchParams } = new URL(request.url);
    const wlanIndex = searchParams.get('wlanIndex') || '1';

    // Get GenieACS credentials
    const credentials = await getGenieACSCredentials();

    if (!credentials) {
      return NextResponse.json(
        { success: false, error: 'GenieACS belum dikonfigurasi' },
        { status: 400 }
      );
    }

    const { host, username, password } = credentials;

    if (!host) {
      return NextResponse.json(
        { success: false, error: 'GenieACS host tidak dikonfigurasi' },
        { status: 400 }
      );
    }

    const authHeader = Buffer.from(`${username}:${password}`).toString('base64');

    // Get device data with WLAN parameters
    const projection = encodeURIComponent(JSON.stringify({
      [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${wlanIndex}.SSID`]: 1,
      [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${wlanIndex}.Enable`]: 1,
      [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${wlanIndex}.BeaconType`]: 1,
      [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${wlanIndex}.Standard`]: 1,
      [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${wlanIndex}.Channel`]: 1,
    }));

    const query = encodeURIComponent(JSON.stringify({ _id: deviceId }));
    const url = `${host}/devices?query=${query}&projection=${projection}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authHeader}`
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: 'Gagal mengambil data dari GenieACS' },
        { status: response.status }
      );
    }

    const devices = await response.json();
    
    if (!devices || devices.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Device tidak ditemukan' },
        { status: 404 }
      );
    }

    const device = devices[0];
    const basePath = `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${wlanIndex}`;

    // Extract values
    const getValue = (path: string): string => {
      const data = device[path];
      if (!data) return '';
      if (typeof data._value !== 'undefined') return String(data._value);
      if (typeof data.value !== 'undefined') return String(data.value);
      return '';
    };

    return NextResponse.json({
      success: true,
      config: {
        wlanIndex: parseInt(wlanIndex),
        ssid: getValue(`${basePath}.SSID`),
        enabled: getValue(`${basePath}.Enable`) === 'true' || getValue(`${basePath}.Enable`) === '1',
        beaconType: getValue(`${basePath}.BeaconType`),
        standard: getValue(`${basePath}.Standard`),
        channel: getValue(`${basePath}.Channel`),
      }
    });

  } catch (error) {
    console.error('Error getting WiFi config:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Terjadi kesalahan' },
      { status: 500 }
    );
  }
}
