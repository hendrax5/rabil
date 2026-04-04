import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { RouterOSAPI } from 'node-routeros';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let conn: RouterOSAPI | null = null;
  
  try {
    const { id } = await params;

    // Get router from database
    const router = await prisma.router.findUnique({
      where: { id },
    });

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    // Use port field for API connection (apiPort is legacy)
    const apiPort = router.port || router.apiPort || 8728;
    
    console.log(`[Setup Isolir] Connecting to router ${router.name} at ${router.ipAddress}:${apiPort}`);

    // Connect to MikroTik
    conn = new RouterOSAPI({
      host: router.ipAddress,
      user: router.username,
      password: router.password,
      port: apiPort,
      timeout: 15,
    });

    try {
      await conn.connect();
    } catch (connectError: any) {
      console.error(`[Setup Isolir] Connection failed:`, connectError);
      return NextResponse.json(
        {
          error: 'Failed to connect to router',
          details: connectError.message || 'Connection timeout or refused',
        },
        { status: 500 }
      );
    }

    const comment = 'AIBILL RADIUS - Dont Delete';

    try {
      // 1. Create IP Pool for isolir
      const poolName = 'pool-isolir';
      const poolRange = '10.255.255.2-10.255.255.254';
      const allPools = await conn.write('/ip/pool/print');
      const existingPool = allPools.filter((p: any) => p.name === poolName);
      const poolExists = existingPool.length > 0;

      if (!poolExists) {
        try {
          await conn.write('/ip/pool/add', [
            `=name=${poolName}`,
            `=ranges=${poolRange}`,
            `=comment=${comment}`,
          ]);
        } catch (addError: any) {
          if (!addError.message?.includes('already have')) {
            throw addError;
          }
        }
      } else {
        // Update existing pool
        const poolId = existingPool[0]['.id'];
        await conn.write('/ip/pool/set', [
          `=.id=${poolId}`,
          `=ranges=${poolRange}`,
          `=comment=${comment}`,
        ]);
      }

      // 2. Create PPP Profile 'isolir'
      const profileName = 'isolir';
      const rateLimit = '64k/64k';
      const allProfiles = await conn.write('/ppp/profile/print');
      const existingProfile = allProfiles.filter((p: any) => p.name === profileName);
      const profileExists = existingProfile.length > 0;

      if (!profileExists) {
        await conn.write('/ppp/profile/add', [
          `=name=${profileName}`,
          '=local-address=10.255.255.1',
          `=remote-address=${poolName}`,
          `=rate-limit=${rateLimit}`,
          '=only-one=yes',
          `=comment=${comment}`,
        ]);
      } else {
        // Update existing profile
        const profileId = existingProfile[0]['.id'];
        await conn.write('/ppp/profile/set', [
          `=.id=${profileId}`,
          '=local-address=10.255.255.1',
          `=remote-address=${poolName}`,
          `=rate-limit=${rateLimit}`,
          '=only-one=yes',
          `=comment=${comment}`,
        ]);
      }

      conn.close();

      return NextResponse.json({
        success: true,
        message: 'Profile isolir successfully created/updated!',
        config: {
          profile: profileName,
          rateLimit: rateLimit,
          poolRange: poolRange,
        },
      });
    } catch (apiError) {
      conn.close();
      throw apiError;
    }
  } catch (error: any) {
    console.error('Setup isolir error:', error);
    return NextResponse.json(
      {
        error: 'Failed to setup isolir profile',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
