'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { formatWIB } from '@/lib/timezone';

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  dueDate: string | Date;
  paidAt: string | Date | null;
  createdAt: string | Date;
}

export default function UserInvoicesTab({ userId }: { userId: string }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const res = await fetch(`/api/pppoe/users/${userId}/activity?type=invoices`);
        const data = await res.json();
        if (data.success) {
          setInvoices(data.data);
        }
      } catch (error) {
        console.error('Failed to load invoices:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No invoices found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {invoices.map((invoice) => (
        <div
          key={invoice.id}
          className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium">{invoice.invoiceNumber}</p>
              <p className="text-sm text-gray-500 mt-1">
                Due: {formatWIB(new Date(invoice.dueDate), 'dd MMM yyyy')}
              </p>
              {invoice.paidAt && (
                <p className="text-xs text-green-600 mt-1">
                  Paid: {formatWIB(new Date(invoice.paidAt), 'dd MMM yyyy')}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="font-bold text-lg">
                {new Intl.NumberFormat('id-ID', {
                  style: 'currency',
                  currency: 'IDR',
                  minimumFractionDigits: 0,
                }).format(invoice.amount)}
              </p>
              <span
                className={`inline-block text-xs px-2 py-1 rounded mt-1 ${
                  invoice.status === 'PAID'
                    ? 'bg-green-50 text-green-700'
                    : invoice.status === 'PENDING'
                    ? 'bg-yellow-50 text-yellow-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {invoice.status}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
