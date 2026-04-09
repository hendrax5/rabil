import { PrismaClient } from '@prisma/client'
import { getZteOnuTypes, getZteUncfgOnu } from '../oltAuth/zte'

const prisma = new PrismaClient()

export async function syncOltData() {
  const startTime = Date.now()
  let synced = 0
  let failed = 0
  const errors: string[] = []

  try {
    // Cari semua OLT yang aktif
    const activeOlts = await prisma.networkOLT.findMany({
      where: {
        status: 'active',
      }
    })

    for (const olt of activeOlts) {
      if (!olt.username || !olt.password) {
        errors.push(`OLT ${olt.name} (${olt.ipAddress}) skipped: Missing credentials`)
        failed++
        continue
      }

      const connStr = {
        host: olt.ipAddress,
        port: olt.port || 22,
        username: olt.username,
        password: olt.password,
        protocol: olt.connection,
        readyTimeout: 10000
      }

      try {
        console.log(`[OLT SYNC] Syncing data for OLT ${olt.name}...`)
        
        let onuTypes: string[] = []
        let uncfgOnus: any[] = []

        if (olt.vendor === 'zte') {
          // Fetch Unconfigured ONUs and Types directly from OLT
          uncfgOnus = await getZteUncfgOnu(connStr)
          onuTypes = await getZteOnuTypes(connStr)
        } else {
          errors.push(`OLT ${olt.name} failed: Vendor ${olt.vendor} not supported yet`)
          failed++
          continue
        }

        // Simpan JSON Cache ke Database
        // @ts-ignore
        await prisma.networkOLT.update({
          where: { id: olt.id },
          data: {
            uncfgOnus: uncfgOnus,
            onuTypes: onuTypes,
            lastSync: new Date()
          }
        })

        console.log(`[OLT SYNC] Successfully synced ${olt.name}. Unconfigured ONUs: ${uncfgOnus.length}, Types: ${onuTypes.length}`)
        synced++

      } catch (e: any) {
        console.error(`[OLT SYNC] Failed for OLT ${olt.name}:`, e)
        errors.push(`OLT ${olt.name} sync error: ${e.message}`)
        failed++
      }
    }

    const result = {
      success: true,
      synced,
      failed,
      errors: errors.length > 0 ? errors : undefined
    }

    // Save success history to DB
    await prisma.cronHistory.create({
      data: {
        id: 'olt_job_' + Date.now().toString(),
        jobType: 'olt_sync',
        status: 'success',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        duration: Date.now() - startTime,
        result: JSON.stringify(result)
      }
    })

    return result

  } catch (error: any) {
    console.error('[OLT SYNC] Fatal Error:', error)
    
    // Save error history
    await prisma.cronHistory.create({
      data: {
        id: 'olt_err_' + Date.now().toString(),
        jobType: 'olt_sync',
        status: 'error',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        duration: Date.now() - startTime,
        error: error.message
      }
    })

    return {
      success: false,
      error: error.message
    }
  } finally {
    await prisma.$disconnect()
  }
}
