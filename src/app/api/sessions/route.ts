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
    timeout: 15,
  });

  try {
    await api.connect();
          api.on('error', (err: any) => console.warn('Trapped routeros error:', err.message || err));
    
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
      server: user.server,
    }));
  } catch (error) {
    console.error(`Failed to get hotspot sessions from ${router.name}:`, error);
    return [];
  }
}

// Get real-time PPPoE sessions from MikroTik
async function getPPPoESessionsFromMikrotik(router: any): Promise<any[]> {
  const api = new RouterOSAPI({
    host: router.ipAddress || router.nasname,
    port: router.port || 8728,
    user: router.username,
    password: router.password,
    timeout: 15,
  });

  try {
    await api.connect();
          api.on('error', (err: any) => console.warn('Trapped routeros error:', err.message || err));
    
    // Get active PPPoE sessions
    const activeUsers = await api.write('/ppp/active/print');
    
    await api.close();
    
    return activeUsers.map((user: any) => ({
      username: user.name,
      macAddress: user['caller-id'] || '',
      ipAddress: user.address || '',
      uptime: user.uptime,
      uptimeSeconds: parseUptime(user.uptime || '0s'),
      service: user.service || 'pppoe',
      sessionId: user['session-id'] || user['.id'] || '',
    }));
  } catch (error) {
    console.error(`Failed to get PPPoE sessions from ${router.name}:`, error);
    return [];
  }
}

// Get interface traffic stats for a username (PPPoE)
async function getInterfaceTraffic(router: any, username: string): Promise<{ bytesIn: number; bytesOut: number } | null> {
  const api = new RouterOSAPI({
    host: router.ipAddress || router.nasname,
    port: router.port || 8728,
    user: router.username,
    password: router.password,
    timeout: 10,
  });

  try {
    await api.connect();
          api.on('error', (err: any) => console.warn('Trapped routeros error:', err.message || err));
    
    // PPPoE interface name is typically <pppoe-username>
    const interfaceName = `<pppoe-${username}>`;
    const stats = await api.write('/interface/print', [
      `?name=${interfaceName}`,
      '=.proplist=rx-byte,tx-byte',
    ]);
    
    await api.close();
    
    if (stats && stats.length > 0) {
      return {
        bytesIn: parseInt(stats[0]['rx-byte'] || '0'),
        bytesOut: parseInt(stats[0]['tx-byte'] || '0'),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type'); // 'pppoe' | 'hotspot' | null
    const routerId = searchParams.get('routerId');
    const search = searchParams.get('search');
    const realtime = searchParams.get('realtime') === 'true'; // Enable realtime mode

    // Calculate cutoff times for zombie detection
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000); // For hotspot fallback

    // Get routers for realtime data
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

    // Get real-time traffic data from MikroTik (for active sessions)
    let realtimeHotspotData: Map<string, any> = new Map();
    let realtimePPPoEData: Map<string, any> = new Map();
    
    if (realtime) {
      // Fetch hotspot sessions from all routers
      const hotspotPromises = routers.map(async (router) => {
        try {
          const sessions = await getHotspotSessionsFromMikrotik(router);
          return sessions.map(s => ({ ...s, routerId: router.id, routerName: router.name, router }));
        } catch {
          return [];
        }
      });
      
      const allHotspotSessions = (await Promise.all(hotspotPromises)).flat();
      allHotspotSessions.forEach(session => {
        realtimeHotspotData.set(session.username, session);
      });

      // Fetch PPPoE sessions from all routers
      const pppoePromises = routers.map(async (router) => {
        try {
          const sessions = await getPPPoESessionsFromMikrotik(router);
          return sessions.map(s => ({ ...s, routerId: router.id, routerName: router.name, router }));
        } catch {
          return [];
        }
      });
      
      const allPPPoESessions = (await Promise.all(pppoePromises)).flat();
      allPPPoESessions.forEach(session => {
        realtimePPPoEData.set(session.username, session);
      });
    }

    // Build where clause for radacct (active sessions)
    const where: any = {
      AND: [
        { acctstoptime: null }, // Only sessions without stop time
        {
          OR: [
            // PPPoE sessions: must have recent interim update (< 10 min)
            { acctupdatetime: { gte: tenMinutesAgo } },
            // Hotspot vouchers: might not have interim updates, so use longer window
            { 
              AND: [
                { acctupdatetime: null }, // No interim update
                { acctstarttime: { gte: oneDayAgo } }, // Started within last 24 hours
              ],
            },
          ],
        },
      ],
    };

    // Add search filter without overwriting zombie filter
    if (search) {
      where.AND.push({
        OR: [
          { username: { contains: search } },
          { framedipaddress: { contains: search } },
        ],
      });
    }

    // Add router filter
    if (routerId) {
      const router = await prisma.router.findUnique({
        where: { id: routerId },
        select: { nasname: true },
      });
      if (router) {
        where.AND.push({ nasipaddress: router.nasname });
      }
    }

    // Fetch active sessions from radacct
    const radacctSessions = await prisma.radacct.findMany({
      where,
      orderBy: { acctstarttime: 'desc' },
    });

    // Process sessions and enrich with user/voucher info
    const sessions = await Promise.all(
      radacctSessions.map(async (session) => {
        const username = session.username;
        
        // Determine session type by checking if user exists in pppoeUser or hotspotVoucher
        const pppoeUser = await prisma.pppoeUser.findUnique({
          where: { username },
          select: { id: true },
        });
        const sessionType = pppoeUser ? 'pppoe' : 'hotspot';
        
        // Apply type filter
        if (type && type !== sessionType) {
          return null;
        }

        // Calculate duration
        const startTime = session.acctstarttime ? new Date(session.acctstarttime) : new Date();
        let durationSeconds = session.acctsessiontime || Math.floor((Date.now() - startTime.getTime()) / 1000);
        
        // Get real-time traffic data from MikroTik if available
        const realtimeHotspot = realtimeHotspotData.get(username);
        const realtimePPPoE = realtimePPPoEData.get(username);
        
        // Calculate bandwidth - prefer realtime data if available
        let uploadBytes = Number(session.acctinputoctets || 0);
        let downloadBytes = Number(session.acctoutputoctets || 0);
        
        if (sessionType === 'hotspot' && realtimeHotspot) {
          // Use realtime data from MikroTik API for hotspot
          // MikroTik bytes-in = user upload, bytes-out = user download
          uploadBytes = realtimeHotspot.bytesIn || 0;
          downloadBytes = realtimeHotspot.bytesOut || 0;
          durationSeconds = realtimeHotspot.uptimeSeconds || durationSeconds;
        } else if (sessionType === 'pppoe' && realtimePPPoE) {
          // For PPPoE, get interface traffic stats
          const traffic = await getInterfaceTraffic(realtimePPPoE.router, username);
          if (traffic) {
            uploadBytes = traffic.bytesIn;
            downloadBytes = traffic.bytesOut;
          }
          durationSeconds = realtimePPPoE.uptimeSeconds || durationSeconds;
        }
        
        const totalBytes = uploadBytes + downloadBytes;

        // Get router info - Try multiple methods to match router
        // 1. Match by nasname (IP publik yang terdaftar di NAS)
        // 2. Match by ipAddress field  
        // 3. For local IPs (192.168.x.x), try to find router from nas_client table or first available
        let router = await prisma.router.findFirst({
          where: { 
            OR: [
              { nasname: session.nasipaddress },
              { ipAddress: session.nasipaddress },
            ]
          },
          select: { id: true, name: true },
        });
        
        // If router not found and nasipaddress is local IP, try to get from radacct calledstationid or use first router
        if (!router && session.nasipaddress && /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(session.nasipaddress)) {
          // Try to find router - for now get first active router if only one exists
          const routers = await prisma.router.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            take: 10,
          });
          
          // If only one router, assume it's the one
          if (routers.length === 1) {
            router = routers[0];
          }
        }

        // Get user/voucher info based on type
        let userInfo: any = null;
        if (sessionType === 'pppoe') {
          userInfo = await prisma.pppoeUser.findUnique({
            where: { username },
            select: {
              id: true,
              name: true,
              phone: true,
              profile: {
                select: { name: true },
              },
            },
          });
        } else {
          userInfo = await prisma.hotspotVoucher.findUnique({
            where: { code: username },
            select: {
              id: true,
              status: true,
              batchCode: true,
              agentId: true,
              profile: {
                select: { name: true },
              },
              agent: {
                select: { id: true, name: true },
              },
            },
          });
        }

        return {
          id: session.radacctid.toString(),
          username: session.username,
          sessionId: session.acctsessionid,
          type: sessionType,
          nasIpAddress: session.nasipaddress,
          framedIpAddress: session.framedipaddress,
          macAddress: session.callingstationid,
          startTime: session.acctstarttime,
          duration: durationSeconds,
          durationFormatted: formatDuration(durationSeconds),
          uploadBytes,
          downloadBytes,
          totalBytes,
          uploadFormatted: formatBytes(uploadBytes),
          downloadFormatted: formatBytes(downloadBytes),
          totalFormatted: formatBytes(totalBytes),
          router: router ? {
            id: router.id,
            name: router.name,
          } : null,
          user: sessionType === 'pppoe' && userInfo ? {
            id: userInfo.id,
            name: userInfo.name,
            phone: userInfo.phone,
            profile: userInfo.profile?.name,
          } : null,
          voucher: sessionType === 'hotspot' && userInfo ? {
            id: userInfo.id,
            status: userInfo.status,
            profile: userInfo.profile?.name,
            batchCode: userInfo.batchCode,
            agent: userInfo.agent ? {
              id: userInfo.agent.id,
              name: userInfo.agent.name,
            } : null,
          } : null,
        };
      })
    );

    // Filter out nulls (from type filtering)
    const filteredSessions = sessions.filter(s => s !== null);

    // Calculate active session statistics
    const stats = {
      total: filteredSessions.length,
      pppoe: filteredSessions.filter(s => s?.type === 'pppoe').length,
      hotspot: filteredSessions.filter(s => s?.type === 'hotspot').length,
      totalBandwidth: filteredSessions.reduce((sum, s) => sum + (s?.totalBytes || 0), 0),
    };

    // Calculate ALL TIME statistics (including closed sessions)
    const allTimeStats = await prisma.radacct.aggregate({
      _sum: {
        acctinputoctets: true,
        acctoutputoctets: true,
        acctsessiontime: true,
      },
      _count: {
        radacctid: true,
      },
    });

    const totalAllTimeBytes = 
      (Number(allTimeStats._sum.acctinputoctets) || 0) + 
      (Number(allTimeStats._sum.acctoutputoctets) || 0);

    return NextResponse.json({
      sessions: filteredSessions,
      stats: {
        ...stats,
        totalBandwidthFormatted: formatBytes(stats.totalBandwidth),
      },
      allTimeStats: {
        totalSessions: allTimeStats._count.radacctid || 0,
        totalBandwidth: totalAllTimeBytes,
        totalBandwidthFormatted: formatBytes(totalAllTimeBytes),
        totalDuration: allTimeStats._sum.acctsessiontime || 0,
        totalDurationFormatted: formatDuration(allTimeStats._sum.acctsessiontime || 0),
      },
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
