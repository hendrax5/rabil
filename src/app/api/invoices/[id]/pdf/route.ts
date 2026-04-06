import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatCurrencyExport, formatDateExport } from '@/lib/utils/export';
import { checkAuth } from '@/lib/apiAuth';

// Get single invoice PDF data
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await params;
    
    // Fetch invoice with relations
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            username: true,
            address: true,
            profile: { select: { name: true, price: true } }
          }
        }
      }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Get company info
    const company = await prisma.company.findFirst();

    // Prepare invoice data for PDF
    const invoiceData = {
      company: {
        name: company?.name || 'NexaRadius',
        address: company?.address || '',
        phone: company?.phone || '',
        email: company?.email || ''
      },
      invoice: {
        number: invoice.invoiceNumber,
        date: formatDateExport(invoice.createdAt, 'long'),
        dueDate: formatDateExport(invoice.dueDate, 'long'),
        status: invoice.status,
        paidAt: invoice.paidAt ? formatDateExport(invoice.paidAt, 'long') : null
      },
      customer: {
        name: invoice.user?.name || invoice.customerName || 'Customer',
        phone: invoice.user?.phone || invoice.customerPhone || '',
        email: invoice.user?.email || '',
        username: invoice.user?.username || invoice.customerUsername || '',
        address: invoice.user?.address || ''
      },
      items: [
        {
          description: `Paket Internet - ${invoice.user?.profile?.name || 'N/A'}`,
          quantity: 1,
          price: invoice.amount,
          total: invoice.amount
        }
      ],
      subtotal: invoice.amount,
      total: invoice.amount,
      amountFormatted: formatCurrencyExport(invoice.amount),
      paymentLink: invoice.paymentLink
    };

    return NextResponse.json({ success: true, data: invoiceData });

  } catch (error) {
    console.error('Invoice PDF error:', error);
    return NextResponse.json({ error: 'Failed to get invoice data' }, { status: 500 });
  }
}
