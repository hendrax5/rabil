import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Hapus multiple vouchers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { voucherIds } = body;

    if (!voucherIds || !Array.isArray(voucherIds) || voucherIds.length === 0) {
      return NextResponse.json({ error: 'Voucher IDs array is required' }, { status: 400 });
    }

    // Get voucher codes untuk hapus dari radcheck
    const vouchers = await prisma.hotspotVoucher.findMany({
      where: { id: { in: voucherIds } },
      select: { id: true, code: true },
    });

    const voucherCodes = vouchers.map(v => v.code);

    // Hapus dari radcheck
    if (voucherCodes.length > 0) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM radcheck WHERE username IN (${voucherCodes.map(() => '?').join(',')})`,
        ...voucherCodes
      );
    }

    // Hapus vouchers
    const result = await prisma.hotspotVoucher.deleteMany({
      where: { id: { in: voucherIds } },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `${result.count} voucher(s) deleted successfully`,
    });
  } catch (error) {
    console.error('Delete multiple vouchers error:', error);
    return NextResponse.json({ error: 'Failed to delete vouchers' }, { status: 500 });
  }
}
