'use client';

import { useEffect, useState } from 'react';
import { showSuccess, showError } from '@/lib/sweetalert';
import { UserPlus, Loader2, Wifi, CheckCircle, Shield } from 'lucide-react';

interface Profile {
  id: string;
  name: string;
  price: number;
  downloadSpeed: number;
  uploadSpeed: number;
  description: string | null;
}

export default function DaftarPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [companyName, setCompanyName] = useState('NexaRadius');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    profileId: '',
    notes: '',
  });

  useEffect(() => {
    loadCompanyName();
    loadProfiles();
  }, []);

  const loadCompanyName = async () => {
    try {
      const res = await fetch('/api/public/company');
      const data = await res.json();
      if (data.success && data.company.name) setCompanyName(data.company.name);
    } catch (error) { console.error('Load company error:', error); }
  };

  const loadProfiles = async () => {
    try {
      const res = await fetch('/api/pppoe/profiles');
      const data = await res.json();
      setProfiles(data.profiles.filter((p: any) => p.isActive) || []);
    } catch (error) { console.error('Failed to load profiles:', error); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.address || !formData.profileId) {
      await showError('Mohon lengkapi semua field yang wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        await showSuccess('Pendaftaran berhasil dikirim!\n\nTim kami akan menghubungi Anda segera.');
      } else {
        await showError(data.error || 'Gagal mengirim pendaftaran');
      }
    } catch (error) {
      await showError('Gagal mengirim pendaftaran');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProfile = profiles.find((p) => p.id === formData.profileId);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 flex items-center justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Pendaftaran Berhasil!</h2>
          <p className="text-xs text-gray-600 mb-4">Terima kasih telah mendaftar. Tim kami akan segera menghubungi Anda.</p>
          <button
            onClick={() => { setSuccess(false); setFormData({ name: '', phone: '', email: '', address: '', profileId: '', notes: '' }); }}
            className="w-full px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg transition"
          >
            Daftar Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 py-6 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-teal-600 to-cyan-600 rounded-xl shadow-lg mb-3">
            <Wifi className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{companyName}</h1>
          <p className="text-xs text-gray-600 mt-0.5">Daftar Layanan Internet</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-4 h-4 text-teal-600" />
            <h2 className="text-sm font-semibold">Formulir Pendaftaran</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Personal Info */}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase">Informasi Pribadi</p>
              
              <div>
                <label className="text-[11px] font-medium text-gray-700">Nama Lengkap <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="Nama lengkap Anda"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full mt-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-teal-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-gray-700">Nomor WhatsApp <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  placeholder="08xxxxxxxxxx"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full mt-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-teal-500"
                  required
                />
                <p className="text-[10px] text-gray-500 mt-0.5">Untuk komunikasi</p>
              </div>

              <div>
                <label className="text-[11px] font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  placeholder="email@example.com (opsional)"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full mt-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-gray-700">Alamat Lengkap <span className="text-red-500">*</span></label>
                <textarea
                  placeholder="Jalan, RT/RW, Kelurahan, Kecamatan"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full mt-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-teal-500"
                  rows={2}
                  required
                />
              </div>
            </div>

            {/* Package Selection */}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase">Pilih Paket</p>
              
              <div>
                <label className="text-[11px] font-medium text-gray-700">Paket Internet <span className="text-red-500">*</span></label>
                <select
                  value={formData.profileId}
                  onChange={(e) => setFormData({ ...formData, profileId: e.target.value })}
                  className="w-full mt-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-teal-500 bg-white"
                  required
                >
                  <option value="">Pilih paket internet</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} - {profile.downloadSpeed}/{profile.uploadSpeed} Mbps - Rp {profile.price.toLocaleString()}/bln
                    </option>
                  ))}
                </select>
              </div>

              {selectedProfile && (
                <div className="bg-teal-50 p-2.5 rounded-lg border border-teal-200">
                  <h4 className="text-[10px] font-semibold text-teal-800 mb-1.5">Detail Paket</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-gray-600">Paket:</span><span className="font-medium">{selectedProfile.name}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Speed:</span><span className="font-medium">{selectedProfile.downloadSpeed}/{selectedProfile.uploadSpeed} Mbps</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Harga:</span><span className="font-bold text-teal-700">Rp {selectedProfile.price.toLocaleString()}/bln</span></div>
                    {selectedProfile.description && <p className="pt-1 border-t border-teal-200 text-gray-700 text-[10px]">{selectedProfile.description}</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="text-[11px] font-medium text-gray-700">Catatan (Opsional)</label>
              <textarea
                placeholder="Catatan atau permintaan khusus"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full mt-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-teal-500"
                rows={2}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-400 text-white text-sm font-medium rounded-lg transition"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Mengirim...</>
              ) : (
                <><UserPlus className="w-4 h-4" />Kirim Pendaftaran</>
              )}
            </button>

            <p className="text-[10px] text-center text-gray-500">
              Dengan mendaftar, Anda menyetujui syarat dan ketentuan layanan
            </p>
          </form>
        </div>

        <p className="mt-4 text-center text-[10px] text-gray-500">
          Powered by NexaRadius
        </p>
      </div>
    </div>
  );
}
