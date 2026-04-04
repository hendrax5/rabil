'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Clock, RefreshCw, ExternalLink, Loader2, Info } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Invoice { id: string; invoiceNumber: string; amount: number; status: string; paymentLink: string | null; }

function PaymentPendingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => { if (token) fetchInvoiceStatus(); else { setError('Token tidak ditemukan'); setLoading(false); } }, [token]);
  useEffect(() => { if (!autoRefresh || !token) return; const interval = setInterval(() => fetchInvoiceStatus(true), 5000); return () => clearInterval(interval); }, [autoRefresh, token]);

  const fetchInvoiceStatus = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/invoices/check?token=${token}`);
      const data = await res.json();
      if (res.ok && data.invoice) { setInvoice(data.invoice); if (data.invoice.status === 'PAID') router.push(`/payment/success?token=${token}`); }
      else setError(data.error || 'Invoice tidak ditemukan');
    } catch { if (!silent) setError('Gagal mengecek status'); } finally { setLoading(false); setChecking(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="text-center"><Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-2" /><p className="text-xs text-gray-600 dark:text-gray-400">Mengecek status...</p></div>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-gray-900 dark:to-gray-800 py-6 px-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="text-center">
          <div className="inline-block relative mb-3">
            <div className="absolute inset-0 bg-teal-400 rounded-full opacity-20 animate-pulse"></div>
            <div className="relative w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
              <Clock className="w-8 h-8 text-white animate-bounce" />
            </div>
          </div>
          <h1 className="text-lg font-bold text-teal-700 dark:text-teal-400 mb-1">Menunggu Pembayaran</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">Pembayaran sedang diproses</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-3 text-white">
            <div className="flex items-center justify-between mb-1"><span className="text-[10px] opacity-80">Invoice</span><span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-medium">PENDING</span></div>
            <p className="text-sm font-bold">#{invoice.invoiceNumber}</p>
          </div>
          <div className="p-4 space-y-4">
            <div className="text-center py-4 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-lg">
              <p className="text-[10px] text-gray-500 mb-1">Total Pembayaran</p>
              <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">{formatCurrency(invoice.amount)}</p>
            </div>
            <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 mt-0.5 flex-shrink-0" />
                <div className="text-[10px] text-teal-800 dark:text-teal-300 space-y-1">
                  <p className="font-semibold">Langkah Selanjutnya:</p>
                  <ol className="list-decimal list-inside space-y-0.5 ml-1">
                    <li>Selesaikan pembayaran</li>
                    <li>Jangan tutup halaman ini</li>
                    <li>Status akan otomatis terupdate</li>
                  </ol>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-500"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div><span>Auto-refresh setiap 5 detik</span></div>
            {invoice.paymentLink && (
              <a href={invoice.paymentLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 w-full px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 rounded-lg">
                <ExternalLink className="w-3.5 h-3.5" />Buka Halaman Pembayaran
              </a>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <button onClick={() => { setChecking(true); fetchInvoiceStatus(); }} disabled={checking} className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-teal-500 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />{checking ? 'Mengecek...' : 'Cek Status'}
          </button>
          <button onClick={() => router.push(`/pay/${token}`)} className="w-full px-4 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Kembali ke Invoice</button>
        </div>

        <p className="text-center text-[10px] text-gray-500">Halaman akan otomatis redirect setelah pembayaran berhasil</p>
      </div>
    </div>
  );
}

export default function PaymentPendingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>}>
      <PaymentPendingContent />
    </Suspense>
  );
}
