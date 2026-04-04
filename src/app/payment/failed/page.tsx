'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { XCircle, RefreshCw, Home, Loader2, AlertTriangle } from 'lucide-react';

function PaymentFailedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const reason = searchParams.get('reason');
  const [loading, setLoading] = useState(true);
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [companyPhone, setCompanyPhone] = useState('6281234567890');

  useEffect(() => {
    if (token) fetchInvoiceInfo(); else setLoading(false);
    fetch('/api/company').then(res => res.json()).then(data => { if (data.phone) { let phone = data.phone.replace(/^0/, '62'); if (!phone.startsWith('62')) phone = '62' + phone; setCompanyPhone(phone); } }).catch(() => {});
  }, [token]);

  const fetchInvoiceInfo = async () => {
    try {
      const res = await fetch(`/api/invoices/check?token=${token}`);
      const data = await res.json();
      if (res.ok && data.invoice) setInvoiceNumber(data.invoice.invoiceNumber);
    } catch { } finally { setLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="text-center"><Loader2 className="w-8 h-8 animate-spin text-red-600 mx-auto mb-2" /><p className="text-xs text-gray-600 dark:text-gray-400">Memuat informasi...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 py-6 px-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="text-center">
          <div className="inline-block relative mb-3">
            <div className="absolute inset-0 bg-red-400 rounded-full opacity-20 animate-pulse"></div>
            <div className="relative w-16 h-16 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
              <XCircle className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-lg font-bold text-red-700 dark:text-red-400 mb-1">Pembayaran Gagal</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400">Transaksi tidak dapat diselesaikan</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div className="p-4 space-y-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            {invoiceNumber && <div className="text-center"><p className="text-[10px] text-gray-500 mb-0.5">Invoice</p><p className="text-sm font-bold text-gray-900 dark:text-white">#{invoiceNumber}</p></div>}
            {reason && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2.5"><p className="text-[10px] font-medium text-red-800 dark:text-red-300 text-center">{decodeURIComponent(reason)}</p></div>}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Kemungkinan Penyebab:</p>
              <ul className="text-[10px] text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                <li>Saldo atau limit kartu tidak mencukupi</li>
                <li>Pembayaran dibatalkan oleh pengguna</li>
                <li>Transaksi ditolak oleh bank</li>
                <li>Waktu pembayaran telah habis</li>
                <li>Koneksi internet terputus</li>
              </ul>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Tidak ada biaya yang dikenakan.</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Silakan coba lagi atau hubungi kami.</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => router.push('/')} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-red-500"><Home className="w-3.5 h-3.5" />Kembali</button>
          {token && <button onClick={() => router.push(`/pay/${token}`)} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-white bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 rounded-lg"><RefreshCw className="w-3.5 h-3.5" />Coba Lagi</button>}
        </div>

        <div className="text-center">
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">Butuh bantuan?</p>
          <a href={`https://wa.me/${companyPhone}`} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:text-green-700 dark:text-green-400 font-medium">Hubungi CS via WhatsApp</a>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-red-600" /></div>}>
      <PaymentFailedContent />
    </Suspense>
  );
}
