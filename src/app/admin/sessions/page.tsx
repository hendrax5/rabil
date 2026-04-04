'use client';

import { useEffect, useState } from 'react';
import { Activity, Filter, Power, RefreshCw, Wifi, WifiOff, Search, Download } from 'lucide-react';
import Swal from 'sweetalert2';
import { useTranslation } from '@/hooks/useTranslation';

interface Session {
  id: string;
  username: string;
  sessionId: string;
  type: 'pppoe' | 'hotspot';
  nasIpAddress: string;
  framedIpAddress: string;
  macAddress: string;
  startTime: string;
  duration: number;
  durationFormatted: string;
  uploadFormatted: string;
  downloadFormatted: string;
  totalFormatted: string;
  router: { id: string; name: string } | null;
  user: { id: string; name: string; phone: string; profile: string } | null;
  voucher: { 
    id: string; 
    status: string; 
    profile: string;
    batchCode?: string;
    agent?: { id: string; name: string } | null;
  } | null;
}

interface Stats {
  total: number;
  pppoe: number;
  hotspot: number;
  totalBandwidthFormatted: string;
}

interface AllTimeStats {
  totalSessions: number;
  totalBandwidthFormatted: string;
  totalDurationFormatted: string;
}

interface Router {
  id: string;
  name: string;
}

export default function SessionsPage() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [allTimeStats, setAllTimeStats] = useState<AllTimeStats | null>(null);
  const [routers, setRouters] = useState<Router[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [disconnecting, setDisconnecting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [routerFilter, setRouterFilter] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');

  const fetchSessions = async () => {
    try {
      const params = new URLSearchParams();
      params.set('realtime', 'true');
      if (typeFilter) params.set('type', typeFilter);
      if (routerFilter) params.set('routerId', routerFilter);
      if (searchFilter) params.set('search', searchFilter);

      const res = await fetch(`/api/sessions?${params}`);
      const data = await res.json();
      setSessions(data.sessions || []);
      setStats(data.stats);
      setAllTimeStats(data.allTimeStats);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRouters = async () => {
    try {
      const res = await fetch('/api/network/routers');
      const data = await res.json();
      setRouters(data.routers || []);
    } catch (error) {
      console.error('Failed to fetch routers:', error);
    }
  };

  useEffect(() => {
    fetchRouters();
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, [typeFilter, routerFilter, searchFilter]);

  // Export functions
  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams();
      params.set('format', 'excel');
      params.set('mode', 'active');
      if (typeFilter) params.set('type', typeFilter);
      if (routerFilter) params.set('routerId', routerFilter);
      if (searchFilter) params.set('username', searchFilter);
      const res = await fetch(`/api/sessions/export?${params}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `Sessions-Active-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
    } catch (error) { console.error('Export error:', error); await Swal.fire('Error', 'Export failed', 'error'); }
  };

  const handleExportHistoryExcel = async () => {
    const { value: dateRange } = await Swal.fire({
      title: t('sessions.exportHistory'),
      html: `
        <div class="text-left text-sm">
          <label class="block mb-1 font-medium">${t('time.from')}</label>
          <input id="startDate" type="date" class="w-full px-3 py-2 border rounded mb-3" value="${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}">
          <label class="block mb-1 font-medium">${t('time.to')}</label>
          <input id="endDate" type="date" class="w-full px-3 py-2 border rounded" value="${new Date().toISOString().split('T')[0]}">
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: t('common.export'),
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#0d9488',
      preConfirm: () => ({
        startDate: (document.getElementById('startDate') as HTMLInputElement).value,
        endDate: (document.getElementById('endDate') as HTMLInputElement).value
      })
    });
    
    if (!dateRange) return;
    
    try {
      const params = new URLSearchParams();
      params.set('format', 'excel');
      params.set('mode', 'history');
      params.set('startDate', dateRange.startDate);
      params.set('endDate', dateRange.endDate);
      if (typeFilter) params.set('type', typeFilter);
      if (routerFilter) params.set('routerId', routerFilter);
      const res = await fetch(`/api/sessions/export?${params}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `Sessions-History-${dateRange.startDate}-${dateRange.endDate}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
    } catch (error) { console.error('Export error:', error); await Swal.fire('Error', 'Export failed', 'error'); }
  };

  const handleExportPDF = async () => {
    try {
      const params = new URLSearchParams();
      params.set('format', 'pdf');
      params.set('mode', 'active');
      if (typeFilter) params.set('type', typeFilter);
      if (routerFilter) params.set('routerId', routerFilter);
      const res = await fetch(`/api/sessions/export?${params}`);
      const data = await res.json();
      if (data.pdfData) {
        const { jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(14); doc.text(data.pdfData.title, 14, 15);
        doc.setFontSize(8); doc.text(`Generated: ${data.pdfData.generatedAt}`, 14, 21);
        autoTable(doc, { head: [data.pdfData.headers], body: data.pdfData.rows, startY: 26, styles: { fontSize: 7 }, headStyles: { fillColor: [13, 148, 136] } });
        if (data.pdfData.summary) {
          const finalY = (doc as any).lastAutoTable.finalY + 8;
          doc.setFontSize(9); doc.setFont('helvetica', 'bold');
          data.pdfData.summary.forEach((s: any, i: number) => { doc.text(`${s.label}: ${s.value}`, 14, finalY + (i * 5)); });
        }
        doc.save(`Sessions-Active-${new Date().toISOString().split('T')[0]}.pdf`);
      }
    } catch (error) { console.error('PDF error:', error); await Swal.fire('Error', 'PDF export failed', 'error'); }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSessions(new Set(sessions.map(s => s.sessionId)));
    } else {
      setSelectedSessions(new Set());
    }
  };

  const handleSelectSession = (sessionId: string, checked: boolean) => {
    const newSelected = new Set(selectedSessions);
    if (checked) {
      newSelected.add(sessionId);
    } else {
      newSelected.delete(sessionId);
    }
    setSelectedSessions(newSelected);
  };

  const handleDisconnect = async (sessionIds: string[]) => {
    const result = await Swal.fire({
      title: t('sessions.disconnect') + '?',
      text: `${t('sessions.disconnect')} ${sessionIds.length} ${t('sessions.title').toLowerCase()}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#DC2626',
      cancelButtonColor: '#6B7280',
      confirmButtonText: t('sessions.disconnect'),
      cancelButtonText: t('common.cancel')
    });

    if (!result.isConfirmed) return;

    setDisconnecting(true);
    try {
      const res = await fetch('/api/sessions/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds }),
      });

      const data = await res.json();
      
      if (data.success) {
        await Swal.fire({
          title: t('notifications.success'),
          html: `${t('sessions.disconnect')}: <strong>${data.summary.successful}</strong>`,
          icon: 'success',
          confirmButtonColor: '#0d9488'
        });
        setSelectedSessions(new Set());
        await fetchSessions();
      } else {
        await Swal.fire(t('notifications.error'), t('notifications.failed'), 'error');
      }
    } catch (error) {
      await Swal.fire(t('notifications.error'), t('notifications.failed'), 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleBulkDisconnect = () => {
    const sessionIds = Array.from(selectedSessions);
    handleDisconnect(sessionIds);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            {t('sessions.title')}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('sessions.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            <Download className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            onClick={handleExportHistoryExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Download className="w-3.5 h-3.5" />
            {t('sessions.history')}
          </button>
          <button
            onClick={fetchSessions}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="text-[10px] font-medium text-gray-500 uppercase">{t('sessions.active')}</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{stats.total}</div>
          </div>
          <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="text-[10px] font-medium text-gray-500 uppercase flex items-center gap-1">
              <Wifi className="w-3 h-3" /> PPPoE
            </div>
            <div className="text-lg font-bold text-teal-600">{stats.pppoe}</div>
          </div>
          <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="text-[10px] font-medium text-gray-500 uppercase flex items-center gap-1">
              <WifiOff className="w-3 h-3" /> Hotspot
            </div>
            <div className="text-lg font-bold text-orange-600">{stats.hotspot}</div>
          </div>
          <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="text-[10px] font-medium text-gray-500 uppercase">{t('dashboard.bandwidth')}</div>
            <div className="text-lg font-bold text-green-600">{stats.totalBandwidthFormatted}</div>
          </div>
        </div>
      )}

      {/* All-Time Stats */}
      {allTimeStats && (
        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 p-3 rounded-lg border border-teal-200 dark:border-teal-800">
          <h2 className="text-xs font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-teal-600" />
            All-Time Statistics
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] text-gray-600 dark:text-gray-400">Total Sessions</div>
              <div className="text-base font-bold text-gray-900 dark:text-white">{allTimeStats.totalSessions.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-600 dark:text-gray-400">Bandwidth Used</div>
              <div className="text-base font-bold text-teal-600">{allTimeStats.totalBandwidthFormatted}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-600 dark:text-gray-400">Total Duration</div>
              <div className="text-base font-bold text-cyan-600">{allTimeStats.totalDurationFormatted}</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('common.filter')}:</span>
            </div>
            
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
            >
              <option value="">{t('common.all')} {t('common.type')}</option>
              <option value="pppoe">PPPoE</option>
              <option value="hotspot">Hotspot</option>
            </select>

            <select
              value={routerFilter}
              onChange={(e) => setRouterFilter(e.target.value)}
              className="px-2 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
            >
              <option value="">{t('common.all')} Router</option>
              {routers.map(router => (
                <option key={router.id} value={router.id}>{router.name}</option>
              ))}
            </select>

            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder={t('common.search')}
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-7 pr-3 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs w-40"
              />
            </div>
          </div>

          {selectedSessions.size > 0 && (
            <button
              onClick={handleBulkDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-xs"
            >
              <Power className="w-3.5 h-3.5" />
              {t('sessions.disconnect')} ({selectedSessions.size})
            </button>
          )}
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={selectedSessions.size === sessions.length && sessions.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 w-3.5 h-3.5"
                  />
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('common.type')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('sessions.username')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden md:table-cell">User/Voucher</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden lg:table-cell">Router</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden sm:table-cell">{t('sessions.ipAddress')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('sessions.duration')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden lg:table-cell">↑</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden lg:table-cell">↓</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('sessions.total')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-gray-500 text-xs">
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedSessions.has(session.sessionId)}
                        onChange={(e) => handleSelectSession(session.sessionId, e.target.checked)}
                        className="rounded border-gray-300 w-3.5 h-3.5"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        session.type === 'pppoe' 
                          ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      }`}>
                        {session.type === 'pppoe' ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                        {session.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-gray-900 dark:text-white">{session.username}</td>
                    <td className="px-3 py-2 text-xs hidden md:table-cell">
                      {session.user && (
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white text-[10px]">{session.user.name}</div>
                          <div className="text-[9px] text-gray-500">{session.user.profile}</div>
                        </div>
                      )}
                      {session.voucher && (
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white text-[10px]">{session.voucher.profile}</div>
                          {session.voucher.agent && (
                            <div className="text-[9px] text-purple-600">🏪 {session.voucher.agent.name}</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                      {session.router?.name || '-'}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                      {session.framedIpAddress}
                    </td>
                    <td className="px-3 py-2 text-[10px] font-medium text-gray-900 dark:text-white">
                      {session.durationFormatted}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-gray-600 dark:text-gray-400 hidden lg:table-cell">{session.uploadFormatted}</td>
                    <td className="px-3 py-2 text-[10px] text-gray-600 dark:text-gray-400 hidden lg:table-cell">{session.downloadFormatted}</td>
                    <td className="px-3 py-2 text-[10px] font-medium text-gray-900 dark:text-white">{session.totalFormatted}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleDisconnect([session.sessionId])}
                        disabled={disconnecting}
                        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50"
                        title="Disconnect"
                      >
                        <Power className="w-3.5 h-3.5" />
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
