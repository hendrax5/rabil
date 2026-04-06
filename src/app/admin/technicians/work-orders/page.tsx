'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import {
  Wrench,
  Search,
  Plus,
  RefreshCcw,
  Calendar,
  User,
  MapPin,
  Clock,
  Phone,
  Pencil,
  Trash2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import {
  SimpleModal,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  ModalInput,
  ModalLabel,
  ModalButton,
} from '@/components/cyberpunk';

interface Technician {
  id: string;
  name: string;
  phoneNumber: string;
}

interface WorkOrder {
  id: string;
  technicianId: string | null;
  technician?: Technician | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  issueType: string;
  description: string;
  priority: string;
  status: string;
  scheduledDate: string | null;
  estimatedHours: number | null;
  createdAt: string;
  notes: string | null;
}

export default function AdminWorkOrdersPage() {
  const { t } = useTranslation();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWorkOrder, setEditingWorkOrder] = useState<WorkOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    issueType: 'INTERNET_DOWN',
    description: '',
    priority: 'MEDIUM',
    status: 'OPEN',
    technicianId: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [woRes, techRes] = await Promise.all([
        fetch(`/api/admin/work-orders?search=${searchTerm}&status=${filterStatus}`),
        fetch(`/api/admin/technicians?isActive=true`)
      ]);

      if (woRes.ok) setWorkOrders(await woRes.json());
      if (techRes.ok) setTechnicians(await techRes.json());
    } catch (error) {
      await showError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'text-pink-400 bg-pink-400/10 border-pink-400/30';
      case 'ASSIGNED': return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      case 'IN_PROGRESS': return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
      case 'COMPLETED': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
      case 'CANCELLED': return 'text-red-400 bg-red-400/10 border-red-400/30';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'text-red-500';
      case 'MEDIUM': return 'text-amber-500';
      case 'LOW': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const resetForm = () => {
    setFormData({
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      issueType: 'INTERNET_DOWN',
      description: '',
      priority: 'MEDIUM',
      status: 'OPEN',
      technicianId: '',
      notes: '',
    });
  };

  const handleEdit = (wo: WorkOrder) => {
    setEditingWorkOrder(wo);
    setFormData({
      customerName: wo.customerName,
      customerPhone: wo.customerPhone,
      customerAddress: wo.customerAddress,
      issueType: wo.issueType,
      description: wo.description,
      priority: wo.priority,
      status: wo.status,
      technicianId: wo.technicianId || '',
      notes: wo.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (wo: WorkOrder) => {
    const confirmed = await showConfirm(
      'Delete Work Order',
      `Are you sure you want to delete work order for ${wo.customerName}?`
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/work-orders/${wo.id}`, { method: 'DELETE' });
      if (res.ok) {
        await showSuccess('Work order deleted successfully');
        loadData();
      } else {
        await showError('Failed to delete work order');
      }
    } catch {
      await showError('An error occurred');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerName || !formData.issueType || !formData.description) {
      await showError('Please fill in all required fields');
      return;
    }

    try {
      const isNew = !editingWorkOrder;
      const url = isNew ? '/api/admin/work-orders' : `/api/admin/work-orders/${editingWorkOrder.id}`;
      
      const payload = { ...formData, technicianId: formData.technicianId || null };

      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        await showSuccess(isNew ? 'Work order created successfully' : 'Work order updated');
        setIsDialogOpen(false);
        resetForm();
        setEditingWorkOrder(null);
        loadData();
      } else {
        await showError(data.error || 'Operation failed');
      }
    } catch (error) {
      await showError('An error occurred');
    }
  };

  if (loading && workOrders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse"></div>
        </div>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 relative z-10"></div>
      </div>
    );
  }

  return (
    <div className="bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-cyan-400 via-white to-pink-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,255,255,0.5)] flex items-center gap-2">
            <Wrench className="h-6 w-6 text-cyan-400" />
            {t('nav.workOrders')}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage your field tasks, assignments, and issue troubleshooting.
          </p>
        </div>

        {/* Actions Bar */}
        <div className="bg-card/80 backdrop-blur-xl rounded-xl shadow-lg border border-cyan-500/20 mb-6 p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search customer, phone, or issue..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-input/50 border border-border rounded-lg focus:ring-2 focus:ring-cyan-500/50 text-sm outline-none transition-all"
              />
            </div>

            <div className="flex gap-2 w-full lg:w-auto">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-input/50 border border-border rounded-lg text-sm outline-none flex-1 lg:flex-none"
              >
                <option value="">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>

              <button
                onClick={loadData}
                className="p-2.5 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
              >
                <RefreshCcw className="h-4 w-4" />
              </button>

              <button
                onClick={() => {
                  setEditingWorkOrder(null);
                  resetForm();
                  setIsDialogOpen(true);
                }}
                className="px-4 py-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 rounded-lg hover:bg-cyan-500/30 transition-colors text-sm font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(0,255,255,0.2)]"
              >
                <Plus className="h-4 w-4" />
                New Task
              </button>
            </div>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workOrders.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground bg-card/40 rounded-xl border border-dashed border-border">
              No work orders found.
            </div>
          ) : (
            workOrders.map((wo) => (
              <div
                key={wo.id}
                className="bg-card/60 backdrop-blur-md rounded-xl border border-border overflow-hidden hover:border-cyan-500/30 transition-all shadow-md group relative"
              >
                <div className={`absolute top-0 left-0 w-1 h-full ${
                  wo.priority === 'HIGH' ? 'bg-red-500' : wo.priority === 'MEDIUM' ? 'bg-amber-500' : 'bg-blue-500'
                }`}></div>
                
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3 pl-2">
                    <div>
                      <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                        {wo.issueType.replace('_', ' ')}
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-background/50 border border-border">
                          {wo.priority}
                        </span>
                      </h3>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${getStatusColor(wo.status)} shadow-sm`}>
                      {wo.status}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4 pl-2 text-xs">
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <User className="w-3.5 h-3.5 mt-0.5 text-cyan-400/70" />
                      <div>
                        <p className="text-foreground font-medium">{wo.customerName}</p>
                        <p className="text-[10px]">{wo.customerPhone}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 text-pink-400/70" />
                      <p className="line-clamp-2">{wo.customerAddress}</p>
                    </div>

                    <div className="flex items-start gap-2 text-muted-foreground">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-amber-400/70" />
                      <p className="line-clamp-2 italic">{wo.description}</p>
                    </div>
                  </div>

                  <div className="bg-background/50 rounded-lg p-2.5 flex items-center justify-between text-xs border border-border ml-2">
                    <div className="flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-medium text-foreground">
                        {wo.technician ? wo.technician.name : <span className="text-muted-foreground italic">Unassigned</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground text-[10px]">
                      <Calendar className="w-3 h-3" />
                      {new Date(wo.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="border-t border-border bg-card/40 p-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-0 left-0 right-0">
                  <button onClick={() => handleEdit(wo)} className="flex-1 py-1.5 rounded text-xs font-medium bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 text-center flex items-center justify-center gap-1">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => handleDelete(wo)} className="flex-1 py-1.5 rounded text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 text-center flex items-center justify-center gap-1">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal */}
        <SimpleModal isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} size="lg">
          <ModalHeader>
            <ModalTitle>{editingWorkOrder ? 'Edit Work Order' : 'New Work Order'}</ModalTitle>
          </ModalHeader>
          <form onSubmit={handleSubmit}>
            <ModalBody className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Info */}
                <div className="space-y-4 border border-border rounded-xl p-3 bg-card/30 relative">
                  <div className="absolute -top-2.5 left-3 bg-background px-2 text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Customer Details</div>
                  
                  <div>
                    <ModalLabel required>Customer Name</ModalLabel>
                    <ModalInput value={formData.customerName} onChange={(e) => setFormData({...formData, customerName: e.target.value})} required />
                  </div>
                  <div>
                    <ModalLabel required>Phone Number</ModalLabel>
                    <ModalInput value={formData.customerPhone} onChange={(e) => setFormData({...formData, customerPhone: e.target.value})} required />
                  </div>
                  <div>
                    <ModalLabel required>Address (Coordinates/Map URL optional)</ModalLabel>
                    <textarea 
                      value={formData.customerAddress} 
                      onChange={(e) => setFormData({...formData, customerAddress: e.target.value})}
                      className="w-full bg-input/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-cyan-500/50 min-h-[80px]"
                      required
                    />
                  </div>
                </div>

                {/* Job Info */}
                <div className="space-y-4 border border-border rounded-xl p-3 bg-card/30 relative">
                  <div className="absolute -top-2.5 left-3 bg-background px-2 text-[10px] font-bold text-pink-400 uppercase tracking-wider">Job Details</div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <ModalLabel required>Issue Type</ModalLabel>
                      <select 
                        value={formData.issueType} 
                        onChange={(e) => setFormData({...formData, issueType: e.target.value})}
                        className="w-full bg-input/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-cyan-500/50"
                      >
                        <option value="INTERNET_DOWN">Internet Down</option>
                        <option value="SLOW_CONNECTION">Slow Connection</option>
                        <option value="ROUTER_ISSUE">Router Issue</option>
                        <option value="INSTALLATION">New Installation</option>
                        <option value="CABLE_CUT">Cable Cut (FOC)</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div>
                      <ModalLabel required>Priority</ModalLabel>
                      <select 
                        value={formData.priority} 
                        onChange={(e) => setFormData({...formData, priority: e.target.value})}
                        className="w-full bg-input/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-cyan-500/50"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <ModalLabel required>Issue Description</ModalLabel>
                    <textarea 
                      value={formData.description} 
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full bg-input/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-cyan-500/50 min-h-[80px]"
                      placeholder="Detail the issue reported..."
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Assignment & Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-border rounded-xl p-3 bg-card/30 relative mt-4">
                <div className="absolute -top-2.5 left-3 bg-background px-2 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Assignment</div>
                
                <div>
                  <ModalLabel>Assign to Technician</ModalLabel>
                  <select 
                    value={formData.technicianId} 
                    onChange={(e) => setFormData({...formData, technicianId: e.target.value})}
                    className="w-full bg-input/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-cyan-500/50"
                  >
                    <option value="">-- Unassigned --</option>
                    {technicians.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.phoneNumber})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <ModalLabel>Current Status</ModalLabel>
                  <select 
                    value={formData.status} 
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full bg-input/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-cyan-500/50"
                  >
                    <option value="OPEN">OPEN (Not Started)</option>
                    <option value="ASSIGNED">ASSIGNED (On The Way)</option>
                    <option value="IN_PROGRESS">IN PROGRESS (Working)</option>
                    <option value="COMPLETED">COMPLETED (Fixed)</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

            </ModalBody>
            <ModalFooter>
              <ModalButton type="button" variant="secondary" onClick={() => setIsDialogOpen(false)}>Cancel</ModalButton>
              <ModalButton type="submit" variant="primary">{editingWorkOrder ? 'Save Changes' : 'Create Task'}</ModalButton>
            </ModalFooter>
          </form>
        </SimpleModal>
      </div>
    </div>
  );
}
