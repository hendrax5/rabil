'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import {
  Wrench,
  MapPin,
  Calendar,
  Clock,
  Phone,
  Power,
  Play,
  CheckCircle,
  XCircle,
  User,
  AlertTriangle,
  Loader2,
  ListTodo
} from 'lucide-react';

interface TechnicianData {
  id: string;
  name: string;
  phoneNumber: string;
}

interface WorkOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  issueType: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
  scheduledDate: string | null;
}

export default function TechnicianHomePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [technician, setTechnician] = useState<TechnicianData | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/technician/auth/session');
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        router.push('/technician/login');
        return;
      }
      
      setTechnician(data.technician);
      loadTasks();
    } catch {
      router.push('/technician/login');
    }
  };

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/technician/work-orders?mine=true');
      const data = await res.json();
      if (res.ok) {
        setWorkOrders(data.workOrders);
      }
    } catch {
      await showError('Gagal memuat tugas');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const confirmed = await showConfirm('Logout', 'Apakah Anda yakin ingin keluar?');
    if (!confirmed) return;

    try {
      await fetch('/api/technician/auth/logout', { method: 'POST' });
      router.push('/technician/login');
    } catch {
      await showError('Gagal logout');
    }
  };

  const handleAction = async (workOrderId: string, action: 'START' | 'COMPLETE' | 'CANCEL') => {
    let confirmTitle = '';
    let confirmMsg = '';

    if (action === 'START') {
      confirmTitle = 'Mulai Kerja';
      confirmMsg = 'Apakah Anda sudah di lokasi dan siap mulai kerja?';
    } else if (action === 'COMPLETE') {
      confirmTitle = 'Selesaikan Tugas';
      confirmMsg = 'Apakah masalah pelanggan ini sudah benar-benar teratasi?';
    } else if (action === 'CANCEL') {
      confirmTitle = 'Batalkan Tugas';
      confirmMsg = 'Apakah Anda ingin menolak / membatalkan tugas ini?';
    }

    const confirmed = await showConfirm(confirmTitle, confirmMsg);
    if (!confirmed) return;

    setActionLoading(workOrderId);
    try {
      const res = await fetch('/api/technician/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workOrderId, action }),
      });

      if (res.ok) {
        await showSuccess('Status tugas berhasil diubah');
        loadTasks();
      } else {
        const data = await res.json();
        await showError(data.error || 'Gagal mengubah status');
      }
    } catch {
      await showError('Terjadi kesalahan jaringan');
    } finally {
      setActionLoading(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-500/20 text-red-500 border-red-500/50';
      case 'MEDIUM': return 'bg-amber-500/20 text-amber-500 border-amber-500/50';
      case 'LOW': return 'bg-blue-500/20 text-blue-500 border-blue-500/50';
      default: return 'bg-gray-500/20 text-gray-500 border-gray-500/50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ASSIGNED': return 'bg-blue-500/10 text-blue-400 border border-blue-500/30';
      case 'IN_PROGRESS': return 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse';
      case 'COMPLETED': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
      case 'CANCELLED': return 'bg-red-500/10 text-red-400 border border-red-500/30';
      default: return 'bg-gray-500/10 text-gray-400 border border-gray-500/30';
    }
  };

  const openMaps = (address: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  if (loading && !technician) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[100dvh]">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
        <p className="text-sm text-cyan-400/70 font-medium tracking-widest uppercase">Memuat Sesi...</p>
      </div>
    );
  }

  // Calculate active task
  const activeTask = workOrders.find(wo => wo.status === 'IN_PROGRESS');
  const pendingTasks = workOrders.filter(wo => wo.status === 'ASSIGNED');
  const completedTasks = workOrders.filter(wo => wo.status === 'COMPLETED').slice(0, 5); // Only show recent 5

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative overflow-y-auto pb-24">
      {/* Dynamic Cyberpunk Header Line */}
      <div className="sticky top-0 z-50 h-1 w-full bg-gradient-to-r from-cyan-400 via-blue-500 to-pink-500" />
      
      {/* Header Info */}
      <div className="px-5 py-4 flex items-center justify-between sticky top-1 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div>
          <p className="text-[10px] text-cyan-400 font-bold tracking-widest uppercase mb-0.5">Technician</p>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <h1 className="text-sm font-bold text-foreground line-clamp-1">{technician?.name}</h1>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="p-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-colors"
        >
          <Power className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-6">
        
        {/* Active Task (Very Prominent) */}
        {activeTask && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2 pl-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Sedang Dikerjakan
            </h2>
            <div className="bg-amber-900/20 border-2 border-amber-500/50 rounded-2xl p-4 shadow-[0_0_20px_rgba(245,158,11,0.15)] relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-xl" />
              
              <div className="flex justify-between items-start mb-3 relative z-10">
                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                  {activeTask.issueType.replace('_', ' ')}
                </span>
              </div>
              
              <div className="space-y-3 mb-4 relative z-10">
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">{activeTask.customerName}</h3>
                  <a href={`tel:${activeTask.customerPhone}`} className="text-xs text-amber-300/80 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" /> {activeTask.customerPhone}
                  </a>
                </div>
                
                <div 
                  className="bg-black/30 rounded-lg p-2 flex items-start gap-2 cursor-pointer active:scale-95 transition-transform border border-amber-500/20"
                  onClick={() => openMaps(activeTask.customerAddress)}
                >
                  <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-100/70 line-clamp-2 leading-relaxed">
                    {activeTask.customerAddress}
                    <span className="block mt-1 text-[10px] text-amber-400/80 underline decoration-amber-400/30">Buka di Maps</span>
                  </p>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-2.5">
                  <p className="text-xs text-amber-100/90 italic">"{activeTask.description}"</p>
                </div>
              </div>

              <div className="flex gap-2 relative z-10">
                <button
                  disabled={actionLoading === activeTask.id}
                  onClick={() => handleAction(activeTask.id, 'COMPLETE')}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-400 text-white font-bold text-sm py-3.5 rounded-xl shadow-[0_4px_15px_rgba(16,185,129,0.3)] flex justify-center items-center gap-2 active:scale-95 transition-transform"
                >
                  {actionLoading === activeTask.id ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <><CheckCircle className="w-5 h-5" /> SELESAIKAN</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assigned Tasks */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2 pl-1">
            <ListTodo className="w-4 h-4" /> Daftar Tugas ({pendingTasks.length})
          </h2>

          {pendingTasks.length === 0 && !activeTask ? (
            <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center flex flex-col items-center">
              <CheckCircle className="w-12 h-12 text-cyan-500/30 mb-3" />
              <p className="text-sm font-bold text-cyan-100">Semua Tugas Selesai</p>
              <p className="text-xs text-muted-foreground mt-1">Anda tidak memiliki tugas yang assigned saat ini.</p>
              <button 
                onClick={loadTasks}
                className="mt-4 text-xs bg-cyan-500/10 text-cyan-400 font-bold px-4 py-2 rounded-lg border border-cyan-500/20"
              >
                Refresh Data
              </button>
            </div>
          ) : pendingTasks.map((wo) => (
            <div key={wo.id} className="bg-card border border-border rounded-xl overflow-hidden active:bg-muted/50 transition-colors">
              <div className="p-3 border-b border-border/50 bg-background/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getPriorityColor(wo.priority)}`}>
                    {wo.priority}
                  </span>
                  <span className="text-[10px] text-cyan-400/80 font-medium bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    {wo.issueType.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {new Date(wo.createdAt).toLocaleDateString('id-ID')}
                </div>
              </div>
              
              <div className="p-3">
                <h3 className="font-bold text-sm text-white mb-1.5">{wo.customerName}</h3>
                
                <div 
                  className="flex items-start gap-2 mb-3 cursor-pointer"
                  onClick={() => openMaps(wo.customerAddress)}
                >
                  <MapPin className="w-3.5 h-3.5 text-pink-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground line-clamp-1">{wo.customerAddress}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    disabled={actionLoading === wo.id || activeTask !== undefined}
                    onClick={() => handleAction(wo.id, 'START')}
                    className="flex-1 bg-cyan-500 text-black font-bold text-xs py-2.5 rounded-lg shadow-[0_0_10px_rgba(34,211,238,0.2)] flex justify-center items-center gap-1.5 disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none transition-colors"
                  >
                    {actionLoading === wo.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <><Play className="w-4 h-4" /> MULAI KERJA</>
                    )}
                  </button>
                  <button
                    disabled={actionLoading === wo.id}
                    onClick={() => openMaps(wo.customerAddress)}
                    className="w-10 bg-pink-500/10 text-pink-400 border border-pink-500/30 rounded-lg flex justify-center items-center"
                  >
                    <MapPin className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recently Completed */}
        {completedTasks.length > 0 && (
          <div className="space-y-3 pt-6 border-t border-border/50">
            <h2 className="text-xs font-bold text-emerald-400/80 uppercase tracking-widest flex items-center gap-2 pl-1">
              <CheckCircle className="w-3.5 h-3.5" /> Baru Diselesaikan
            </h2>
            <div className="space-y-2">
              {completedTasks.map((wo) => (
                <div key={wo.id} className="bg-background/50 border border-emerald-500/10 rounded-lg p-2.5 flex items-center justify-between opacity-70">
                  <div>
                    <h4 className="text-xs font-bold text-foreground line-clamp-1">{wo.customerName}</h4>
                    <p className="text-[10px] text-muted-foreground">{wo.issueType.replace('_', ' ')}</p>
                  </div>
                  <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-1 rounded">
                    Selesai
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
