'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { showError } from '@/lib/sweetalert';
import Swal from 'sweetalert2';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface HistoryItem {
  id: string;
  phone: string;
  message: string;
  status: 'sent' | 'failed';
  response: string;
  providerName?: string;
  providerType?: string;
  sentAt: string;
}

interface Stats {
  total: number;
  sent: number;
  failed: number;
  last24Hours: number;
}

const getProviderColor = (type?: string) => {
  switch (type?.toLowerCase()) {
    case 'mpwa': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'waha': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'fonnte': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'wablas': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
  }
};

export default function WhatsAppHistoryPage() {
  const { t } = useTranslation();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, sent: 0, failed: 0, last24Hours: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchHistory();
  }, [page, statusFilter]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        status: statusFilter,
        search: searchQuery,
      });

      const res = await fetch(`/api/whatsapp/history?${params}`);
      const data = await res.json();

      if (data.success) {
        setHistory(data.data);
        setStats(data.stats);
        setTotalPages(data.pagination.totalPages);
      } else {
        showError('Gagal memuat history');
      }
    } catch (error) {
      console.error('Fetch history error:', error);
      showError('Gagal memuat history');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchHistory();
  };

  const showDetail = (item: HistoryItem) => {
    let responseData;
    try {
      responseData = JSON.parse(item.response);
    } catch {
      responseData = item.response;
    }

    Swal.fire({
      title: 'Detail Pesan',
      html: `
        <div class="text-left space-y-2 text-sm">
          <div><span class="font-semibold text-gray-600">Nomor:</span> ${item.phone}</div>
          <div><span class="font-semibold text-gray-600">Status:</span> ${item.status === 'sent' ? '✅ Terkirim' : '❌ Gagal'}</div>
          ${item.providerName ? `<div><span class="font-semibold text-gray-600">Provider:</span> ${item.providerName} (${item.providerType?.toUpperCase()})</div>` : ''}
          <div><span class="font-semibold text-gray-600">Waktu:</span> ${new Date(item.sentAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</div>
          <div><span class="font-semibold text-gray-600">Pesan:</span></div>
          <div class="whitespace-pre-wrap bg-gray-50 p-2 rounded text-xs max-h-32 overflow-auto">${item.message}</div>
          <div><span class="font-semibold text-gray-600">Response:</span></div>
          <pre class="text-xs bg-gray-50 p-2 rounded max-h-40 overflow-auto">${JSON.stringify(responseData, null, 2)}</pre>
        </div>
      `,
      width: 500,
      confirmButtonText: 'Tutup',
    });
  };

  if (loading && history.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-3 sm:p-4">
      <div className="max-w-7xl mx-auto space-y-3">
        {/* Header */}
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('whatsapp.historyTitle')}
          </h1>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('whatsapp.historySubtitle')}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded">
                <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.total}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('whatsapp.totalMessages')}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded">
                <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold text-green-600">{stats.sent}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('whatsapp.sentToday')}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded">
                <svg className="w-3.5 h-3.5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold text-red-600">{stats.failed}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('whatsapp.failedToday')}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded">
                <svg className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold text-purple-600">{stats.last24Hours}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('whatsapp.activityToday')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {['all', 'sent', 'failed'].map((status) => (
                <button
                  key={status}
                  onClick={() => { setStatusFilter(status); setPage(1); }}
                  className={`h-7 px-2.5 text-[10px] font-medium rounded transition-colors ${
                    statusFilter === status
                      ? status === 'sent' ? 'bg-green-600 text-white' : status === 'failed' ? 'bg-red-600 text-white' : 'bg-teal-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {status === 'all' ? t('common.all') : status === 'sent' ? `✓ ${t('whatsapp.sent')}` : `✗ ${t('whatsapp.failed')}`}
                </button>
              ))}
            </div>
            <div className="flex-1 flex gap-1.5 min-w-[200px]">
              <input
                type="text"
                placeholder={t('whatsapp.searchPhoneMessage')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 h-7 px-2.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white"
              />
              <button
                onClick={handleSearch}
                className="h-7 px-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs rounded transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-xs">{t('whatsapp.noHistory')}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{t('common.time')}</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{t('whatsapp.number')}</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">{t('whatsapp.message')}</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">{t('whatsapp.provider')}</th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{t('common.status')}</th>
                      <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{t('common.action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {history.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-3 py-1.5">
                          <div className="text-xs text-gray-700 dark:text-gray-300">
                            {formatDistanceToNow(new Date(item.sentAt), {
                              addSuffix: true,
                              locale: localeId,
                            })}
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">
                            {new Date(item.sentAt).toLocaleString('id-ID', { 
                              timeZone: 'Asia/Jakarta',
                              dateStyle: 'short',
                              timeStyle: 'short'
                            })}
                          </div>
                        </td>
                        <td className="px-3 py-1.5">
                          <span className="text-xs font-mono text-gray-700 dark:text-gray-300">{item.phone}</span>
                        </td>
                        <td className="px-3 py-1.5 hidden md:table-cell">
                          <div className="max-w-xs truncate text-xs text-gray-600 dark:text-gray-400">
                            {item.message}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 hidden sm:table-cell">
                          {item.providerName ? (
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${getProviderColor(item.providerType)}`}>
                              {item.providerName}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {item.status === 'sent' ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-medium rounded">
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              {t('whatsapp.sent')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-medium rounded">
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              {t('whatsapp.failed')}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <button
                            onClick={() => showDetail(item)}
                            className="p-1 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded transition-colors"
                            title="Detail"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 dark:border-gray-800">
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {t('whatsapp.page')} {page} {t('table.of')} {totalPages}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1 || loading}
                    className="h-6 px-2 text-[10px] font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t('whatsapp.prev')}
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages || loading}
                    className="h-6 px-2 text-[10px] font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {t('whatsapp.next')}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
