import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { disconnectPPPoEUser } from '@/lib/services/coaService';

export async function PUT(request: Request) {
  try {
    const { userId, status } = await request.json();

    if (!userId || !status) {
      return NextResponse.json(
        { error: 'Missing userId or status' },
        { status: 400 }
      );
    }

    if (!['active', 'isolated', 'blocked'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: active, isolated, or blocked' },
        { status: 400 }
      );
    }

    // Update user status in database
    const updatedUser = await prisma.pppoeUser.update({
      where: { id: userId },
      data: { status },
    });

    // Get user with profile and router for restore
    const user = await prisma.pppoeUser.findUnique({
      where: { id: userId },
      include: { 
        profile: true,
        router: { select: { id: true, nasname: true } },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update RADIUS based on status
    if (status === 'active') {
      // Restore to original profile
      // 1. Ensure password in radcheck
      await prisma.$executeRaw`
        INSERT INTO radcheck (username, attribute, op, value)
        VALUES (${user.username}, 'Cleartext-Password', ':=', ${user.password})
        ON DUPLICATE KEY UPDATE value = ${user.password}
      `;

      // 2. Add NAS-IP-Address if router is assigned
      if (user.router) {
        await prisma.$executeRaw`
          INSERT INTO radcheck (username, attribute, op, value)
          VALUES (${user.username}, 'NAS-IP-Address', '==', ${user.router.nasname})
          ON DUPLICATE KEY UPDATE value = ${user.router.nasname}
        `;
      }

      // 3. Restore to original group
      await prisma.$executeRaw`
        DELETE FROM radusergroup WHERE username = ${user.username}
      `;
      await prisma.$executeRaw`
        INSERT INTO radusergroup (username, groupname, priority)
        VALUES (${user.username}, ${user.profile.groupName}, 1)
      `;

      // 4. Restore static IP if exists
      if (user.ipAddress) {
        await prisma.$executeRaw`
          INSERT INTO radreply (username, attribute, op, value)
          VALUES (${user.username}, 'Framed-IP-Address', ':=', ${user.ipAddress})
          ON DUPLICATE KEY UPDATE value = ${user.ipAddress}
        `;
      }
    } else if (status === 'isolated') {
      // Move to isolir group - MikroTik will apply isolir profile
      // Remove static IP so user gets IP from MikroTik pool-isolir
      
      // 1. Keep password in radcheck
      await prisma.$executeRaw`
        INSERT INTO radcheck (username, attribute, op, value)
        VALUES (${user.username}, 'Cleartext-Password', ':=', ${user.password})
        ON DUPLICATE KEY UPDATE value = ${user.password}
      `;

      // 2. Add NAS-IP-Address if router is assigned
      if (user.router) {
        await prisma.$executeRaw`
          INSERT INTO radcheck (username, attribute, op, value)
          VALUES (${user.username}, 'NAS-IP-Address', '==', ${user.router.nasname})
          ON DUPLICATE KEY UPDATE value = ${user.router.nasname}
        `;
      }

      // 3. Move to isolir group (this maps to MikroTik profile 'isolir')
      await prisma.$executeRaw`
        DELETE FROM radusergroup WHERE username = ${user.username}
      `;
      await prisma.$executeRaw`
        INSERT INTO radusergroup (username, groupname, priority)
        VALUES (${user.username}, 'isolir', 1)
      `;

      // 4. DELETE Framed-IP so user gets IP from MikroTik pool-isolir
      await prisma.$executeRaw`
        DELETE FROM radreply WHERE username = ${user.username} AND attribute = 'Framed-IP-Address'
      `;
    } else if (status === 'blocked') {
      // Block: Remove from all RADIUS tables
      await prisma.$executeRaw`
        DELETE FROM radcheck WHERE username = ${user.username}
      `;
      await prisma.$executeRaw`
        DELETE FROM radusergroup WHERE username = ${user.username}
      `;
      await prisma.$executeRaw`
        DELETE FROM radreply WHERE username = ${user.username}
      `;
    }

    // Send CoA disconnect to force user to re-authenticate with new config
    const coaResult = await disconnectPPPoEUser(user.username);
    console.log(`[Status Change] CoA disconnect result for ${user.username}:`, coaResult);

    return NextResponse.json({
      success: true,
      user: updatedUser,
      coa: coaResult,
    });
  } catch (error) {
    console.error('Status change error:', error);
    return NextResponse.json(
      { error: 'Failed to change status' },
      { status: 500 }
    );
  }
}
