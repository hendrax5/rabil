import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { applyProfileChangeToActiveSessions, isRadclientAvailable } from '@/lib/radius-coa';
import { RouterOSAPI } from 'node-routeros';

const prisma = new PrismaClient();

// GET - List all PPPoE profiles
export async function GET() {
  try {
    const profiles = await prisma.pppoeProfile.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      profiles,
      count: profiles.length,
    });
  } catch (error) {
    console.error('Get PPPoE profiles error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new PPPoE profile
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      groupName,
      price,
      downloadSpeed,
      uploadSpeed,
      validityValue,
      validityUnit,
    } = body;

    // Validate required fields
    if (!name || !groupName || !price || !downloadSpeed || !uploadSpeed || !validityValue || !validityUnit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if groupName already exists
    const existingProfile = await prisma.pppoeProfile.findUnique({
      where: { groupName },
    });

    if (existingProfile) {
      return NextResponse.json(
        { error: `Group name "${groupName}" already exists. Please use a unique group name.` },
        { status: 400 }
      );
    }

    // Create profile
    const profile = await prisma.pppoeProfile.create({
      data: {
        id: crypto.randomUUID(),
        name,
        description: description || null,
        groupName,
        price: parseInt(price),
        downloadSpeed: parseInt(downloadSpeed),
        uploadSpeed: parseInt(uploadSpeed),
        validityValue: parseInt(validityValue),
        validityUnit,
        isActive: true,
      },
    });

    // Sync to FreeRADIUS radgroupreply
    try {
      // Format rate limit: downloadM/uploadM (e.g. "10M/10M")
      const rateLimit = `${downloadSpeed}M/${uploadSpeed}M`;

      // Create Mikrotik-Group attribute (maps to MikroTik PPP profile)
      await prisma.radgroupreply.create({
        data: {
          groupname: groupName,
          attribute: 'Mikrotik-Group',
          op: ':=',
          value: groupName, // Must match PPP profile name in MikroTik
        },
      });

      // Create Mikrotik-Rate-Limit attribute (bandwidth limitation)
      await prisma.radgroupreply.create({
        data: {
          groupname: groupName,
          attribute: 'Mikrotik-Rate-Limit',
          op: ':=',
          value: rateLimit,
        },
      });

      // Mark as synced
      await prisma.pppoeProfile.update({
        where: { id: profile.id },
        data: {
          syncedToRadius: true,
          lastSyncAt: new Date(),
        },
      });

      // Synchronize profile to all active Mikrotik NAS
      try {
        const routers = await prisma.router.findMany({
          where: { isActive: true, type: 'mikrotik' },
        });

        const syncTasks = routers.map(async (router) => {
          let conn: RouterOSAPI | null = null;
          try {
            const apiPort = router.port || router.apiPort || 8728;
            conn = new RouterOSAPI({ host: router.ipAddress, user: router.username, password: router.password, port: apiPort, timeout: 15 });
            await conn.connect();
            conn.on('error', () => { /* ignore */ });

            const allProfiles = await conn.write('/ppp/profile/print');
            const exists = allProfiles.find((p: any) => p.name === groupName);
            if (!exists) {
              await conn.write('/ppp/profile/add', [
                `=name=${groupName}`,
                `=rate-limit=${rateLimit}`,
                `=comment=Managed by NexaRadius`,
              ]);
            } else {
              await conn.write('/ppp/profile/set', [
                `=.id=${exists['.id']}`,
                `=rate-limit=${rateLimit}`,
                `=comment=Managed by NexaRadius`,
              ]);
            }
          } catch (e: any) {
             console.warn(`[Profile Sync] Failed to sync to ${router.name}:`, e.message);
          } finally {
             if (conn) conn.close();
          }
        });
        await Promise.allSettled(syncTasks);
      } catch (routerErr) {
        console.warn('Failed to fetch routers for profile sync:', routerErr);
      }

      return NextResponse.json({
        success: true,
        profile: {
          ...profile,
          syncedToRadius: true,
        },
      }, { status: 201 });
    } catch (syncError: any) {
      console.error('RADIUS sync error:', syncError);
      // Profile created but sync failed
      return NextResponse.json({
        success: true,
        profile,
        warning: 'Profile created but RADIUS sync failed',
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Create PPPoE profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update PPPoE profile
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      description,
      groupName,
      price,
      downloadSpeed,
      uploadSpeed,
      validityValue,
      validityUnit,
      isActive,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
    }

    const currentProfile = await prisma.pppoeProfile.findUnique({ where: { id } });
    if (!currentProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if groupName changed and new one already exists
    if (groupName && groupName !== currentProfile.groupName) {
      const existingProfile = await prisma.pppoeProfile.findUnique({
        where: { groupName },
      });

      if (existingProfile) {
        return NextResponse.json(
          { error: `Group name "${groupName}" already exists.` },
          { status: 400 }
        );
      }
    }

    // Update profile
    const profile = await prisma.pppoeProfile.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(groupName && { groupName }),
        ...(price && { price: parseInt(price) }),
        ...(downloadSpeed && { downloadSpeed: parseInt(downloadSpeed) }),
        ...(uploadSpeed && { uploadSpeed: parseInt(uploadSpeed) }),
        ...(validityValue && { validityValue: parseInt(validityValue) }),
        ...(validityUnit && { validityUnit }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // Re-sync to RADIUS if groupName or speeds changed
    if (groupName || downloadSpeed || uploadSpeed) {
      try {
        const oldGroupName = currentProfile.groupName;
        const newGroupName = groupName || currentProfile.groupName;
        const newDownload = downloadSpeed || currentProfile.downloadSpeed;
        const newUpload = uploadSpeed || currentProfile.uploadSpeed;
        const rateLimit = `${newDownload}M/${newUpload}M`;

        // Delete old RADIUS entries
        await prisma.radgroupreply.deleteMany({
          where: { groupname: oldGroupName },
        });

        // Create new RADIUS entries
        await prisma.radgroupreply.createMany({
          data: [
            {
              groupname: newGroupName,
              attribute: 'Mikrotik-Group',
              op: ':=',
              value: newGroupName,
            },
            {
              groupname: newGroupName,
              attribute: 'Mikrotik-Rate-Limit',
              op: ':=',
              value: rateLimit,
            },
          ],
        });

        // Mark as synced
        await prisma.pppoeProfile.update({
          where: { id },
          data: {
            syncedToRadius: true,
            lastSyncAt: new Date(),
          },
        });

        // Synchronize profile to all active Mikrotik NAS
        try {
          const routers = await prisma.router.findMany({
            where: { isActive: true, type: 'mikrotik' },
          });

          const syncTasks = routers.map(async (router) => {
            let conn: RouterOSAPI | null = null;
            try {
              const apiPort = router.port || router.apiPort || 8728;
              conn = new RouterOSAPI({ host: router.ipAddress, user: router.username, password: router.password, port: apiPort, timeout: 15 });
              await conn.connect();
              conn.on('error', () => { /* ignore */ });

              const allProfiles = await conn.write('/ppp/profile/print');
              const existsOld = oldGroupName ? allProfiles.find((p: any) => p.name === oldGroupName) : null;
              const existsNew = allProfiles.find((p: any) => p.name === newGroupName);
              
              if (existsNew) {
                // Update existing new profile directly
                await conn.write('/ppp/profile/set', [
                  `=.id=${existsNew['.id']}`,
                  `=rate-limit=${rateLimit}`,
                ]);
                // If there's an old one different from new, maybe remove it? Better to keep safe, just rename if possible.
                if (existsOld && oldGroupName !== newGroupName) {
                   await conn.write('/ppp/profile/remove', [`=.id=${existsOld['.id']}`]);
                }
              } else if (existsOld && oldGroupName !== newGroupName) {
                // Rename old profile
                await conn.write('/ppp/profile/set', [
                  `=.id=${existsOld['.id']}`,
                  `=name=${newGroupName}`,
                  `=rate-limit=${rateLimit}`,
                ]);
              } else {
                // Add new profile
                await conn.write('/ppp/profile/add', [
                  `=name=${newGroupName}`,
                  `=rate-limit=${rateLimit}`,
                  `=comment=Managed by NexaRadius`,
                ]);
              }
            } catch (e: any) {
               console.warn(`[Profile Sync] Failed to sync to ${router.name}:`, e.message);
            } finally {
               if (conn) conn.close();
            }
          });
          await Promise.allSettled(syncTasks);
        } catch (routerErr) {
          console.warn('Failed to fetch routers for profile sync:', routerErr);
        }

        // If speed changed, apply CoA to all active sessions using this profile
        if (downloadSpeed || uploadSpeed) {
          console.log(`[Profile Update] Speed changed for profile ${newGroupName}, applying CoA to active sessions...`);
          
          // Check if CoA is available
          const coaAvailable = await isRadclientAvailable();
          
          if (coaAvailable) {
            // Find all users using this profile
            const usersWithProfile = await prisma.pppoeUser.findMany({
              where: { profileId: id },
              select: { username: true },
            });

            // For each user, find active sessions and send CoA
            const coaResults: any[] = [];
            for (const user of usersWithProfile) {
              // Find active session in radacct
              const activeSession = await prisma.radacct.findFirst({
                where: {
                  username: user.username,
                  acctstoptime: null,
                },
                select: {
                  acctsessionid: true,
                  nasipaddress: true,
                  framedipaddress: true,
                },
              });

              if (activeSession?.nasipaddress) {
                // Get router secret for this NAS
                const router = await prisma.router.findFirst({
                  where: {
                    OR: [
                      { nasname: activeSession.nasipaddress },
                      { ipAddress: activeSession.nasipaddress },
                    ],
                  },
                  select: { secret: true },
                });
                
                const result = await applyProfileChangeToActiveSessions(
                  user.username,
                  [{
                    acctSessionId: activeSession.acctsessionid || undefined,
                    nasIpAddress: activeSession.nasipaddress,
                    framedIpAddress: activeSession.framedipaddress || undefined,
                    nasSecret: router?.secret || undefined,
                  }],
                  {
                    downloadSpeed: newDownload,
                    uploadSpeed: newUpload,
                    groupName: newGroupName,
                  },
                  { 
                    fallbackToDisconnect: true,
                    secret: router?.secret || undefined,
                  }
                );
                
                coaResults.push({
                  username: user.username,
                  targetNas: activeSession.nasipaddress,
                  ...result,
                });
              }
            }

            console.log(`[Profile Update] CoA applied to ${coaResults.length} active sessions`);
            
            return NextResponse.json({ 
              success: true, 
              profile,
              coaApplied: true,
              coaResults: coaResults.map(r => ({
                username: r.username,
                success: r.success,
                action: r.action,
              })),
            });
          } else {
            console.log('[Profile Update] CoA not available (radclient not installed)');
          }
        }
      } catch (syncError) {
        console.error('RADIUS re-sync error:', syncError);
      }
    }

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('Update PPPoE profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove PPPoE profile
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
    }

    const profile = await prisma.pppoeProfile.findUnique({ where: { id } });
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if profile is used by any users
    const userCount = await prisma.pppoeUser.count({
      where: { profileId: id },
    });

    if (userCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete profile. ${userCount} user(s) are using this profile.` },
        { status: 400 }
      );
    }

    // Delete RADIUS entries
    try {
      await prisma.radgroupreply.deleteMany({
        where: { groupname: profile.groupName },
      });
      
      // Delete from Mikrotik routers
      const routers = await prisma.router.findMany({
        where: { isActive: true, type: 'mikrotik' },
      });

      const syncTasks = routers.map(async (router) => {
        let conn: RouterOSAPI | null = null;
        try {
          const apiPort = router.port || router.apiPort || 8728;
          conn = new RouterOSAPI({ host: router.ipAddress, user: router.username, password: router.password, port: apiPort, timeout: 15 });
          await conn.connect();
          conn.on('error', () => { /* ignore */ });

          const allProfiles = await conn.write('/ppp/profile/print');
          const exists = allProfiles.find((p: any) => p.name === profile.groupName);
          if (exists) {
            await conn.write('/ppp/profile/remove', [`=.id=${exists['.id']}`]);
          }
        } catch (e: any) {
           console.warn(`[Profile Sync] Failed to remove from ${router.name}:`, e.message);
        } finally {
           if (conn) conn.close();
        }
      });
      await Promise.allSettled(syncTasks);
      
    } catch (syncError) {
      console.error('RADIUS cleanup error:', syncError);
    }

    // Delete profile
    await prisma.pppoeProfile.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Profile deleted successfully',
    });
  } catch (error) {
    console.error('Delete PPPoE profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
