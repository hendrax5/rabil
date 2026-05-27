import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withOlt } from '@/lib/olt';

/**
 * GET /api/network/olts/[id]/onus
 * Fetch live ONU status from OLT via SSH/Telnet
 * 
 * Query params:
 *   ?refresh=true  — force fetch from OLT (skip cache)
 *   ?port=1/1/1    — filter by specific PON port
 *   ?mode=db       — return only DB-synced data (no live fetch)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const forceRefresh = searchParams.get('refresh') === 'true';
  const filterPort = searchParams.get('port');
  const mode = searchParams.get('mode') || 'live';

  try {
    const olt = await prisma.networkOLT.findUnique({ where: { id } });
    if (!olt) {
      return NextResponse.json({ error: 'OLT not found' }, { status: 404 });
    }

    // DB-only mode: return stored data
    if (mode === 'db') {
      const dbOnus = await prisma.network_onu.findMany({
        where: { oltId: id, ...(filterPort ? { port: filterPort } : {}) },
        orderBy: [{ board: 'asc' }, { port: 'asc' }, { onuId: 'asc' }],
      });
      return NextResponse.json({
        success: true,
        source: 'database',
        lastSync: dbOnus[0]?.lastSync || null,
        onus: dbOnus,
        total: dbOnus.length,
        online: dbOnus.filter(o => o.state === 'working').length,
        offline: dbOnus.filter(o => o.state === 'offline').length,
        los: dbOnus.filter(o => o.state === 'los').length,
      });
    }

    // Check cache (last sync < 2 minutes ago)
    const cacheThreshold = new Date(Date.now() - 2 * 60 * 1000);
    const cachedOnus = await prisma.network_onu.findMany({
      where: { oltId: id, lastSync: { gt: cacheThreshold } },
    });

    if (!forceRefresh && cachedOnus.length > 0) {
      const filtered = filterPort
        ? cachedOnus.filter(o => `${o.board}/${o.port}` === filterPort)
        : cachedOnus;

      return NextResponse.json({
        success: true,
        source: 'cache',
        lastSync: cachedOnus[0]?.lastSync,
        onus: filtered,
        total: cachedOnus.length,
        online: cachedOnus.filter(o => o.state === 'working').length,
        offline: cachedOnus.filter(o => o.state === 'offline').length,
        los: cachedOnus.filter(o => o.state === 'los').length,
        weak: cachedOnus.filter(o => o.state === 'degraded').length,
      });
    }

    // No credentials — skip live fetch
    if (!olt.username || !olt.password) {
      return NextResponse.json({
        success: false,
        error: 'OLT has no credentials configured. Please set username and password.',
      }, { status: 422 });
    }

    // Live fetch from OLT
    const liveOnus = await withOlt(
      {
        host: olt.ipAddress,
        port: olt.port || 22,
        username: olt.username,
        password: olt.password,
        protocol: (olt.connection as 'ssh' | 'telnet') || 'ssh',
        vendor: (olt.vendor as any) || 'zte',
      },
      async (driver) => {
        if (filterPort) {
          const [board, port] = filterPort.split('/').slice(-2);
          return driver.getOnuByPort(filterPort.split('/').slice(0, -1).join('/'), port);
        }
        return driver.getAllOnus();
      }
    );

    const now = new Date();

    // Upsert to DB
    await Promise.all(
      liveOnus.map(onu =>
        prisma.network_onu.upsert({
          where: { oltId_onuId: { oltId: id, onuId: onu.onuId } },
          update: {
            sn: onu.sn,
            board: onu.board,
            port: onu.port,
            state: onu.state,
            rxPower: onu.rxPower?.toString() || null,
            txPower: onu.txPower?.toString() || null,
            profile: onu.onuType || null,
            lastSync: now,
          },
          create: {
            oltId: id,
            onuId: onu.onuId,
            sn: onu.sn,
            board: onu.board,
            slot: onu.board.split('/')[1] || '1',
            port: onu.port,
            state: onu.state,
            rxPower: onu.rxPower?.toString() || null,
            txPower: onu.txPower?.toString() || null,
            profile: onu.onuType || null,
            lastSync: now,
          },
        })
      )
    );

    // Update OLT lastSync
    await prisma.networkOLT.update({
      where: { id },
      data: { lastSync: now },
    });

    const filtered = filterPort
      ? liveOnus.filter(o => `${o.board}/${o.port}` === filterPort)
      : liveOnus;

    return NextResponse.json({
      success: true,
      source: 'live',
      lastSync: now,
      onus: filtered,
      total: liveOnus.length,
      online: liveOnus.filter(o => o.state === 'working').length,
      offline: liveOnus.filter(o => o.state === 'offline').length,
      los: liveOnus.filter(o => o.state === 'los').length,
      weak: liveOnus.filter(o => o.state === 'degraded').length,
    });

  } catch (error: any) {
    console.error('[ONU Monitor] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch ONU data',
    }, { status: 500 });
  }
}
