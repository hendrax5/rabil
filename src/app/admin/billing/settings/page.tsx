'use client';

import { useState, useEffect } from 'react';
import {
  CreditCard, Save, RefreshCw, Settings, AlertTriangle,
  Shield, Calendar, Clock, DollarSign, Bell, Zap, Info,
} from 'lucide-react';
import { showError } from '@/lib/sweetalert';
import Swal from 'sweetalert2';

interface BillingSettings {
  id: string;
  billingType: string;
  billingDay: number;
  gracePeriod: number;
  autoSuspend: boolean;
  autoUnsuspend: boolean;
  lateFeeType: string;
  lateFeeAmount: number;
  sendInvoiceDay: number;
}

function ToggleSwitch({ value, onChange, label, description }: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-white">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
          value ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            value ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}

export default function BillingSettingsPage() {
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing/settings');
      const data = await res.json();
      if (data.success) setSettings(data.settings);
    } catch (e) {
      showError('Gagal memuat billing settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const update = (key: keyof BillingSettings, value: any) => {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev);
    setChanged(true);
  };

  const handleSave = async () => {
    if (!settings || !changed) return;
    setSaving(true);
    try {
      const res = await fetch('/api/billing/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setChanged(false);
        await Swal.fire({
          title: 'Tersimpan!',
          text: 'Billing settings berhasil disimpan.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        showError(data.error || 'Gagal menyimpan');
      }
    } catch (e) {
      showError('Gagal menyimpan settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="h-5 w-5 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-teal-600" />
            Billing Engine Settings
          </h1>
          <p className="page-subtitle">Konfigurasi siklus tagihan, grace period, dan auto-suspend</p>
        </div>
        <button
          onClick={handleSave}
          disabled={!changed || saving}
          className="btn-premium bg-teal-600 hover:bg-teal-700 text-white gap-1.5 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>

      {changed && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          Ada perubahan yang belum disimpan
        </div>
      )}

      {/* Billing Cycle */}
      <div className="card-soft p-6 space-y-5">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4 text-teal-600" />
          Siklus Penagihan
        </h2>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
            Tipe Billing
          </label>
          <div className="flex gap-3">
            {[
              { value: 'fixed', label: 'Fixed Date', desc: 'Tanggal tetap setiap bulan' },
              { value: 'anniversary', label: 'Anniversary', desc: 'Berdasarkan tanggal registrasi' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => update('billingType', opt.value)}
                className={`flex-1 p-3 rounded-xl border-2 text-left transition-all ${
                  settings.billingType === opt.value
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-teal-300'
                }`}
              >
                <p className="text-xs font-semibold">{opt.label}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {settings.billingType === 'fixed' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              Tanggal Jatuh Tempo (1-28)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={28}
                value={settings.billingDay}
                onChange={e => update('billingDay', parseInt(e.target.value))}
                className="input-field w-24 text-center text-lg font-bold"
              />
              <p className="text-xs text-gray-500">Tagihan jatuh tempo setiap tanggal {settings.billingDay} per bulan</p>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
            Kirim Invoice H- (hari sebelum jatuh tempo)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={28}
              value={settings.sendInvoiceDay}
              onChange={e => update('sendInvoiceDay', parseInt(e.target.value))}
              className="input-field w-24 text-center text-lg font-bold"
            />
            <p className="text-xs text-gray-500">Invoice dikirim tiap tanggal {settings.sendInvoiceDay}</p>
          </div>
        </div>
      </div>

      {/* Grace Period & Auto-Suspend */}
      <div className="card-soft p-6 space-y-5">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-600" />
          Grace Period & Auto Suspend
        </h2>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
            Grace Period (hari setelah jatuh tempo sebelum suspend)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={30}
              value={settings.gracePeriod}
              onChange={e => update('gracePeriod', parseInt(e.target.value))}
              className="input-field w-24 text-center text-lg font-bold"
            />
            <div>
              <p className="text-xs text-gray-500">
                {settings.gracePeriod === 0
                  ? 'Suspend langsung saat jatuh tempo'
                  : `Suspend ${settings.gracePeriod} hari setelah jatuh tempo`}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Contoh: jatuh tempo tgl 1, grace 3 hari → suspend tgl 4
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <ToggleSwitch
            value={settings.autoSuspend}
            onChange={v => update('autoSuspend', v)}
            label="Auto Suspend via RADIUS CoA"
            description="Otomatis putus koneksi PPPoE user expired melalui RADIUS Disconnect-Request"
          />
          <ToggleSwitch
            value={settings.autoUnsuspend}
            onChange={v => update('autoUnsuspend', v)}
            label="Auto Unsuspend setelah Pembayaran"
            description="Otomatis aktifkan kembali user setelah payment gateway mengkonfirmasi pembayaran"
          />
        </div>

        {settings.autoSuspend && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-700 dark:text-blue-400">
              Auto Suspend bekerja via RADIUS CoA. Pastikan MikroTik dikonfigurasi dengan:
              <code className="block mt-1 font-mono bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded text-[10px]">
                /radius incoming set accept=yes port=3799
              </code>
            </p>
          </div>
        )}
      </div>

      {/* Late Fee */}
      <div className="card-soft p-6 space-y-5">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-red-600" />
          Denda Keterlambatan
        </h2>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
            Tipe Denda
          </label>
          <div className="flex gap-3">
            {[
              { value: 'none', label: 'Tidak Ada', desc: 'Tanpa denda' },
              { value: 'percent', label: 'Persentase', desc: '% dari tagihan' },
              { value: 'nominal', label: 'Nominal', desc: 'Jumlah tetap (IDR)' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => update('lateFeeType', opt.value)}
                className={`flex-1 p-3 rounded-xl border-2 text-left transition-all ${
                  settings.lateFeeType === opt.value
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-teal-300'
                }`}
              >
                <p className="text-xs font-semibold">{opt.label}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {settings.lateFeeType !== 'none' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              {settings.lateFeeType === 'percent' ? 'Persentase Denda (%)' : 'Nominal Denda (IDR)'}
            </label>
            <div className="flex items-center gap-2">
              {settings.lateFeeType === 'nominal' && <span className="text-sm text-gray-500">Rp</span>}
              <input
                type="number"
                min={0}
                step={settings.lateFeeType === 'percent' ? 0.5 : 1000}
                value={settings.lateFeeAmount}
                onChange={e => update('lateFeeAmount', parseFloat(e.target.value))}
                className="input-field w-36"
              />
              {settings.lateFeeType === 'percent' && <span className="text-sm text-gray-500">%</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
