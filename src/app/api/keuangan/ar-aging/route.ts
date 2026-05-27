import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const now = new Date();
    
    // Fetch all unpaid invoices
    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      include: {
        user: {
          select: {
            username: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    const agingBuckets = {
      current: 0,
      days30: 0,
      days60: 0,
      days90: 0,
      over90: 0,
    };

    const customerAging: Record<string, {
      username: string;
      name: string;
      phone: string;
      current: number;
      days30: number;
      days60: number;
      days90: number;
      over90: number;
      total: number;
    }> = {};

    for (const inv of unpaidInvoices) {
      const dueDate = new Date(inv.dueDate);
      const isOverdue = dueDate < now;
      const diffTime = Math.abs(now.getTime() - dueDate.getTime());
      const diffDays = isOverdue ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;

      let bucket: 'current' | 'days30' | 'days60' | 'days90' | 'over90' = 'current';

      if (!isOverdue) {
        bucket = 'current';
      } else if (diffDays <= 30) {
        bucket = 'days30';
      } else if (diffDays <= 60) {
        bucket = 'days60';
      } else if (diffDays <= 90) {
        bucket = 'days90';
      } else {
        bucket = 'over90';
      }

      // Add to overall stats
      agingBuckets[bucket] += inv.amount;

      // Group by user
      const userKey = inv.userId || 'unknown';
      if (!customerAging[userKey]) {
        customerAging[userKey] = {
          username: inv.customerUsername || inv.user?.username || 'Guest',
          name: inv.customerName || inv.user?.name || 'Walk-in Customer',
          phone: inv.customerPhone || inv.user?.phone || '-',
          current: 0,
          days30: 0,
          days60: 0,
          days90: 0,
          over90: 0,
          total: 0,
        };
      }

      customerAging[userKey][bucket] += inv.amount;
      customerAging[userKey].total += inv.amount;
    }

    const customersList = Object.values(customerAging).sort((a, b) => b.total - a.total);

    return NextResponse.json({
      success: true,
      summary: {
        totalOutstanding: Object.values(agingBuckets).reduce((a, b) => a + b, 0),
        buckets: agingBuckets,
      },
      customers: customersList,
    });
  } catch (error: any) {
    console.error('AR Aging Report error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
