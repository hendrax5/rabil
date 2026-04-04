import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { prisma } from '@/lib/prisma';
const RouterOSAPI = require('node-routeros').RouterOSAPI;

const execAsync = promisify(exec);

/**
 * Helper function to check if IP is private
 */
function isPrivateIP(ip: string): boolean {
  return ip.startsWith('192.168.') || 
         ip.startsWith('10.') || 
         ip.startsWith('172.16.') || 
         ip.startsWith('172.17.') || 
         ip.startsWith('172.18.') || 
         ip.startsWith('172.19.') || 
         ip.startsWith('172.2') || 
         ip.startsWith('172.30.') || 
         ip.startsWith('172.31.') ||
         ip.startsWith('127.');
}

/**
 * Helper function to check if IP is reachable via ping
 */
async function canPing(ip: string): Promise<boolean> {
  try {
    await execAsync(`ping -c 1 -W 2 ${ip}`, { timeout: 3000 });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Helper function to detect public IP from MikroTik
 */
async function detectPublicIp(router: any): Promise<string | null> {
  try {
    const conn = new RouterOSAPI({
      host: router.ipAddress,
      user: router.username,
      password: router.password,
      port: router.port || 8728,
      timeout: 10,
      tls: false,
    });

    await conn.connect();
    let publicIp: string | null = null;

    // Method 1: Check IP Cloud (DDNS)
    try {
      const cloud = await conn.write('/ip/cloud/print');
      if (cloud && cloud[0] && cloud[0]['public-address']) {
        publicIp = cloud[0]['public-address'];
      }
    } catch (e) {
      // IP Cloud not available
    }

    // Method 2: Check PPPoE interface
    if (!publicIp) {
      try {
        const pppoe = await conn.write('/interface/pppoe-client/print');
        if (pppoe && pppoe.length > 0) {
          for (const iface of pppoe) {
            if (iface.running === 'true' || iface.running === true) {
              const pppIp = await conn.write('/ip/address/print', [
                '?interface=' + iface.name,
              ]);
              if (pppIp && pppIp[0] && pppIp[0].address) {
                publicIp = pppIp[0].address.split('/')[0];
                break;
              }
            }
          }
        }
      } catch (e) {
        // PPPoE check failed
      }
    }

    // Method 3: Get all IPs and find non-private one
    if (!publicIp) {
      try {
        const allIps = await conn.write('/ip/address/print');
        for (const ipAddr of allIps) {
          const ip = ipAddr.address?.split('/')[0];
          if (ip && !ip.startsWith('192.168.') && !ip.startsWith('10.') && 
              !ip.startsWith('172.16.') && !ip.startsWith('127.')) {
            publicIp = ip;
            break;
          }
        }
      } catch (e) {
        // All IPs check failed
      }
    }

    conn.close();
    return publicIp;
  } catch (error) {
    console.error(`Failed to detect public IP for ${router.name}:`, error);
    return null;
  }
}

/**
 * API untuk mendeteksi IP NAS/MikroTik yang mencoba koneksi ke RADIUS
 * Berguna untuk mencari IP source dari MikroTik yang terhubung via VPN
 * Otomatis mendeteksi IP public jika router menggunakan IP public
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'unknown-clients') {
      // Get unknown clients from FreeRADIUS log
      // These are clients trying to connect but not registered in NAS table
      try {
        const { stdout } = await execAsync(
          `grep -i "unknown client" /var/log/freeradius/radius.log | tail -50 | grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+' | sort -u`,
          { timeout: 5000 }
        );
        
        const unknownIps = stdout.trim().split('\n').filter(ip => ip);
        
        // Get registered NAS IPs for comparison
        const registeredNas = await prisma.router.findMany({
          select: { 
            id: true,
            nasname: true, 
            name: true,
            ipAddress: true,
            username: true,
            password: true,
            port: true,
          },
        });
        const registeredIps = new Set(registeredNas.map((n: any) => n.nasname));
        
        // Filter out already registered IPs
        const newUnknownIps = unknownIps.filter(ip => !registeredIps.has(ip));
        
        // Check if any registered router needs public IP update
        const routersNeedUpdate: any[] = [];
        for (const router of registeredNas) {
          const nasIp = router.nasname;
          
          // SKIP: If nasname is already public IP and can ping
          if (!isPrivateIP(nasIp)) {
            const canReach = await canPing(nasIp);
            if (canReach) {
              console.log(`[Detect NAS] Skip ${router.name} - Already using public IP ${nasIp} and reachable`);
              continue; // Skip this router, no need to detect
            }
          }
          
          // ONLY process routers with private IP OR unreachable public IP
          if (isPrivateIP(nasIp)) {
            // Try to detect public IP
            const publicIp = await detectPublicIp(router);
            if (publicIp && publicIp !== nasIp) {
              // Check if this public IP is in unknown list
              if (newUnknownIps.includes(publicIp)) {
                routersNeedUpdate.push({
                  id: router.id,
                  name: router.name,
                  currentNasIp: nasIp,
                  detectedPublicIp: publicIp,
                  suggestion: `Update nasname from ${nasIp} to ${publicIp}`,
                });
              }
            }
          }
        }
        
        return NextResponse.json({
          success: true,
          unknownClients: newUnknownIps,
          registeredClients: registeredNas.map((n: any) => ({ 
            id: n.id,
            ip: n.nasname, 
            name: n.name 
          })),
          routersNeedUpdate,
          message: newUnknownIps.length > 0 
            ? `Found ${newUnknownIps.length} unknown client(s) trying to connect`
            : 'No unknown clients detected',
          hint: routersNeedUpdate.length > 0 
            ? `Found ${routersNeedUpdate.length} router(s) that may need public IP update`
            : null,
        });
      } catch (error) {
        console.error('Failed to read radius log:', error);
        return NextResponse.json({
          success: false,
          unknownClients: [],
          registeredClients: [],
          routersNeedUpdate: [],
          error: 'Failed to read FreeRADIUS log',
        });
      }
    }

    if (action === 'recent-connections') {
      // Get recent auth attempts from radpostauth
      const recentAuth = await prisma.$queryRaw<any[]>`
        SELECT DISTINCT 
          username,
          nasipaddress,
          reply,
          authdate
        FROM radpostauth 
        ORDER BY authdate DESC 
        LIMIT 20
      `;
      
      return NextResponse.json({
        success: true,
        recentConnections: recentAuth,
      });
    }

    if (action === 'auto-detect-public-ip') {
      // Auto-detect and update routers with public IP
      const routers = await prisma.router.findMany({
        select: { 
          id: true,
          nasname: true, 
          name: true,
          ipAddress: true,
          username: true,
          password: true,
          port: true,
        },
      });

      const updates: any[] = [];
      const skipped: any[] = [];
      
      for (const router of routers) {
        const nasIp = router.nasname;
        
        // SKIP: If nasname is already public IP and can ping
        if (!isPrivateIP(nasIp)) {
          const canReach = await canPing(nasIp);
          if (canReach) {
            console.log(`[Auto-detect] Skip ${router.name} - Already using public IP ${nasIp} and reachable`);
            skipped.push({
              id: router.id,
              name: router.name,
              nasIp: nasIp,
              reason: 'Already using public IP and reachable',
            });
            continue; // Skip this router
          }
        }
        
        // ONLY process routers with private IP
        if (isPrivateIP(nasIp)) {
          // Try to detect public IP
          const publicIp = await detectPublicIp(router);
          if (publicIp && publicIp !== nasIp) {
            // Verify the detected public IP is reachable
            const canReach = await canPing(publicIp);
            if (canReach) {
              // Update nasname to public IP
              await prisma.router.update({
                where: { id: router.id },
                data: { nasname: publicIp },
              });
              
              updates.push({
                id: router.id,
                name: router.name,
                oldNasIp: nasIp,
                newNasIp: publicIp,
                status: 'updated',
              });
            } else {
              skipped.push({
                id: router.id,
                name: router.name,
                nasIp: nasIp,
                detectedPublicIp: publicIp,
                reason: 'Detected public IP is not reachable from VPS',
              });
            }
          } else {
            skipped.push({
              id: router.id,
              name: router.name,
              nasIp: nasIp,
              reason: 'Could not detect public IP from router',
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        updates,
        skipped,
        message: updates.length > 0 
          ? `Updated ${updates.length} router(s) with public IP`
          : 'No routers needed public IP update',
        summary: {
          total: routers.length,
          updated: updates.length,
          skipped: skipped.length,
        },
      });
    }

    // Default: Return instructions
    return NextResponse.json({
      success: true,
      message: 'NAS Detection API',
      usage: {
        'unknown-clients': 'GET /api/network/detect-nas?action=unknown-clients - Find unknown clients from FreeRADIUS log',
        'recent-connections': 'GET /api/network/detect-nas?action=recent-connections - Get recent auth attempts',
        'auto-detect-public-ip': 'GET /api/network/detect-nas?action=auto-detect-public-ip - Auto-detect and update routers with public IP',
      },
      tip: 'Untuk MikroTik via VPN, IP yang terdeteksi adalah IP VPN atau IP publik source internet. Gunakan auto-detect-public-ip untuk otomatis update nasname dengan IP public.',
    });

  } catch (error) {
    console.error('Detect NAS error:', error);
    return NextResponse.json({ 
      error: 'Failed to detect NAS',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
