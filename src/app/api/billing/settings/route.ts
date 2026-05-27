import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/billing/settings
 * Return current billing engine settings
 */
export async function GET() {
  try {
    let settings = await prisma.billingSettings.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    // Auto-create defaults if not exists
    if (!settings) {
      settings = await prisma.billingSettings.create({
        data: {
          billingType: 'fixed',
          billingDay: 1,
          gracePeriod: 3,
          autoSuspend: true,
          autoUnsuspend: true,
          lateFeeType: 'none',
          lateFeeAmount: 0,
          sendInvoiceDay: 25,
        },
      });
    }

    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/billing/settings
 * Update billing engine settings
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      billingType,
      billingDay,
      gracePeriod,
      autoSuspend,
      autoUnsuspend,
      lateFeeType,
      lateFeeAmount,
      sendInvoiceDay,
    } = body;

    // Validate
    if (billingDay !== undefined && (billingDay < 1 || billingDay > 28)) {
      return NextResponse.json({ success: false, error: 'billingDay must be between 1 and 28' }, { status: 400 });
    }
    if (gracePeriod !== undefined && gracePeriod < 0) {
      return NextResponse.json({ success: false, error: 'gracePeriod cannot be negative' }, { status: 400 });
    }

    let settings = await prisma.billingSettings.findFirst();

    if (!settings) {
      settings = await prisma.billingSettings.create({ data: body });
    } else {
      settings = await prisma.billingSettings.update({
        where: { id: settings.id },
        data: {
          ...(billingType !== undefined && { billingType }),
          ...(billingDay !== undefined && { billingDay: parseInt(billingDay) }),
          ...(gracePeriod !== undefined && { gracePeriod: parseInt(gracePeriod) }),
          ...(autoSuspend !== undefined && { autoSuspend: Boolean(autoSuspend) }),
          ...(autoUnsuspend !== undefined && { autoUnsuspend: Boolean(autoUnsuspend) }),
          ...(lateFeeType !== undefined && { lateFeeType }),
          ...(lateFeeAmount !== undefined && { lateFeeAmount: parseFloat(lateFeeAmount) }),
          ...(sendInvoiceDay !== undefined && { sendInvoiceDay: parseInt(sendInvoiceDay) }),
        },
      });
    }

    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
