import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withOlt } from '@/lib/olt';

/**
 * GET /api/network/olts/[id]/alarms
 * Fetch live ONU alarms: LOS, offline, weak signal
 * 
 * Query params:
 *   ?refresh=true  — force live fetch from OLT
 *   ?resolved=true — include resolved alarms from DB
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const forceRefresh = searchParams.get('refresh') === 'true';
  const includeResolved = searchParams.get('resolved') === 'true';

  try {
    const olt = await prisma.networkOLT.findUnique({ where: { id } });
    if (!olt) {
      return NextResponse.json({ error: 'OLT not found' }, { status: 404 });
    }

    if (!olt.username || !olt.password) {
      return NextResponse.json({ success: false, alarms: [], error: 'No OLT credentials' });
    }

    // Fetch live alarms from OLT
    const liveAlarms = await withOlt(
      {
        host: olt.ipAddress,
        port: olt.port || 22,
        username: olt.username,
        password: olt.password,
        protocol: (olt.connection as 'ssh' | 'telnet') || 'ssh',
        vendor: (olt.vendor as any) || 'zte',
      },
      async (driver) => driver.checkAlarms()
    );

    // Sync alarms to DB (create new ones, mark resolved ones)
    const now = new Date();
    const activeSnSet = new Set(liveAlarms.map(a => a.sn));

    // Mark previously active alarms as resolved if no longer in live list
    await prisma.$executeRaw`
      UPDATE onu_alarms 
      SET resolved = true, resolvedAt = ${now}
      WHERE oltId = ${id} AND resolved = false
    `;

    // Upsert active alarms
    for (const alarm of liveAlarms) {
      await prisma.$executeRaw`
        INSERT INTO onu_alarms (id, oltId, onuId, sn, alarmType, rxPower, threshold, description, resolved, createdAt)
        VALUES (UUID(), ${id}, ${alarm.onuId}, ${alarm.sn}, ${alarm.alarmType}, ${alarm.rxPower}, ${alarm.threshold ?? null}, ${alarm.description}, false, ${now})
        ON DUPLICATE KEY UPDATE 
          resolved = false,
          resolvedAt = NULL,
          rxPower = ${alarm.rxPower},
          description = ${alarm.description}
      `;
    }

    // Send WhatsApp alert for new critical alarms (LOS only, max 3 per run)
    const losAlarms = liveAlarms.filter(a => a.alarmType === 'LOS');
    if (losAlarms.length > 0) {
      try {
        const { sendWhatsAppNotification } = await import('@/lib/whatsapp-notifications');
        const msg = `🚨 *OLT ALARM* — ${olt.name}\n\n` +
          `⚠️ ${losAlarms.length} ONU mengalami Loss of Signal:\n` +
          losAlarms.slice(0, 5).map(a => `• SN: ${a.sn} | Port: ${a.board}/${a.port}`).join('\n') +
          (losAlarms.length > 5 ? `\n...dan ${losAlarms.length - 5} ONU lainnya` : '') +
          `\n\n🕐 ${new Date().toLocaleString('id-ID')}`;

        await sendWhatsAppNotification('admin', msg);
      } catch (e) {
        // WhatsApp notification is non-critical
        console.warn('[ONU Alarms] WhatsApp notification failed:', e);
      }
    }

    return NextResponse.json({
      success: true,
      lastSync: now,
      summary: {
        total: liveAlarms.length,
        los: liveAlarms.filter(a => a.alarmType === 'LOS').length,
        offline: liveAlarms.filter(a => a.alarmType === 'OFFLINE').length,
        weakSignal: liveAlarms.filter(a => a.alarmType === 'WEAK_SIGNAL').length,
      },
      alarms: liveAlarms,
    });

  } catch (error: any) {
    console.error('[ONU Alarms] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch alarms',
      alarms: [],
    }, { status: 500 });
  }
}
