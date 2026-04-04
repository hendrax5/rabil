'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { formatToWIB } from '@/lib/utils/dateUtils';
import {
  ShoppingCart,
  Search,
  RefreshCw,
  Ban,
  Send,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  Filter,
} from 'lucide-react';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  totalAmount: number;
  status: string;
  quantity: number;
  createdAt: string;
  paidAt?: string;
  profile: { name: string };
  vouchers: any[];
}

export default function EVoucherManagementPage() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    paid: 0,
    cancelled: 0,
    expired: 0,
    revenue: 0,
  });

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, statusFilter, searchQuery]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/evoucher/orders');
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders);
        calculateStats(data.orders);
      }
    } catch (error) {
      showError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (orderList: Order[]) => {
    setStats({
      total: orderList.length,
      pending: orderList.filter((o) => o.status === 'PENDING').length,
      paid: orderList.filter((o) => o.status === 'PAID').length,
      cancelled: orderList.filter((o) => o.status === 'CANCELLED').length,
      expired: orderList.filter((o) => o.status === 'EXPIRED').length,
      revenue: orderList.filter((o) => o.status === 'PAID').reduce((sum, o) => sum + o.totalAmount, 0),
    });
  };

  const filterOrders = () => {
    let filtered = orders;
    if (statusFilter !== 'all') {
      filtered = filtered.filter((o) => o.status === statusFilter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(query) ||
          o.customerName.toLowerCase().includes(query) ||
          o.customerPhone.includes(query)
      );
    }
    setFilteredOrders(filtered);
  };

  const handleCancelOrder = async (orderId: string, orderNumber: string) => {
    const confirmed = await showConfirm(`Cancel order ${orderNumber}?`);
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/admin/evoucher/orders/${orderId}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showSuccess('Cancelled');
        loadOrders();
      } else {
        showError(data.error || 'Failed');
      }
    } catch (error) {
      showError('Failed');
    }
  };

  const handleResendVoucher = async (orderId: string, orderNumber: string) => {
    const confirmed = await showConfirm(`Resend vouchers for ${orderNumber}?`);
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/admin/evoucher/orders/${orderId}/resend`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showSuccess('Resent');
      } else {
        showError(data.error || 'Failed');
      }
    } catch (error) {
      showError('Failed');
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const getStatusBadge = (status: string) => {
    const cfg: Record<string, { bg: string; icon: any }> = {
      PENDING: { bg: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
      PAID: { bg: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
      CANCELLED: { bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: Ban },
      EXPIRED: { bg: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', icon: XCircle },
    };
    const c = cfg[status] || cfg.PENDING;
    const Icon = c.icon;
    return (
      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${c.bg}`}>
        <Icon className="w-2.5 h-2.5" />
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            {t('evoucher.title')}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('evoucher.subtitle')}</p>
        </div>
        <button
          onClick={loadOrders}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium text-gray-500 uppercase">{t('common.total')}</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{stats.total}</div>
            </div>
            <Package className="w-4 h-4 text-gray-400" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium text-yellow-600 uppercase">{t('evoucher.pending')}</div>
              <div className="text-lg font-bold text-yellow-600">{stats.pending}</div>
            </div>
            <Clock className="w-4 h-4 text-yellow-400" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium text-green-600 uppercase">{t('evoucher.paid')}</div>
              <div className="text-lg font-bold text-green-600">{stats.paid}</div>
            </div>
            <CheckCircle className="w-4 h-4 text-green-400" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium text-red-600 uppercase">{t('evoucher.cancelled')}</div>
              <div className="text-lg font-bold text-red-600">{stats.cancelled}</div>
            </div>
            <Ban className="w-4 h-4 text-red-400" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium text-gray-500 uppercase">{t('evoucher.expired')}</div>
              <div className="text-lg font-bold text-gray-600">{stats.expired}</div>
            </div>
            <XCircle className="w-4 h-4 text-gray-400" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium text-blue-600 uppercase">{t('evoucher.revenue')}</div>
              <div className="text-sm font-bold text-blue-600">{formatCurrency(stats.revenue)}</div>
            </div>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('evoucher.filters')}:</span>
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder={t('evoucher.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-3 py-1.5 w-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
          >
            <option value="all">{t('evoucher.allStatus')}</option>
            <option value="PENDING">{t('evoucher.pending')}</option>
            <option value="PAID">{t('evoucher.paid')}</option>
            <option value="CANCELLED">{t('evoucher.cancelled')}</option>
            <option value="EXPIRED">{t('evoucher.expired')}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('evoucher.order')}</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('evoucher.customer')}</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden sm:table-cell">{t('evoucher.profile')}</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('evoucher.quantity')}</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('evoucher.amount')}</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('common.status')}</th>
                  <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden md:table-cell">{t('common.date')}</th>
                  <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-gray-500 text-xs">{t('evoucher.noOrdersFound')}</td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-3 py-2 font-mono text-[10px] text-gray-900 dark:text-white">{order.orderNumber}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-xs text-gray-900 dark:text-white">{order.customerName}</div>
                        <div className="text-[10px] text-gray-500">{order.customerPhone}</div>
                      </td>
                      <td className="px-3 py-2 text-xs hidden sm:table-cell">{order.profile.name}</td>
                      <td className="px-3 py-2 text-xs">{order.quantity}x</td>
                      <td className="px-3 py-2 text-xs font-medium">{formatCurrency(order.totalAmount)}</td>
                      <td className="px-3 py-2">{getStatusBadge(order.status)}</td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        <div className="text-[10px]">{formatToWIB(order.createdAt)}</div>
                        {order.paidAt && <div className="text-[9px] text-green-600">Paid: {formatToWIB(order.paidAt)}</div>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {order.status === 'PENDING' && (
                            <button
                              onClick={() => handleCancelOrder(order.id, order.orderNumber)}
                              className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              title="Cancel"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {order.status === 'PAID' && (
                            <button
                              onClick={() => handleResendVoucher(order.id, order.orderNumber)}
                              className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                              title="Resend"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
