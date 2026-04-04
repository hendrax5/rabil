'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { showSuccess, showError } from '@/lib/sweetalert';
import {
  UserPlus,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Wrench,
  Filter,
} from 'lucide-react';
import { formatToWIB } from '@/lib/utils/dateUtils';

interface Registration {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string;
  notes: string | null;
  status: string;
  installationFee: number;
  rejectionReason: string | null;
  createdAt: string;
  profile: {
    id: string;
    name: string;
    price: number;
    downloadSpeed: number;
    uploadSpeed: number;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    amount: number;
  } | null;
  pppoeUser: {
    id: string;
    username: string;
    status: string;
  } | null;
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  installed: number;
  active: number;
  rejected: number;
}

export default function RegistrationsPage() {
  const { t } = useTranslation();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [installationFee, setInstallationFee] = useState('');
  const [approving, setApproving] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [marking, setMarking] = useState(false);

  const fetchRegistrations = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (searchFilter) params.set('search', searchFilter);

      const res = await fetch(`/api/admin/registrations?${params}`);
      const data = await res.json();
      setRegistrations(data.registrations || []);
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to fetch registrations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, [statusFilter, searchFilter]);

  const handleApproveClick = (registration: Registration) => {
    setSelectedRegistration(registration);
    setInstallationFee('');
    setApproveModalOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedRegistration || !installationFee) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/admin/registrations/${selectedRegistration.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installationFee: parseFloat(installationFee) }),
      });
      const data = await res.json();
      if (res.ok) {
        await showSuccess(`Approved!\nUsername: ${data.pppoeUser.username}\nPassword: ${data.pppoeUser.password}`);
        setApproveModalOpen(false);
        fetchRegistrations();
      } else {
        await showError(data.error || 'Failed');
      }
    } catch (error) {
      await showError('Failed to approve');
    } finally {
      setApproving(false);
    }
  };

  const handleRejectClick = (registration: Registration) => {
    setSelectedRegistration(registration);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  const handleReject = async () => {
    if (!selectedRegistration || !rejectionReason) return;
    setRejecting(true);
    try {
      const res = await fetch(`/api/admin/registrations/${selectedRegistration.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason }),
      });
      if (res.ok) {
        await showSuccess('Rejected');
        setRejectModalOpen(false);
        fetchRegistrations();
      } else {
        const data = await res.json();
        await showError(data.error || 'Failed');
      }
    } catch (error) {
      await showError('Failed to reject');
    } finally {
      setRejecting(false);
    }
  };

  const handleMarkInstalled = async (registration: Registration) => {
    setMarking(true);
    try {
      const res = await fetch(`/api/admin/registrations/${registration.id}/mark-installed`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        await showSuccess(`Installed!\nInvoice: ${data.invoice.invoiceNumber}`);
        fetchRegistrations();
      } else {
        await showError(data.error || 'Failed');
      }
    } catch (error) {
      await showError('Failed');
    } finally {
      setMarking(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      APPROVED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      INSTALLED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            {t('pppoe.registrationsTitle')}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('pppoe.registrationsSubtitle')}</p>
        </div>
        <button
          onClick={fetchRegistrations}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t('common.refresh')}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="text-[10px] font-medium text-gray-500 uppercase">{t('common.total')}</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{stats.total}</div>
          </div>
          <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="text-[10px] font-medium text-yellow-600 uppercase flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" /> {t('pppoe.pending')}
            </div>
            <div className="text-lg font-bold text-yellow-600">{stats.pending}</div>
          </div>
          <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="text-[10px] font-medium text-blue-600 uppercase">{t('pppoe.approved')}</div>
            <div className="text-lg font-bold text-blue-600">{stats.approved}</div>
          </div>
          <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="text-[10px] font-medium text-purple-600 uppercase">{t('pppoe.installed')}</div>
            <div className="text-lg font-bold text-purple-600">{stats.installed}</div>
          </div>
          <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="text-[10px] font-medium text-green-600 uppercase">{t('pppoe.active')}</div>
            <div className="text-lg font-bold text-green-600">{stats.active}</div>
          </div>
          <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="text-[10px] font-medium text-red-600 uppercase">{t('pppoe.rejected')}</div>
            <div className="text-lg font-bold text-red-600">{stats.rejected}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('pppoe.filters')}:</span>
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder={t('pppoe.searchNamePhone')}
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-7 pr-3 py-1.5 w-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
          >
            <option value="all">{t('pppoe.allStatus')}</option>
            <option value="PENDING">{t('pppoe.pending')}</option>
            <option value="APPROVED">{t('pppoe.approved')}</option>
            <option value="INSTALLED">{t('pppoe.installed')}</option>
            <option value="ACTIVE">{t('pppoe.active')}</option>
            <option value="REJECTED">{t('pppoe.rejected')}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('pppoe.customer')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden sm:table-cell">{t('pppoe.contact')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('pppoe.profile')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('common.status')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden md:table-cell">{t('pppoe.pppoeUser')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden lg:table-cell">{t('pppoe.invoice')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden lg:table-cell">{t('common.date')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('pppoe.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {registrations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500 text-xs">
                    {t('pppoe.noRegistrations')}
                  </td>
                </tr>
              ) : (
                registrations.map((reg) => (
                  <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2">
                      <div className="font-medium text-xs text-gray-900 dark:text-white">{reg.name}</div>
                      <div className="text-[10px] text-gray-500 truncate max-w-[150px]">{reg.address}</div>
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell">
                      <div className="text-xs">{reg.phone}</div>
                      {reg.email && <div className="text-[10px] text-gray-500">{reg.email}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-xs">{reg.profile.name}</div>
                      <div className="text-[10px] text-gray-500">{reg.profile.downloadSpeed}/{reg.profile.uploadSpeed}M</div>
                      <div className="text-[10px] text-green-600 font-medium">Rp {reg.profile.price.toLocaleString()}</div>
                    </td>
                    <td className="px-3 py-2">{getStatusBadge(reg.status)}</td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      {reg.pppoeUser ? (
                        <div>
                          <div className="font-mono text-[10px]">{reg.pppoeUser.username}</div>
                          <span className={`text-[9px] ${reg.pppoeUser.status === 'isolated' ? 'text-orange-600' : 'text-green-600'}`}>
                            {reg.pppoeUser.status}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-[10px]">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell">
                      {reg.invoice ? (
                        <div>
                          <div className="font-mono text-[10px]">{reg.invoice.invoiceNumber}</div>
                          <div className="text-[10px] text-gray-500">Rp {reg.invoice.amount.toLocaleString()}</div>
                          <span className={`text-[9px] ${reg.invoice.status === 'PAID' ? 'text-green-600' : 'text-yellow-600'}`}>
                            {reg.invoice.status}
                          </span>
                        </div>
                      ) : reg.status === 'APPROVED' ? (
                        <span className="text-blue-600 text-[10px]">{t('pppoe.awaiting')}</span>
                      ) : (
                        <span className="text-gray-400 text-[10px]">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-gray-600 hidden lg:table-cell">
                      {formatToWIB(reg.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {reg.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApproveClick(reg)}
                              className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                              title="Approve"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRejectClick(reg)}
                              className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              title="Reject"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {reg.status === 'APPROVED' && (
                          <button
                            onClick={() => handleMarkInstalled(reg)}
                            disabled={marking}
                            className="p-1 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded disabled:opacity-50"
                            title="Mark Installed"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {reg.status === 'INSTALLED' && (
                          <span className="text-[10px] text-gray-500">{t('pppoe.waitPayment')}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approve Modal */}
      {approveModalOpen && selectedRegistration && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-sm w-full">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('pppoe.approveRegistration')}</h2>
              <p className="text-[10px] text-gray-500">{t('pppoe.setInstallFee')}</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('common.name')}:</span>
                  <span className="font-medium">{selectedRegistration.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('common.phone')}:</span>
                  <span className="font-medium">{selectedRegistration.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('pppoe.profile')}:</span>
                  <span className="font-medium">{selectedRegistration.profile.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('pppoe.username')}:</span>
                  <span className="font-mono">{selectedRegistration.name.split(' ')[0].toLowerCase()}-{selectedRegistration.phone}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('pppoe.installationFee')} *</label>
                <input
                  type="number"
                  placeholder="e.g. 350000"
                  value={installationFee}
                  onChange={(e) => setInstallationFee(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
              <button
                onClick={() => setApproveModalOpen(false)}
                className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleApprove}
                disabled={!installationFee || approving}
                className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {approving ? t('pppoe.approving') : t('pppoe.approve')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalOpen && selectedRegistration && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-sm w-full">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('pppoe.rejectRegistration')}</h2>
              <p className="text-[10px] text-gray-500">{t('pppoe.provideReason')}</p>
            </div>
            <div className="p-4">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('pppoe.rejectionReason')} *</label>
              <textarea
                className="w-full px-3 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs min-h-[80px]"
                placeholder="e.g. Area not covered..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason || rejecting}
                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {rejecting ? t('pppoe.rejecting') : t('pppoe.reject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
