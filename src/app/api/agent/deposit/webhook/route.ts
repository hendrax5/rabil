import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/agent/deposit/webhook
 * Handle payment webhook for agent deposits
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Determine which gateway sent the webhook
    let orderId: string | null = null;
    let status: string | null = null;
    let transactionId: string | null = null;
    let gateway: string | null = null;

    // Midtrans webhook format
    if (body.order_id && body.transaction_status) {
      orderId = body.order_id;
      const txStatus = body.transaction_status;
      transactionId = body.transaction_id;
      gateway = 'midtrans';
      
      // Map Midtrans status to our status
      if (['capture', 'settlement'].includes(txStatus)) {
        status = 'PAID';
      } else if (['pending'].includes(txStatus)) {
        status = 'PENDING';
      } else if (['deny', 'expire', 'cancel'].includes(txStatus)) {
        status = 'FAILED';
      }
    }
    // Xendit webhook format
    else if (body.external_id && body.status) {
      orderId = body.external_id;
      const xenditStatus = body.status;
      transactionId = body.id;
      gateway = 'xendit';
      
      // Map Xendit status
      if (xenditStatus === 'PAID') {
        status = 'PAID';
      } else if (xenditStatus === 'PENDING') {
        status = 'PENDING';
      } else if (['EXPIRED', 'FAILED'].includes(xenditStatus)) {
        status = 'FAILED';
      }
    }
    // Duitku webhook format
    else if (body.merchantOrderId && body.resultCode) {
      orderId = body.merchantOrderId;
      transactionId = body.reference;
      gateway = 'duitku';
      
      // Map Duitku status
      if (body.resultCode === '00') {
        status = 'PAID';
      } else {
        status = 'FAILED';
      }
    }

    if (!orderId || !status) {
      return NextResponse.json(
        { error: 'Invalid webhook data' },
        { status: 400 }
      );
    }

    // Find deposit by ID
    const deposit = await prisma.agentDeposit.findUnique({
      where: { id: orderId },
      include: { agent: true },
    });

    if (!deposit) {
      console.error('Deposit not found:', orderId);
      return NextResponse.json(
        { error: 'Deposit not found' },
        { status: 404 }
      );
    }

    // Only process if current status is PENDING
    if (deposit.status !== 'PENDING') {
      return NextResponse.json({
        success: true,
        message: 'Deposit already processed',
      });
    }

    // Update deposit status
    await prisma.agentDeposit.update({
      where: { id: deposit.id },
      data: {
        status,
        transactionId: transactionId || deposit.transactionId,
        paidAt: status === 'PAID' ? new Date() : null,
      },
    });

    // If payment successful, add balance to agent
    if (status === 'PAID') {
      await prisma.agent.update({
        where: { id: deposit.agentId },
        data: {
          balance: {
            increment: deposit.amount,
          },
        },
      });

      console.log(`Agent ${deposit.agent.name} balance increased by ${deposit.amount}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
    });
  } catch (error) {
    console.error('Agent deposit webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
