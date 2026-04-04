import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/hotspot/agents/balance
 * Manual adjustment of agent balance by admin
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, amount, type, note } = body;

    // Validate input
    if (!agentId || !amount || !type) {
      return NextResponse.json(
        { error: 'Agent ID, amount, and type are required' },
        { status: 400 }
      );
    }

    if (!['add', 'subtract'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be either "add" or "subtract"' },
        { status: 400 }
      );
    }

    // Get current agent
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Calculate new balance
    const adjustAmount = type === 'add' ? amount : -amount;
    const newBalance = agent.balance + adjustAmount;

    if (newBalance < 0) {
      return NextResponse.json(
        { error: 'Insufficient balance. Cannot subtract more than current balance.' },
        { status: 400 }
      );
    }

    // Update agent balance
    const updatedAgent = await prisma.agent.update({
      where: { id: agentId },
      data: { balance: newBalance },
    });

    // Create manual deposit record for tracking (using agentDeposit table)
    await prisma.agentDeposit.create({
      data: {
        id: crypto.randomUUID(),
        agentId: agentId,
        amount: adjustAmount,
        status: 'PAID',
        paymentGateway: 'manual',
        paymentToken: `MANUAL-${Date.now()}`,
        transactionId: `MANUAL-${type.toUpperCase()}-${Date.now()}`,
        paidAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      agent: {
        id: updatedAgent.id,
        name: updatedAgent.name,
        balance: updatedAgent.balance,
        adjustment: {
          type,
          amount,
          previousBalance: agent.balance,
          newBalance: updatedAgent.balance,
          note: note || null,
        },
      },
    });
  } catch (error) {
    console.error('Adjust agent balance error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
