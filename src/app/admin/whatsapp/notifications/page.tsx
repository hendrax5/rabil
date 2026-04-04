'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { showSuccess, showError } from '@/lib/sweetalert';

interface ReminderSettings {
  id: string;
  enabled: boolean;
  reminderDays: number[];
  reminderTime: string;
  otpEnabled: boolean;
  otpExpiry: number;
  updatedAt: string;
}

export default function NotificationSettingsPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [reminderDays, setReminderDays] = useState<number[]>([-7, -5, -3, 0]);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [otpEnabled, setOtpEnabled] = useState(true);
  const [otpExpiry, setOtpExpiry] = useState(5);
  const [newDay, setNewDay] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/whatsapp/reminder-settings');
      const data = await res.json();
      
      if (data.success && data.settings) {
        setSettings(data.settings);
        setEnabled(data.settings.enabled);
        setReminderDays(data.settings.reminderDays);
        setReminderTime(data.settings.reminderTime);
        setOtpEnabled(data.settings.otpEnabled ?? true);
        setOtpExpiry(data.settings.otpExpiry ?? 5);
      }
    } catch (error) {
      console.error('Load settings error:', error);
    } finally {
      setLoading(false);
    }
  };

  const addReminderDay = () => {
    const day = parseInt(newDay);
    if (isNaN(day)) {
      showError('Masukkan angka yang valid');
      return;
    }
    if (day > 0) {
      showError('Nilai harus 0 atau negatif (contoh: -7 untuk H-7)');
      return;
    }
    if (reminderDays.includes(day)) {
      showError('Hari ini sudah ada dalam daftar');
      return;
    }
    
    const newDays = [...reminderDays, day].sort((a, b) => a - b);
    setReminderDays(newDays);
    setNewDay('');
  };

  const removeReminderDay = (day: number) => {
    setReminderDays(reminderDays.filter(d => d !== day));
  };

  const handleSave = async () => {
    if (reminderDays.length === 0) {
      await showError('Minimal harus ada 1 hari reminder');
      return;
    }

    if (otpExpiry < 1 || otpExpiry > 60) {
      await showError('OTP expiry harus antara 1-60 menit');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/whatsapp/reminder-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          reminderDays,
          reminderTime,
          otpEnabled,
          otpExpiry
        })
      });

      const data = await res.json();

      if (data.success) {
        await showSuccess('Pengaturan berhasil disimpan');
        loadSettings();
      } else {
        await showError('Gagal menyimpan: ' + data.error);
      }
    } catch (error) {
      console.error('Save error:', error);
      await showError('Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  const formatDayLabel = (day: number) => {
    if (day === 0) return 'H (Hari Expired)';
    return `H${day} (${Math.abs(day)} hari sebelum expired)`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-3 sm:p-4">
      <div className="max-w-3xl mx-auto space-y-3">
        {/* Header */}
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">{t('whatsapp.notificationsTitle')}</h1>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('whatsapp.notificationsSubtitle')}</p>
        </div>

        {/* Invoice Reminder Card */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('whatsapp.invoiceReminder')}</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('whatsapp.invoiceReminderDesc')}</p>
              </div>
            </div>
          </div>
          <div className="p-3 space-y-3">
            {/* Enable Toggle */}
            <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">{t('whatsapp.enableAutoReminder')}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('whatsapp.enableAutoReminderDesc')}</p>
              </div>
              <button
                onClick={() => setEnabled(!enabled)}
                className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>

            {/* Reminder Time */}
            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('whatsapp.sendTime')}
              </label>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-40 h-8 px-2.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white"
              />
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{t('whatsapp.sendTimeNote')}</p>
            </div>

            {/* Reminder Days */}
            <div>
              <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                {t('whatsapp.reminderSchedule')}
              </label>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">
                {t('whatsapp.reminderScheduleDesc')}
              </p>

              <div className="flex flex-wrap gap-1.5 mb-2">
                {reminderDays.length === 0 ? (
                  <span className="text-[10px] text-gray-400 italic">{t('whatsapp.noSchedule')}</span>
                ) : (
                  reminderDays.map((day) => (
                    <span
                      key={day}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded"
                    >
                      {formatDayLabel(day)}
                      <button
                        onClick={() => removeReminderDay(day)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="-7"
                  value={newDay}
                  onChange={(e) => setNewDay(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addReminderDay()}
                  className="w-24 h-8 px-2.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white"
                />
                <button
                  onClick={addReminderDay}
                  className="h-8 px-3 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t('whatsapp.addSchedule')}
                </button>
              </div>
              <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-1">
                {t('whatsapp.exampleSchedule')}
              </p>
            </div>
          </div>
        </div>

        {/* OTP Settings Card */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('whatsapp.otpLogin')}</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('whatsapp.otpLoginDesc')}</p>
              </div>
            </div>
          </div>
          <div className="p-3 space-y-3">
            {/* OTP Enable Toggle */}
            <div className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">{t('whatsapp.enableOtp')}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('whatsapp.enableOtpDesc')}</p>
              </div>
              <button
                onClick={() => setOtpEnabled(!otpEnabled)}
                className={`relative w-10 h-5 rounded-full transition-colors ${otpEnabled ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${otpEnabled ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>

            {/* OTP Expiry */}
            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('whatsapp.otpExpiry')}
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={otpExpiry}
                onChange={(e) => setOtpExpiry(parseInt(e.target.value))}
                className="w-24 h-8 px-2.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white"
              />
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                {t('whatsapp.otpExpiryNote')} {otpExpiry} {t('whatsapp.minutes')}
              </p>
            </div>

            {/* OTP Warning */}
            {!otpEnabled && (
              <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <p className="text-[10px] text-yellow-800 dark:text-yellow-200">
                  ⚠️ {t('whatsapp.otpDisabledWarning')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-8 px-4 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('whatsapp.saving')}
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {t('whatsapp.saveSettings')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
