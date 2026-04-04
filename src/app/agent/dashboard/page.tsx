'use client';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { formatWIB } from '@/lib/timezone';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  Calendar,
  Ticket,
  LogOut,
  Zap,
  Check,
  X as CloseIcon,
  MessageCircle,
  Wallet,
  Plus,
  RefreshCcw,
} from 'lucide-react';

interface AgentData {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  balance: number;
  minBalance: number;
}

interface Deposit {
  id: string;
  amount: number;
  status: string;
  paymentGateway: string | null;
  paymentUrl: string | null;
  paidAt: string | null;
  expiredAt: string | null;
  createdAt: string;
}

interface Profile {
  id: string;
  name: string;
  costPrice: number;
  resellerFee: number;
  sellingPrice: number;
  downloadSpeed: number;
  uploadSpeed: number;
  validityValue: number;
  validityUnit: string;
}

interface Voucher {
  id: string;
  code: string;
  batchCode: string;
  status: string;
  profileName: string;
  sellingPrice: number;
  resellerFee: number;
  routerName: string | null;
  firstLoginAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function AgentDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [stats, setStats] = useState({
    currentMonth: { total: 0, count: 0, income: 0 },
    allTime: { total: 0, count: 0, income: 0 },
    generated: 0,
    waiting: 0,
    sold: 0,
    used: 0,
  });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [generatedVouchers, setGeneratedVouchers] = useState<Voucher[]>([]);
  const [showVouchersModal, setShowVouchersModal] = useState(false);
  
  // Deposit functionality
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositGateway, setDepositGateway] = useState('');
  const [creatingDeposit, setCreatingDeposit] = useState(false);
  const [paymentGateways, setPaymentGateways] = useState<{provider: string; name: string}[]>([]);
  
  // WhatsApp functionality
  const [selectedVouchers, setSelectedVouchers] = useState<string[]>([]);
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  useEffect(() => {
    // Check if agent is logged in
    const agentDataStr = localStorage.getItem('agentData');
    if (!agentDataStr) {
      router.push('/agent');
      return;
    }

    const agentData = JSON.parse(agentDataStr);
    setAgent(agentData);
    loadDashboard(agentData.id);
  }, [router]);

  const loadDashboard = async (agentId: string) => {
    try {
      const res = await fetch(`/api/agent/dashboard?agentId=${agentId}`);
      const data = await res.json();

      if (res.ok) {
        setAgent(data.agent);
        setStats(data.stats || {
          currentMonth: { total: 0, count: 0, income: 0 },
          allTime: { total: 0, count: 0, income: 0 },
          generated: 0,
          waiting: 0,
          sold: 0,
          used: 0,
        });
        setProfiles(data.profiles || []);
        setVouchers(data.vouchers || []);
        setDeposits(data.deposits || []);
        setPaymentGateways(data.paymentGateways || []);
        if (data.paymentGateways && data.paymentGateways.length > 0) {
          setDepositGateway(data.paymentGateways[0].provider);
        }
        if (data.profiles && data.profiles.length > 0) {
          setSelectedProfile(data.profiles[0].id);
        }
      }
    } catch (error) {
      console.error('Load dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('agentData');
    router.push('/agent');
  };

  const handleSelectVoucher = (voucherId: string) => {
    setSelectedVouchers(prev => 
      prev.includes(voucherId) 
        ? prev.filter(id => id !== voucherId)
        : [...prev, voucherId]
    );
  };

  const handleSelectAll = () => {
    const waitingVouchers = vouchers.filter(v => v.status === 'WAITING').map(v => v.id);
    setSelectedVouchers(waitingVouchers.length === selectedVouchers.length ? [] : waitingVouchers);
  };

  const handleSendWhatsApp = async () => {
    if (selectedVouchers.length === 0) {
      await showError('Pilih voucher terlebih dahulu');
      return;
    }
    setShowWhatsAppDialog(true);
  };

  const handleWhatsAppSubmit = async () => {
    if (!whatsappPhone) {
      await showError('Masukkan nomor WhatsApp');
      return;
    }

    setSendingWhatsApp(true);
    try {
      const vouchersToSend = vouchers.filter(v => selectedVouchers.includes(v.id));
      
      const vouchersData = vouchersToSend.map(v => {
        const profile = profiles.find(p => p.name === v.profileName);
        return {
          code: v.code,
          profileName: v.profileName,
          price: profile?.sellingPrice || 0,
          validity: profile ? `${profile.validityValue} ${profile.validityUnit.toLowerCase()}` : '-'
        };
      });

      const res = await fetch('/api/hotspot/voucher/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: whatsappPhone,
          vouchers: vouchersData
        })
      });

      const data = await res.json();

      if (data.success) {
        await showSuccess(`WhatsApp berhasil dikirim ke ${whatsappPhone}!`);
        setShowWhatsAppDialog(false);
        setWhatsappPhone('');
        setSelectedVouchers([]);
      } else {
        await showError('Gagal: ' + data.error);
      }
    } catch (error) {
      console.error('Send WhatsApp error:', error);
      await showError('Gagal mengirim WhatsApp');
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const handleGenerate = async () => {
    if (!agent || !selectedProfile) return;
    
    const profile = profiles.find(p => p.id === selectedProfile);
    if (!profile) return;
    
    const totalCost = profile.costPrice * quantity;
    
    if (agent.balance < totalCost) {
      const deficit = totalCost - agent.balance;
      const result = await showConfirm(
        `Saldo tidak cukup!\n\nSaldo Anda: ${formatCurrency(agent.balance)}\nDibutuhkan: ${formatCurrency(totalCost)}\nKurang: ${formatCurrency(deficit)}\n\nTop up sekarang?`,
        'Saldo Tidak Cukup'
      );
      if (result) {
        setShowDepositModal(true);
        setDepositAmount(Math.ceil(deficit / 10000) * 10000 + '');
      }
      return;
    }
    
    const confirmed = await showConfirm(
      `Generate ${quantity} voucher(s) ${profile.name}?\n\nTotal Harga: ${formatCurrency(totalCost)}\nSaldo Sekarang: ${formatCurrency(agent.balance)}\nSaldo Setelah: ${formatCurrency(agent.balance - totalCost)}`,
      'Generate Voucher'
    );
    
    if (!confirmed) return;

    setGenerating(true);
    try {
      const res = await fetch('/api/agent/generate-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          profileId: selectedProfile,
          quantity,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setGeneratedVouchers(data.vouchers);
        setShowVouchersModal(true);
        if (data.newBalance !== undefined && agent) {
          setAgent({ ...agent, balance: data.newBalance });
        }
        loadDashboard(agent.id);
        await showSuccess(`${data.vouchers.length} voucher berhasil digenerate!\n\nSaldo baru: ${formatCurrency(data.newBalance || 0)}`);
      } else {
        if (data.error === 'Insufficient balance') {
          const deficit = data.deficit || 0;
          const result = await showConfirm(
            `Saldo tidak cukup!\n\nSaldo Anda: ${formatCurrency(data.current || 0)}\nDibutuhkan: ${formatCurrency(data.required || 0)}\nKurang: ${formatCurrency(deficit)}\n\nTop up sekarang?`,
            'Saldo Tidak Cukup'
          );
          if (result) {
            setShowDepositModal(true);
            setDepositAmount(Math.ceil(deficit / 10000) * 10000 + '');
          }
        } else {
          await showError('Error: ' + data.error);
        }
      }
    } catch (error) {
      console.error('Generate error:', error);
      await showError('Gagal generate voucher');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateDeposit = async () => {
    if (!agent) return;

    if (paymentGateways.length === 0) {
      await showError('Payment gateway belum dikonfigurasi. Hubungi admin.');
      return;
    }

    const amount = parseInt(depositAmount);
    if (isNaN(amount) || amount < 10000) {
      await showError('Minimum deposit Rp 10.000');
      return;
    }

    if (!depositGateway) {
      await showError('Pilih metode pembayaran');
      return;
    }

    setCreatingDeposit(true);
    try {
      const res = await fetch('/api/agent/deposit/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          amount,
          gateway: depositGateway,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.deposit.paymentUrl) {
          window.open(data.deposit.paymentUrl, '_blank');
          await showSuccess('Link pembayaran dibuka di tab baru. Silakan selesaikan pembayaran.');
          setShowDepositModal(false);
          setDepositAmount('');
          setTimeout(() => loadDashboard(agent.id), 3000);
        }
      } else {
        await showError('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Create deposit error:', error);
      await showError('Gagal membuat deposit');
    } finally {
      setCreatingDeposit(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const currentMonthName = new Date().toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });

  const selectedProfileData = profiles.find(p => p.id === selectedProfile);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Agent Dashboard</h1>
              <p className="text-sm text-white/80 mt-0.5">{agent.name}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition"
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Balance Card */}
        <div className="bg-gradient-to-r from-teal-500 to-cyan-600 rounded-xl shadow-lg p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">SALDO ANDA</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(agent.balance || 0)}</p>
              {agent.minBalance > 0 && (
                <p className="text-xs opacity-75 mt-1">Min. saldo: {formatCurrency(agent.minBalance)}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDepositModal(true)}
                className="flex items-center px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition"
              >
                <Plus className="h-4 w-4 mr-1" />
                Deposit
              </button>
              <button
                onClick={() => agent && loadDashboard(agent.id)}
                className="flex items-center px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition"
              >
                <RefreshCcw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Komisi Bulan Ini</p>
                <p className="text-lg font-bold mt-0.5 text-green-600">
                  {formatCurrency(stats.currentMonth?.total || 0)}
                </p>
              </div>
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Komisi</p>
                <p className="text-lg font-bold mt-0.5 text-teal-600">
                  {formatCurrency(stats.allTime?.total || 0)}
                </p>
              </div>
              <Calendar className="h-6 w-6 text-teal-600" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Voucher Tersedia</p>
                <p className="text-lg font-bold mt-0.5">{stats.waiting || 0}</p>
              </div>
              <Ticket className="h-6 w-6 text-cyan-600" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Voucher Terpakai</p>
                <p className="text-lg font-bold mt-0.5">{stats.used || 0}</p>
              </div>
              <Check className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </div>

        {/* Quick Generate */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-yellow-500" />
            <h2 className="text-base font-semibold">Generate Voucher</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1.5">Pilih Paket</label>
              <select
                value={selectedProfile}
                onChange={(e) => setSelectedProfile(e.target.value)}
                className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg dark:bg-gray-700"
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} - {formatCurrency(profile.sellingPrice)} - {profile.downloadSpeed}/{profile.uploadSpeed} Mbps
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5">Jumlah</label>
              <input
                type="number"
                min="1"
                max="50"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg dark:bg-gray-700"
              />
            </div>
          </div>

          {selectedProfileData && (
            <div className="mt-3 p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Harga Beli</p>
                  <p className="font-semibold">{formatCurrency(selectedProfileData.costPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Keuntungan/pcs</p>
                  <p className="font-semibold text-green-600">{formatCurrency(selectedProfileData.resellerFee)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Speed</p>
                  <p className="font-semibold">{selectedProfileData.downloadSpeed}/{selectedProfileData.uploadSpeed} Mbps</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Total Bayar</p>
                  <p className="font-semibold text-teal-600">{formatCurrency(selectedProfileData.costPrice * quantity)}</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || !selectedProfile}
            className="mt-4 w-full flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                Generating...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Generate Voucher
              </>
            )}
          </button>
        </div>

        {/* Vouchers List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-5 py-4 border-b dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Daftar Voucher</h2>
              <p className="text-xs text-gray-500 mt-0.5">Semua voucher yang sudah di-generate</p>
            </div>
            {selectedVouchers.length > 0 && (
              <button
                onClick={handleSendWhatsApp}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs transition"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Kirim WA ({selectedVouchers.length})
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-2.5 w-10">
                    <input
                      type="checkbox"
                      checked={selectedVouchers.length > 0 && selectedVouchers.length === vouchers.filter(v => v.status === 'WAITING').length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Kode Voucher</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Paket</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Router</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Dibuat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {vouchers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                      Belum ada voucher. Generate voucher pertama Anda di atas.
                    </td>
                  </tr>
                ) : (
                  vouchers.map((voucher) => (
                    <tr key={voucher.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        {voucher.status === 'WAITING' && (
                          <input
                            type="checkbox"
                            checked={selectedVouchers.includes(voucher.id)}
                            onChange={() => handleSelectVoucher(voucher.id)}
                            className="rounded border-gray-300"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-sm">{voucher.code}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{voucher.batchCode || '-'}</td>
                      <td className="px-4 py-3 text-xs">{voucher.profileName}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{voucher.routerName || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          voucher.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : voucher.status === 'EXPIRED'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                            : voucher.status === 'SOLD'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                        }`}>
                          {voucher.status === 'WAITING' ? 'WAITING' : 
                           voucher.status === 'SOLD' ? 'SOLD' :
                           voucher.status === 'ACTIVE' ? 'ACTIVE' :
                           voucher.status === 'EXPIRED' ? 'EXPIRED' : voucher.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {voucher.createdAt ? formatWIB(new Date(voucher.createdAt), 'dd MMM yyyy HH:mm') : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Generated Vouchers Modal */}
      {showVouchersModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="px-5 py-4 border-b dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <h2 className="text-base font-semibold">Voucher Berhasil Dibuat!</h2>
              </div>
              <button
                onClick={() => { setShowVouchersModal(false); setGeneratedVouchers([]); }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(80vh-80px)]">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                Salin kode voucher di bawah ini untuk pelanggan Anda
              </p>
              <div className="space-y-2">
                {generatedVouchers.map((voucher, index) => (
                  <div
                    key={voucher.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div>
                      <p className="text-xs text-gray-500">Voucher {index + 1}</p>
                      <p className="text-xl font-mono font-bold">{voucher.code}</p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(voucher.code);
                        showSuccess('Kode disalin!');
                      }}
                      className="px-3 py-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded transition"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Dialog */}
      {showWhatsAppDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full">
            <div className="px-5 py-4 border-b dark:border-gray-700">
              <h2 className="text-base font-semibold">Kirim Voucher via WhatsApp</h2>
              <p className="text-xs text-gray-500 mt-0.5">Kirim {selectedVouchers.length} voucher ke customer</p>
            </div>

            <div className="p-5">
              <label className="block text-xs font-medium mb-1.5">Nomor WhatsApp</label>
              <input
                type="tel"
                placeholder="628123456789"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg dark:bg-gray-700"
              />
              <p className="text-xs text-gray-500 mt-1">Masukkan nomor dengan kode negara</p>
            </div>

            <div className="px-5 py-4 border-t dark:border-gray-700 flex gap-2 justify-end">
              <button
                onClick={() => { setShowWhatsAppDialog(false); setWhatsappPhone(''); }}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                Batal
              </button>
              <button
                onClick={handleWhatsAppSubmit}
                disabled={sendingWhatsApp || !whatsappPhone}
                className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {sendingWhatsApp ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Mengirim...</>
                ) : (
                  <><MessageCircle className="h-3.5 w-3.5" />Kirim WhatsApp</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full">
            <div className="px-5 py-4 border-b dark:border-gray-700">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Top Up Saldo
              </h2>
            </div>

            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1.5">Jumlah Deposit</label>
                <input
                  type="number"
                  placeholder="Minimum Rp 10.000"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  min="10000"
                  step="10000"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5">Metode Pembayaran</label>
                {paymentGateways.length > 0 ? (
                  <select
                    value={depositGateway}
                    onChange={(e) => setDepositGateway(e.target.value)}
                    className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  >
                    {paymentGateways.map((gw) => (
                      <option key={gw.provider} value={gw.provider}>{gw.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-red-500 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    Belum ada payment gateway yang dikonfigurasi. Hubungi admin.
                  </div>
                )}
              </div>

              {depositAmount && parseInt(depositAmount) >= 10000 && (
                <div className="bg-teal-50 dark:bg-teal-900/20 p-3 rounded-lg">
                  <p className="text-sm text-teal-800 dark:text-teal-300">
                    Total: <span className="font-bold">{formatCurrency(parseInt(depositAmount))}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t dark:border-gray-700 flex gap-2 justify-end">
              <button
                onClick={() => { setShowDepositModal(false); setDepositAmount(''); }}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                disabled={creatingDeposit}
              >
                Batal
              </button>
              <button
                onClick={handleCreateDeposit}
                disabled={creatingDeposit || !depositAmount || parseInt(depositAmount) < 10000 || paymentGateways.length === 0}
                className="px-3 py-1.5 text-sm bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {creatingDeposit ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Memproses...</>
                ) : (
                  <><Plus className="h-3.5 w-3.5" />Bayar Sekarang</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
