'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Clock, Play, RefreshCw, CheckCircle, XCircle, Loader2, Activity } from 'lucide-react';
import Swal from 'sweetalert2';
import { formatWIB } from '@/lib/timezone';

interface CronJob {
  type: string;
  name: string;
  description: string;
  scheduleLabel: string;
  enabled: boolean;
  health: 'healthy' | 'degraded' | 'error';
  lastRun?: {
    startedAt: string;
    completedAt?: string;
    status: 'success' | 'error' | 'running';
    duration?: number;
    result?: string;
    error?: string;
  };
  nextRun: string;
  recentHistory?: any[];
}

interface CronHistory {
  id: string;
  type: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'success' | 'error';
  result?: string;
  error?: string;
}

export default function CronSettingsPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [history, setHistory] = useState<CronHistory[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');

  useEffect(() => {
    loadHistory();
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadHistory, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/cron/status');
      const data = await res.json();
      if (data.success) {
        setJobs(data.jobs || []);
        
        // Flatten all recent history from all jobs
        const allHistory = data.jobs.flatMap((job: any) => 
          (job.recentHistory || []).map((h: any) => ({
            id: h.id,
            type: job.type,
            startedAt: h.startedAt,
            completedAt: h.completedAt,
            status: h.status,
            result: h.result,
            error: h.error,
          }))
        );
        
        // Sort by startedAt desc and take last 50
        const sortedHistory = allHistory
          .sort((a: CronHistory, b: CronHistory) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
          .slice(0, 50);
        
        setHistory(sortedHistory);
      }
    } catch (error) {
      console.error('Load history error:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerManual = async (jobType: string) => {
    setTriggering(jobType);
    try {
      const res = await fetch('/api/cron', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: jobType })
      });
      const data = await res.json();
      
      if (data.success) {
        if (jobType === 'voucher_sync') {
          await Swal.fire({
            icon: 'success',
            title: t('common.success'),
            text: `Synced ${data.synced} voucher(s)`,
            timer: 2000,
            showConfirmButton: false
          });
        } else if (jobType === 'agent_sales') {
          await Swal.fire({
            icon: 'success',
            title: t('common.success'),
            text: `Recorded ${data.recorded} sales`,
            timer: 2000,
            showConfirmButton: false
          });
        } else if (jobType === 'invoice_generate') {
          await Swal.fire({
            icon: 'success',
            title: t('common.success'),
            text: `Generated ${data.generated} invoices, skipped ${data.skipped}`,
            timer: 2000,
            showConfirmButton: false
          });
        } else if (jobType === 'invoice_reminder') {
          await Swal.fire({
            icon: 'success',
            title: t('common.success'),
            text: `Sent ${data.sent} reminders, skipped ${data.skipped}`,
            timer: 2000,
            showConfirmButton: false
          });
        } else if (jobType === 'auto_isolir') {
          await Swal.fire({
            icon: 'success',
            title: t('common.success'),
            text: `Isolated ${data.isolated} expired user(s)`,
            timer: 2000,
            showConfirmButton: false
          });
        } else {
          await Swal.fire({
            icon: 'success',
            title: t('common.success'),
            text: 'Job completed successfully!',
            timer: 2000,
            showConfirmButton: false
          });
        }
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed: ' + data.error
        });
      }
      
      loadHistory();
    } catch (error) {
      console.error('Manual trigger error:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to trigger job'
      });
    } finally {
      setTriggering(null);
    }
  };

  const getHealthBadge = (health: string, enabled: boolean) => {
    if (!enabled) {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded">Disabled</span>;
    }
    switch (health) {
      case 'healthy':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">🟢 Active</span>;
      case 'degraded':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded">🟡 Degraded</span>;
      case 'error':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">🔴 Error</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded">Unknown</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded"><CheckCircle className="w-3 h-3" />Success</span>;
      case 'error':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded"><XCircle className="w-3 h-3" />Error</span>;
      case 'running':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded"><Loader2 className="w-3 h-3 animate-spin" />Running</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded">-</span>;
    }
  };

  const typeLabels: Record<string, string> = {
    voucher_sync: 'Voucher Sync',
    agent_sales: 'Agent Sales',
    invoice_generate: 'Invoice Gen',
    invoice_reminder: 'Reminders',
    auto_isolir: 'Auto Isolir'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
            {t('settings.cronTitle')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Background tasks and scheduled jobs
          </p>
        </div>
        <button
          onClick={loadHistory}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Jobs Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {jobs.map((job) => (
          <div key={job.type} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-4">
            <div className="space-y-3">
              {/* Header */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{job.name}</h3>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{job.description}</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Schedule:</span>
                  <div className="font-medium text-gray-900 dark:text-white">{job.scheduleLabel}</div>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <div className="mt-0.5">
                    {getHealthBadge(job.health, job.enabled)}
                  </div>
                </div>
              </div>

              {/* Last Run Info */}
              <div className="text-xs space-y-1 pt-2 border-t border-gray-100 dark:border-gray-700">
                <div>
                  <span className="text-gray-500">Last Run:</span>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {job.lastRun ? formatWIB(job.lastRun.startedAt) : 'Never'}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Next Run:</span>
                  <div className="font-medium text-teal-600 dark:text-teal-400">
                    {formatWIB(job.nextRun)}
                  </div>
                </div>
                {job.lastRun?.duration && (
                  <div>
                    <span className="text-gray-500">Duration:</span>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {(job.lastRun.duration / 1000).toFixed(2)}s
                    </div>
                  </div>
                )}
              </div>

              {/* Trigger Button */}
              <button
                onClick={() => triggerManual(job.type)}
                disabled={triggering !== null}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 rounded-lg transition-colors"
              >
                {triggering === job.type ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    Trigger Now
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Execution History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Execution History
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Last 50 executions
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedType('all')}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  selectedType === 'all'
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                All
              </button>
              {jobs.map((job) => (
                <button
                  key={job.type}
                  onClick={() => setSelectedType(job.type)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                    selectedType === job.type
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {job.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Started At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Completed At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Result
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {(selectedType === 'all' ? history : history.filter(h => h.type === selectedType)).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No execution history yet
                  </td>
                </tr>
              ) : (
                (selectedType === 'all' ? history : history.filter(h => h.type === selectedType)).map((item) => {
                  const duration = item.completedAt 
                    ? Math.round((new Date(item.completedAt).getTime() - new Date(item.startedAt).getTime()) / 1000)
                    : null;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded">
                          {typeLabels[item.type] || item.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {formatWIB(item.startedAt)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {item.completedAt ? formatWIB(item.completedAt) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {duration ? `${duration}s` : '-'}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {item.status === 'success' && (
                          <span className="text-gray-900 dark:text-white">{item.result}</span>
                        )}
                        {item.status === 'error' && (
                          <span className="text-red-600 dark:text-red-400">{item.error}</span>
                        )}
                        {item.status === 'running' && (
                          <span className="text-blue-600 dark:text-blue-400">In progress...</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
