'use client';
import { showSuccess, showError, showWarning } from '@/lib/sweetalert';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Wifi, ShoppingCart, Loader2, CheckCircle, Zap, Clock, Phone, User } from 'lucide-react';

interface Profile {
  id: string;
  name: string;
  sellingPrice: number;
  downloadSpeed: number;
  uploadSpeed: number;
  validityValue: number;
  validityUnit: string;
  eVoucherAccess: boolean;
}

export default function EVoucherPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '' });

  useEffect(() => { loadProfiles(); }, []);

  const loadProfiles = async () => {
    try {
      const res = await fetch('/api/evoucher/profiles');
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles || []);
      }
    } catch (error) { console.error('Load profiles error:', error); }
    finally { setLoading(false); }
  };

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) { await showWarning('Silakan pilih paket terlebih dahulu'); return; }

    setPurchasing(true);
    try {
      const res = await fetch('/api/evoucher/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: selectedProfile.id, customerName: formData.name, customerPhone: formData.phone, quantity: 1 }),
      });

      const data = await res.json();
      if (res.ok) router.push(data.order.paymentLink);
      else await showError(data.error || 'Gagal membuat pesanan');
    } catch (error) {
      await showError('Gagal membuat pesanan. Silakan coba lagi.');
    } finally { setPurchasing(false); }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const formatValidity = (value: number, unit: string) => {
    const unitMap: { [key: string]: string } = { MINUTES: 'Menit', HOURS: 'Jam', DAYS: 'Hari', MONTHS: 'Bulan' };
    return `${value} ${unitMap[unit] || unit}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100">
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 py-6">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-4 mb-5">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-teal-600 to-cyan-600 rounded-xl shadow-lg mb-3">
            <Wifi className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Beli Voucher WiFi</h1>
          <p className="text-xs text-gray-600 mt-0.5">Pilih paket sesuai kebutuhan Anda</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Packages */}
          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Paket Tersedia</h2>
            
            {profiles.length === 0 ? (
              <div className="bg-white rounded-lg border p-6 text-center">
                <Wifi className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-xs text-gray-500">Belum ada paket tersedia</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    onClick={() => setSelectedProfile(profile)}
                    className={`bg-white rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md ${
                      selectedProfile?.id === profile.id ? 'ring-2 ring-teal-600 shadow-md' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 text-[10px] font-medium rounded mb-1.5">
                          <Clock className="w-2.5 h-2.5" />
                          {formatValidity(profile.validityValue, profile.validityUnit)}
                        </span>
                        <h3 className="text-sm font-bold text-gray-900 line-clamp-1">{profile.name}</h3>
                        <div className="flex items-center text-[10px] text-gray-500 mt-0.5">
                          <Zap className="w-2.5 h-2.5 mr-0.5 text-teal-600" />
                          {profile.downloadSpeed}/{profile.uploadSpeed} Mbps
                        </div>
                      </div>
                      {selectedProfile?.id === profile.id && (
                        <CheckCircle className="w-4 h-4 text-teal-600" />
                      )}
                    </div>
                    <div className="pt-2 border-t flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-gray-500">Harga</p>
                        <p className="text-sm font-bold text-teal-600">{formatCurrency(profile.sellingPrice)}</p>
                      </div>
                      <button className={`px-2 py-1 text-[10px] font-medium rounded ${
                        selectedProfile?.id === profile.id 
                          ? 'bg-teal-600 text-white' 
                          : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}>
                        {selectedProfile?.id === profile.id ? 'Dipilih' : 'Pilih'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Order Form */}
          <div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-lg sticky top-4">
              <div className="p-3 border-b border-gray-200">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                  <ShoppingCart className="w-4 h-4 text-teal-600" />
                  Ringkasan Pesanan
                </h3>
              </div>
              <div className="p-3 space-y-3">
                {selectedProfile ? (
                  <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg p-2.5">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Paket Dipilih</p>
                    <p className="text-sm font-bold text-gray-900">{selectedProfile.name}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {formatValidity(selectedProfile.validityValue, selectedProfile.validityUnit)} • {selectedProfile.downloadSpeed}/{selectedProfile.uploadSpeed} Mbps
                    </p>
                    <div className="pt-2 mt-2 border-t border-teal-200 flex justify-between items-baseline">
                      <span className="text-[10px] text-gray-600">Total Bayar</span>
                      <span className="text-lg font-bold text-teal-600">{formatCurrency(selectedProfile.sellingPrice)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 text-center border-2 border-dashed border-gray-300">
                    <Wifi className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                    <p className="text-[10px] text-gray-500">Pilih paket terlebih dahulu</p>
                  </div>
                )}

                <form onSubmit={handlePurchase} className="space-y-3">
                  <div>
                    <label className="flex items-center gap-1 text-[11px] font-medium text-gray-700 mb-1">
                      <User className="w-3 h-3" /> Nama Lengkap *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="Masukkan nama Anda"
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1 text-[11px] font-medium text-gray-700 mb-1">
                      <Phone className="w-3 h-3" /> Nomor WhatsApp *
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                      placeholder="08123456789"
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-teal-500"
                    />
                    <p className="text-[10px] text-gray-500 mt-0.5">Kode voucher akan dikirim ke nomor ini</p>
                  </div>

                  <button
                    type="submit"
                    disabled={!selectedProfile || purchasing}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-400 text-white text-sm font-medium rounded-lg transition"
                  >
                    {purchasing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Memproses...</>
                    ) : (
                      <><ShoppingCart className="w-4 h-4" />Beli Sekarang</>
                    )}
                  </button>

                  <p className="text-[10px] text-center text-gray-500">
                    Dengan melanjutkan, Anda menyetujui syarat & ketentuan
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 py-4 border-t border-gray-200">
        <p className="text-center text-[10px] text-gray-500">Powered by AIBILL RADIUS</p>
      </div>
    </div>
  );
}
