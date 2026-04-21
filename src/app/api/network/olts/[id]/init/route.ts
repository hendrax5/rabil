import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { initializeZteOlt } from '@/lib/oltAuth/zte';

const prisma = new PrismaClient();

export async function POST(
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
      return NextResponse.json({ error: 'Auto-initialization only supported for ZTE currently' }, { status: 400 });
    }

    if (!olt.username || !olt.password) {
      return NextResponse.json({ error: 'OLT credentials not configured' }, { status: 400 });
    }

    const routers = await prisma.router.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const vlansToCreate: number[] = [];
    routers.forEach((r, index) => {
      vlansToCreate.push(100 + index); // ACS VLAN
      vlansToCreate.push(200 + index); // PPPoE VLAN
    });

    const connStr = {
      host: olt.ipAddress,
      port: olt.port || 22,
      username: olt.username,
      password: olt.password,
      protocol: olt.connection,
      readyTimeout: 10000
    };

    const resultMsg = await initializeZteOlt(connStr, vlansToCreate);

    return NextResponse.json({ 
      success: true, 
      message: 'OLT initialization completed successfully',
      output: resultMsg
    });

  } catch (error: any) {
    console.error('OLT Init error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initialize OLT' },
      { status: 500 }
    );
  }
}
