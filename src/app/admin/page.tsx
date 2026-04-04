'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Users,
  Wifi,
  Receipt,
  TrendingUp,
  Activity,
  Clock,
  DollarSign,
  Loader2,
  Server,
  Database,
  Zap,
  CheckCircle2,
  XCircle,
  RotateCw,
  RefreshCw,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Swal from 'sweetalert2';
import { formatWIB, getTimezoneInfo } from '@/lib/timezone';
import { useTranslation } from '@/hooks/useTranslation';
import dynamic from 'next/dynamic';
import { ChartCard } from '@/components/charts';

const RevenueLineChart = dynamic(() => import('@/components/charts').then(mod => mod.RevenueLineChart), { ssr: false, loading: () => <div className="h-[220px] flex items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div> });
const CategoryBarChart = dynamic(() => import('@/components/charts').then(mod => mod.CategoryBarChart), { ssr: false, loading: () => <div className="h-[220px] flex items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div> });
const UserStatusPieChart = dynamic(() => import('@/components/charts').then(mod => mod.UserStatusPieChart), { ssr: false, loading: () => <div className="h-[180px] flex items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div> });
const UserGrowthChart = dynamic(() => import('@/components/charts').then(mod => mod.UserGrowthChart), { ssr: false, loading: () => <div className="h-[180px] flex items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div> });
const VoucherSalesChart = dynamic(() => import('@/components/charts').then(mod => mod.VoucherSalesChart), { ssr: false, loading: () => <div className="h-[180px] flex items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div> });
const VoucherStatusPieChart = dynamic(() => import('@/components/charts').then(mod => mod.VoucherStatusPieChart), { ssr: false, loading: () => <div className="h-[180px] flex items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div> });
const SessionsChart = dynamic(() => import('@/components/charts').then(mod => mod.SessionsChart), { ssr: false, loading: () => <div className="h-[200px] flex items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div> });
const BandwidthChart = dynamic(() => import('@/components/charts').then(mod => mod.BandwidthChart), { ssr: false, loading: () => <div className="h-[200px] flex items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div> });
const IncomeExpenseChart = dynamic(() => import('@/components/charts').then(mod => mod.IncomeExpenseChart), { ssr: false, loading: () => <div className="h-[200px] flex items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div> });
const TopRevenueSources = dynamic(() => import('@/components/charts').then(mod => mod.TopRevenueSources), { ssr: false, loading: () => <div className="h-[200px] flex items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div> });

interface StatCard {
  title: string;
  value: string | number;
  change?: string | null;
  icon: React.ReactNode;
  color: string;
}

interface DashboardData {
  stats: {
    totalUsers: { value: number; change: string };
    activeSessions: { value: number; change: string | null };
    pendingInvoices: { value: number; change: string };
    revenue: { value: string; change: string };
  };
  network: {
    pppoeUsers: number;
    hotspotSessions: number;
    bandwidth: string;
  };
  commission?: {
    rate: number;
    earned: number;
    potential: number;
  };
  activities: RecentActivity[];
  systemStatus?: {
    radius: boolean;
    database: boolean;
    api: boolean;
  };
}

interface RadiusStatus {
  status: 'running' | 'stopped';
  uptime: string;
}

interface RecentActivity {
  id: string;
  user: string;
  action: string;
  time: string;
  status: 'success' | 'warning' | 'error';
}

interface AnalyticsData {
  revenue?: {
    monthly: { month: string; revenue: number }[];
    byCategory: { category: string; amount: number }[];
  };
  users?: {
    byStatus: { name: string; value: number }[];
    growth: { month: string; newUsers: number; totalUsers: number }[];
  };
  hotspot?: {
    salesByProfile: { profile: string; sold: number }[];
    byStatus: { name: string; value: number }[];
  };
  sessions?: {
    hourly: { time: string; pppoe: number; hotspot: number }[];
    bandwidth: { time: string; upload: number; download: number }[];
  };
  financial?: {
    incomeExpense: { month: string; income: number; expense: number }[];
    topSources: { source: string; amount: number }[];
  };
}

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const tzInfo = getTimezoneInfo();
  const [currentTime, setCurrentTime] = useState('');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [radiusStatus, setRadiusStatus] = useState<RadiusStatus | null>(null);
  const [restarting, setRestarting] = useState(false);
  const { t } = useTranslation();

  const loadDashboardData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      const data = await res.json();
      if (data.success) {
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalyticsData = useCallback(async () => {
    try {
      setAnalyticsLoading(true);
      const res = await fetch('/api/dashboard/analytics?type=all');
      const data = await res.json();
      if (data.success) {
        setAnalyticsData(data.data);
      }
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const loadRadiusStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/system/radius');
      const data = await res.json();
      if (data.success) {
        setRadiusStatus(data);
      }
    } catch (error) {
      console.error('Failed to load RADIUS status:', error);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    loadDashboardData();
    loadRadiusStatus();
    loadAnalyticsData();
    setCurrentTime(formatWIB(new Date(), 'HH:mm:ss'));
    
    const timeInterval = setInterval(() => {
      setCurrentTime(formatWIB(new Date(), 'HH:mm:ss'));
    }, 1000);

    const dataInterval = setInterval(() => {
      loadDashboardData();
      loadRadiusStatus();
    }, 30000);

    // Analytics refresh every 5 minutes
    const analyticsInterval = setInterval(() => {
      loadAnalyticsData();
    }, 300000);

    return () => {
      clearInterval(timeInterval);
      clearInterval(dataInterval);
      clearInterval(analyticsInterval);
    };
  }, [loadDashboardData, loadRadiusStatus, loadAnalyticsData]);

  const handleRestartRadius = async () => {
    const result = await Swal.fire({
      title: t('system.restartRadius'),
      text: t('system.restartRadiusWarning'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: t('common.yes') + ', ' + t('system.restart'),
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#ef4444',
    });

    if (!result.isConfirmed) return;

    setRestarting(true);
    try {
      const res = await fetch('/api/system/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart' }),
      });

      const data = await res.json();
      if (data.success) {
        Swal.fire(t('notifications.success'), t('notifications.radiusRestarted'), 'success');
        loadRadiusStatus();
        loadDashboardData();
      } else {
        Swal.fire(t('notifications.error'), data.error || t('errors.restartFailed'), 'error');
      }
    } catch (error) {
      Swal.fire(t('notifications.error'), t('errors.restartFailed'), 'error');
    } finally {
      setRestarting(false);
    }
  };

  const getStats = (): StatCard[] => {
    const placeholder = { value: '-', change: null };
    const data = dashboardData?.stats || {
      totalUsers: placeholder,
      activeSessions: placeholder,
      pendingInvoices: placeholder,
      revenue: placeholder,
    };
    
    const isSales = (session?.user as any)?.role === 'SALES';

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    };

    if (isSales && dashboardData?.commission) {
      return [
        {
          title: t('dashboard.totalUsers'),
          value: typeof data.totalUsers.value === 'number' ? data.totalUsers.value.toLocaleString() : '-',
          change: data.totalUsers.change,
          icon: <Users className="w-4 h-4" />,
          color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/20',
        },
        {
          title: t('dashboard.activeSessions'),
          value: typeof data.activeSessions.value === 'number' ? data.activeSessions.value.toLocaleString() : '-',
          change: data.activeSessions.change,
          icon: <Activity className="w-4 h-4" />,
          color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
        },
        {
          title: 'Komisi Dibayar',
          value: formatCurrency(dashboardData.commission.earned),
          change: null,
          icon: <DollarSign className="w-4 h-4" />,
          color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/20',
        },
        {
          title: 'Potensi Komisi',
          value: formatCurrency(dashboardData.commission.potential),
          change: null,
          icon: <TrendingUp className="w-4 h-4" />,
          color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
        },
      ];
    }

    return [
      {
        title: t('dashboard.totalUsers'),
        value: typeof data.totalUsers.value === 'number' ? data.totalUsers.value.toLocaleString() : '-',
        change: data.totalUsers.change,
        icon: <Users className="w-4 h-4" />,
        color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/20',
      },
      {
        title: t('dashboard.activeSessions'),
        value: typeof data.activeSessions.value === 'number' ? data.activeSessions.value.toLocaleString() : '-',
        change: data.activeSessions.change,
        icon: <Activity className="w-4 h-4" />,
        color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
      },
      {
        title: t('dashboard.pendingInvoices'),
        value: typeof data.pendingInvoices.value === 'number' ? data.pendingInvoices.value.toLocaleString() : '-',
        change: data.pendingInvoices.change,
        icon: <Receipt className="w-4 h-4" />,
        color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
      },
      {
        title: t('dashboard.revenue'),
        value: data.revenue.value || '-',
        change: data.revenue.change,
        icon: <DollarSign className="w-4 h-4" />,
        color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/20',
      },
    ];
  };

  const handleRefreshAnalytics = () => {
    loadAnalyticsData();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.title')}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
            {tzInfo.name} • {currentTime}
          </p>
        </div>
        <button
          onClick={handleRefreshAnalytics}
          disabled={analyticsLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : (
          getStats().map((stat) => (
            <div
              key={stat.title}
              className="bg-white/80 dark:bg-zinc-950/70 backdrop-blur-xl rounded-[20px] border border-gray-200/50 dark:border-gray-800/50 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">
                    {stat.title}
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                    {stat.value}
                  </p>
                  {stat.change && (
                    <p className={`text-[10px] font-medium mt-0.5 ${
                      stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stat.change}
                    </p>
                  )}
                </div>
                <div className={`p-2 rounded-md ${stat.color}`}>
                  {stat.icon}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Charts Row 1: Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <ChartCard 
            title={t('dashboard.monthlyRevenue')} 
            subtitle={t('dashboard.last12Months')}
            action={<LineChartIcon className="w-4 h-4 text-gray-400" />}
          >
            <RevenueLineChart 
              data={analyticsData?.revenue?.monthly || []} 
              loading={analyticsLoading}
              height={220}
            />
          </ChartCard>
        </div>
        <ChartCard 
          title={t('dashboard.revenueByCategory')} 
          subtitle={t('dashboard.thisMonth')}
          action={<BarChart3 className="w-4 h-4 text-gray-400" />}
        >
          <CategoryBarChart 
            data={analyticsData?.revenue?.byCategory || []} 
            loading={analyticsLoading}
            height={220}
          />
        </ChartCard>
      </div>

      {/* Charts Row 2: Users & Hotspot */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <ChartCard 
          title={t('dashboard.userByStatus')} 
          subtitle={t('dashboard.pppoeUsers')}
          action={<PieChartIcon className="w-4 h-4 text-gray-400" />}
        >
          <UserStatusPieChart 
            data={analyticsData?.users?.byStatus || []} 
            loading={analyticsLoading}
            height={180}
          />
        </ChartCard>

        <ChartCard 
          title={t('dashboard.userGrowth')} 
          subtitle={t('dashboard.last12Months')}
          action={<TrendingUp className="w-4 h-4 text-gray-400" />}
        >
          <UserGrowthChart 
            data={analyticsData?.users?.growth || []} 
            loading={analyticsLoading}
            height={180}
          />
        </ChartCard>

        <ChartCard 
          title={t('dashboard.voucherSales')} 
          subtitle={t('dashboard.perProfileThisMonth')}
          action={<BarChart3 className="w-4 h-4 text-gray-400" />}
        >
          <VoucherSalesChart 
            data={analyticsData?.hotspot?.salesByProfile || []} 
            loading={analyticsLoading}
            height={180}
          />
        </ChartCard>

        <ChartCard 
          title={t('dashboard.voucherStatus')} 
          subtitle={t('dashboard.allVouchers')}
          action={<PieChartIcon className="w-4 h-4 text-gray-400" />}
        >
          <VoucherStatusPieChart 
            data={analyticsData?.hotspot?.byStatus || []} 
            loading={analyticsLoading}
            height={180}
          />
        </ChartCard>
      </div>

      {/* Charts Row 3: Sessions & Financial */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard 
          title={t('dashboard.activeSessions')} 
          subtitle={t('dashboard.last24Hours')}
          action={<Activity className="w-4 h-4 text-gray-400" />}
        >
          <SessionsChart 
            data={analyticsData?.sessions?.hourly || []} 
            loading={analyticsLoading}
            height={200}
          />
        </ChartCard>

        <ChartCard 
          title={t('dashboard.bandwidthUsage')} 
          subtitle={t('dashboard.last7Days')}
          action={<TrendingUp className="w-4 h-4 text-gray-400" />}
        >
          <BandwidthChart 
            data={analyticsData?.sessions?.bandwidth || []} 
            loading={analyticsLoading}
            height={200}
          />
        </ChartCard>
      </div>

      {/* Charts Row 4: Financial Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <ChartCard 
            title={t('dashboard.incomeVsExpense')} 
            subtitle={t('dashboard.last6Months')}
            action={<BarChart3 className="w-4 h-4 text-gray-400" />}
          >
            <IncomeExpenseChart 
              data={analyticsData?.financial?.incomeExpense || []} 
              loading={analyticsLoading}
              height={200}
            />
          </ChartCard>
        </div>
        <ChartCard 
          title={t('dashboard.topRevenueSources')} 
          subtitle={t('dashboard.thisMonth')}
          action={<DollarSign className="w-4 h-4 text-gray-400" />}
        >
          <TopRevenueSources 
            data={analyticsData?.financial?.topSources || []} 
            loading={analyticsLoading}
            height={200}
          />
        </ChartCard>
      </div>

      {/* Original Sections: Activities & Network */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Recent Activities */}
        <div className="bg-white/80 dark:bg-zinc-950/70 backdrop-blur-xl rounded-[20px] border border-gray-200/50 dark:border-gray-800/50 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('dashboard.recentActivities')}</h2>
          <div className="space-y-2">
            {!dashboardData || dashboardData.activities.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <Activity className="h-5 w-5 mx-auto mb-1 opacity-50" />
                <p className="text-xs">{t('dashboard.noRecentActivities')}</p>
              </div>
            ) : (
              dashboardData.activities.slice(0, 5).map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-3 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md rounded-[12px] border border-white/20 dark:border-white/5 shadow-sm"
                  >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                      {activity.user}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                      {activity.action}
                    </p>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <p className="text-[10px] text-gray-500">{formatWIB(activity.time, 'HH:mm')}</p>
                    <span className={`inline-block px-1.5 py-0.5 text-[9px] font-medium rounded ${
                      activity.status === 'success'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : activity.status === 'warning'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {activity.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Network Overview */}
        <div className="bg-white/80 dark:bg-zinc-950/70 backdrop-blur-xl rounded-[20px] border border-gray-200/50 dark:border-gray-800/50 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('dashboard.networkOverview')}</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md rounded-[12px] border border-white/20 dark:border-white/5 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-teal-50 dark:bg-teal-900/20 rounded-md flex items-center justify-center">
                  <Wifi className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-900 dark:text-white">{t('dashboard.pppoeUsers')}</p>
                  <p className="text-[10px] text-gray-500">{t('dashboard.activeConnections')}</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {dashboardData?.network.pppoeUsers.toLocaleString() || '-'}
              </p>
            </div>

            <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md rounded-[12px] border border-white/20 dark:border-white/5 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-emerald-50 dark:bg-emerald-900/20 rounded-md flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-900 dark:text-white">{t('dashboard.hotspotSessions')}</p>
                  <p className="text-[10px] text-gray-500">{t('dashboard.activeVouchers')}</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {dashboardData?.network.hotspotSessions.toLocaleString() || '-'}
              </p>
            </div>

            <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md rounded-[12px] border border-white/20 dark:border-white/5 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-violet-50 dark:bg-violet-900/20 rounded-md flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-900 dark:text-white">{t('dashboard.bandwidth')}</p>
                  <p className="text-[10px] text-gray-500">{t('dashboard.allTimeUsage')}</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {dashboardData?.network.bandwidth || '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white/80 dark:bg-zinc-950/70 backdrop-blur-xl rounded-[20px] border border-gray-200/50 dark:border-gray-800/50 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('dashboard.systemStatus')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* RADIUS Server */}
          <div className="flex items-center gap-2 p-3 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md rounded-[12px] border border-white/20 dark:border-white/5 shadow-sm">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
              radiusStatus?.status === 'running'
                ? 'bg-green-50 dark:bg-green-900/20'
                : 'bg-red-50 dark:bg-red-900/20'
            }`}>
              <Server className={`w-3.5 h-3.5 ${
                radiusStatus?.status === 'running'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 dark:text-white">{t('system.radius')}</p>
              <div className="flex items-center gap-1">
                {radiusStatus?.status === 'running' ? (
                  <>
                    <CheckCircle2 className="w-2.5 h-2.5 text-green-600" />
                    <span className="text-[10px] text-green-600 truncate">{radiusStatus.uptime}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-2.5 h-2.5 text-red-600" />
                    <span className="text-[10px] text-red-600">{t('system.offline')}</span>
                  </>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRestartRadius}
              disabled={restarting}
              className="h-6 w-6 p-0"
            >
              {restarting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCw className="h-3 w-3" />
              )}
            </Button>
          </div>

          {/* Database */}
          <div className="flex items-center gap-2 p-3 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md rounded-[12px] border border-white/20 dark:border-white/5 shadow-sm">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
              dashboardData?.systemStatus?.database
                ? 'bg-green-50 dark:bg-green-900/20'
                : 'bg-red-50 dark:bg-red-900/20'
            }`}>
              <Database className={`w-3.5 h-3.5 ${
                dashboardData?.systemStatus?.database
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-900 dark:text-white">{t('system.database')}</p>
              <div className="flex items-center gap-1">
                {dashboardData?.systemStatus?.database ? (
                  <>
                    <CheckCircle2 className="w-2.5 h-2.5 text-green-600" />
                    <span className="text-[10px] text-green-600">{t('system.connected')}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-2.5 h-2.5 text-red-600" />
                    <span className="text-[10px] text-red-600">{t('system.disconnected')}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* API */}
          <div className="flex items-center gap-2 p-3 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md rounded-[12px] border border-white/20 dark:border-white/5 shadow-sm">
            <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
              dashboardData?.systemStatus?.api
                ? 'bg-green-50 dark:bg-green-900/20'
                : 'bg-red-50 dark:bg-red-900/20'
            }`}>
              <Zap className={`w-3.5 h-3.5 ${
                dashboardData?.systemStatus?.api
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-900 dark:text-white">{t('system.api')}</p>
              <div className="flex items-center gap-1">
                {dashboardData?.systemStatus?.api ? (
                  <>
                    <CheckCircle2 className="w-2.5 h-2.5 text-green-600" />
                    <span className="text-[10px] text-green-600">{t('system.running')}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-2.5 h-2.5 text-red-600" />
                    <span className="text-[10px] text-red-600">{t('system.stopped')}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
