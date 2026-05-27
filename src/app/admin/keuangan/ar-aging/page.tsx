'use client';
import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { showSuccess, showError } from '@/lib/sweetalert';
import { Wallet, MessageSquare, AlertCircle, RefreshCw, Download, FileText } from 'lucide-react';

interface AgingSummary {
  totalOutstanding: number;
  buckets: {
    current: number;
    days30: number;
    days60: number;
    days90: number;
    over90: number;
  };
}

interface CustomerAging {
  username: string;
  name: string;
  phone: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}

export default function ArAgingReportPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<AgingSummary | null>(null);
  const [customers, setCustomers] = useState<CustomerAging[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadAgingData();
  }, []);

  const loadAgingData = async () => {
    try {
      const res = await fetch('/api/keuangan/ar-aging');
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
        setCustomers(data.customers || []);
      }
    } catch (error) {
      console.error('Error loading AR Aging data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAgingData();
  };

  const handleSendReminder = async (customer: CustomerAging) => {
    if (!customer.phone || customer.phone === '-') {
      await showError('Customer has no phone number registered');
      return;
    }
    
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: customer.phone,
          message: `⚠️ *Pemberitahuan Tagihan Tertunggak*\n\nHalo ${customer.name || customer.username},\n\nKami menginformasikan bahwa Anda memiliki tagihan tertunggak sebesar *Rp ${customer.total.toLocaleString('id-ID')}*.\n\nSilakan lakukan pembayaran untuk menghindari penangguhan layanan.\n\nTerima kasih 🙏`
        })
      });
      
      if (res.ok) {
        await showSuccess(`Reminder sent to ${customer.name}`);
      } else {
        await showError('Failed to send WhatsApp reminder');
      }
    } catch (error) {
      console.error(error);
      await showError('Error sending reminder');
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-5 w-5 animate-spin text-primary" />
        <span className="ml-2 text-xs text-gray-500">Loading aging report...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Accounts Receivable (AR) Aging</h1>
          <p className="page-subtitle">Outstanding billing receivables categorized by days overdue</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center px-3 py-1.5 text-xs bg-primary hover:bg-primary/95 text-white rounded gap-1 disabled:opacity-50 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="card-soft p-5 border-l-4 border-l-blue-500">
            <p className="text-[10px] text-gray-500 uppercase font-semibold">Total Outstanding</p>
            <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-1">{formatCurrency(summary.totalOutstanding)}</p>
            <p className="text-[10px] text-gray-400 mt-1">Total unpaid balance</p>
          </div>

          <div className="card-soft p-5 border-l-4 border-l-green-500">
            <p className="text-[10px] text-gray-500 uppercase font-semibold">Current (Not Overdue)</p>
            <p className="text-lg font-bold text-green-600 mt-1">{formatCurrency(summary.buckets.current)}</p>
            <p className="text-[10px] text-gray-400 mt-1">Before due date</p>
          </div>

          <div className="card-soft p-5 border-l-4 border-l-yellow-500">
            <p className="text-[10px] text-gray-500 uppercase font-semibold">1 - 30 Days Overdue</p>
            <p className="text-lg font-bold text-yellow-600 mt-1">{formatCurrency(summary.buckets.days30)}</p>
            <p className="text-[10px] text-gray-400 mt-1">First warning stage</p>
          </div>

          <div className="card-soft p-5 border-l-4 border-l-orange-500">
            <p className="text-[10px] text-gray-500 uppercase font-semibold">31 - 60 Days Overdue</p>
            <p className="text-lg font-bold text-orange-600 mt-1">{formatCurrency(summary.buckets.days60)}</p>
            <p className="text-[10px] text-gray-400 mt-1">Second warning stage</p>
          </div>

          <div className="card-soft p-5 border-l-4 border-l-red-500">
            <p className="text-[10px] text-gray-500 uppercase font-semibold">&gt; 60 Days Overdue</p>
            <p className="text-lg font-bold text-red-600 mt-1">{formatCurrency(summary.buckets.days90 + summary.buckets.over90)}</p>
            <p className="text-[10px] text-gray-400 mt-1">Critical collection stage</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="card-soft overflow-hidden">
        <div className="p-4 border-b dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-xs">
            <input
              type="text"
              placeholder="Search customer name or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
            />
          </div>
          <span className="text-xs font-semibold text-gray-500">
            Showing {filteredCustomers.length} of {customers.length} debtors
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Current</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">1-30 Days</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">31-60 Days</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">&gt;60 Days</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Total Debt</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-xs">No aging records found</td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => (
                  <tr key={cust.username} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 text-xs">
                    <td className="px-4 py-3.5">
                      <p className="font-semibold">{cust.name}</p>
                      <p className="text-[10px] text-gray-500 font-mono">@{cust.username} | {cust.phone}</p>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono">
                      {cust.current > 0 ? formatCurrency(cust.current) : '-'}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-yellow-600 font-medium">
                      {cust.days30 > 0 ? formatCurrency(cust.days30) : '-'}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-orange-600 font-medium">
                      {cust.days60 > 0 ? formatCurrency(cust.days60) : '-'}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-red-600 font-bold">
                      {cust.days90 + cust.over90 > 0 ? formatCurrency(cust.days90 + cust.over90) : '-'}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold font-mono text-gray-800 dark:text-zinc-200">
                      {formatCurrency(cust.total)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => handleSendReminder(cust)}
                        title="Send WhatsApp payment reminder"
                        className="p-1.5 bg-green-50 hover:bg-green-100 dark:bg-green-950/20 dark:hover:bg-green-950/40 text-green-600 rounded transition"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
