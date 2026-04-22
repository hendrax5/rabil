import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/network/ztp/bind
 * Binds PPPoE credentials and configuration to a DISCOVERED ONU.
 * Changes the status to READY so the orchestrator can provision it.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, vlan, mode, pppoeUser, pppoePass, profile } = body;

    if (!id || !vlan || !mode) {
      return NextResponse.json(
        { error: 'Missing required binding parameters (id, vlan, mode)' },
        { status: 400 }
      );
    }

    if (mode === 'pppoe' && (!pppoeUser || !pppoePass)) {
      return NextResponse.json(
        { error: 'PPPoE mode requires pppoeUser and pppoePass' },
        { status: 400 }
      );
    }

    // Check if the discovered ONU exists
    const discoveredOnu = await prisma.discovered_onu.findUnique({
      where: { id }
    });

    if (!discoveredOnu) {
      return NextResponse.json(
        { error: 'Discovered ONU not found' },
        { status: 404 }
      );
    }

    if (discoveredOnu.status !== 'DISCOVERED' && discoveredOnu.status !== 'FAILED') {
      return NextResponse.json(
        { error: `Cannot bind ONU with status: ${discoveredOnu.status}` },
        { status: 400 }
      );
    }

    // Update with binding details and mark as READY
    const updatedOnu = await prisma.discovered_onu.update({
      where: { id },
      data: {
        vlan,
        mode,
        pppoeUser: mode === 'pppoe' ? pppoeUser : null,
        pppoePass: mode === 'pppoe' ? pppoePass : null,
        profile: profile || 'UNLIMITED',
        status: 'READY'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'ONU successfully bound and queued for provisioning',
      data: updatedOnu
    });

  } catch (error: any) {
    console.error('[ZTP BIND ERROR]', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
