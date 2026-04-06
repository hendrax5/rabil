import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateExcelBuffer, formatCurrencyExport, formatDateExport, generatePDFBuffer } from '@/lib/utils/export';
import { checkAuth } from '@/lib/apiAuth';

export async function GET(req: NextRequest) {
  const auth = await checkAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') || 'excel';
  const profileId = searchParams.get('profileId');
  const routerId = searchParams.get('routerId');
  const status = searchParams.get('status');

  try {
    // Build query filters
    const where: any = {};
    
    if (profileId) {
      where.profileId = profileId;
    }
    
    if (routerId) {
      if (routerId === 'global') {
        where.routerId = null;
      } else {
        where.routerId = routerId;
      }
    }
    
    if (status) {
      where.status = status;
    }

    // Fetch PPPoE users with relations
    const users = await prisma.pppoeUser.findMany({
      where,
      include: {
        profile: true,
        router: {
          select: { id: true, name: true, nasname: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (format === 'pdf') {
      // Generate PDF data for client-side rendering
      const headers = ['No', 'Username', 'Nama', 'Phone', 'Profile', 'Status', 'Expired', 'Router'];
      const rows = users.map((u, idx) => [
        idx + 1,
        u.username,
        u.name,
        u.phone,
        u.profile.name,
        u.status === 'active' ? 'Aktif' : u.status === 'isolated' ? 'Isolir' : 'Block',
        u.expiredAt ? formatDateExport(u.expiredAt) : '-',
        u.router?.name || 'Global'
      ]);

      const summary = [
        { label: 'Total Pelanggan', value: users.length.toString() },
        { label: 'Aktif', value: users.filter(u => u.status === 'active').length.toString() },
        { label: 'Isolir', value: users.filter(u => u.status === 'isolated').length.toString() },
        { label: 'Block', value: users.filter(u => u.status === 'blocked').length.toString() }
      ];

      return NextResponse.json({
        pdfData: {
          title: 'Daftar Pelanggan PPPoE - NexaRadius',
          headers,
          rows,
          summary,
          generatedAt: new Date().toLocaleString('id-ID')
        }
      });
    }

    // Excel export
    const columns = [
      { key: 'no', header: 'No', width: 6 },
      { key: 'username', header: 'Username', width: 20 },
      { key: 'name', header: 'Nama', width: 25 },
      { key: 'phone', header: 'Telepon', width: 15 },
      { key: 'email', header: 'Email', width: 25 },
      { key: 'address', header: 'Alamat', width: 35 },
      { key: 'profile', header: 'Profile', width: 15 },
      { key: 'status', header: 'Status', width: 12 },
      { key: 'ipAddress', header: 'IP Address', width: 15 },
      { key: 'expiredAt', header: 'Expired', width: 15 },
      { key: 'router', header: 'Router', width: 15 },
      { key: 'createdAt', header: 'Created', width: 15 }
    ];

    const data = users.map((u, idx) => ({
      no: idx + 1,
      username: u.username,
      name: u.name,
      phone: u.phone,
      email: u.email || '',
      address: u.address || '',
      profile: u.profile.name,
      status: u.status === 'active' ? 'Aktif' : u.status === 'isolated' ? 'Isolir' : 'Block',
      ipAddress: u.ipAddress || '',
      expiredAt: u.expiredAt ? formatDateExport(u.expiredAt) : '',
      router: u.router?.name || 'Global',
      createdAt: formatDateExport(u.createdAt)
    }));

    const excelBuffer = generateExcelBuffer(data, columns, 'PPPoE Users');

    const filename = `PPPoE-Users-${new Date().toISOString().split('T')[0]}.xlsx`;
    
    return new NextResponse(Buffer.from(excelBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
