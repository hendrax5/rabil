'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, Download, ArrowRight, Loader2, Calendar, User, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Invoice { id: string; invoiceNumber: string; amount: number; status: string; paidAt: string | null; dueDate: string; customerName: string | null; customerPhone: string | null; customerUsername: string | null; user: { name: string; phone: string; username: string; expiredAt: string | null; } | null; }

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (token) fetchInvoiceStatus(); else { setError('Token tidak ditemukan'); setLoading(false); } }, [token]);

  const fetchInvoiceStatus = async () => {
    try {
      const res = await fetch(`/api/invoices/check?token=${token}`);
      const data = await res.json();
      if (res.ok && data.invoice) setInvoice(data.invoice); else setError(data.error || 'Invoice tidak ditemukan');
    } catch { setError('Gagal mengecek status'); } finally { setLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="text-center"><Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-2" /><p className="text-xs text-gray-600 dark:text-gray-400">Mengecek status...</p></div>
    </div>
  );

  if (error || !invoice) return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 text-center">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-3"><span className="text-xl">❌</span></div>
        <h1 className="text-base font-bold text-gray-900 dark:text-white mb-1">Oops!</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <button onClick={() => router.push('/')} className="px-4 py-2 text-xs font-medium bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg">Kembali</button>
      </div>
    </div>
  );

  const isPaid = invoice.status === 'PAID';
  const customerName = invoice.user?.name || invoice.customerName || 'Customer';
  const customerPhone = invoice.user?.phone || invoice.customerPhone || '-';
  const expiryDate = invoice.user?.expiredAt;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-900 dark:to-gray-800 py-6 px-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="text-center">
          <div className="inline-block relative mb-3">
            <div className="absolute inset-0 bg-green-400 rounded-full opacity-20 animate-ping"></div>
            <div className="relative w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-lg font-bold text-green-700 dark:text-green-400 mb-1">Pembayaran Berhasil! 🎉</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">{isPaid ? 'Invoice telah terbayar' : 'Sedang diproses'}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3 text-white">
            <div className="flex items-center justify-between mb-1"><span className="text-[10px] opacity-80">Invoice</span>{isPaid && <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-medium">LUNAS</span>}</div>
            <p className="text-sm font-bold">#{invoice.invoiceNumber}</p>
          </div>
          <div className="p-4 space-y-4">
            <div className="text-center py-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
              <p className="text-[10px] text-gray-500 mb-1">Total Pembayaran</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(invoice.amount)}</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-2"><User className="w-4 h-4 text-gray-400 mt-0.5" /><div><p className="text-[10px] text-gray-500">Pelanggan</p><p className="text-xs font-semibold text-gray-900 dark:text-white">{customerName}</p><p className="text-[10px] text-gray-500">{customerPhone}</p></div></div>
              {invoice.paidAt && <div className="flex items-start gap-2"><CreditCard className="w-4 h-4 text-gray-400 mt-0.5" /><div><p className="text-[10px] text-gray-500">Tanggal Pembayaran</p><p className="text-xs font-semibold text-gray-900 dark:text-white">{new Date(invoice.paidAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p></div></div>}
              {expiryDate && <div className="flex items-start gap-2"><Calendar className="w-4 h-4 text-gray-400 mt-0.5" /><div><p className="text-[10px] text-gray-500">Masa Aktif Sampai</p><p className="text-xs font-semibold text-green-600 dark:text-green-400">{new Date(expiryDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div></div>}
            </div>
            {isPaid && <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-2.5"><p className="text-[10px] text-green-800 dark:text-green-300 text-center">✅ Layanan telah diaktifkan kembali</p></div>}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => router.push(`/pay/${token}`)} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-500"><Download className="w-3.5 h-3.5" />Lihat Invoice</button>
          <button onClick={() => router.push('/')} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-lg">Selesai<ArrowRight className="w-3.5 h-3.5" /></button>
        </div>

        <p className="text-center text-[10px] text-gray-500">Terima kasih atas pembayaran Anda! 🙏</p>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
