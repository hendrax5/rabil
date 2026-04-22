import { PrismaClient } from '@prisma/client';
import { getZteUncfgOnu, registerZteOnu, RegisterOnuParams } from '../oltAuth/zte';
import { getGenieACSCredentials } from '@/app/api/settings/genieacs/route';

const prisma = new PrismaClient();

// In a real scenario, this would be fetched from a policy/rules table
// For this MVP, we map OLT ports to specific VLANs and profiles
const resolvePolicy = (oltId: string, board: string, slot: string, port: string, sn: string): Partial<RegisterOnuParams> | null => {
  // Default mapping rules:
  // We can assign a default VLAN or extract from a logic
  return {
    mode: 'bridge', // default mode
    vlan: '100',    // default internet vlan
    profile: 'UNLIMITED',
    name: `ONU_${sn.substring(sn.length - 4)}`, // Default naming convention
    onuType: '1.ZTE-Home', // default
    
    // TR069 ACS Configuration (Optional)
    // Uncomment and customize below if you want to push ACS to all ONUs
    // vlanAcs: '200', 
    // acsUrl: 'http://acs.yourdomain.com:7547',
    // acsUser: 'acsadmin',
    // acsPass: 'acspassword'
  };
};

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
              status: 'PENDING'
            }
          });
        }
        
        // 2. Process PENDING ONUs
        const pendingOnus = await prisma.discovered_onu.findMany({
          where: { oltId: olt.id, status: 'PENDING' },
          take: 5 // Limit batch size to prevent OLT overload
        });

        for (const target of pendingOnus) {
          console.log(`[ZTP] Provisioning SN: ${target.sn} on OLT ${olt.name}`);
          
          await prisma.discovered_onu.update({
            where: { id: target.id },
            data: { status: 'PROVISIONING' }
          });

          try {
            const policy = resolvePolicy(olt.id, target.board, target.slot, target.port, target.sn);
            if (!policy) {
              throw new Error('No matching provisioning policy found');
            }

            const params: RegisterOnuParams = {
              board: target.board,
              port: target.port, // could be "1/1"
              sn: target.sn,
              name: policy.name || `AUTO_${target.sn.substring(0,6)}`,
              vlan: policy.vlan || '10',
              mode: policy.mode || 'bridge',
              onuType: policy.onuType || '1.ZTE-Home',
              profile: policy.profile || 'UNLIMITED',
              vlanAcs: policy.vlanAcs,
              acsUrl: policy.acsUrl || acsCreds?.host,
              acsUser: policy.acsUser || acsCreds?.username,
              acsPass: policy.acsPass || acsCreds?.password
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
