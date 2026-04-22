import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { registerZteOnu } from '@/lib/oltAuth/zte';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let reqBody: any = {};
  try {
    const { id: oltId } = await params;
    reqBody = await request.json();
    const { board, port, sn, pppoeUserId, mode, onuType, profile, vlanProfile } = reqBody;
    
    if (!board || !port || !sn || !pppoeUserId) {
      return NextResponse.json({ error: 'board, port, sn, pppoeUserId are required' }, { status: 400 });
    }

    const pppoeUser = await prisma.pppoeUser.findUnique({
      where: { id: pppoeUserId }
    });

    if (!pppoeUser) {
      return NextResponse.json({ error: 'PPPoE User not found' }, { status: 404 });
    }

    if (pppoeUser.onuSn) {
      return NextResponse.json({ error: 'This PPPoE User is already bound to another ONU.' }, { status: 400 });
    }

    if (!pppoeUser.routerId) {
      return NextResponse.json({ error: 'PPPoE User is not assigned to any NAS/Router.' }, { status: 400 });
    }

    const routers = await prisma.router.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    const routerIndex = routers.findIndex(r => r.id === pppoeUser.routerId);
    if (routerIndex === -1) {
      return NextResponse.json({ error: 'Associated NAS/Router not found in the database.' }, { status: 404 });
    }

    // Generate VLAN based on NAS index as done in Router generation logic
    const generatedPppoeVlan = (200 + Math.max(0, routerIndex)).toString();
    const generatedAcsVlan = (100 + Math.max(0, routerIndex)).toString();

    const olt = await prisma.networkOLT.findUnique({
      where: { id: oltId }
    });

    if (!olt) {
      return NextResponse.json({ error: 'OLT not found' }, { status: 404 });
    }

    if (!olt.username || !olt.password) {
      return NextResponse.json({ error: 'OLT credentials not configured' }, { status: 400 });
    }

    const connStr = {
      host: olt.ipAddress,
      port: olt.port || 22,
      username: olt.username,
      password: olt.password,
      protocol: olt.connection,
      readyTimeout: 10000
    };

    let result = '';
    if (olt.vendor === 'zte') {
      result = await registerZteOnu(connStr, { 
        board: String(board), 
        port: String(port), 
        sn, 
        name: pppoeUser.username, 
        vlan: generatedPppoeVlan,
        mode, 
        onuType, 
        pppoeUser: pppoeUser.username, 
        pppoePass: pppoeUser.password, 
        profile, 
        vlanProfile,
        vlanAcs: generatedAcsVlan
      });
    } else {
      return NextResponse.json({ error: 'Only ZTE is supported currently' }, { status: 400 });
    }

    console.log('[OLT Provisioning] Successfully registered ONU. Output:', result);

    // Save success log to provision_log table
    await prisma.provision_log.create({
      data: {
        oltId,
        sn,
        action: 'REGISTER',
        status: 'SUCCESS',
        message: 'ONU successfully registered to OLT'
      }
    });

    // Save the binding to database
    await prisma.pppoeUser.update({
      where: { id: pppoeUser.id },
      data: {
        oltId,
        oltBoard: String(board),
        oltPort: String(port),
        onuSn: sn,
        vlanAcs: generatedAcsVlan
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'ONU successfully registered and bound to user.',
      output: result
    });

  } catch (error: any) {
    console.error('Register ONU error:', error);
    
    try {
      const { id: oltId } = await params;
      await prisma.provision_log.create({
        data: {
          oltId: oltId,
          sn: reqBody.sn || 'UNKNOWN_SN',
          action: 'REGISTER',
          status: 'FAILED',
          message: error.message || 'Failed to register ONU to OLT'
        }
      });
    } catch (logErr) {
      console.error('Failed to write error log to DB:', logErr);
    }

    return NextResponse.json(
      { error: error.message || 'Failed to register ONU to OLT' },
      { status: 500 }
    );
  }
}
