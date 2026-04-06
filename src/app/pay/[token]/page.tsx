'use client';
import { showError } from '@/lib/sweetalert';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Wifi, CheckCircle, Clock, AlertCircle, CreditCard, Building2, Loader2 } from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  status: string;
  dueDate: string;
  createdAt: string;
  paidAt: string | null;
  user: { profile: { name: string; } | null; } | null;
}

interface PaymentGateway { id: string; name: string; provider: string; isActive: boolean; }
interface CompanySetting { companyName: string; address: string | null; phone: string | null; email: string | null; }

export default function PaymentPage() {
  const params = useParams();
  const token = params.token as string;
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [paymentGateways, setPaymentGateways] = useState<PaymentGateway[]>([]);
  const [company, setCompany] = useState<CompanySetting | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => { loadInvoice(); }, [token]);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/invoices/by-token/${token}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to load invoice'); return; }
      setInvoice(data.invoice);
      setPaymentGateways(data.paymentGateways || []);
      setCompany(data.company || null);
    } catch (err) { setError('Failed to load invoice'); } finally { setLoading(false); }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PAID: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      OVERDUE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    };
    const icons: Record<string, React.ReactNode> = { PAID: <CheckCircle className="w-3 h-3" />, PENDING: <Clock className="w-3 h-3" />, OVERDUE: <AlertCircle className="w-3 h-3" /> };
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${styles[status] || 'bg-gray-100'}`}>{icons[status]} {status}</span>;
  };

  const handlePayment = async (gateway: string) => {
    if (!invoice) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/payment/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: invoice.id, gateway }) });
      const data = await res.json();
      if (!res.ok) { await showError(data.error || 'Failed'); return; }
      if (data.paymentUrl) window.location.href = data.paymentUrl; else await showError('Payment URL not available');
    } catch { await showError('Failed to process payment'); } finally { setProcessing(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-2" /><p className="text-xs text-gray-600 dark:text-gray-400">Loading...</p></div>
    </div>
  );

  if (error || !invoice) return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 max-w-sm w-full text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">Invoice Not Found</h2>
        <p className="text-xs text-gray-600 dark:text-gray-400">{error || 'The payment link is invalid or has expired.'}</p>
      </div>
    </div>
  );

  if (invoice.status === 'PAID') return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 max-w-sm w-full text-center">
        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3"><CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" /></div>
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">Payment Received</h2>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">This invoice has been paid</p>
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-left space-y-1.5">
          <div className="flex justify-between text-xs"><span className="text-gray-500">Invoice</span><span className="font-mono font-medium text-gray-900 dark:text-white">{invoice.invoiceNumber}</span></div>
          <div className="flex justify-between text-xs"><span className="text-gray-500">Amount</span><span className="font-bold text-green-600">{formatCurrency(invoice.amount)}</span></div>
          {invoice.paidAt && <div className="flex justify-between text-xs"><span className="text-gray-500">Paid At</span><span className="text-gray-900 dark:text-white">{formatDate(invoice.paidAt)}</span></div>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-6 px-4">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-teal-600 to-cyan-600 rounded-full mb-2"><Wifi className="w-4 h-4 text-white" /><span className="text-xs font-medium text-white">Payment Invoice</span></div>
          <p className="text-xs text-gray-600 dark:text-gray-400">Please review your invoice details below</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-3"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-white">Invoice Details</span>{getStatusBadge(invoice.status)}</div></div>
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-700"><span className="text-xs text-gray-500">Invoice Number</span><span className="font-mono font-bold text-sm text-gray-900 dark:text-white">{invoice.invoiceNumber}</span></div>
            <div><p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">Customer Information</p>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2.5 space-y-1">
                <div className="flex justify-between text-xs"><span className="text-gray-500">Name</span><span className="font-medium text-gray-900 dark:text-white">{invoice.customerName}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">Phone</span><span className="font-medium text-gray-900 dark:text-white">{invoice.customerPhone}</span></div>
                {invoice.user?.profile?.name && <div className="flex justify-between text-xs"><span className="text-gray-500">Package</span><span className="font-medium text-gray-900 dark:text-white">{invoice.user.profile.name}</span></div>}
              </div>
            </div>
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-lg p-4 text-center"><p className="text-[10px] text-gray-500 mb-1">Total Amount</p><p className="text-2xl font-bold text-teal-600 dark:text-teal-400">{formatCurrency(invoice.amount)}</p></div>
            <div className="grid grid-cols-2 gap-3"><div><p className="text-[10px] text-gray-500 mb-0.5">Issue Date</p><p className="text-xs font-medium text-gray-900 dark:text-white">{formatDate(invoice.createdAt)}</p></div><div><p className="text-[10px] text-gray-500 mb-0.5">Due Date</p><p className="text-xs font-medium text-gray-900 dark:text-white">{formatDate(invoice.dueDate)}</p></div></div>
            {invoice.status === 'OVERDUE' && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2.5"><div className="flex items-start gap-2"><AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" /><div><p className="text-xs font-semibold text-red-800 dark:text-red-300">Payment Overdue</p><p className="text-[10px] text-red-700 dark:text-red-400 mt-0.5">Please make payment as soon as possible.</p></div></div></div>}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700"><h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><CreditCard className="w-4 h-4 text-teal-600" />Payment Methods</h2></div>
          <div className="p-4">
            {paymentGateways.length === 0 ? <div className="text-center py-6"><Building2 className="w-10 h-10 text-gray-400 mx-auto mb-2" /><p className="text-xs text-gray-600 dark:text-gray-400">No payment methods available.</p></div> : (
              <div className="space-y-2">{paymentGateways.map((gateway) => (
                <button key={gateway.id} onClick={() => handlePayment(gateway.provider)} disabled={processing} className="w-full flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-teal-500 dark:hover:border-teal-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all disabled:opacity-50">
                  <div className="flex items-center gap-2.5"><div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-lg flex items-center justify-center"><CreditCard className="w-4 h-4 text-white" /></div><div className="text-left"><p className="text-xs font-semibold text-gray-900 dark:text-white">{gateway.name}</p><p className="text-[10px] text-gray-500 capitalize">{gateway.provider}</p></div></div>
                  {processing ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <span className="text-[10px] text-gray-500">Pay Now →</span>}
                </button>
              ))}</div>
            )}
          </div>
        </div>
        {company && <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 text-center"><h3 className="text-sm font-semibold text-gray-900 dark:text-white">{company.companyName}</h3>{company.address && <p className="text-[10px] text-gray-500 mt-1">📍 {company.address}</p>}<div className="flex flex-wrap justify-center gap-3 text-[10px] text-gray-500 mt-2">{company.phone && <span>📞 {company.phone}</span>}{company.email && <span>✉️ {company.email}</span>}</div></div>}
        <div className="text-center space-y-1"><p className="text-[10px] text-gray-500">Secure payment powered by</p><p className="text-xs font-semibold text-teal-600 dark:text-teal-400">NexaRadiusRADIUS</p></div>
      </div>
    </div>
  );
}
