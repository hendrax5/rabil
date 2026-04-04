import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createMidtransPayment } from '@/lib/payment/midtrans';

/**
 * POST /api/agent/deposit/create
 * Create deposit request for agent via payment gateway
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, amount, gateway } = body;

    // Validate input
    if (!agentId || !amount || !gateway) {
      return NextResponse.json(
        { error: 'Agent ID, amount, and gateway are required' },
        { status: 400 }
      );
    }

    if (amount < 10000) {
      return NextResponse.json(
        { error: 'Minimum deposit amount is Rp 10.000' },
        { status: 400 }
      );
    }

    // Check agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Check if agent is active
    if (!agent.isActive) {
      return NextResponse.json(
        { error: 'Agent account is inactive' },
        { status: 403 }
      );
    }

    // Get payment gateway config
    const gatewayConfig = await prisma.paymentGateway.findUnique({
      where: { provider: gateway },
    });

    if (!gatewayConfig || !gatewayConfig.isActive) {
      return NextResponse.json(
        { error: 'Payment gateway not available' },
        { status: 400 }
      );
    }

    // Create unique token
    const token = `DEP-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    
    // Create deposit record
    const deposit = await prisma.agentDeposit.create({
      data: {
        id: crypto.randomUUID(),
        agentId: agent.id,
        amount,
        status: 'PENDING',
        paymentGateway: gateway,
        paymentToken: token,
        expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Create payment link based on gateway
    let paymentResult;
    const orderDetails = {
      orderId: deposit.id,
      amount,
      customerName: agent.name,
      customerEmail: agent.email || `${agent.phone}@noemail.com`,
      customerPhone: agent.phone,
      invoiceToken: token,
      items: [{
        id: crypto.randomUUID(),
        name: 'Deposit Saldo Agent',
        price: amount,
        quantity: 1,
      }],
    };

    try {
      switch (gateway) {
        case 'midtrans':
          paymentResult = await createMidtransPayment(orderDetails);
          break;
        case 'xendit':
          {
            // For xendit, use createXenditInvoice
            const { createXenditInvoice } = await import('@/lib/payment/xendit');
            const xenditResult = await createXenditInvoice({
              externalId: deposit.id,
              amount,
              customerName: agent.name,
              payerEmail: agent.email || undefined,
              customerPhone: agent.phone,
              description: 'Deposit Saldo Agent',
              invoiceToken: token,
            });
            paymentResult = {
              paymentUrl: xenditResult.invoiceUrl,
              transactionId: xenditResult.id,
            };
          }
          break;
        case 'duitku':
          {
            // For duitku, get config first
            const gatewayConfig = await prisma.paymentGateway.findUnique({
              where: { provider: 'duitku' },
            });
            
            if (!gatewayConfig?.duitkuMerchantCode || !gatewayConfig?.duitkuApiKey) {
              throw new Error('Duitku not configured');
            }

            const company = await prisma.company.findFirst();
            const baseUrl = company?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

            const { DuitkuPayment } = await import('@/lib/payment/duitku');
            const duitku = new DuitkuPayment({
              merchantCode: gatewayConfig.duitkuMerchantCode,
              apiKey: gatewayConfig.duitkuApiKey,
              callbackUrl: `${baseUrl}/api/agent/deposit/webhook`,
              returnUrl: `${baseUrl}/agent/dashboard`,
              sandbox: gatewayConfig.duitkuEnvironment === 'sandbox',
            });
            
            const duitkuResult = await duitku.createInvoice({
              invoiceId: deposit.id,
              amount,
              customerName: agent.name,
              customerEmail: agent.email || `${agent.phone}@noemail.com`,
              description: 'Deposit Saldo Agent',
            });
            
            paymentResult = {
              paymentUrl: duitkuResult.paymentUrl,
              transactionId: duitkuResult.reference,
            };
          }
          break;
        default:
          throw new Error('Invalid payment gateway');
      }

      // Update deposit with payment URL
      await prisma.agentDeposit.update({
        where: { id: deposit.id },
        data: {
          paymentUrl: paymentResult.paymentUrl,
          transactionId: paymentResult.transactionId,
        },
      });

      return NextResponse.json({
        success: true,
        deposit: {
          id: deposit.id,
          token: deposit.paymentToken,
          amount: deposit.amount,
          paymentUrl: paymentResult.paymentUrl,
          expiredAt: deposit.expiredAt,
        },
      });
    } catch (paymentError: any) {
      // Update deposit status to FAILED
      await prisma.agentDeposit.update({
        where: { id: deposit.id },
        data: { status: 'FAILED' },
      });

      console.error('Payment creation error:', paymentError);
      return NextResponse.json(
        { error: `Failed to create payment: ${paymentError.message}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Create agent deposit error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
