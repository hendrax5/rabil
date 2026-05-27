'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Server, Wifi, WifiOff, AlertTriangle, RefreshCw, Signal,
  Activity, Zap, ChevronLeft, Download, Upload, BarChart2,
  CheckCircle2, XCircle, Clock, Terminal, Package, Eye,
  Filter, Search, ArrowUpDown,
} from 'lucide-react';
import { showError } from '@/lib/sweetalert';
import { getSignalQuality, getSignalColor, SIGNAL_THRESHOLDS } from '@/lib/olt/types';

// ── Types ─────────────────────────────────────────────────────────────────
interface OltInfo {
  id: string;
  name: string;
  ipAddress: string;
  vendor: string;
  connection: string;
  port: number;
  status: string;
  lastSync: string | null;
}

interface OnuInfo {
  onuId: string;
  sn: string;
  board: string;
  port: string;
  state: 'working' | 'offline' | 'los' | 'degraded' | 'unknown';
  rxPower: number | null;
  txPower: number | null;
  profile?: string;
  lastSync: string;
}

interface PonPort {
  board: string;
  port: string;
  totalOnus: number;
  activeOnus: number;
  offlineOnus: number;
  losOnus: number;
  capacity: number;
  utilization: number;
}

interface AlarmInfo {
  onuId: string;
  sn: string;
  board: string;
  port: string;
  alarmType: string;
  rxPower: number | null;
  description: string;
}

// ── Signal Power Bar ──────────────────────────────────────────────────────
function SignalBar({ rxPower }: { rxPower: number | null }) {
  if (rxPower === null) {
    return <span className="text-[10px] text-gray-400">N/A</span>;
  }
  const quality = getSignalQuality(rxPower);
  const color = getSignalColor(quality);
  // Map dBm to percentage: -10dBm=100%, -40dBm=0%
  const pct = Math.max(0, Math.min(100, ((rxPower + 40) / 30) * 100));

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden w-16">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-mono" style={{ color }}>
        {rxPower.toFixed(1)} dBm
      </span>
    </div>
  );
}

// ── ONU State Badge ───────────────────────────────────────────────────────
function StateBadge({ state }: { state: OnuInfo['state'] }) {
  const config = {
    working:  { label: 'Online',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', dot: 'bg-emerald-500' },
    offline:  { label: 'Offline',  cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', dot: 'bg-gray-400' },
    los:      { label: 'LOS',      cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500 animate-pulse' },
    degraded: { label: 'Degraded', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-500' },
    unknown:  { label: 'Unknown',  cls: 'bg-gray-100 text-gray-500', dot: 'bg-gray-300' },
  }[state] ?? { label: state, cls: 'bg-gray-100 text-gray-500', dot: 'bg-gray-300' };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

// ── PON Port Card ─────────────────────────────────────────────────────────
function PonPortCard({ port, onClick, active }: { port: PonPort; onClick: () => void; active: boolean }) {
  const utilColor = port.utilization > 80 ? '#ef4444' : port.utilization > 60 ? '#f59e0b' : '#10b981';
  return (
    <button
      onClick={onClick}
      className={`text-left p-3 rounded-xl border transition-all ${
        active
          ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-900 hover:border-teal-300'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-mono font-bold text-gray-800 dark:text-white">
          {port.board}/{port.port}
        </span>
        <span className="text-[10px] font-medium" style={{ color: utilColor }}>
          {port.utilization}%
        </span>
      </div>

      {/* Utilization bar */}
      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mb-2">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${port.utilization}%`, backgroundColor: utilColor }}
        />
      </div>

      <div className="grid grid-cols-3 gap-1 text-center">
        <div>
          <p className="text-[9px] text-gray-400">Total</p>
          <p className="text-[11px] font-bold text-gray-700 dark:text-gray-200">{port.totalOnus}</p>
        </div>
        <div>
          <p className="text-[9px] text-emerald-500">Online</p>
          <p className="text-[11px] font-bold text-emerald-600">{port.activeOnus}</p>
        </div>
        <div>
          <p className="text-[9px] text-red-400">LOS</p>
          <p className="text-[11px] font-bold text-red-500">{port.losOnus}</p>
        </div>
      </div>
    </button>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────
export default function OLTDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [olt, setOlt] = useState<OltInfo | null>(null);
  const [onus, setOnus] = useState<OnuInfo[]>([]);
  const [ports, setPorts] = useState<PonPort[]>([]);
  const [alarms, setAlarms] = useState<AlarmInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'onus' | 'ports' | 'alarms'>('onus');
  const [selectedPort, setSelectedPort] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  const loadOltInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/network/olts');
      const data = await res.json();
      if (data.success) {
        const found = data.olts.find((o: any) => o.id === id);
        if (found) setOlt(found);
      }
    } catch (e) {}
  }, [id]);

  const fetchOnus = useCallback(async (refresh = false) => {
    try {
      const url = `/api/network/olts/${id}/onus?refresh=${refresh}&mode=${refresh ? 'live' : 'db'}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setOnus(data.onus || []);
        setLastRefresh(new Date());
      }
    } catch (e) {}
  }, [id]);

  const fetchPorts = useCallback(async (live = false) => {
    try {
      const res = await fetch(`/api/network/olts/${id}/pon-ports?live=${live}`);
      const data = await res.json();
      if (data.success) setPorts(data.ports || []);
    } catch (e) {}
  }, [id]);

  const fetchAlarms = useCallback(async (refresh = false) => {
    try {
      const res = await fetch(`/api/network/olts/${id}/alarms?refresh=${refresh}`);
      const data = await res.json();
      if (data.success) setAlarms(data.alarms || []);
    } catch (e) {}
  }, [id]);

  const loadAll = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    await Promise.all([
      fetchOnus(forceRefresh),
      fetchPorts(forceRefresh),
      fetchAlarms(forceRefresh),
    ]);
    if (forceRefresh) setRefreshing(false);
  }, [fetchOnus, fetchPorts, fetchAlarms]);

  useEffect(() => {
    const init = async () => {
      await loadOltInfo();
      await loadAll(false);
      setLoading(false);
    };
    init();

    // Auto-refresh every 60 seconds
    autoRefreshRef.current = setInterval(() => loadAll(false), 60000);
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [id, loadOltInfo, loadAll]);

  const handleLiveRefresh = async () => {
    await loadAll(true);
  };

  // ── Filter ONU list ──────────────────────────────────────────────────
  const filteredOnus = onus.filter(o => {
    const matchState = stateFilter === 'all' || o.state === stateFilter;
    const matchPort = !selectedPort || `${o.board}/${o.port}` === selectedPort;
    const matchSearch = !searchTerm || o.sn.toLowerCase().includes(searchTerm.toLowerCase()) || o.onuId.includes(searchTerm);
    return matchState && matchPort && matchSearch;
  });

  // ── Summary stats ────────────────────────────────────────────────────
  const stats = {
    total: onus.length,
    online: onus.filter(o => o.state === 'working').length,
    offline: onus.filter(o => o.state === 'offline').length,
    los: onus.filter(o => o.state === 'los').length,
    weak: onus.filter(o => o.state === 'degraded').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={() => router.back()}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-gray-500" />
            </button>
            <h1 className="page-title flex items-center gap-2">
              <Server className="h-5 w-5 text-teal-600" />
              {olt?.name || 'OLT Detail'}
            </h1>
            <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full uppercase ${
              olt?.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500'
            }`}>
              {olt?.status}
            </span>
          </div>
          <p className="page-subtitle ml-8">
            {olt?.ipAddress} • {olt?.vendor?.toUpperCase()} • {olt?.connection?.toUpperCase()}:{olt?.port}
            {lastRefresh && (
              <span className="ml-2 text-gray-400">
                • Sync: {lastRefresh.toLocaleTimeString('id-ID')}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/admin/network/olts/${id}/terminal`)}
            className="btn-premium border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 gap-1.5"
          >
            <Terminal className="h-3.5 w-3.5" />
            Terminal
          </button>
          <button
            onClick={() => router.push(`/admin/network/olts/${id}/bulk-provision`)}
            className="btn-premium border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 gap-1.5"
          >
            <Package className="h-3.5 w-3.5" />
            Bulk Provision
          </button>
          <button
            onClick={handleLiveRefresh}
            disabled={refreshing}
            className="btn-premium bg-teal-600 hover:bg-teal-700 text-white gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Live Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total ONU', value: stats.total, icon: <Server className="h-4 w-4" />, color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-800' },
          { label: 'Online', value: stats.online, icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Offline', value: stats.offline, icon: <XCircle className="h-4 w-4" />, color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-900/50' },
          { label: 'LOS', value: stats.los, icon: <AlertTriangle className="h-4 w-4" />, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
          { label: 'Weak Signal', value: stats.weak, icon: <Signal className="h-4 w-4" />, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
        ].map(s => (
          <div key={s.label} className="card-soft p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-500 dark:text-zinc-400 uppercase tracking-wide">{s.label}</p>
                <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
              </div>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.bg}`}>
                <span className={s.color}>{s.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Active Alarms Banner */}
      {alarms.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-600 animate-pulse" />
            <span className="text-sm font-semibold text-red-700 dark:text-red-400">
              {alarms.length} Active Alarm{alarms.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {alarms.slice(0, 6).map((a, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded text-[10px] font-mono"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  a.alarmType === 'LOS' ? 'bg-red-500' : a.alarmType === 'OFFLINE' ? 'bg-gray-400' : 'bg-amber-500'
                } animate-pulse`} />
                {a.alarmType}: {a.sn}
              </span>
            ))}
            {alarms.length > 6 && (
              <span className="text-[10px] text-red-600">+{alarms.length - 6} more</span>
            )}
          </div>
        </div>
      )}

      {/* Main Content: PON Ports + ONU Table */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* PON Port Panel */}
        <div className="xl:col-span-1">
          <div className="card-soft p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <BarChart2 className="h-4 w-4 text-teal-600" />
                PON Ports
              </h3>
              <button
                onClick={() => { setSelectedPort(null); }}
                className="text-[10px] text-gray-400 hover:text-gray-600"
              >
                All
              </button>
            </div>
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {ports.length === 0 ? (
                <p className="text-[11px] text-gray-400 text-center py-4">No port data</p>
              ) : (
                ports.map(p => (
                  <PonPortCard
                    key={`${p.board}/${p.port}`}
                    port={p}
                    active={selectedPort === `${p.board}/${p.port}`}
                    onClick={() => setSelectedPort(
                      selectedPort === `${p.board}/${p.port}` ? null : `${p.board}/${p.port}`
                    )}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* ONU Grid */}
        <div className="xl:col-span-3">
          {/* Tabs */}
          <div className="flex items-center gap-0.5 mb-3">
            {[
              { key: 'onus', label: 'ONU List', count: onus.length },
              { key: 'alarms', label: 'Alarms', count: alarms.length },
              { key: 'ports', label: 'Port Stats', count: ports.length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-all ${
                  activeTab === tab.key
                    ? 'bg-teal-600 text-white'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] ${
                  activeTab === tab.key ? 'bg-teal-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* ONU Tab */}
          {activeTab === 'onus' && (
            <div className="card-soft overflow-hidden">
              {/* Filter bar */}
              <div className="px-4 py-3 border-b dark:border-gray-800 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                  <input
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search SN or ONU ID..."
                    className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-zinc-900 focus:outline-none focus:border-teal-500"
                  />
                </div>
                {(['all', 'working', 'los', 'offline', 'degraded'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setStateFilter(f)}
                    className={`px-2.5 py-1 text-[10px] rounded-lg font-medium transition-all ${
                      stateFilter === f
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'working' ? 'Online' : f === 'los' ? 'LOS' : f === 'offline' ? 'Offline' : 'Degraded'}
                  </button>
                ))}
              </div>

              {/* Table */}
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/80 backdrop-blur-sm z-10">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">ONU ID</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Serial Number</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Rx Power</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Profile</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredOnus.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-xs text-gray-400">
                          {onus.length === 0 ? 'No ONU data. Click "Live Refresh" to fetch from OLT.' : 'No ONU matches filter.'}
                        </td>
                      </tr>
                    ) : (
                      filteredOnus.map(onu => (
                        <tr
                          key={onu.onuId}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                            onu.state === 'los' ? 'bg-red-50/40 dark:bg-red-900/10' : ''
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <span className="font-mono text-[11px] text-gray-600 dark:text-gray-400">
                              {onu.onuId}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-mono text-[11px] font-semibold text-gray-800 dark:text-white">
                              {onu.sn}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <StateBadge state={onu.state} />
                          </td>
                          <td className="px-4 py-2.5 min-w-[140px]">
                            <SignalBar rxPower={onu.rxPower} />
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell">
                            <span className="text-[11px] text-gray-500">{onu.profile || '—'}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t dark:border-gray-800 flex items-center justify-between">
                <span className="text-[10px] text-gray-400">
                  Showing {filteredOnus.length} of {onus.length} ONUs
                </span>
                <button
                  onClick={() => {
                    const csv = ['ONU ID,Serial Number,Status,Rx Power (dBm),Profile',
                      ...filteredOnus.map(o => `${o.onuId},${o.sn},${o.state},${o.rxPower ?? ''},${o.profile || ''}`)
                    ].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `onus-${new Date().toISOString().slice(0,10)}.csv`;
                    a.click();
                  }}
                  className="flex items-center gap-1 text-[10px] text-teal-600 hover:text-teal-700 font-medium"
                >
                  <Download className="h-3 w-3" />
                  Export CSV
                </button>
              </div>
            </div>
          )}

          {/* Alarms Tab */}
          {activeTab === 'alarms' && (
            <div className="card-soft overflow-hidden">
              <div className="px-4 py-3 border-b dark:border-gray-800">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Active ONU Alarms</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[520px] overflow-y-auto">
                {alarms.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No active alarms</p>
                    <p className="text-xs text-gray-400 mt-1">All ONUs are operating normally</p>
                  </div>
                ) : (
                  alarms.map((alarm, i) => (
                    <div key={i} className="px-4 py-3 flex items-start gap-3">
                      <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                        alarm.alarmType === 'LOS' ? 'bg-red-500 animate-pulse' :
                        alarm.alarmType === 'OFFLINE' ? 'bg-gray-400' : 'bg-amber-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            alarm.alarmType === 'LOS' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            alarm.alarmType === 'OFFLINE' ? 'bg-gray-100 text-gray-600' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {alarm.alarmType}
                          </span>
                          <span className="font-mono text-xs text-gray-800 dark:text-white">{alarm.sn}</span>
                          <span className="text-[10px] text-gray-400">Port {alarm.board}/{alarm.port}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">{alarm.description}</p>
                        {alarm.rxPower !== null && (
                          <p className="text-[10px] text-gray-400 mt-0.5 font-mono">Rx: {alarm.rxPower} dBm</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Port Stats Tab */}
          {activeTab === 'ports' && (
            <div className="card-soft overflow-hidden">
              <div className="px-4 py-3 border-b dark:border-gray-800">
                <span className="text-xs font-medium">PON Port Details</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Port</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Utilization</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Online</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Offline</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">LOS</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Capacity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {ports.map(p => {
                      const utilColor = p.utilization > 80 ? 'text-red-600' : p.utilization > 60 ? 'text-amber-600' : 'text-emerald-600';
                      return (
                        <tr key={`${p.board}/${p.port}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-2.5 font-mono text-xs font-bold">{p.board}/{p.port}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${p.utilization}%`,
                                    backgroundColor: p.utilization > 80 ? '#ef4444' : p.utilization > 60 ? '#f59e0b' : '#10b981',
                                  }}
                                />
                              </div>
                              <span className={`text-xs font-bold ${utilColor}`}>{p.utilization}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-emerald-600 font-medium">{p.activeOnus}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{p.offlineOnus}</td>
                          <td className="px-4 py-2.5 text-xs text-red-600 font-medium">{p.losOnus}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">{p.totalOnus}/{p.capacity}</td>
                        </tr>
                      );
                    })}
                    {ports.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-400">
                          No port data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
