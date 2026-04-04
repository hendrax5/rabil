import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { registerZteOnu } from '@/lib/oltAuth/zte';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const oltId = params.id;
    const body = await request.json();
    const { board, port, sn, name, vlan } = body;
    
    if (!board || !port || !sn || !name || !vlan) {
      return NextResponse.json({ error: 'board, port, sn, name, vlan are required' }, { status: 400 });
    }

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
      result = await registerZteOnu(connStr, { board, port, sn, name, vlan: String(vlan) });
    } else {
      return NextResponse.json({ error: 'Only ZTE is supported currently' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'ONT registration command executed.',
      output: result
    });

  } catch (error: any) {
    console.error('Register ONU error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to register ONU to OLT' },
      { status: 500 }
    );
  }
}
