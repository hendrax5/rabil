'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Building2, Mail, Phone, MapPin, Globe, Save, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';

interface CompanySettings {
  id?: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  baseUrl: string;
}

export default function CompanySettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<CompanySettings>({
    name: '',
    email: '',
    phone: '',
    address: '',
    baseUrl: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/company');
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setSettings(data);
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch('/api/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        Swal.fire({
          icon: 'success',
          title: t('common.success'),
          text: t('settings.companySaved'),
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        throw new Error(t('common.saveFailed'));
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: t('settings.saveSettingsFailed')
      });
    } finally {
      setSaving(false);
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
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-lg p-3 text-white">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          <div>
            <h1 className="text-base font-semibold">{t('settings.companySettings')}</h1>
            <p className="text-[11px] text-teal-100">{t('settings.manageCompanyInfo')}</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
        <div className="space-y-3">
          {/* Nama Perusahaan */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Building2 className="w-3 h-3" />
              {t('settings.companyName')}
            </label>
            <input
              type="text"
              value={settings.name}
              onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              placeholder="Nama perusahaan Anda"
              required
            />
          </div>

          {/* Email & Phone - 2 columns on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Mail className="w-3 h-3" />
                Email
              </label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                placeholder="email@perusahaan.com"
                required
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Phone className="w-3 h-3" />
                {t('settings.phone')}
              </label>
              <input
                type="tel"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                placeholder="08xxxxxxxxxx"
                required
              />
            </div>
          </div>

          {/* Alamat */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
              <MapPin className="w-3 h-3" />
              {t('settings.address')}
            </label>
            <textarea
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              rows={2}
              placeholder="Alamat lengkap perusahaan"
              required
            />
          </div>

          {/* Base URL */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Globe className="w-3 h-3" />
              Base URL
            </label>
            <input
              type="url"
              value={settings.baseUrl}
              onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              placeholder="https://billing.domain.com"
              required
            />
            <p className="mt-1 text-[10px] text-gray-500">{t('settings.baseUrlHelp')}</p>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t('settings.saving')}
                </>
              ) : (
                <>
                  <Save className="w-3 h-3" />
                  {t('settings.saveSettings')}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
