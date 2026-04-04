import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { nowWIB, startOfDayWIBtoUTC, endOfDayWIBtoUTC } from "@/lib/timezone";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Disable caching for this route - always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Allow all authenticated admin users (they use AdminRole: SUPER_ADMIN, FINANCE, etc.)
    // No additional role check needed - if they can login to admin, they can see dashboard
    const userRole = (session.user as any).role;
    console.log('Dashboard stats accessed by role:', userRole);
    // Get current time in WIB timezone (database stores UTC)
    // Use WIB for month boundaries to match user expectations
    const now = nowWIB();
    
    // Calculate month boundaries in WIB, convert to UTC for database queries
    const startOfMonth = startOfDayWIBtoUTC(new Date(now.getFullYear(), now.getMonth(), 1));
    const startOfLastMonth = startOfDayWIBtoUTC(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const endOfLastMonth = endOfDayWIBtoUTC(new Date(now.getFullYear(), now.getMonth(), 0));

    // Scoping for SALES role
    const isSales = userRole === "SALES";
    const userId = (session.user as any).id;
    const salesFilter = isSales ? { salesId: userId } : {};

    // Get Admin config (for commission rate)
    let commissionRate = 0;
    if (isSales || userRole === "SALES_MANAGER") {
      const dbUser = await prisma.adminUser.findUnique({ where: { id: userId } });
      if (dbUser) commissionRate = dbUser.commissionRate || 0;
    }

    // Invoice filters for revenue
    const invoiceSalesFilter = isSales ? { user: { salesId: userId } } : {};

    // Execute parallel Prisma aggregations to prevent sequential waterfalls
    const [
      totalUsers,
      lastMonthUsers,
      activeSessions,
      pendingInvoices,
      lastMonthPendingInvoices,
      incomeThisMonth,
      incomeLastMonth,
      pppoeActiveCount,
      hotspotActiveCount,
      bandwidthData,
      recentPayments,
      recentInvoices,
      recentRadacct,
      earnedCount
    ] = await Promise.all([
      prisma.pppoeUser.count({ where: salesFilter }),
      prisma.pppoeUser.count({
        where: { ...salesFilter, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      }),
      prisma.radacct.count({
        where: {
          AND: [
            { acctstoptime: null },
            {
              OR: [
                { acctupdatetime: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
                {
                  AND: [
                    { acctupdatetime: null },
                    { acctstarttime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
                  ],
                },
              ],
            },
          ],
          // radacct user scope usually isn't filtered strictly by sales here unless we join, 
          // but for now we let them see total active sessions or filter if needed. 
          // For simplicity, we won't strictly scope radacct to sales due to no direct ID link,
          // but the summary totalUsers is scoped.
        },
      }),
      prisma.invoice.count({ where: { status: "PENDING", ...invoiceSalesFilter } }),
      prisma.invoice.count({
        where: {
          status: "PENDING",
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
          ...invoiceSalesFilter
        },
      }),
      isSales 
        ? prisma.invoice.aggregate({ where: { status: "PAID", paidAt: { gte: startOfMonth, lte: now }, ...invoiceSalesFilter }, _sum: { amount: true } })
        : prisma.transaction.aggregate({ where: { type: 'INCOME', date: { gte: startOfMonth, lte: now } }, _sum: { amount: true } }),
      isSales
        ? prisma.invoice.aggregate({ where: { status: "PAID", paidAt: { gte: startOfLastMonth, lte: endOfLastMonth }, ...invoiceSalesFilter }, _sum: { amount: true } })
        : prisma.transaction.aggregate({ where: { type: 'INCOME', date: { gte: startOfLastMonth, lte: endOfLastMonth } }, _sum: { amount: true } }),
      prisma.pppoeUser.count({ where: { status: "active", ...salesFilter } }),
      prisma.hotspotVoucher.count({ where: { status: "ACTIVE" } }),
      prisma.radacct.aggregate({ _sum: { acctinputoctets: true, acctoutputoctets: true } }),
      prisma.payment.findMany({
        where: { status: "PAID", invoice: isSales ? { user: { salesId: userId } } : undefined },
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          invoice: {
            select: {
              customerUsername: true,
              user: { select: { username: true } },
            },
          },
        },
      }),
      prisma.invoice.findMany({
        where: { status: "PENDING", dueDate: { lt: now }, ...invoiceSalesFilter },
        take: 5,
        orderBy: { dueDate: "desc" },
        select: {
          customerUsername: true,
          dueDate: true,
          user: { select: { username: true } },
        },
      }),
      prisma.radacct.findFirst({
        where: { acctstarttime: { gte: new Date(Date.now() - 3600000) } },
        select: { radacctid: true }
      }),
      isSales ? prisma.invoice.count({
        where: { status: "PAID", paidAt: { gte: startOfMonth, lte: now }, ...invoiceSalesFilter }
      }) : Promise.resolve(0)
    ]).catch(error => {
      console.error("Parallel Prisma Query failed:", error);
      throw error;
    });

    const usersGrowth = lastMonthUsers > 0 ? ((totalUsers - lastMonthUsers) / lastMonthUsers) * 100 : 0;
    const invoicesChange = lastMonthPendingInvoices > 0 ? ((pendingInvoices - lastMonthPendingInvoices) / lastMonthPendingInvoices) * 100 : 0;

    const revenueThisMonth = Number(incomeThisMonth._sum.amount) || 0;
    const revenueLastMonth = Number(incomeLastMonth._sum.amount) || 0;
    const revenueGrowth = revenueLastMonth > 0 ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100 : 0;

    const formatRevenue = (amount: number) => {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    };

    const totalBytesIn = bandwidthData._sum.acctinputoctets || BigInt(0);
    const totalBytesOut = bandwidthData._sum.acctoutputoctets || BigInt(0);
    const totalBytes = Number(totalBytesIn) + Number(totalBytesOut);

    const formatBandwidth = (bytes: number) => {
      const tb = bytes / 1024 ** 4;
      const gb = bytes / 1024 ** 3;
      if (tb >= 1) return `${tb.toFixed(2)} TB`;
      if (gb >= 1) return `${gb.toFixed(2)} GB`;
      return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
    };

    const activities = [
      ...recentPayments
        .filter((payment: any) => payment.paidAt !== null)
        .map((payment: any) => ({
          id: payment.id,
          user: payment.invoice?.user?.username || payment.invoice?.customerUsername || "Unknown",
          action: "Payment received",
          time: payment.paidAt!.toISOString(),
          status: "success" as const,
        })),
      ...recentInvoices.map((invoice: any) => ({
        id: invoice.customerUsername || "unknown",
        user: invoice.user?.username || invoice.customerUsername || "Unknown",
        action: "Invoice overdue",
        time: invoice.dueDate.toISOString(),
        status: "warning" as const,
      })),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);

    // If these lines execute, both the API and Database are functioning normally
    let databaseStatus = true;
    let apiStatus = true; 
    let radiusStatus = true; 

    // Commission Check
    const commissionData = isSales || userRole === "SALES_MANAGER" ? {
      rate: commissionRate,
      earned: isSales ? earnedCount * commissionRate : 0,
      potential: isSales ? totalUsers * commissionRate : 0
    } : null;

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: {
          value: totalUsers,
          change: `${usersGrowth > 0 ? "+" : ""}${usersGrowth.toFixed(1)}%`,
        },
        activeSessions: {
          value: activeSessions,
          change: null, // Can calculate if needed
        },
        pendingInvoices: {
          value: pendingInvoices,
          change: `${invoicesChange > 0 ? "+" : ""}${invoicesChange.toFixed(1)}%`,
        },
        revenue: {
          value: formatRevenue(revenueThisMonth),
          change: `${revenueGrowth > 0 ? "+" : ""}${revenueGrowth.toFixed(1)}%`,
        },
      },
      commission: commissionData,
      network: {
        pppoeUsers: pppoeActiveCount,
        hotspotSessions: hotspotActiveCount,
        bandwidth: formatBandwidth(totalBytes),
      },
      activities,
      systemStatus: {
        radius: radiusStatus,
        database: databaseStatus,
        api: apiStatus,
      },
    });
  } catch (error: any) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

