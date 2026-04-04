import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";

/**
 * RADIUS Post-Auth Hook
 * Called after successful authentication to:
 * 1. Set firstLoginAt and expiresAt on first login
 * 2. Check if voucher is expired
 * 3. Update voucher status
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, reply } = body;

    // Only process Access-Accept
    if (reply !== "Access-Accept") {
      return NextResponse.json({ success: true, action: "ignore" });
    }

    // Find voucher
    const voucher = await prisma.hotspotVoucher.findUnique({
      where: { code: username },
      include: { profile: true },
    });

    // If voucher not found in hotspotVoucher table, it might be:
    // - A PPPoE user (should not reach here due to conditional in FreeRADIUS)
    // - A legacy/test voucher in radcheck only
    // Return success to allow authentication to proceed
    if (!voucher) {
      return NextResponse.json({
        success: true,
        action: "ignore",
        message: "Not a managed voucher",
      });
    }

    // Get current time - server is in WIB, store as-is
    // No timezone conversion since DATABASE_URL has no timezone parameter
    const now = new Date();    // Check if voucher is already expired
    if (voucher.expiresAt && now > voucher.expiresAt) {
      // Mark as expired and reject
      await prisma.hotspotVoucher.update({
        where: { id: voucher.id },
        data: { status: "EXPIRED" },
      });

      return NextResponse.json(
        {
          success: false,
          error: "Voucher expired",
          action: "reject",
        },
        { status: 403 },
      );
    }

    // First login: set firstLoginAt and calculate expiresAt
    if (!voucher.firstLoginAt) {
      const { validityValue, validityUnit } = voucher.profile;

      // Calculate interval in milliseconds
      let intervalMs = 0;
      switch (validityUnit) {
        case "MINUTES":
          intervalMs = validityValue * 60 * 1000;
          break;
        case "HOURS":
          intervalMs = validityValue * 60 * 60 * 1000;
          break;
        case "DAYS":
          intervalMs = validityValue * 24 * 60 * 60 * 1000;
          break;
        case "MONTHS":
          // Approximate 30 days per month
          intervalMs = validityValue * 30 * 24 * 60 * 60 * 1000;
          break;
      }

      const expiresAt = new Date(now.getTime() + intervalMs);

      // Update using Prisma (will handle timezone properly)
      const updated = await prisma.hotspotVoucher.update({
        where: { id: voucher.id },
        data: {
          firstLoginAt: now,
          expiresAt,
          status: "ACTIVE",
        },
        select: { firstLoginAt: true, expiresAt: true },
      });

      // Auto-sync to Keuangan (realtime for manual/agent vouchers)
      if (!voucher.orderId) {
        try {
          const hotspotCategory = await prisma.transactionCategory.findFirst({
            where: { name: "Pembayaran Hotspot", type: "INCOME" },
          });

          if (hotspotCategory) {
            const existingTransaction = await prisma.transaction.findFirst({
              where: { reference: `VOUCHER-${voucher.code}` },
            });

            if (!existingTransaction) {
              // Check if this is an agent voucher
              const isAgentVoucher = voucher.agentId !== null;
              const hasResellerFee = voucher.profile.resellerFee > 0;
              
              // Income = sellingPrice (harga jual ke customer)
              const incomeAmount = voucher.profile.sellingPrice;
              
              // Create income transaction with selling price
              await prisma.transaction.create({
                data: {
                  id: nanoid(),
                  categoryId: hotspotCategory.id,
                  type: "INCOME",
                  amount: incomeAmount,
                  description: `Voucher ${voucher.profile.name} - ${voucher.code}${isAgentVoucher ? ' (Agent)' : ''}`,
                  date: now,
                  reference: `VOUCHER-${voucher.code}`,
                  notes: `Pendapatan voucher hotspot (Harga Jual: Rp ${incomeAmount}, Harga Modal: Rp ${voucher.profile.costPrice})`,
                },
              });
              console.log(
                `[POST-AUTH] Keuangan synced: ${voucher.code} - Income Rp ${incomeAmount}`,
              );

              // If agent voucher, record commission as expense
              // Net profit = sellingPrice - resellerFee
              if (isAgentVoucher && hasResellerFee) {
                const agentCategory = await prisma.transactionCategory.findFirst({
                  where: { name: "Komisi Agent", type: "EXPENSE" },
                });

                if (agentCategory) {
                  // Get agent name if available
                  const agent = await prisma.agent.findUnique({
                    where: { id: voucher.agentId! },
                    select: { name: true },
                  });
                  
                  const agentName = agent?.name || 'Unknown';
                  const commissionAmount = voucher.profile.resellerFee;
                  const netProfit = incomeAmount - commissionAmount;
                  
                  await prisma.transaction.create({
                    data: {
                      id: nanoid(),
                      categoryId: agentCategory.id,
                      type: "EXPENSE",
                      amount: commissionAmount,
                      description: `Komisi Agent ${agentName} - Voucher ${voucher.code}`,
                      date: now,
                      reference: `COMMISSION-${voucher.code}`,
                      notes: `Komisi agent untuk voucher ${voucher.profile.name} (Net Profit: Rp ${netProfit})`,
                    },
                  });
                  console.log(
                    `[POST-AUTH] Agent commission: ${voucher.code} - Rp ${commissionAmount} (Net: Rp ${netProfit})`,
                  );
                }
              }
            }
          }
        } catch (keuanganError) {
          console.error("[POST-AUTH] Keuangan sync error:", keuanganError);
        }
      }

      return NextResponse.json({
        success: true,
        action: "first_login",
        firstLoginAt: updated?.firstLoginAt,
        expiresAt: updated?.expiresAt,
      });
    }

    // Subsequent logins: just verify not expired
    return NextResponse.json({
      success: true,
      action: "allow",
      expiresAt: voucher.expiresAt,
    });
  } catch (error: any) {
    console.error("RADIUS post-auth error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}
