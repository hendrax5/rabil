import { PrismaClient } from '@prisma/client';
import { getZteUncfgOnu, registerZteOnu, RegisterOnuParams } from '../oltAuth/zte';
import { getGenieACSCredentials } from '@/app/api/settings/genieacs/route';

const prisma = new PrismaClient();

// Removed resolvePolicy - parameters are now provided via UI binding

export async function runZtpOrchestrator() {
  console.log('[ZTP ORCHESTRATOR] Starting discovery loop...');
  let processedCount = 0;
  
  // Fetch global ACS credentials once per loop
  const acsCreds = await getGenieACSCredentials();
  
  try {
    const activeOlts = await prisma.networkOLT.findMany({
      where: { status: 'active' }
    });

    for (const olt of activeOlts) {
      if (!olt.username || !olt.password) continue;

      const connStr = {
        host: olt.ipAddress,
        port: olt.port || 22,
        username: olt.username,
        password: olt.password,
        protocol: olt.connection,
        readyTimeout: 10000
      };

      try {
        console.log(`[ZTP] Fetching unconfigured ONUs for OLT ${olt.name}...`);
        const uncfgOnus = await getZteUncfgOnu(connStr);
        
        // 1. Sync discovered ONUs to DB
        for (const onu of uncfgOnus) {
          // ONU format usually comes as board: "1/1/1", we split it or use as is
          // getZteUncfgOnu returns { board: "1", port: "1/1", sn: "ZTEGC123...", state: "..." }
          // The structure might slightly vary, but we save it
          
          await prisma.discovered_onu.upsert({
            where: {
              oltId_sn: {
                oltId: olt.id,
                sn: onu.sn
              }
            },
            update: {
              updatedAt: new Date()
            },
            create: {
              oltId: olt.id,
              sn: onu.sn,
              board: onu.board,
              slot: '1', // fallback
              port: onu.port,
              status: 'DISCOVERED'
            }
          });
        }
        
        // 2. Process READY ONUs (ONUs that have been bound by the admin)
        const pendingOnus = await prisma.discovered_onu.findMany({
          where: { oltId: olt.id, status: 'READY' },
          take: 5 // Limit batch size to prevent OLT overload
        });

        for (const target of pendingOnus) {
          console.log(`[ZTP] Provisioning SN: ${target.sn} on OLT ${olt.name}`);
          
          await prisma.discovered_onu.update({
            where: { id: target.id },
            data: { status: 'PROVISIONING' }
          });

          try {
            const params: RegisterOnuParams = {
              board: target.board,
              port: target.port, 
              sn: target.sn,
              name: `ONU_${target.sn.substring(target.sn.length - 4)}`, // Basic default, could be updated if we had a name field
              vlan: target.vlan || '10',
              mode: (target.mode as any) || 'bridge',
              onuType: '1.ZTE-Home',
              profile: target.profile || 'UNLIMITED',
              vlanAcs: undefined, // Usually null or mapped if we had it
              acsUrl: acsCreds?.host,
              acsUser: acsCreds?.username,
              acsPass: acsCreds?.password,
              pppoeUser: target.pppoeUser || undefined,
              pppoePass: target.pppoePass || undefined
            };

            const result = await registerZteOnu(connStr, params);
            
            // Success
            await prisma.discovered_onu.update({
              where: { id: target.id },
              data: { status: 'SUCCESS' }
            });

            await prisma.provision_log.create({
              data: {
                oltId: olt.id,
                sn: target.sn,
                action: 'REGISTER',
                status: 'SUCCESS',
                message: result
              }
            });
            
            processedCount++;

          } catch (provError: any) {
            console.error(`[ZTP] Failed to provision ${target.sn}:`, provError);
            
            await prisma.discovered_onu.update({
              where: { id: target.id },
              data: { status: 'FAILED' }
            });

            await prisma.provision_log.create({
              data: {
                oltId: olt.id,
                sn: target.sn,
                action: 'REGISTER',
                status: 'FAILED',
                message: provError.message || String(provError)
              }
            });
          }
        }
        
      } catch (e: any) {
        console.error(`[ZTP] OLT ${olt.name} loop error:`, e.message);
      }
    }
  } catch (error) {
    console.error('[ZTP] Orchestrator fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
  
  return processedCount;
}
