'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { ListTodo, RefreshCw, Loader2, Trash2, CheckCircle, XCircle, Clock, Search, AlertCircle, X, Activity } from 'lucide-react';
import Swal from 'sweetalert2';

interface GenieACSTask {
  _id: string;
  name: string;
  device: string;
  timestamp: string;
  status: string;
  retries: number;
  fault?: {
    code: string;
    message: string;
  };
}

export default function GenieACSTasksPage() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<GenieACSTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch('/api/genieacs/tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Auto-refresh every 10 seconds if there are pending tasks
  useEffect(() => {
    if (!autoRefresh) return;
    
    const hasPending = tasks.some(t => !t.fault && t.status !== 'done');
    if (!hasPending) return;

    const interval = setInterval(() => {
      fetchTasks();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [tasks, autoRefresh, fetchTasks]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTasks();
    setRefreshing(false);
  };

  const handleDeleteTask = async (taskId: string) => {
    const result = await Swal.fire({
      title: 'Hapus Task?',
      text: 'Task akan dihapus dari queue',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      confirmButtonColor: '#dc2626',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        const response = await fetch(`/api/genieacs/tasks/${encodeURIComponent(taskId)}`, { 
          method: 'DELETE' 
        });
        if (response.ok) {
          setTasks(tasks.filter(t => t._id !== taskId));
          Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Task dihapus', timer: 2000, showConfirmButton: false });
        } else {
          throw new Error('Gagal menghapus task');
        }
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Gagal menghapus task' });
      }
    }
  };

  const handleRetryTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/genieacs/tasks/${encodeURIComponent(taskId)}/retry`, { 
        method: 'POST' 
      });
      if (response.ok) {
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Task akan di-retry', timer: 2000, showConfirmButton: false });
        handleRefresh();
      } else {
        throw new Error('Gagal retry task');
      }
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Gagal retry task' });
    }
  };

  const getStatusBadge = (task: GenieACSTask) => {
    // Check for fault first
    if (task.fault) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">
          <XCircle className="w-3 h-3" />
          Fault
        </span>
      );
    }
    
    // GenieACS task status logic:
    // - No status field or empty = pending (waiting for device)
    // - status = 'done' = completed
    const status = task.status || '';
    
    if (status === 'done') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">
          <CheckCircle className="w-3 h-3" />
          Done
        </span>
      );
    }
    
    // Default to pending - task is waiting for device connection
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded">
        <Clock className="w-3 h-3" />
        Pending
      </span>
    );
  };

  const getTaskNameLabel = (name: string) => {
    switch (name) {
      case 'setParameterValues':
        return 'Set Parameter Values';
      case 'getParameterValues':
        return 'Get Parameter Values';
      case 'refreshObject':
        return 'Refresh Object';
      case 'reboot':
        return 'Reboot';
      case 'factoryReset':
        return 'Factory Reset';
      case 'download':
        return 'Download';
      default:
        return name;
    }
  };

  // Helper to check if task is pending (no status or status !== 'done')
  const isPending = (task: GenieACSTask) => !task.fault && task.status !== 'done';
  const isDone = (task: GenieACSTask) => !task.fault && task.status === 'done';

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = 
      task.device?.toLowerCase().includes(search.toLowerCase()) ||
      task.name?.toLowerCase().includes(search.toLowerCase()) ||
      task._id?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'pending' && isPending(task)) ||
      (statusFilter === 'done' && isDone(task)) ||
      (statusFilter === 'fault' && task.fault);
    
    return matchesSearch && matchesStatus;
  });

  const pendingCount = tasks.filter(t => isPending(t)).length;
  const faultCount = tasks.filter(t => t.fault).length;
  const doneCount = tasks.filter(t => isDone(t)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-50 dark:bg-teal-500/10 rounded-lg">
            <ListTodo className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">GenieACS Tasks</h1>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">Monitor dan kelola task TR-069</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
          className={`bg-white dark:bg-zinc-900 rounded-xl border p-3 transition-all ${
            statusFilter === 'pending' ? 'border-yellow-500 ring-1 ring-yellow-500' : 'border-gray-200 dark:border-zinc-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-500/10">
              <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-500" />
            </div>
            <div className="text-left">
              <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">Pending</p>
              <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-500 leading-tight">{pendingCount}</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === 'fault' ? 'all' : 'fault')}
          className={`bg-white dark:bg-zinc-900 rounded-xl border p-3 transition-all ${
            statusFilter === 'fault' ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200 dark:border-zinc-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10">
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-500" />
            </div>
            <div className="text-left">
              <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">Fault</p>
              <p className="text-lg font-semibold text-red-600 dark:text-red-500 leading-tight">{faultCount}</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === 'done' ? 'all' : 'done')}
          className={`bg-white dark:bg-zinc-900 rounded-xl border p-3 transition-all ${
            statusFilter === 'done' ? 'border-green-500 ring-1 ring-green-500' : 'border-gray-200 dark:border-zinc-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-500/10">
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-500" />
            </div>
            <div className="text-left">
              <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">Done</p>
              <p className="text-lg font-semibold text-green-600 dark:text-green-500 leading-tight">{doneCount}</p>
            </div>
          </div>
        </button>
      </div>

      {/* Tasks Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden shadow-sm dark:shadow-none">
        {/* Search & Actions */}
        <div className="p-4 border-b border-gray-200 dark:border-zinc-800">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari device ID atau task..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-zinc-800 rounded-lg bg-gray-50 dark:bg-zinc-950 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 dark:text-zinc-100 transition-all outline-none"
              />
            </div>
            {statusFilter !== 'all' && (
              <button
                onClick={() => setStatusFilter('all')}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border rounded-lg transition-colors ${
                autoRefresh
                  ? 'text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/10'
                  : 'text-gray-600 dark:text-zinc-400 border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800'
              }`}
              title={autoRefresh ? 'Auto-refresh aktif (10s)' : 'Auto-refresh nonaktif'}
            >
              <Activity className="w-4 h-4" />
              Auto
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 rounded-lg disabled:opacity-50 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          {pendingCount > 0 && autoRefresh && (
            <p className="text-xs text-teal-600 dark:text-teal-400 mt-3 font-medium">
              ⏱️ Auto-refresh aktif - update setiap 10 detik
            </p>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950/50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Task ID</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Device</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Task Name</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Timestamp</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Retries</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Status</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/50">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500 dark:text-zinc-500">
                    <ListTodo className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">Tidak ada task</p>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr key={task._id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors group">
                    <td className="py-3 px-4 font-mono text-xs text-gray-500 dark:text-zinc-400 max-w-[120px] truncate">
                      {task._id}
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      <p className="text-gray-900 dark:text-zinc-200 truncate font-medium" title={task.device}>
                        {task.device}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-gray-700 dark:text-zinc-300">
                      {getTaskNameLabel(task.name)}
                    </td>
                    <td className="py-3 px-4 text-gray-500 dark:text-zinc-400 whitespace-nowrap text-xs">
                      {new Date(task.timestamp).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-700 dark:text-zinc-300">
                      {task.retries || 0}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {getStatusBadge(task)}
                      {task.fault && (
                        <p className="text-[10px] text-red-500 mt-1 max-w-[150px] truncate" title={task.fault.message}>
                          {task.fault.message}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {task.fault && (
                          <button
                            onClick={() => handleRetryTask(task._id)}
                            className="p-1.5 text-teal-600 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-500/10 rounded-md transition-colors"
                            title="Retry Task"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteTask(task._id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 rounded-md transition-colors"
                          title="Hapus Task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warning for pending tasks */}
      {pendingCount > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-yellow-200 dark:border-yellow-900/30 rounded-xl p-4 shadow-sm dark:shadow-none">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-yellow-50 dark:bg-yellow-500/10 mt-0.5">
              <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-500" />
            </div>
            <div className="text-sm text-gray-700 dark:text-zinc-300">
              <p className="font-semibold text-gray-900 dark:text-zinc-100 mb-1.5">Task Pending ({pendingCount}) - Menunggu Periodic Inform</p>
              <ul className="space-y-1.5 text-xs text-gray-500 dark:text-zinc-400">
                <li>&bull; Task akan dieksekusi saat device melakukan <strong className="text-gray-700 dark:text-zinc-300">periodic inform</strong> ke GenieACS</li>
                <li>&bull; Interval inform biasanya: <strong className="text-gray-700 dark:text-zinc-300">30-300 detik</strong> (tergantung konfigurasi device)</li>
                <li>&bull; Alternatif 1: Klik <strong className="text-gray-700 dark:text-zinc-300">&quot;Force Sync&quot;</strong> di Devices untuk trigger connection request</li>
                <li>&bull; Alternatif 2: Tunggu inform berikutnya (otomatis), lalu refresh halaman ini</li>
                <li className="italic">&bull; Connection request hanya bekerja jika device bisa di-reach dari server GenieACS</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm dark:shadow-none">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 mt-0.5">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-sm text-gray-700 dark:text-zinc-300">
            <p className="font-semibold text-gray-900 dark:text-zinc-100 mb-1.5">Tentang Tasks</p>
            <ul className="space-y-1.5 text-xs text-gray-500 dark:text-zinc-400">
              <li>&bull; Task adalah perintah yang dikirim ke device via TR-069</li>
              <li>&bull; Task pending akan dieksekusi saat device melakukan connection request</li>
              <li>&bull; Gunakan <strong className="text-gray-700 dark:text-zinc-300">&quot;Force Sync&quot;</strong> di Devices untuk trigger connection request</li>
              <li>&bull; Task dengan status fault dapat di-retry atau dihapus</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
