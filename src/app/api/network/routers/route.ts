import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { reloadFreeRadius } from '@/lib/freeradius';
import { syncChapSecrets } from '@/app/api/system/vpn-users/route';
import crypto from 'crypto';
import os from 'os';
const RouterOSAPI = require('node-routeros').RouterOSAPI;

const prisma = new PrismaClient();

// Auto-detect server IP from network interfaces
const getServerIp = (): string => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
};

// RADIUS Server IP - prioritas: ENV > auto-detect
const getRadiusServerIp = () => process.env.RADIUS_SERVER_IP || process.env.VPS_IP || getServerIp();

// GET - Load all routers
export async function GET() {
  try {
    const radiusServerIp = getRadiusServerIp();
    
    const routers = await prisma.router.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    // Add radiusServerIp as computed field for frontend display
    // Note: 'server' field in NAS table is for FreeRADIUS virtual_server name, NOT RADIUS IP
    const routersWithServer = routers.map(router => ({
      ...router,
      radiusServerIp: radiusServerIp,  // For frontend display only
      ports: router.ports || 1812,
    }));

    return NextResponse.json({ routers: routersWithServer, radiusServerIp });
  } catch (error) {
    console.error('Load routers error:', error);
    return NextResponse.json({ error: 'Failed to load routers' }, { status: 500 });
  }
}

// POST - Add new router
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, ipAddress, nasIpAddress, username, password, port, secret, latitude, longitude, autoVpn } = body;

    if (!name || (!ipAddress && !autoVpn) || !username || !password) {
      return NextResponse.json(
        { error: 'Name, IP address, username, and password are required' },
        { status: 400 }
      );
    }

    // Generate shortname from name (remove spaces, lowercase)
    const shortname = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    let finalIpAddress = ipAddress;
    let finalNasIpAddress = nasIpAddress;
    let identityName = 'Unknown';

    // Auto-provisioning VPN L2TP
    if (autoVpn) {
      // Cari alokasi IP 172.26.0.x yang kosong
      const existingVpns = await prisma.vpnAccount.findMany({
        where: { type: 'L2TP' },
        select: { staticIp: true }
      });
      const usedIps = existingVpns.map(v => v.staticIp).filter(Boolean);
      let newIpParams = "";
      for (let i = 2; i <= 254; i++) {
        const checkIp = `172.26.0.${i}`;
        if (!usedIps.includes(checkIp)) {
          newIpParams = checkIp;
          break;
        }
      }
      
      if (!newIpParams) {
        return NextResponse.json({ error: 'Tidak ada IP L2TP tersisa' }, { status: 400 });
      }

      finalIpAddress = newIpParams;
      finalNasIpAddress = newIpParams;

      // 1-Step: Paksa simpan VPN
      await prisma.vpnAccount.create({
        data: {
          id: crypto.randomUUID(),
          username: username, // Duplikat username API sbg VPN username
          password: password, // Duplikat password
          type: 'L2TP',
          staticIp: finalIpAddress,
          notes: `Auto-provisioned for NAS ${name}`,
          isActive: true
        }
      });
      
      await syncChapSecrets();
      identityName = `VPN-${name}`; // Bebas tes koneksi API!
    } else {
      // Test connection to MikroTik (Bila tidak autoVpn)
      try {
        const conn = new RouterOSAPI({
          host: finalIpAddress,
          user: username,
          password: password,
          port: port || 8728,
          timeout: 5,
          tls: false,
        });

        await conn.connect();
        const identity = await conn.write('/system/identity/print');
        identityName = identity[0]?.name || 'Unknown';
        conn.close();
      } catch (connError: any) {
        console.error('Router connection error:', connError);
        return NextResponse.json(
          { 
            error: 'Failed to connect to router', 
            details: connError.message,
            hint: 'Check IP address, username, password, and port. Ensure MikroTik API service is enabled.',
          },
          { status: 400 }
        );
      }
    }

    const nasname = finalNasIpAddress || finalIpAddress;

    // Save to database
    // Note: 'server' field left NULL - it's for FreeRADIUS virtual_server name, not RADIUS IP
    const router = await prisma.router.create({
      data: {
        id: crypto.randomUUID(),
        name,
        nasname,           // IP untuk FreeRADIUS client (IP publik/VPN)
        shortname,
        type: 'mikrotik',
        ipAddress: finalIpAddress,         // IP untuk koneksi API MikroTik
        username,
        password,
        port: port || 8728,
        secret: secret || 'secret123',
        // server: NULL - untuk FreeRADIUS virtual_server name
          ports: 1812, // RADIUS auth port
          description: `MikroTik Router - ${name}`,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          isActive: true,
        },
      });

      // Restart FreeRADIUS to reload NAS table
      await reloadFreeRadius();

      return NextResponse.json({
        success: true,
        router,
        identity: identityName,
        message: autoVpn ? 'NAS & VPN Auto-Provisioned Successfully' : 'Router added and connection test successful',
      });
    // Exception catch already handled inside IF condition for non-autoVpn
  } catch (error) {
    console.error('Add router error:', error);
    return NextResponse.json({ error: 'Failed to add router' }, { status: 500 });
  }
}

// PUT - Update router
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, ipAddress, nasIpAddress, username, password, port, secret, isActive, latitude, longitude } = body;

    if (!id) {
      return NextResponse.json({ error: 'Router ID is required' }, { status: 400 });
    }

    // Generate shortname from name if name is provided
    const shortname = name ? name.toLowerCase().replace(/[^a-z0-9]/g, '') : undefined;
    
    // nasname = IP untuk FreeRADIUS (IP publik/VPN)
    // Jika nasIpAddress diberikan, gunakan itu. Jika tidak dan ipAddress diberikan, gunakan ipAddress
    const nasname = nasIpAddress || ipAddress || undefined;

    // Test connection if credentials changed
    if (ipAddress || username || password || port) {
      const currentRouter = await prisma.router.findUnique({ where: { id } });
      if (!currentRouter) {
        return NextResponse.json({ error: 'Router not found' }, { status: 404 });
      }

      try {
        const conn = new RouterOSAPI({
          host: ipAddress || currentRouter.ipAddress,
          user: username || currentRouter.username,
          password: password || currentRouter.password,
          port: port || currentRouter.port || 8728,
          timeout: 5,
          tls: false,
        });

        await conn.connect();
        conn.close();
      } catch (connError: any) {
        return NextResponse.json(
          { 
            error: 'Failed to connect with new credentials', 
            details: connError.message 
          },
          { status: 400 }
        );
      }
    }

    // Note: 'server' field is for FreeRADIUS virtual_server name, not RADIUS IP
    // Don't update it here - RADIUS Server IP is from environment variable
    
    const router = await prisma.router.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(shortname && { shortname }),
        ...(nasname && { nasname }),
        ...(ipAddress && { ipAddress }),
        ...(username && { username }),
        ...(password && { password }),
        ...(port && { port }),
        ...(secret && { secret }),
        ...(isActive !== undefined && { isActive }),
        ...(latitude !== undefined && { latitude: latitude ? parseFloat(latitude) : null }),
        ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
        // server: NULL - untuk FreeRADIUS virtual_server name
      },
    });

    // Restart FreeRADIUS to reload NAS table
    await reloadFreeRadius();

    return NextResponse.json({ success: true, router });
  } catch (error) {
    console.error('Update router error:', error);
    return NextResponse.json({ error: 'Failed to update router' }, { status: 500 });
  }
}

// DELETE - Remove router
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Router ID is required' }, { status: 400 });
    }

    await prisma.router.delete({
      where: { id },
    });

    // Restart FreeRADIUS to reload NAS table
    await reloadFreeRadius();

    return NextResponse.json({ success: true, message: 'Router deleted successfully' });
  } catch (error) {
    console.error('Delete router error:', error);
    return NextResponse.json({ error: 'Failed to delete router' }, { status: 500 });
  }
}
