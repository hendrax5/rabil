/**
 * Network Uptime Monitor
 * Pings OLTs, routers, and servers to track availability
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { getRouterStats, getOltStats } from './snmp';

const execAsync = promisify(exec);

export interface PingResult {
  host: string;
  isUp: boolean;
  responseMs: number | null;
  error?: string;
}

/**
 * Ping a host and return the result
 */
export async function pingHost(host: string, timeoutMs = 3000): Promise<PingResult> {
  try {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows
      ? `ping -n 1 -w ${timeoutMs} ${host}`
      : `ping -c 1 -W ${Math.floor(timeoutMs / 1000)} ${host}`;

    const start = Date.now();
    const { stdout } = await execAsync(cmd, { timeout: timeoutMs + 1000 });
    const elapsed = Date.now() - start;

    // Parse response time
    const msMatch = stdout.match(/time[=<](\d+(?:\.\d+)?)\s*ms/i) || 
                    stdout.match(/(\d+(?:\.\d+)?)\s*ms/i);
    const responseMs = msMatch ? parseFloat(msMatch[1]) : elapsed;

    const isUp = isWindows
      ? !stdout.includes('Request timed out') && !stdout.includes('host unreachable')
      : stdout.includes('1 received') || stdout.includes('1 packets received');

    return { host, isUp, responseMs: isUp ? responseMs : null };
  } catch {
    return { host, isUp: false, responseMs: null, error: 'Ping failed or timed out' };
  }
}

/**
 * Ping multiple hosts in parallel
 */
export async function pingHosts(hosts: string[]): Promise<PingResult[]> {
  return Promise.all(hosts.map(h => pingHost(h)));
}

/**
 * Run uptime check on all OLTs and routers
 * Called by cron every 5 minutes
 */
export async function runUptimeCheck(): Promise<{ checked: number; up: number; down: number }> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  let checked = 0;
  let up = 0;
  let down = 0;

  try {
    // Get all active OLTs
    const olts = await prisma.networkOLT.findMany({
      where: { status: 'active' },
    });

    // Get all active routers/NAS
    const routers = await prisma.router.findMany({
      where: { isActive: true },
    }).catch(() => []);

    const targets = [
      ...olts.map(o => ({ ...o, ip: o.ipAddress, type: 'OLT' })),
      ...routers.map(r => ({ ...r, ip: r.ipAddress, type: 'ROUTER' })),
    ];

    const pingResults = await pingHosts(targets.map(t => t.ip));

    const now = new Date();
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const result = pingResults[i];

      let cpuUsage: number | null = null;
      let memoryUsage: number | null = null;

      if (result.isUp) {
        try {
          const stats = target.type === 'ROUTER'
            ? await getRouterStats(target)
            : await getOltStats(target);
          cpuUsage = stats.cpuUsage;
          memoryUsage = stats.memoryUsage;
        } catch (err: any) {
          console.warn(`[Uptime Monitor] Performance stats failed for ${target.name}:`, err.message);
        }
      }

      await prisma.uptimeRecord.create({
        data: {
          deviceType: target.type,
          deviceId: target.id,
          deviceName: target.name,
          isUp: result.isUp,
          responseMs: result.responseMs ? Math.round(result.responseMs) : null,
          cpuUsage,
          memoryUsage,
          checkedAt: now,
          oltId: target.type === 'OLT' ? target.id : null,
        },
      });

      checked++;
      if (result.isUp) up++;
      else down++;
    }

    // Clean up records older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await prisma.uptimeRecord.deleteMany({
      where: { checkedAt: { lt: thirtyDaysAgo } },
    });

  } catch (error: any) {
    console.error('[Uptime Monitor] Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }

  return { checked, up, down };
}

/**
 * Get uptime stats for a device (last 24h)
 */
export async function getDeviceUptimeStats(deviceId: string, hours = 24): Promise<{
  uptime: number;      // percentage 0-100
  totalChecks: number;
  upChecks: number;
  avgLatency: number | null;
  lastSeen: Date | null;
}> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const records = await prisma.uptimeRecord.findMany({
      where: { deviceId, checkedAt: { gt: since } },
      orderBy: { checkedAt: 'desc' },
    });

    const totalChecks = records.length;
    const upChecks = records.filter(r => r.isUp).length;
    const uptime = totalChecks > 0 ? Math.round((upChecks / totalChecks) * 100) : 0;
    
    const latencies = records.filter(r => r.responseMs !== null).map(r => r.responseMs!);
    const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
    
    const lastUp = records.find(r => r.isUp);
    const lastSeen = lastUp ? lastUp.checkedAt : null;

    return { uptime, totalChecks, upChecks, avgLatency, lastSeen };
  } finally {
    await prisma.$disconnect();
  }
}
