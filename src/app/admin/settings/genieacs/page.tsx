'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Server, Loader2, Zap, Save, CheckCircle, Info, ExternalLink } from 'lucide-react';
import Swal from 'sweetalert2';

interface GenieACSSettings {
  id?: string;
  host: string;
  username: string;
  password: string;
  isActive: boolean;
  hasPassword?: boolean;
}

export default function GenieACSSettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<GenieACSSettings>({
    host: '',
    username: '',
    password: '',
    isActive: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [settingsRes, devicesRes] = await Promise.all([
        fetch('/api/settings/genieacs'),
        fetch('/api/settings/genieacs/devices')
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        if (data?.settings) {
          setSettings({
            id: data.settings.id ?? '',
            host: data.settings.host ?? '',
            username: data.settings.username ?? '',
            password: '',
            isActive: data.settings.isActive ?? false,
            hasPassword: data.settings.hasPassword ?? false
          });
        }
      }

      if (devicesRes.ok) {
        const data = await devicesRes.json();
        setDeviceCount(data.devices?.length || 0);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings.host || !settings.username || (!settings.password && !settings.hasPassword)) {
      Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Host, username, dan password harus diisi' });
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        host: settings.host,
        username: settings.username,
      };
      if (settings.password) payload.password = settings.password;
      const response = await fetch('/api/settings/genieacs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        setSettings(prev => ({ ...prev, hasPassword: true, password: '', isActive: true }));
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Pengaturan GenieACS tersimpan', timer: 2000, showConfirmButton: false });
      } else {
        throw new Error(data.error || 'Gagal');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Gagal menyimpan pengaturan';
      Swal.fire({ icon: 'error', title: 'Error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!settings.host) {
      Swal.fire({ icon: 'warning', title: 'Perhatian', text: 'Masukkan URL server terlebih dahulu' });
      return;
    }
    setTesting(true);
    try {
      const response = await fetch('/api/settings/genieacs/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: settings.host, username: settings.username, password: settings.password })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        Swal.fire({ icon: 'success', title: 'Koneksi Berhasil', text: `Server GenieACS dapat dijangkau. ${data.deviceCount || 0} device terdaftar.`, timer: 3000, showConfirmButton: false });
      } else {
        throw new Error(data.error || 'Koneksi gagal');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Gagal terhubung ke server';
      Swal.fire({ icon: 'error', title: 'Koneksi Gagal', text: msg });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5" />
            <div>
              <h1 className="text-lg font-semibold">GenieACS Settings</h1>
              <p className="text-sm text-teal-100">Konfigurasi koneksi ke server GenieACS TR-069</p>
            </div>
          </div>
          <span className={`px-2 py-1 text-xs font-medium rounded ${settings.isActive ? 'bg-green-500' : 'bg-red-500'}`}>
            {settings.isActive ? 'Aktif' : 'Nonaktif'}
          </span>
        </div>
      </div>

      {/* Quick Stats */}
      {settings.isActive && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                <Server className="w-4 h-4 text-teal-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{deviceCount} Device</p>
                <p className="text-xs text-gray-500">Terhubung ke GenieACS</p>
              </div>
            </div>
            <a
              href="/admin/genieacs/devices"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-600 border border-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Lihat Devices
            </a>
          </div>
        </div>
      )}

      {/* Settings Form */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Konfigurasi Server</h2>
          <p className="text-xs text-gray-500 mt-0.5">Masukkan kredensial untuk terhubung ke GenieACS NBI API</p>
        </div>

        <form onSubmit={handleSaveSettings} className="p-4 space-y-4">
          {/* Status Info */}
          {settings.hasPassword && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <p className="text-xs text-green-700 dark:text-green-400">Kredensial tersimpan. Kosongkan password jika tidak ingin mengubah.</p>
            </div>
          )}

          {/* Info Box */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 dark:text-blue-400">
              <p className="font-medium mb-1">GenieACS NBI API</p>
              <p>Masukkan URL server GenieACS beserta port NBI (default: 7557). Contoh: <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">http://genieacs.example.com:7557</code></p>
            </div>
          </div>

          {/* Server URL */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              URL Server <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={settings.host || ''}
              onChange={(e) => setSettings({ ...settings, host: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              placeholder="http://genieacs.local:7557"
              required
            />
          </div>

          {/* Username & Password */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={settings.username || ''}
                onChange={(e) => setSettings({ ...settings, username: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="admin"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Password {!settings.hasPassword && <span className="text-red-500">*</span>}
              </label>
              <input
                type="password"
                value={settings.password || ''}
                onChange={(e) => setSettings({ ...settings, password: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder={settings.hasPassword ? '(tidak berubah)' : '••••••••'}
                required={!settings.hasPassword}
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !settings.host}
              className="flex items-center gap-1.5 px-4 py-2 text-teal-600 border border-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 text-xs font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Test Koneksi
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Simpan Pengaturan
            </button>
          </div>
        </form>
      </div>

      {/* Help Section */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Bantuan</h3>
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-teal-600">•</span>
            Pastikan GenieACS NBI API dapat diakses dari server ini
          </li>
          <li className="flex items-start gap-2">
            <span className="text-teal-600">•</span>
            Default port NBI API adalah 7557
          </li>
          <li className="flex items-start gap-2">
            <span className="text-teal-600">•</span>
            Gunakan Test Koneksi untuk memverifikasi kredensial sebelum menyimpan
          </li>
          <li className="flex items-start gap-2">
            <span className="text-teal-600">•</span>
            Setelah konfigurasi berhasil, kelola devices di menu <a href="/admin/genieacs/devices" className="text-teal-600 hover:underline">GenieACS → Devices</a>
          </li>
        </ul>
      </div>
    </div>
  );
}
