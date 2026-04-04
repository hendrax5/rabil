'use client';

import { useState, useEffect } from 'react';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { Plus, Pencil, Trash2, Users, TrendingUp, Calendar, Eye, X, Wallet, DollarSign, RefreshCw } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface Router {
  id: string;
  name: string;
  nasname: string;
  shortname: string;
}

interface Agent {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  isActive: boolean;
  balance: number;
  minBalance: number;
  routerId: string | null;
  router: Router | null;
  createdAt: string;
  updatedAt: string;
  stats: {
    currentMonth: { total: number; count: number };
    allTime: { total: number; count: number };
  };
}

interface MonthlyHistory {
  year: number;
  month: number;
  monthName: string;
  total: number;
  count: number;
}

interface MonthDetail {
  month: number;
  year: number;
  total: number;
  count: number;
  sales: {
    id: string;
    voucherCode: string;
    profileName: string;
    amount: number;
    createdAt: string;
  }[];
}

export default function AgentPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [routers, setRouters] = useState<Router[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [deleteAgentId, setDeleteAgentId] = useState<string | null>(null);
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [selectedAgentForBalance, setSelectedAgentForBalance] = useState<Agent | null>(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceType, setBalanceType] = useState<'add' | 'subtract'>('add');
  const [balanceNote, setBalanceNote] = useState('');
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [monthlyHistory, setMonthlyHistory] = useState<MonthlyHistory[]>([]);
  const [selectedMonthDetail, setSelectedMonthDetail] = useState<MonthDetail | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const currentMonthName = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    routerId: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [agentsRes, routersRes] = await Promise.all([
        fetch('/api/hotspot/agents'),
        fetch('/api/network/routers'),
      ]);
      const agentsData = await agentsRes.json();
      const routersData = await routersRes.json();
      setAgents(agentsData.agents || []);
      setRouters(routersData.routers || []);
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = '/api/hotspot/agents';
      const method = editingAgent ? 'PUT' : 'POST';
      const payload = { ...formData, ...(editingAgent && { id: editingAgent.id }) };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (res.ok) {
        setIsDialogOpen(false);
        setEditingAgent(null);
        resetForm();
        loadData();
        await showSuccess(editingAgent ? 'Agent updated!' : 'Agent created!');
      } else {
        await showError('Error: ' + result.error);
      }
    } catch (error) {
      await showError('Failed to save');
    }
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      phone: agent.phone,
      email: agent.email || '',
      address: agent.address || '',
      routerId: agent.routerId || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteAgentId) return;
    const confirmed = await showConfirm('Delete this agent and all history?');
    if (!confirmed) { setDeleteAgentId(null); return; }
    try {
      const res = await fetch(`/api/hotspot/agents?id=${deleteAgentId}`, { method: 'DELETE' });
      if (res.ok) {
        await showSuccess('Deleted!');
        loadData();
      } else {
        const result = await res.json();
        await showError(result.error || 'Failed');
      }
    } catch (error) {
      await showError('Failed to delete');
    } finally {
      setDeleteAgentId(null);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', email: '', address: '', routerId: '' });
  };

  const handleBalanceAdjust = async () => {
    if (!selectedAgentForBalance || !balanceAmount) {
      await showError('Enter amount');
      return;
    }
    const amount = parseInt(balanceAmount);
    if (isNaN(amount) || amount <= 0) {
      await showError('Invalid amount');
      return;
    }
    const confirmed = await showConfirm(`${balanceType === 'add' ? 'Add' : 'Subtract'} Rp ${formatCurrency(amount)}?`);
    if (!confirmed) return;
    try {
      const res = await fetch('/api/hotspot/agents/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgentForBalance.id,
          amount,
          type: balanceType,
          note: balanceNote || null,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        await showSuccess('Balance updated!');
        setBalanceModalOpen(false);
        setSelectedAgentForBalance(null);
        setBalanceAmount('');
        setBalanceNote('');
        loadData();
      } else {
        await showError(result.error || 'Failed');
      }
    } catch (error) {
      await showError('Failed');
    }
  };

  const openBalanceModal = (agent: Agent) => {
    setSelectedAgentForBalance(agent);
    setBalanceModalOpen(true);
    setBalanceAmount('');
    setBalanceType('add');
    setBalanceNote('');
  };

  const handleViewHistory = async (agent: Agent) => {
    setSelectedAgent(agent);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/hotspot/agents/${agent.id}/history`);
      const data = await res.json();
      setMonthlyHistory(data.history || []);
    } catch (error) {
      console.error('Load history error:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleViewMonthDetail = async (year: number, month: number) => {
    if (!selectedAgent) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/hotspot/agents/${selectedAgent.id}/history?year=${year}&month=${month}`);
      const data = await res.json();
      setSelectedMonthDetail(data);
    } catch (error) {
      console.error('Load month detail error:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

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
            <Users className="w-5 h-5 text-primary" />
            {t('agent.title')}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('agent.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { resetForm(); setEditingAgent(null); setIsDialogOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-white rounded-md hover:bg-primary/90"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('agent.addAgent')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium text-gray-500 uppercase">{t('common.total')}</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{agents.length}</div>
            </div>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium text-gray-500 uppercase">{t('common.active')}</div>
              <div className="text-lg font-bold text-green-600">{agents.filter((a) => a.isActive).length}</div>
            </div>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium text-gray-500 uppercase">{t('agent.allTime')}</div>
              <div className="text-sm font-bold text-purple-600">
                {formatCurrency(agents.reduce((sum, a) => sum + a.stats.allTime.total, 0))}
              </div>
            </div>
            <Calendar className="w-4 h-4 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('common.name')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden sm:table-cell">{t('common.phone')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden md:table-cell">{t('agent.router')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('agent.balance')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">
                  <div>{currentMonthName}</div>
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden lg:table-cell">{t('agent.allTime')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('common.status')}</th>
                <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500 text-xs">{t('agent.noAgentsFound')}</td>
                </tr>
              ) : (
                agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2">
                      <div className="font-medium text-xs text-gray-900 dark:text-white">{agent.name}</div>
                      {agent.email && <div className="text-[10px] text-gray-500">{agent.email}</div>}
                    </td>
                    <td className="px-3 py-2 text-xs hidden sm:table-cell">{agent.phone}</td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      {agent.router ? (
                        <div>
                          <div className="font-medium text-[10px]">{agent.router.name}</div>
                          <div className="text-[9px] text-gray-500">{agent.router.nasname}</div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">{t('agent.notAssigned')}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <div>
                          <div className="font-semibold text-[10px] text-green-600">{formatCurrency(agent.balance)}</div>
                          {agent.minBalance > 0 && (
                            <div className="text-[9px] text-gray-400">Min: {formatCurrency(agent.minBalance)}</div>
                          )}
                        </div>
                        <button
                          onClick={() => openBalanceModal(agent)}
                          className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                          title="Adjust"
                        >
                          <Wallet className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-[10px]">{formatCurrency(agent.stats.currentMonth.total)}</div>
                      <div className="text-[9px] text-gray-500">{agent.stats.currentMonth.count} vcr</div>
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell">
                      <div className="font-medium text-[10px]">{formatCurrency(agent.stats.allTime.total)}</div>
                      <div className="text-[9px] text-gray-500">{agent.stats.allTime.count} vcr</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        agent.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {agent.isActive ? t('common.active') : t('common.inactive')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleViewHistory(agent)}
                          className="p-1 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded"
                          title="History"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleEdit(agent)}
                          className="p-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteAgentId(agent.id)}
                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Delete"
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

      {/* Add/Edit Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-sm w-full">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                {editingAgent ? t('agent.editAgent') : t('agent.addAgent')}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.name')} *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('agent.agentName')}
                  required
                  className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.phone')} *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="08123456789"
                  required
                  className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.email')}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="agent@example.com"
                  className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.address')}</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder={t('common.address')}
                  rows={2}
                  className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('agent.router')}/NAS</label>
                <select
                  value={formData.routerId}
                  onChange={(e) => setFormData({ ...formData, routerId: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
                >
                  <option value="">{t('agent.noRouter')}</option>
                  {routers.map((router) => (
                    <option key={router.id} value={router.id}>{router.name} ({router.nasname})</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => { setIsDialogOpen(false); setEditingAgent(null); resetForm(); }}
                  className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="px-3 py-1.5 text-xs bg-primary text-white rounded-md hover:bg-primary/90">
                  {editingAgent ? t('common.update') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteAgentId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-sm w-full p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('agent.deleteAgent')}</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 mb-4">
              {t('agent.deleteConfirm')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteAgentId(null)}
                className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Balance Modal */}
      {balanceModalOpen && selectedAgentForBalance && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-sm w-full">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('agent.adjustBalance')}</h2>
                <p className="text-[10px] text-gray-500">{selectedAgentForBalance.name}</p>
              </div>
              <button onClick={() => { setBalanceModalOpen(false); setSelectedAgentForBalance(null); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <p className="text-[10px] text-gray-600 dark:text-gray-400">{t('agent.currentBalance')}</p>
                <p className="text-lg font-bold text-blue-600">{formatCurrency(selectedAgentForBalance.balance)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBalanceType('add')}
                  className={`px-3 py-2 rounded-lg border-2 text-xs font-medium ${
                    balanceType === 'add' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5 mx-auto mb-0.5" /> {t('agent.addBalance')}
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceType('subtract')}
                  className={`px-3 py-2 rounded-lg border-2 text-xs font-medium ${
                    balanceType === 'subtract' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 hover:border-red-300'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5 mx-auto mb-0.5" /> {t('agent.subtractBalance')}
                </button>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.amount')} *</label>
                <input
                  type="number"
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="1000"
                  className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.note')}</label>
                <textarea
                  value={balanceNote}
                  onChange={(e) => setBalanceNote(e.target.value)}
                  placeholder={t('common.optional')}
                  rows={2}
                  className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
                />
              </div>
              {balanceAmount && !isNaN(parseInt(balanceAmount)) && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-xs">
                  <div className="flex justify-between">
                    <span>{t('agent.newBalance')}:</span>
                    <span className="font-bold text-blue-600">
                      {formatCurrency(
                        balanceType === 'add'
                          ? selectedAgentForBalance.balance + parseInt(balanceAmount)
                          : selectedAgentForBalance.balance - parseInt(balanceAmount)
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
              <button
                onClick={() => { setBalanceModalOpen(false); setSelectedAgentForBalance(null); }}
                className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleBalanceAdjust}
                className={`px-3 py-1.5 text-xs text-white rounded-md ${
                  balanceType === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {balanceType === 'add' ? t('agent.addBalance') : t('agent.subtractBalance')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModalOpen && selectedAgent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{selectedAgent.name}</h2>
                <p className="text-[10px] text-gray-500">{t('agent.salesHistory')}</p>
              </div>
              <button onClick={() => { setHistoryModalOpen(false); setSelectedAgent(null); setSelectedMonthDetail(null); setMonthlyHistory([]); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingHistory ? (
                <div className="flex items-center justify-center h-24">
                  <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                </div>
              ) : selectedMonthDetail ? (
                <div className="space-y-3">
                  <button onClick={() => setSelectedMonthDetail(null)} className="text-xs text-blue-600 hover:underline">
                    ← {t('common.back')}
                  </button>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs font-semibold">
                      {new Date(selectedMonthDetail.year, selectedMonthDetail.month).toLocaleString('id-ID', { month: 'long', year: 'numeric' })}
                    </p>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <p className="text-[10px] text-gray-500">{t('agent.totalSales')}</p>
                        <p className="text-sm font-bold">{formatCurrency(selectedMonthDetail.total)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500">{t('agent.vouchers')}</p>
                        <p className="text-sm font-bold">{selectedMonthDetail.count}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {selectedMonthDetail.sales.map((sale) => (
                      <div key={sale.id} className="border dark:border-gray-700 rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-xs">{sale.voucherCode}</p>
                            <p className="text-[10px] text-gray-500">{sale.profileName}</p>
                            <p className="text-[9px] text-gray-400 mt-0.5">{formatDate(sale.createdAt)}</p>
                          </div>
                          <p className="font-semibold text-xs text-green-600">{formatCurrency(sale.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {monthlyHistory.length === 0 ? (
                    <p className="text-center text-gray-500 text-xs py-6">{t('agent.noHistory')}</p>
                  ) : (
                    monthlyHistory.map((month) => (
                      <button
                        key={`${month.year}-${month.month}`}
                        onClick={() => handleViewMonthDetail(month.year, month.month - 1)}
                        className="w-full border dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-left"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-xs">{month.monthName}</p>
                            <p className="text-[10px] text-gray-500">{month.count} vouchers</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-xs text-green-600">{formatCurrency(month.total)}</p>
                            <Eye className="w-3 h-3 text-gray-400 ml-auto mt-0.5" />
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
