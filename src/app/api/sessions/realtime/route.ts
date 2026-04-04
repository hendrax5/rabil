import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RouterOSAPI } from 'node-routeros';

// Helper to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper to format duration
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Parse MikroTik uptime format (e.g., "1h30m45s", "5m20s", "30s")
function parseUptime(uptime: string): number {
  let seconds = 0;
  
  const weeks = uptime.match(/(\d+)w/);
  const days = uptime.match(/(\d+)d/);
  const hours = uptime.match(/(\d+)h/);
  const minutes = uptime.match(/(\d+)m/);
  const secs = uptime.match(/(\d+)s/);
  
  if (weeks) seconds += parseInt(weeks[1]) * 7 * 24 * 3600;
  if (days) seconds += parseInt(days[1]) * 24 * 3600;
  if (hours) seconds += parseInt(hours[1]) * 3600;
  if (minutes) seconds += parseInt(minutes[1]) * 60;
  if (secs) seconds += parseInt(secs[1]);
  
  return seconds;
}

// Get real-time hotspot sessions from MikroTik
async function getHotspotSessionsFromMikrotik(router: any): Promise<any[]> {
  const api = new RouterOSAPI({
    host: router.ipAddress || router.nasname,
    port: router.port || 8728,
    user: router.username,
    password: router.password,
    timeout: 10,
  });

  try {
    await api.connect();
    
    // Get active hotspot users
    const activeUsers = await api.write('/ip/hotspot/active/print');
    
    await api.close();
    
    return activeUsers.map((user: any) => ({
      username: user.user || user.username,
      macAddress: user['mac-address'],
      ipAddress: user.address,
      uptime: user.uptime,
      uptimeSeconds: parseUptime(user.uptime || '0s'),
      bytesIn: parseInt(user['bytes-in'] || '0'),
      bytesOut: parseInt(user['bytes-out'] || '0'),
      packetsIn: parseInt(user['packets-in'] || '0'),
      packetsOut: parseInt(user['packets-out'] || '0'),
      server: user.server,
      sessionId: user['session-id'],
    }));
  } catch (error) {
    console.error(`Failed to get hotspot sessions from ${router.name}:`, error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const routerId = searchParams.get('routerId');
    const search = searchParams.get('search');

    // Get all active routers or specific router
    const routerWhere: any = { isActive: true };
    if (routerId) {
      routerWhere.id = routerId;
    }

    const routers = await prisma.router.findMany({
      where: routerWhere,
      select: {
        id: true,
        name: true,
        nasname: true,
        ipAddress: true,
        username: true,
        password: true,
        port: true,
      },
    });

    if (routers.length === 0) {
      return NextResponse.json({
        sessions: [],
        stats: { total: 0, hotspot: 0, totalBandwidth: 0, totalBandwidthFormatted: '0 B' },
        source: 'mikrotik-api',
        error: 'No active routers found',
      });
    }

    // Fetch sessions from all routers in parallel
    const sessionsPromises = routers.map(async (router: typeof routers[0]) => {
      const mikrotikSessions = await getHotspotSessionsFromMikrotik(router);
      
      // Enrich with voucher info
      return Promise.all(
        mikrotikSessions.map(async (session) => {
          // Get voucher info
          const voucher = await prisma.hotspotVoucher.findUnique({
            where: { code: session.username },
            select: {
              id: true,
              status: true,
              profile: {
                select: { name: true },
              },
            },
          });

          // Apply search filter
          if (search) {
            const searchLower = search.toLowerCase();
            if (
              !session.username.toLowerCase().includes(searchLower) &&
              !session.ipAddress?.toLowerCase().includes(searchLower)
            ) {
              return null;
            }
          }

          return {
            id: `${router.id}-${session.username}`,
            username: session.username,
            sessionId: session.sessionId,
            type: 'hotspot',
            nasIpAddress: router.ipAddress || router.nasname,
            framedIpAddress: session.ipAddress,
            macAddress: session.macAddress,
            startTime: new Date(Date.now() - session.uptimeSeconds * 1000),
            duration: session.uptimeSeconds,
            durationFormatted: formatDuration(session.uptimeSeconds),
            // MikroTik: bytes-in = download (from user perspective, upload to router)
            // bytes-out = upload (from user perspective, download from router)
            uploadBytes: session.bytesIn,
            downloadBytes: session.bytesOut,
            totalBytes: session.bytesIn + session.bytesOut,
            uploadFormatted: formatBytes(session.bytesIn),
            downloadFormatted: formatBytes(session.bytesOut),
            totalFormatted: formatBytes(session.bytesIn + session.bytesOut),
            router: {
              id: router.id,
              name: router.name,
            },
            voucher: voucher ? {
              id: voucher.id,
              status: voucher.status,
              profile: voucher.profile?.name,
            } : null,
            source: 'realtime',
          };
        })
      );
    });

    const allSessionsArrays = await Promise.all(sessionsPromises);
    const allSessions = allSessionsArrays.flat().filter(s => s !== null);

    // Calculate statistics
    const stats = {
      total: allSessions.length,
      hotspot: allSessions.length,
      totalBandwidth: allSessions.reduce((sum, s) => sum + (s?.totalBytes || 0), 0),
      totalBandwidthFormatted: formatBytes(
        allSessions.reduce((sum, s) => sum + (s?.totalBytes || 0), 0)
      ),
    };

    return NextResponse.json({
      sessions: allSessions,
      stats,
      source: 'mikrotik-api',
      routersQueried: routers.length,
    });
  } catch (error) {
    console.error('Get realtime sessions error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
