import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withOlt } from '@/lib/olt';

/**
 * GET /api/network/olts/[id]/pon-ports
 * Returns PON port utilization statistics
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const live = searchParams.get('live') === 'true';

  try {
    const olt = await prisma.networkOLT.findUnique({ where: { id } });
    if (!olt) return NextResponse.json({ error: 'OLT not found' }, { status: 404 });

    if (live && olt.username && olt.password) {
      const portStats = await withOlt(
        {
          host: olt.ipAddress,
          port: olt.port || 22,
          username: olt.username,
          password: olt.password,
          protocol: (olt.connection as any) || 'ssh',
          vendor: (olt.vendor as any) || 'zte',
        },
        async (driver) => driver.getPonPortStats()
      );
      return NextResponse.json({ success: true, source: 'live', ports: portStats });
    }

    // From DB
    const onus = await prisma.network_onu.findMany({ where: { oltId: id } });
    const portMap: Record<string, any> = {};
    for (const onu of onus) {
      const key = `${onu.board}/${onu.port}`;
      if (!portMap[key]) portMap[key] = { board: onu.board, port: onu.port, totalOnus: 0, activeOnus: 0, offlineOnus: 0, losOnus: 0, capacity: 128 };
      portMap[key].totalOnus++;
      if (onu.state === 'working') portMap[key].activeOnus++;
      else if (onu.state === 'los') portMap[key].losOnus++;
      else portMap[key].offlineOnus++;
    }
    const ports = Object.values(portMap).map((p: any) => ({
      ...p,
      utilization: Math.round((p.totalOnus / p.capacity) * 100),
    }));

    return NextResponse.json({ success: true, source: 'database', ports });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
