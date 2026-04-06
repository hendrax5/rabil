'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User, Wifi, Receipt, Loader2, ExternalLink, Edit2, X, Check, Shield } from 'lucide-react';

interface CustomerUser {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  expiredAt: Date;
  profile: {
    name: string;
    downloadSpeed: number;
    uploadSpeed: number;
  };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  paymentLink: string | null;
}

export default function CustomerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [ontDevice, setOntDevice] = useState<any>(null);
  const [loadingOnt, setLoadingOnt] = useState(true);
  const [editingWifi, setEditingWifi] = useState(false);
  const [wifiForm, setWifiForm] = useState({ ssid: '', password: '' });
  const [updatingWifi, setUpdatingWifi] = useState(false);
  const [companyName, setCompanyName] = useState('NexaRadius');

  useEffect(() => {
    loadCompanyName();
    loadUserData();
    loadInvoices();
    loadOntDevice();
  }, [router]);

  const loadCompanyName = async () => {
    try {
      const res = await fetch('/api/public/company');
      const data = await res.json();
      if (data.success && data.company.name) setCompanyName(data.company.name);
    } catch (error) { console.error('Load company name error:', error); }
  };

  const loadUserData = async () => {
    const token = localStorage.getItem('customer_token');
    if (!token) { router.push('/login'); return; }

    try {
      const res = await fetch('/api/customer/me', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();

      if (data.success) {
        setUser(data.user);
        localStorage.setItem('customer_user', JSON.stringify(data.user));
      } else {
        localStorage.removeItem('customer_token');
        localStorage.removeItem('customer_user');
        router.push('/login');
      }
    } catch (error) {
      const userData = localStorage.getItem('customer_user');
      if (userData) { try { setUser(JSON.parse(userData)); } catch (e) { router.push('/login'); } }
      else router.push('/login');
    } finally { setLoading(false); }
  };

  const loadInvoices = async () => {
    const token = localStorage.getItem('customer_token');
    if (!token) return;
    try {
      const res = await fetch('/api/customer/invoices', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setInvoices(data.invoices || []);
    } catch (error) { console.error('Load invoices error:', error); }
  };

  const loadOntDevice = async () => {
    const token = localStorage.getItem('customer_token');
    if (!token) return;
    try {
      const res = await fetch('/api/customer/ont', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.success && data.device) setOntDevice(data.device);
    } catch (error) { console.error('Load ONT error:', error); }
    finally { setLoadingOnt(false); }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const handleUpdateWifi = async () => {
    if (!wifiForm.ssid && !wifiForm.password) { alert('SSID atau password harus diisi'); return; }
    if (wifiForm.password && (wifiForm.password.length < 8 || wifiForm.password.length > 63)) { alert('Password harus 8-63 karakter'); return; }

    setUpdatingWifi(true);
    const token = localStorage.getItem('customer_token');
    try {
      const res = await fetch('/api/customer/ont/update-wifi', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(wifiForm),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setEditingWifi(false);
        setWifiForm({ ssid: '', password: '' });
        setTimeout(() => loadOntDevice(), 3000);
      } else alert(data.error || 'Gagal update WiFi');
    } catch (error) { alert('Gagal update WiFi'); }
    finally { setUpdatingWifi(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_user');
    router.push('/login');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>;
  if (!user) return null;

  const expiredDate = new Date(user.expiredAt);
  const isExpired = expiredDate < new Date();
  const daysLeft = Math.ceil((expiredDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-3 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            <div>
              <h1 className="text-sm font-bold">{companyName}</h1>
              <p className="text-[10px] text-teal-100">Customer Portal</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition">
            <LogOut className="w-3.5 h-3.5" /> Keluar
          </button>
        </div>
      </header>

      {/* Main */}
      <div className="max-w-3xl mx-auto p-3 space-y-3">
        {/* Profile Card */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-teal-100 dark:bg-teal-900/20 rounded-lg">
              <User className="w-4 h-4 text-teal-600" />
            </div>
            <h2 className="text-sm font-semibold">Informasi Akun</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-gray-500 block text-[10px]">Nama</span><span className="font-medium">{user.name}</span></div>
            <div><span className="text-gray-500 block text-[10px]">No. HP</span><span className="font-medium">{user.phone}</span></div>
            <div><span className="text-gray-500 block text-[10px]">Username</span><span className="font-mono text-[10px]">{user.username}</span></div>
            <div><span className="text-gray-500 block text-[10px]">Paket</span><span className="font-medium">{user.profile.name}</span></div>
            <div><span className="text-gray-500 block text-[10px]">Speed</span><span className="font-medium">{user.profile.downloadSpeed}/{user.profile.uploadSpeed} Mbps</span></div>
            <div><span className="text-gray-500 block text-[10px]">Status</span>
              {isExpired ? <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded">Expired</span>
              : user.status === 'active' ? <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded">Aktif</span>
              : <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[10px] rounded">{user.status}</span>}
            </div>
            <div className="col-span-2"><span className="text-gray-500 block text-[10px]">Expired</span>
              <span className="font-medium">{expiredDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                {!isExpired && <span className="text-gray-500 ml-1">({daysLeft} hari lagi)</span>}
              </span>
            </div>
          </div>
        </div>

        {/* ONT/WiFi Card */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <Wifi className="w-4 h-4 text-purple-600" />
            </div>
            <h2 className="text-sm font-semibold">ONT / WiFi</h2>
          </div>
          
          {loadingOnt ? <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin mx-auto text-purple-600" /></div>
          : !ontDevice ? <div className="text-center py-4 text-gray-500 text-xs"><Wifi className="w-8 h-8 mx-auto mb-1 opacity-30" /><p>ONT tidak ditemukan</p></div>
          : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div><span className="text-gray-500 block text-[10px]">Model</span><span className="font-medium">{ontDevice.manufacturer} {ontDevice.model}</span></div>
                <div><span className="text-gray-500 block text-[10px]">Status</span>
                  <span className={`px-1.5 py-0.5 text-[10px] rounded ${ontDevice.connectionStatus === 'Online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{ontDevice.connectionStatus}</span>
                </div>
                <div><span className="text-gray-500 block text-[10px]">IP</span><span className="font-mono text-[10px]">{ontDevice.ipAddress}</span></div>
                <div><span className="text-gray-500 block text-[10px]">RX Power</span><span className="font-medium">{ontDevice.rxPower} dBm</span></div>
              </div>
              
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">WiFi Settings</span>
                  {!editingWifi && <button onClick={() => { setEditingWifi(true); setWifiForm({ ssid: ontDevice.wifiSSID, password: '' }); }} className="text-[10px] text-teal-600 flex items-center gap-0.5"><Edit2 className="w-2.5 h-2.5" />Edit</button>}
                </div>
                
                {editingWifi ? (
                  <div className="space-y-2">
                    <input type="text" value={wifiForm.ssid} onChange={(e) => setWifiForm({ ...wifiForm, ssid: e.target.value })} className="w-full px-2 py-1 text-xs border rounded" placeholder="SSID baru" />
                    <input type="text" value={wifiForm.password} onChange={(e) => setWifiForm({ ...wifiForm, password: e.target.value })} className="w-full px-2 py-1 text-xs border rounded" placeholder="Password baru (8-63 karakter)" />
                    <div className="flex gap-1">
                      <button onClick={handleUpdateWifi} disabled={updatingWifi} className="flex-1 px-2 py-1 bg-teal-600 text-white text-[10px] rounded disabled:opacity-50 flex items-center justify-center gap-1">
                        {updatingWifi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}Simpan
                      </button>
                      <button onClick={() => { setEditingWifi(false); setWifiForm({ ssid: '', password: '' }); }} className="px-2 py-1 border text-[10px] rounded"><X className="w-3 h-3" /></button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-gray-500 block text-[10px]">SSID</span><span className="font-medium">{ontDevice.wifiSSID}</span></div>
                    <div><span className="text-gray-500 block text-[10px]">Status</span><span className={ontDevice.wifiEnabled ? 'text-green-600' : 'text-red-600'}>{ontDevice.wifiEnabled ? 'Aktif' : 'Off'}</span></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Invoices Card */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <Receipt className="w-4 h-4 text-green-600" />
            </div>
            <h2 className="text-sm font-semibold">Tagihan</h2>
          </div>
          
          {invoices.length === 0 ? <div className="text-center py-4 text-gray-500 text-xs"><Receipt className="w-8 h-8 mx-auto mb-1 opacity-30" /><p>Belum ada tagihan</p></div>
          : (
            <div className="space-y-2">
              {invoices.map((invoice) => {
                const dueDate = new Date(invoice.dueDate);
                const isPaid = invoice.status === 'PAID';
                const isOverdue = !isPaid && dueDate < new Date();
                return (
                  <div key={invoice.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-2.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-mono text-xs font-semibold">{invoice.invoiceNumber}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Due: {dueDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold">{formatCurrency(invoice.amount)}</p>
                        {isPaid ? <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded">Lunas</span>
                        : isOverdue ? <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded">Terlambat</span>
                        : <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] rounded">Belum Bayar</span>}
                      </div>
                    </div>
                    {!isPaid && invoice.paymentLink && (
                      <a href={invoice.paymentLink} target="_blank" rel="noopener noreferrer" className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs rounded transition">
                        Bayar Sekarang <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
