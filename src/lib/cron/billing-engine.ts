/**
 * Auto-Suspend Billing Engine Cron
 * 
 * 1. Checks billing settings (grace period, auto-suspend flag)
 * 2. Finds expired users that should be suspended
 * 3. Sends RADIUS CoA Disconnect to their active NAS sessions
 * 4. Marks user as isolated/suspended in DB
 * 5. Sends WhatsApp notification
 */

import { PrismaClient } from '@prisma/client';
import { sendDisconnectRequest, applyProfileChangeToActiveSessions } from '../radius-coa';
import { sendWhatsAppNotification } from '../whatsapp-notifications';

const prisma = new PrismaClient();

interface SuspendResult {
  processed: number;
  suspended: number;
  errors: string[];
}

export async function autoSuspendExpiredUsers(): Promise<SuspendResult> {
  const result: SuspendResult = { processed: 0, suspended: 0, errors: [] };

  try {
    // Get billing settings
    const settings = await prisma.billingSettings.findFirst();
    if (!settings?.autoSuspend) {
      console.log('[AutoSuspend] autoSuspend is disabled in billing settings, skipping.');
      return result;
    }

    const now = new Date();
    // Grace period: user expired X days ago and still not suspended
    const graceDeadline = new Date(now);
    graceDeadline.setDate(graceDeadline.getDate() - (settings.gracePeriod || 0));

    // Find active PPPoE users who are past grace period deadline
    const expiredUsers = await prisma.pppoeUser.findMany({
      where: {
        status: 'active', // not yet suspended
        expiredAt: { lt: graceDeadline },
      },
      select: {
        id: true,
        username: true,
        expiredAt: true,
        phone: true,
        name: true,
      },
      take: 50, // Process in batches
    });

    console.log(`[AutoSuspend] Found ${expiredUsers.length} users past grace period.`);

    for (const user of expiredUsers) {
      result.processed++;
      try {
        // Find active RADIUS sessions
        const sessions = await prisma.radacct.findMany({
          where: {
            username: user.username,
            acctstoptime: null,
          },
          select: {
            nasipaddress: true,
            framedipaddress: true,
            acctsessionid: true,
          },
        });

        // Disconnect all active sessions via CoA
        let disconnected = false;
        for (const session of sessions) {
          const coaResult = await sendDisconnectRequest({
            username: user.username,
            nasIpAddress: session.nasipaddress,
            framedIpAddress: session.framedipaddress || undefined,
            acctSessionId: session.acctsessionid,
          });
          if (coaResult.success) {
            disconnected = true;
            console.log(`[AutoSuspend] Disconnected ${user.username} from NAS ${session.nasipaddress}`);
          }
        }

        // Mark as suspended in DB (status = isolated)
        await prisma.pppoeUser.update({
          where: { id: user.id },
          data: { status: 'isolated' },
        });

        // WhatsApp notification if user has phone
        if (user.phone) {
          const expDate = user.expiredAt
            ? new Date(user.expiredAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
            : '-';
          const msg = `⚠️ *Notifikasi Penangguhan Layanan*\n\nHalo ${user.name || user.username},\n\nLayanan internet Anda telah *ditangguhkan* karena masa berlaku berakhir pada ${expDate}.\n\nSilakan hubungi kami untuk perpanjangan layanan.\n\nTerima kasih 🙏`;
          await sendWhatsAppNotification(user.phone, msg).catch(() => {});
        }

        result.suspended++;
      } catch (e: any) {
        result.errors.push(`${user.username}: ${e.message}`);
        console.error(`[AutoSuspend] Error for ${user.username}:`, e);
      }
    }

    console.log(`[AutoSuspend] Done: ${result.suspended}/${result.processed} suspended, ${result.errors.length} errors`);
  } catch (error: any) {
    console.error('[AutoSuspend] Fatal error:', error);
    result.errors.push(error.message);
  }

  return result;
}

/**
 * Auto-Unsuspend after payment detected
 * Called from payment confirmation webhook
 */
export async function autoUnsuspendUser(username: string): Promise<{ success: boolean; message: string }> {
  try {
    const settings = await prisma.billingSettings.findFirst();
    if (!settings?.autoUnsuspend) {
      return { success: true, message: 'Auto-unsuspend disabled, manual action required.' };
    }

    const user = await prisma.pppoeUser.findFirst({
      where: { username },
      select: { id: true, name: true, phone: true, profile: true },
    });

    if (!user) return { success: false, message: `User ${username} not found` };

    // Re-activate in DB & Reset quota
    await prisma.pppoeUser.update({
      where: { id: user.id },
      data: { 
        status: 'active',
        quotaUsedBytes: 0,
        quotaLastReset: new Date(),
      },
    });

    // WhatsApp activation notification
    if (user.phone) {
      const msg = `✅ *Layanan Internet Aktif*\n\nHalo ${user.name || username},\n\nLayanan internet Anda telah *diaktifkan kembali* setelah pembayaran terverifikasi.\n\nSilakan sambungkan perangkat Anda.\n\nTerima kasih telah memperpanjang layanan! 🙏`;
      await sendWhatsAppNotification(user.phone, msg).catch(() => {});
    }

    console.log(`[AutoUnsuspend] User ${username} reactivated.`);
    return { success: true, message: `User ${username} successfully unsuspended` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Scan all OLTs for ONU alarms (LOS, offline, weak signal)
 * Called by cron every 5 minutes
 */
export async function scanOnuAlarms(): Promise<{ scanned: number; newAlarms: number }> {
  let scanned = 0;
  let newAlarms = 0;

  try {
    const activeOlts = await prisma.networkOLT.findMany({
      where: {
        status: 'active',
        username: { not: null },
        password: { not: null },
      },
    });

    const { withOlt } = await import('../olt');

    for (const olt of activeOlts) {
      if (!olt.username || !olt.password) continue;

      try {
        const alarms = await withOlt(
          {
            host: olt.ipAddress,
            port: olt.port || 22,
            username: olt.username,
            password: olt.password,
            protocol: (olt.connection as any) || 'ssh',
            vendor: (olt.vendor as any) || 'zte',
          },
          async (driver) => driver.checkAlarms()
        );

        scanned++;

        // Mark old active alarms as resolved
        await prisma.onuAlarm.updateMany({
          where: { oltId: olt.id, resolved: false },
          data: { resolved: true, resolvedAt: new Date() },
        });

        // Create new alarm records
        if (alarms.length > 0) {
          await prisma.onuAlarm.createMany({
            data: alarms.map(a => ({
              oltId: olt.id,
              onuId: a.onuId,
              sn: a.sn,
              board: a.board,
              port: a.port,
              alarmType: a.alarmType,
              rxPower: a.rxPower,
              threshold: a.threshold ?? null,
              description: a.description,
              resolved: false,
            })),
          });
          newAlarms += alarms.length;

          // Alert for LOS alarms via WhatsApp to admin
          const losAlarms = alarms.filter(a => a.alarmType === 'LOS');
          if (losAlarms.length > 0) {
            const msg = `🚨 *OLT ALARM — ${olt.name}*\n\n${losAlarms.length} ONU Loss of Signal:\n` +
              losAlarms.slice(0, 5).map(a => `• ${a.sn} (${a.board}/${a.port})`).join('\n') +
              (losAlarms.length > 5 ? `\n...+${losAlarms.length - 5} lainnya` : '') +
              `\n\n⏰ ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`;
            await sendWhatsAppNotification('admin', msg).catch(() => {});
          }
        }
      } catch (e: any) {
        console.error(`[ONU Alarm Scan] OLT ${olt.name} error:`, e.message);
      }
    }
  } catch (e: any) {
    console.error('[ONU Alarm Scan] Fatal:', e.message);
  }

  return { scanned, newAlarms };
}

/**
 * Check bandwidth quota usage for active PPPoE users and throttle if exceeded FUP threshold
 * Called by cron every 15 minutes
 */
export async function runFupQuotaCheck(): Promise<{ checked: number; throttled: number; restored: number; errors: string[] }> {
  const result = { checked: 0, throttled: 0, restored: 0, errors: [] as string[] };
  
  try {
    const users = await prisma.pppoeUser.findMany({
      where: { status: 'active' },
      include: { profile: true },
    });

    for (const user of users) {
      if (!user.profile.quotaGB) continue; // No FUP limit configured for this profile
      
      result.checked++;
      try {
        const lastReset = user.quotaLastReset || user.createdAt;
        
        // Sum bandwidth usage from radacct
        const usage = await prisma.radacct.aggregate({
          _sum: {
            acctinputoctets: true,
            acctoutputoctets: true,
          },
          where: {
            username: user.username,
            acctstarttime: { gte: lastReset },
          },
        });

        const totalBytes = BigInt(usage._sum.acctinputoctets || 0) + BigInt(usage._sum.acctoutputoctets || 0);
        
        // Update quotaUsedBytes in DB
        await prisma.pppoeUser.update({
          where: { id: user.id },
          data: { quotaUsedBytes: totalBytes },
        });

        const limitBytes = BigInt(user.profile.quotaGB) * BigInt(1024) * BigInt(1024) * BigInt(1024);
        const isExceeded = totalBytes >= limitBytes;

        // Get user's current RADIUS group to see if they are already throttled
        const radGroup = await prisma.radusergroup.findFirst({
          where: { username: user.username },
        });

        if (isExceeded && user.profile.fupGroupName) {
          // If exceeded but not yet throttled
          if (radGroup?.groupname !== user.profile.fupGroupName) {
            console.log(`[FUP] User ${user.username} exceeded quota (${(Number(totalBytes) / 1e9).toFixed(2)} GB / ${user.profile.quotaGB} GB). Throttling...`);
            
            // 1. Update RADIUS group to FUP group
            await prisma.$executeRaw`DELETE FROM radusergroup WHERE username = ${user.username}`;
            await prisma.$executeRaw`
              INSERT INTO radusergroup (username, groupname, priority)
              VALUES (${user.username}, ${user.profile.fupGroupName}, 1)
            `;

            // 2. Fetch speed limits of the FUP group if it exists in PPPoE profiles
            const fupProfile = await prisma.pppoeProfile.findFirst({
              where: { groupName: user.profile.fupGroupName },
            });

            // 3. Find active sessions and apply CoA
            const sessions = await prisma.radacct.findMany({
              where: { username: user.username, acctstoptime: null },
              select: { acctsessionid: true, nasipaddress: true, framedipaddress: true },
            });

            for (const session of sessions) {
              const router = await prisma.router.findFirst({
                where: { OR: [{ nasname: session.nasipaddress }, { ipAddress: session.nasipaddress }] },
                select: { secret: true },
              });

              await applyProfileChangeToActiveSessions(
                user.username,
                [{
                  acctSessionId: session.acctsessionid,
                  nasIpAddress: session.nasipaddress,
                  framedIpAddress: session.framedipaddress || undefined,
                  nasSecret: router?.secret || undefined,
                }],
                {
                  groupName: user.profile.fupGroupName,
                  downloadSpeed: fupProfile?.downloadSpeed || undefined,
                  uploadSpeed: fupProfile?.uploadSpeed || undefined,
                },
                { fallbackToDisconnect: true, secret: router?.secret || undefined }
              );
            }

            // 4. WhatsApp notification
            if (user.phone) {
              const msg = `⚠️ *Notifikasi Batas Pemakaian Wajar (FUP)*\n\nHalo ${user.name || user.username},\n\nPemakaian internet Anda telah melebihi batas wajar (${user.profile.quotaGB} GB).\n\nKecepatan internet Anda disesuaikan sementara. Kuota akan di-reset pada siklus billing berikutnya.\n\nTerima kasih atas pengertiannya 🙏`;
              await sendWhatsAppNotification(user.phone, msg).catch(() => {});
            }

            result.throttled++;
          }
        } else {
          // If NOT exceeded but currently throttled (should restore speed)
          if (radGroup?.groupname === user.profile.fupGroupName) {
            console.log(`[FUP] User ${user.username} usage is below quota. Restoring original profile speed...`);
            
            // 1. Restore RADIUS group
            await prisma.$executeRaw`DELETE FROM radusergroup WHERE username = ${user.username}`;
            await prisma.$executeRaw`
              INSERT INTO radusergroup (username, groupname, priority)
              VALUES (${user.username}, ${user.profile.groupName}, 1)
            `;

            // 2. Find active sessions and apply CoA to restore speed
            const sessions = await prisma.radacct.findMany({
              where: { username: user.username, acctstoptime: null },
              select: { acctsessionid: true, nasipaddress: true, framedipaddress: true },
            });

            for (const session of sessions) {
              const router = await prisma.router.findFirst({
                where: { OR: [{ nasname: session.nasipaddress }, { ipAddress: session.nasipaddress }] },
                select: { secret: true },
              });

              await applyProfileChangeToActiveSessions(
                user.username,
                [{
                  acctSessionId: session.acctsessionid,
                  nasIpAddress: session.nasipaddress,
                  framedIpAddress: session.framedipaddress || undefined,
                  nasSecret: router?.secret || undefined,
                }],
                {
                  groupName: user.profile.groupName,
                  downloadSpeed: user.profile.downloadSpeed,
                  uploadSpeed: user.profile.uploadSpeed,
                },
                { fallbackToDisconnect: true, secret: router?.secret || undefined }
              );
            }

            // 3. WhatsApp notification
            if (user.phone) {
              const msg = `✅ *Notifikasi Pemulihan Kecepatan*\n\nHalo ${user.name || user.username},\n\nKecepatan internet Anda telah dikembalikan ke normal (${user.profile.downloadSpeed} Mbps) setelah kuota di-reset.\n\nTerima kasih telah menggunakan layanan kami 🙏`;
              await sendWhatsAppNotification(user.phone, msg).catch(() => {});
            }

            result.restored++;
          }
        }
      } catch (err: any) {
        result.errors.push(`${user.username}: ${err.message}`);
        console.error(`[FUP] Error checking ${user.username}:`, err);
      }
    }
  } catch (error: any) {
    result.errors.push(error.message);
    console.error('[FUP] Fatal error during quota check:', error);
  }

  return result;
}

/**
 * Reset monthly bandwidth quotas for active users based on their billing cycle
 * Called by cron daily at midnight
 */
export async function resetMonthlyQuotas(): Promise<{ resetCount: number; errors: string[] }> {
  const result = { resetCount: 0, errors: [] as string[] };
  
  try {
    const settings = await prisma.billingSettings.findFirst();
    const billingType = settings?.billingType || 'fixed';
    const billingDay = settings?.billingDay || 1;
    
    const now = new Date();
    const todayDay = now.getDate();
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

    let usersToReset: any[] = [];

    if (billingType === 'fixed') {
      // If today is the fixed billing day, we reset everyone
      if (todayDay === billingDay) {
        usersToReset = await prisma.pppoeUser.findMany({
          where: {
            status: 'active',
            quotaLastReset: { lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()) }, // not reset today
          },
          include: { profile: true },
        });
      }
    } else {
      // Anniversary: Reset users whose quota was last reset > 30 days ago
      usersToReset = await prisma.pppoeUser.findMany({
        where: {
          status: 'active',
          quotaLastReset: { lt: oneMonthAgo },
        },
        include: { profile: true },
      });
    }

    console.log(`[FUP Reset] Found ${usersToReset.length} users to reset quota.`);

    for (const user of usersToReset) {
      try {
        // 1. Reset quota in DB
        await prisma.pppoeUser.update({
          where: { id: user.id },
          data: {
            quotaUsedBytes: 0,
            quotaLastReset: new Date(),
          },
        });

        // 2. If they were throttled, restore their group
        const radGroup = await prisma.radusergroup.findFirst({
          where: { username: user.username },
        });

        if (radGroup?.groupname === user.profile.fupGroupName) {
          await prisma.$executeRaw`DELETE FROM radusergroup WHERE username = ${user.username}`;
          await prisma.$executeRaw`
            INSERT INTO radusergroup (username, groupname, priority)
            VALUES (${user.username}, ${user.profile.groupName}, 1)
          `;

          // Apply CoA to restore speed immediately
          const sessions = await prisma.radacct.findMany({
            where: { username: user.username, acctstoptime: null },
            select: { acctsessionid: true, nasipaddress: true, framedipaddress: true },
          });

          for (const session of sessions) {
            const router = await prisma.router.findFirst({
              where: { OR: [{ nasname: session.nasipaddress }, { ipAddress: session.nasipaddress }] },
              select: { secret: true },
            });

            await applyProfileChangeToActiveSessions(
              user.username,
              [{
                acctSessionId: session.acctsessionid,
                nasIpAddress: session.nasipaddress,
                framedIpAddress: session.framedipaddress || undefined,
                nasSecret: router?.secret || undefined,
              }],
              {
                groupName: user.profile.groupName,
                downloadSpeed: user.profile.downloadSpeed,
                uploadSpeed: user.profile.uploadSpeed,
              },
              { fallbackToDisconnect: true, secret: router?.secret || undefined }
            );
          }

          // WhatsApp notification
          if (user.phone) {
            const msg = `✅ *Notifikasi Kuota Bulanan di-Reset*\n\nHalo ${user.name || user.username},\n\nKuota pemakaian internet Anda telah di-reset untuk bulan ini. Kecepatan internet telah kembali normal (${user.profile.downloadSpeed} Mbps).\n\nTerima kasih 🙏`;
            await sendWhatsAppNotification(user.phone, msg).catch(() => {});
          }
        }

        result.resetCount++;
      } catch (err: any) {
        result.errors.push(`${user.username}: ${err.message}`);
        console.error(`[FUP Reset] Error resetting ${user.username}:`, err);
      }
    }
  } catch (error: any) {
    result.errors.push(error.message);
    console.error('[FUP Reset] Fatal error:', error);
  }

  return result;
}

