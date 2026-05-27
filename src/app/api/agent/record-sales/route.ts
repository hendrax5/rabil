import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/agent/record-sales
 * Record agent sales for vouchers that became ACTIVE
 * Should be called by cron job or after voucher activation
 */
export async function POST(request: NextRequest) {
  try {
    // Get all ACTIVE vouchers that belong to an agent or have agent batch codes
    const activeVouchers = await prisma.hotspotVoucher.findMany({
      where: {
        status: 'ACTIVE',
        firstLoginAt: {
          not: null,
        },
        OR: [
          { agentId: { not: null } },
          { batchCode: { not: null } }
        ]
      },
      include: {
        profile: true,
      },
    });

    let recordedCount = 0;
    const errors = [];

    for (const voucher of activeVouchers) {
      // Check if sale already recorded
      const existingSale = await prisma.agentSale.findFirst({
        where: {
          voucherCode: voucher.code,
        },
      });

      if (existingSale) {
        continue; // Already recorded
      }

      let agent = null;

      // 1. Try finding agent by agentId directly
      if (voucher.agentId) {
        agent = await prisma.agent.findUnique({
          where: { id: voucher.agentId },
        });
      }

      // 2. Fallback to batchCode pattern parsing
      if (!agent && voucher.batchCode && voucher.batchCode.includes('-')) {
        const agentNamePattern = voucher.batchCode.split('-')[0];
        agent = await prisma.agent.findFirst({
          where: {
            name: {
              equals: agentNamePattern,
            },
          },
        });
      }

      if (!agent) {
        errors.push({
          voucher: voucher.code,
          error: `Agent not found for voucher (agentId: ${voucher.agentId}, batchCode: ${voucher.batchCode})`,
        });
        continue;
      }

      try {
        // Record sale with resellerFee as agent profit
        await prisma.agentSale.create({
          data: {
            id: crypto.randomUUID(),
            agentId: agent.id,
            voucherCode: voucher.code,
            profileName: voucher.profile.name,
            amount: voucher.profile.resellerFee, // Agent earns resellerFee
            createdAt: voucher.firstLoginAt!, // Use first login time as sale time
          },
        });

        recordedCount++;
      } catch (error: any) {
        errors.push({
          voucher: voucher.code,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      recorded: recordedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Recorded ${recordedCount} agent sales`,
    });
  } catch (error) {
    console.error('Record agent sales error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
