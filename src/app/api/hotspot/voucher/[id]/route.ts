import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// DELETE - Hapus voucher individual
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Voucher ID is required' }, { status: 400 });
    }

    // Cek voucher exist
    const voucher = await prisma.hotspotVoucher.findUnique({
      where: { id },
      select: { id: true, code: true, status: true },
    });

    if (!voucher) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });
    }

    // Hapus dari radcheck juga jika ada
    await prisma.$executeRaw`DELETE FROM radcheck WHERE username = ${voucher.code}`;

    // Hapus voucher
    await prisma.hotspotVoucher.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Voucher ${voucher.code} deleted successfully`,
    });
  } catch (error) {
    console.error('Delete voucher error:', error);
    return NextResponse.json({ error: 'Failed to delete voucher' }, { status: 500 });
  }
}
