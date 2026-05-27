import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getDeviceUptimeStats } from '@/lib/monitoring/uptime';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // 1. Fetch active OLTs
    const olts = await prisma.networkOLT.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, ipAddress: true, vendor: true },
    });

    // 2. Fetch active routers
    const routers = await prisma.router.findMany({
      where: { isActive: true },
      select: { id: true, name: true, ipAddress: true, type: true },
    });

    const targets = [
      ...olts.map(o => ({ id: o.id, name: o.name, ip: o.ipAddress, type: 'OLT', vendor: o.vendor })),
      ...routers.map(r => ({ id: r.id, name: r.name, ip: r.ipAddress, type: 'ROUTER', vendor: r.type })),
    ];

    const monitoringData = await Promise.all(
      targets.map(async (target) => {
        // Fetch latest record
        const latestRecord = await prisma.uptimeRecord.findFirst({
          where: { deviceId: target.id },
          orderBy: { checkedAt: 'desc' },
        });

        // Fetch 24h stats
        const stats = await getDeviceUptimeStats(target.id, 24);

        return {
          id: target.id,
          name: target.name,
          ip: target.ip,
          type: target.type,
          vendor: target.vendor,
          isUp: latestRecord ? latestRecord.isUp : null,
          latency: latestRecord ? latestRecord.responseMs : null,
          cpuUsage: latestRecord ? latestRecord.cpuUsage : null,
          memoryUsage: latestRecord ? latestRecord.memoryUsage : null,
          lastChecked: latestRecord ? latestRecord.checkedAt : null,
          uptime24h: stats.uptime,
          avgLatency24h: stats.avgLatency,
          lastSeen: stats.lastSeen,
        };
      })
    );

    // Fetch recent logs (last 50 events)
    const recentLogs = await prisma.uptimeRecord.findMany({
      orderBy: { checkedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      devices: monitoringData,
      recentLogs: recentLogs.map(r => ({
        id: r.id,
        deviceName: r.deviceName,
        deviceType: r.deviceType,
        isUp: r.isUp,
        latency: r.responseMs,
        checkedAt: r.checkedAt,
      })),
    });
  } catch (error: any) {
    console.error('Monitoring API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
