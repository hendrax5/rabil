import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { disconnectPPPoEUser } from '@/lib/services/coaService';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Find session by token
    const session = await prisma.customerSession.findFirst({
      where: {
        token,
        verified: true,
        expiresAt: { gte: new Date() },
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const { newPassword } = await request.json();

    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json(
        { success: false, error: 'Password baru minimal 4 karakter' },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.pppoeUser.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // 1. Update password in database
    await prisma.pppoeUser.update({
      where: { id: user.id },
      data: { password: newPassword },
    });

    // 2. Update password in radcheck (RADIUS)
    await prisma.radcheck.upsert({
      where: {
        username_attribute: {
          username: user.username,
          attribute: 'Cleartext-Password',
        },
      },
      update: {
        value: newPassword,
      },
      create: {
        username: user.username,
        attribute: 'Cleartext-Password',
        op: ':=',
        value: newPassword,
      },
    });

    // 3. Disconnect user to force re-authentication with new password
    let disconnected = false;
    try {
      const coaResult = await disconnectPPPoEUser(user.username);
      disconnected = coaResult?.success || false;
    } catch (coaError: any) {
      console.error('[UpdatePassword] CoA disconnect failed:', coaError.message);
    }

    return NextResponse.json({
      success: true,
      message: disconnected 
        ? 'Password berhasil diubah dan koneksi telah di-refresh.' 
        : 'Password berhasil diubah. Password baru akan aktif saat router Anda melakukan koneksi ulang.',
    });
  } catch (error: any) {
    console.error('Update password error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
