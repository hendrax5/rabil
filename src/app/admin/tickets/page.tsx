'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';
import { 
  Ticket, 
  MessageSquare, 
  Filter, 
  Search,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Users
} from 'lucide-react';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface TicketItem {
  id: string;
  ticketNumber: string;
  subject: string;
  customerName: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  assignedToId?: string;
  assignedToType?: string;
  category?: {
    name: string;
    color: string;
  };
  _count: {
    messages: number;
  };
}

interface Stats {
  total: number;
  byStatus: {
    open: number;
    inProgress: number;
    waitingCustomer: number;
    resolved: number;
    closed: number;
  };
  byPriority: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
  unassigned: number;
  avgResponseTimeHours: number;
}

export default function AdminTicketsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    search: '',
  });

  useEffect(() => {
    fetchStats();
    fetchTickets();
  }, [filters]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/tickets/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.search) params.append('search', filters.search);

      const res = await fetch(`/api/tickets?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: TicketStatus) => {
    const colors = {
      OPEN: 'bg-info/10 text-info',
      IN_PROGRESS: 'bg-primary/10 text-primary',
      WAITING_CUSTOMER: 'bg-warning/10 text-warning',
      RESOLVED: 'bg-success/10 text-success',
      CLOSED: 'bg-muted text-muted-foreground',
    };
    return colors[status] || colors.OPEN;
  };

  const getPriorityColor = (priority: TicketPriority) => {
    const colors = {
      LOW: 'bg-muted text-muted-foreground',
      MEDIUM: 'bg-primary/10 text-primary',
      HIGH: 'bg-warning/10 text-warning',
      URGENT: 'bg-destructive/10 text-destructive',
    };
    return colors[priority] || colors.MEDIUM;
  };

  return (
    <div className="bg-background relative overflow-hidden">
      {/* Neon Cyberpunk Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#bc13fe]/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-[#00f7ff]/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-[#ff44cc]/20 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(188,19,254,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(188,19,254,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>
      
      <div className="relative z-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#00f7ff] via-white to-[#ff44cc] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,247,255,0.5)]">
            {t('ticket.tickets')}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {t('ticket.manageAllTickets')}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3 mb-4">
          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-3 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-[#00f7ff] uppercase tracking-wide truncate">{t('ticket.totalTickets')}</p>
                <p className="text-lg sm:text-xl font-bold text-foreground mt-1">{stats.total}</p>
              </div>
              <Ticket className="text-[#00f7ff] h-5 w-5 sm:h-6 sm:w-6 drop-shadow-[0_0_15px_rgba(0,247,255,0.6)] flex-shrink-0" />
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-3 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-[#00f7ff] uppercase tracking-wide truncate">{t('ticket.openTickets')}</p>
                <p className="text-lg sm:text-xl font-bold text-foreground mt-1">{stats.byStatus.open}</p>
              </div>
              <TrendingUp className="text-[#00f7ff] h-5 w-5 sm:h-6 sm:w-6 drop-shadow-[0_0_15px_rgba(0,247,255,0.6)] flex-shrink-0" />
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-3 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-[#00f7ff] uppercase tracking-wide truncate">{t('ticket.urgentTickets')}</p>
                <p className="text-lg sm:text-xl font-bold text-foreground mt-1">{stats.byPriority.urgent}</p>
              </div>
              <AlertCircle className="text-red-400 h-5 w-5 sm:h-6 sm:w-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.6)] flex-shrink-0" />
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-3 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-[#00f7ff] uppercase tracking-wide truncate">{t('ticket.unassigned')}</p>
                <p className="text-lg sm:text-xl font-bold text-foreground mt-1">{stats.unassigned}</p>
              </div>
              <Users className="text-amber-400 h-5 w-5 sm:h-6 sm:w-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] flex-shrink-0" />
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-3 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-[#00f7ff] uppercase tracking-wide truncate">{t('ticket.inProgress')}</p>
                <p className="text-lg sm:text-xl font-bold text-foreground mt-1">{stats.byStatus.inProgress}</p>
              </div>
              <Clock className="text-amber-400 h-5 w-5 sm:h-6 sm:w-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] flex-shrink-0" />
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-3 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-[#00f7ff] uppercase tracking-wide truncate">{t('ticket.resolved')}</p>
                <p className="text-lg sm:text-xl font-bold text-foreground mt-1">{stats.byStatus.resolved}</p>
              </div>
              <CheckCircle className="text-green-400 h-5 w-5 sm:h-6 sm:w-6 drop-shadow-[0_0_15px_rgba(34,197,94,0.6)] flex-shrink-0" />
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-card/80 backdrop-blur-xl rounded-xl border-2 border-[#bc13fe]/30 p-3 shadow-[0_0_20px_rgba(188,19,254,0.2)] hover:border-[#bc13fe]/50 transition-all">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-[#00f7ff] uppercase tracking-wide truncate">{t('ticket.avgResponseTime')}</p>
                <p className="text-lg sm:text-xl font-bold text-foreground mt-1">
                  {stats.avgResponseTimeHours.toFixed(1)} {t('ticket.hours')}
                </p>
              </div>
              <Clock className="text-[#00f7ff] h-5 w-5 sm:h-6 sm:w-6 drop-shadow-[0_0_15px_rgba(0,247,255,0.6)] flex-shrink-0" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-3 mb-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
          <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
          
          <div className="flex-1 min-w-0 sm:min-w-[180px]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder={t('ticket.searchPlaceholder')}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="flex-1 sm:flex-initial border border-border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
            >
              <option value="">{t('ticket.allStatus')}</option>
              <option value="OPEN">{t('ticket.status_OPEN')}</option>
              <option value="IN_PROGRESS">{t('ticket.status_IN_PROGRESS')}</option>
              <option value="WAITING_CUSTOMER">{t('ticket.status_WAITING_CUSTOMER')}</option>
              <option value="RESOLVED">{t('ticket.status_RESOLVED')}</option>
              <option value="CLOSED">{t('ticket.status_CLOSED')}</option>
            </select>

            <select
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="flex-1 sm:flex-initial border border-border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
            >
              <option value="">{t('ticket.allPriority')}</option>
              <option value="LOW">{t('ticket.priority_LOW')}</option>
              <option value="MEDIUM">{t('ticket.priority_MEDIUM')}</option>
              <option value="HIGH">{t('ticket.priority_HIGH')}</option>
              <option value="URGENT">{t('ticket.priority_URGENT')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
            <p className="text-xs text-muted-foreground mt-2">{t('ticket.loading')}</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-8">
            <Ticket className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t('ticket.noTicketsFound')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {t('ticket.ticketNumber')}
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {t('ticket.customer')}
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {t('ticket.subject')}
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {t('ticket.status')}
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {t('ticket.priority')}
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                    {t('ticket.messages')}
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                    {t('ticket.created')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => router.push(`/admin/tickets/${ticket.id}`)}
                    className="hover:bg-muted cursor-pointer"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="text-xs font-mono font-medium text-primary">
                        #{ticket.ticketNumber}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="text-xs text-foreground">
                        {ticket.customerName}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-foreground line-clamp-2">
                          {ticket.subject}
                        </span>
                        {ticket.category && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium text-foreground whitespace-nowrap"
                            style={{ backgroundColor: ticket.category.color }}
                          >
                            {ticket.category.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(ticket.status)}`}>
                        {t(`ticket.status_${ticket.status}`)}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getPriorityColor(ticket.priority)}`}>
                        {t(`ticket.priority_${ticket.priority}`)}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap hidden lg:table-cell">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        {ticket._count.messages}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground hidden lg:table-cell">
                      {new Date(ticket.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden divide-y divide-border">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => router.push(`/admin/tickets/${ticket.id}`)}
                  className="p-3 hover:bg-muted/50 cursor-pointer transition-colors active:bg-muted"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <span className="text-[11px] font-mono font-medium text-primary">
                        #{ticket.ticketNumber}
                      </span>
                      <p className="text-xs font-medium text-foreground mt-0.5 line-clamp-2">{ticket.subject}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap flex-shrink-0 ${getPriorityColor(ticket.priority)}`}>
                      {t(`ticket.priority_${ticket.priority}`)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    <span className="text-[11px] text-muted-foreground">{ticket.customerName}</span>
                    <span className="text-[9px] text-muted-foreground/50">•</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${getStatusColor(ticket.status)}`}>
                      {t(`ticket.status_${ticket.status}`)}
                    </span>
                    {ticket.category && (
                      <>
                        <span className="text-[9px] text-muted-foreground/50">•</span>
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-medium text-foreground"
                          style={{ backgroundColor: ticket.category.color }}
                        >
                          {ticket.category.name}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <MessageSquare className="h-3 w-3" />
                      {ticket._count.messages}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(ticket.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
