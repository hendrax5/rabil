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
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-lg p-3 text-white">
        <div className="flex items-center gap-2">
          <ListTodo className="w-4 h-4" />
          <div>
            <h1 className="text-base font-semibold">GenieACS Tasks</h1>
            <p className="text-[11px] text-teal-100">Monitor dan kelola task TR-069</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
          className={`bg-white dark:bg-gray-900 rounded-lg border p-2 transition-all ${
            statusFilter === 'pending' ? 'border-yellow-500 ring-1 ring-yellow-500' : 'border-gray-200 dark:border-gray-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <Clock className="w-3 h-3 text-yellow-600" />
            </div>
            <div className="text-left">
              <p className="text-[10px] text-gray-500">Pending</p>
              <p className="text-sm font-semibold text-yellow-600">{pendingCount}</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === 'fault' ? 'all' : 'fault')}
          className={`bg-white dark:bg-gray-900 rounded-lg border p-2 transition-all ${
            statusFilter === 'fault' ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200 dark:border-gray-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30">
              <XCircle className="w-3 h-3 text-red-600" />
            </div>
            <div className="text-left">
              <p className="text-[10px] text-gray-500">Fault</p>
              <p className="text-sm font-semibold text-red-600">{faultCount}</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setStatusFilter(statusFilter === 'done' ? 'all' : 'done')}
          className={`bg-white dark:bg-gray-900 rounded-lg border p-2 transition-all ${
            statusFilter === 'done' ? 'border-green-500 ring-1 ring-green-500' : 'border-gray-200 dark:border-gray-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="w-3 h-3 text-green-600" />
            </div>
            <div className="text-left">
              <p className="text-[10px] text-gray-500">Done</p>
              <p className="text-sm font-semibold text-green-600">{doneCount}</p>
            </div>
          </div>
        </button>
      </div>

      {/* Tasks Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Search & Actions */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari device ID atau task..."
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-1 focus:ring-teal-500"
              />
            </div>
            {statusFilter !== 'all' && (
              <button
                onClick={() => setStatusFilter('all')}
                className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
              >
                <X className="w-3 h-3" />
                Clear Filter
              </button>
            )}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                autoRefresh
                  ? 'text-teal-600 border-teal-600 bg-teal-50 dark:bg-teal-900/30'
                  : 'text-gray-600 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              title={autoRefresh ? 'Auto-refresh aktif (10s)' : 'Auto-refresh nonaktif'}
            >
              <Activity className="w-3 h-3" />
              Auto
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          {pendingCount > 0 && autoRefresh && (
            <p className="text-[10px] text-teal-600 mt-2">
              ⏱️ Auto-refresh aktif - update setiap 10 detik
            </p>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase">Task ID</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase">Device</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase">Task Name</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase">Timestamp</th>
                <th className="text-center py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase">Retries</th>
                <th className="text-center py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-center py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    <ListTodo className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Tidak ada task</p>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr key={task._id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-2 px-3 font-mono text-[10px] text-gray-600 dark:text-gray-400 max-w-[120px] truncate">
                      {task._id}
                    </td>
                    <td className="py-2 px-3 max-w-[200px]">
                      <p className="text-gray-800 dark:text-gray-200 truncate" title={task.device}>
                        {task.device}
                      </p>
                    </td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                      {getTaskNameLabel(task.name)}
                    </td>
                    <td className="py-2 px-3 text-gray-500 whitespace-nowrap">
                      {new Date(task.timestamp).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-2 px-3 text-center text-gray-600 dark:text-gray-400">
                      {task.retries || 0}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {getStatusBadge(task)}
                      {task.fault && (
                        <p className="text-[9px] text-red-500 mt-0.5 max-w-[150px] truncate" title={task.fault.message}>
                          {task.fault.message}
                        </p>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex justify-center gap-1">
                        {task.fault && (
                          <button
                            onClick={() => handleRetryTask(task._id)}
                            className="p-1.5 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded transition-colors"
                            title="Retry Task"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteTask(task._id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                          title="Hapus Task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-yellow-700 dark:text-yellow-400">
              <p className="font-medium mb-1">Task Pending ({pendingCount}) - Menunggu Periodic Inform</p>
              <ul className="space-y-0.5 text-[11px]">
                <li>• Task akan dieksekusi saat device melakukan <strong>periodic inform</strong> ke GenieACS</li>
                <li>• Interval inform biasanya: <strong>30-300 detik</strong> (tergantung konfigurasi device)</li>
                <li>• Alternatif 1: Klik <strong>&quot;Force Sync&quot;</strong> di Devices untuk trigger connection request</li>
                <li>• Alternatif 2: Tunggu inform berikutnya (otomatis), lalu refresh halaman ini</li>
                <li className="text-gray-500">• Connection request hanya bekerja jika device bisa di-reach dari server GenieACS</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700 dark:text-blue-400">
            <p className="font-medium mb-1">Tentang Tasks</p>
            <ul className="space-y-0.5 text-[11px]">
              <li>• Task adalah perintah yang dikirim ke device via TR-069</li>
              <li>• Task pending akan dieksekusi saat device melakukan connection request</li>
              <li>• Gunakan <strong>&quot;Force Sync&quot;</strong> di Devices untuk trigger connection request</li>
              <li>• Task dengan status fault dapat di-retry atau dihapus</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
