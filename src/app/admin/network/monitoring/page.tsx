'use client';
import { useState, useEffect } from 'react';
import { Activity, Shield, ShieldAlert, Cpu, HardDrive, RefreshCw, AlertCircle, Clock, Heart } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { showSuccess, showError } from '@/lib/sweetalert';

interface MonitoredDevice {
  id: string;
  name: string;
  ip: string;
  type: 'OLT' | 'ROUTER';
  vendor: string;
  isUp: boolean | null;
  latency: number | null;
  cpuUsage: number | null;
  memoryUsage: number | null;
  lastChecked: string | null;
  uptime24h: number;
  avgLatency24h: number | null;
  lastSeen: string | null;
}

interface RecentLog {
  id: string;
  deviceName: string;
  deviceType: string;
  isUp: boolean;
  latency: number | null;
  checkedAt: string;
}

export default function UptimeMonitoringPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [devices, setDevices] = useState<MonitoredDevice[]>([]);
  const [logs, setLogs] = useState<RecentLog[]>([]);

  useEffect(() => {
    loadMonitoringData();
  }, []);

  const loadMonitoringData = async () => {
    try {
      const res = await fetch('/api/network/monitoring');
      const data = await res.json();
      setDevices(data.devices || []);
      setLogs(data.recentLogs || []);
    } catch (error) {
      console.error('Failed to load monitoring data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMonitoringData();
  };

  const handleTriggerUptime = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/cron?job=uptime_monitor', { method: 'POST' });
      if (res.ok) {
        await showSuccess('Uptime check started successfully');
        await loadMonitoringData();
      } else {
        await showError('Failed to start uptime check');
      }
    } catch (error) {
      console.error(error);
      await showError('Connection error');
    } finally {
      setRefreshing(false);
    }
  };

  const totalDevices = devices.length;
  const upDevices = devices.filter(d => d.isUp === true).length;
  const downDevices = devices.filter(d => d.isUp === false).length;
  const avgSla = totalDevices > 0 ? Math.round(devices.reduce((acc, d) => acc + d.uptime24h, 0) / totalDevices) : 100;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-6 w-6 text-primary animate-spin" />
          <p className="text-xs text-gray-500">Loading monitoring data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">SLA & Uptime Monitor</h1>
          <p className="page-subtitle">Real-time availability and latency monitoring for OLTs and core routers</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleTriggerUptime}
            disabled={refreshing}
            className="inline-flex items-center px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded gap-1 disabled:opacity-50 transition"
          >
            <Activity className="h-3.5 w-3.5" />
            Check Now
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center px-3 py-1.5 text-xs bg-primary hover:bg-primary/95 text-white rounded gap-1 disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-soft p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase">Monitored Devices</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{totalDevices}</p>
          </div>
          <div className="p-3 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600">
            <Cpu className="h-5 w-5" />
          </div>
        </div>

        <div className="card-soft p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase">Status Online</p>
            <p className="text-2xl font-bold text-green-600">{upDevices}</p>
          </div>
          <div className="p-3 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600">
            <Shield className="h-5 w-5" />
          </div>
        </div>

        <div className="card-soft p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase">Status Offline</p>
            <p className="text-2xl font-bold text-red-600">{downDevices}</p>
          </div>
          <div className="p-3 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>

        <div className="card-soft p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase">Avg SLA (24h)</p>
            <p className="text-2xl font-bold text-purple-600">{avgSla}%</p>
          </div>
          <div className="p-3 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600">
            <Heart className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device Availability Table */}
        <div className="lg:col-span-2 card-soft overflow-hidden">
          <div className="px-4 py-3 border-b dark:border-gray-800">
            <h2 className="text-xs font-semibold">Device SLA & Latency</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Latency</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">CPU</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">RAM</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">SLA (24h)</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Last Checked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {devices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500 text-xs">No devices configured for monitoring</td>
                  </tr>
                ) : (
                  devices.map((device) => (
                    <tr key={device.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-xs">{device.name}</p>
                        <p className="text-[10px] text-gray-500">{device.type} ({device.vendor})</p>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-gray-600 dark:text-zinc-300">
                        {device.ip}
                      </td>
                      <td className="px-4 py-3.5">
                        {device.isUp === null ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-100 text-gray-700 dark:bg-gray-800">Unknown</span>
                        ) : device.isUp ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-100 text-green-700 dark:bg-green-950/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1 animate-pulse"></span>
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-100 text-red-700 dark:bg-red-950/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500 mr-1"></span>
                            Offline
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs">
                        {device.latency !== null ? (
                          <span className={device.latency < 50 ? 'text-green-600' : device.latency < 150 ? 'text-yellow-600' : 'text-red-600'}>
                            {device.latency} ms
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs">
                        {device.cpuUsage !== null ? (
                          <span className={device.cpuUsage < 50 ? 'text-green-600' : device.cpuUsage < 80 ? 'text-yellow-600' : 'text-red-600'}>
                            {device.cpuUsage}%
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs">
                        {device.memoryUsage !== null ? (
                          <span className={device.memoryUsage < 60 ? 'text-green-600' : device.memoryUsage < 85 ? 'text-yellow-600' : 'text-red-600'}>
                            {device.memoryUsage}%
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-semibold ${device.uptime24h >= 99 ? 'text-green-600' : device.uptime24h >= 95 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {device.uptime24h}%
                          </span>
                          <div className="w-12 bg-gray-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${device.uptime24h >= 99 ? 'bg-green-500' : device.uptime24h >= 95 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${device.uptime24h}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right text-[10px] text-gray-500">
                        {device.lastChecked ? new Date(device.lastChecked).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Real-time Ping Logs Timeline */}
        <div className="card-soft flex flex-col h-[400px]">
          <div className="px-4 py-3 border-b dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-xs font-semibold">Activity Logs</h2>
            <Clock className="h-3.5 w-3.5 text-gray-400" />
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {logs.length === 0 ? (
              <p className="text-center text-gray-500 text-xs pt-12">No activity logged yet</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex gap-3 text-xs">
                  <div className="flex flex-col items-center">
                    <div className={`h-2.5 w-2.5 rounded-full border ${log.isUp ? 'bg-green-500 border-green-200 dark:border-green-900' : 'bg-red-500 border-red-200 dark:border-red-900'}`}></div>
                    <div className="flex-1 w-px bg-gray-200 dark:bg-zinc-800 my-1"></div>
                  </div>
                  <div className="flex-1 pb-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-700 dark:text-zinc-200">{log.deviceName}</span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(log.checkedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-gray-500 text-[10px]">
                      {log.isUp 
                        ? `Ping success with latency ${log.latency || 0}ms` 
                        : 'Host unreachable or request timed out'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
