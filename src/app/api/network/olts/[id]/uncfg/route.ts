import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getZteUncfgOnu, getZteOnuTypes } from '@/lib/oltAuth/zte';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: oltId } = await params;
    
    const olt = await prisma.networkOLT.findUnique({
      where: { id: oltId }
    });

    if (!olt) {
      return NextResponse.json({ error: 'OLT not found' }, { status: 404 });
    }

    if (olt.vendor !== 'zte') {
      return NextResponse.json({ error: 'Auto-discovery only supported for ZTE currently' }, { status: 400 });
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

    const [uncfgs, onuTypes] = await Promise.all([
      getZteUncfgOnu(connStr),
      getZteOnuTypes(connStr)
    ]);

    return NextResponse.json({ success: true, count: uncfgs.length, data: uncfgs, types: onuTypes });

  } catch (error: any) {
    console.error('Fetch UNCFG error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch unconfigured ONUs from OLT' },
      { status: 500 }
    );
  }
}
