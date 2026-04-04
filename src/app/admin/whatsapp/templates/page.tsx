'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { showSuccess, showError } from '@/lib/sweetalert';

interface Template {
  id: string;
  name: string;
  type: string;
  message: string;
  isActive: boolean;
}

const templateConfig = {
  'registration-approval': {
    title: '🎉 Persetujuan Pendaftaran',
    description: 'Dikirim saat admin menyetujui pendaftaran customer baru',
    variables: ['{{customerName}}', '{{username}}', '{{password}}', '{{profileName}}', '{{installationFee}}', '{{companyName}}', '{{companyPhone}}'],
  },
  'admin-create-user': {
    title: '👤 Admin Create User',
    description: 'Dikirim saat admin membuat user manual (tanpa flow registrasi)',
    variables: ['{{customerName}}', '{{username}}', '{{password}}', '{{profileName}}', '{{companyName}}', '{{companyPhone}}'],
  },
  'installation-invoice': {
    title: '🔧 Invoice Instalasi',
    description: 'Dikirim saat instalasi selesai dan invoice dibuat',
    variables: ['{{customerName}}', '{{invoiceNumber}}', '{{amount}}', '{{dueDate}}', '{{paymentLink}}', '{{companyName}}', '{{companyPhone}}'],
  },
  'invoice-reminder': {
    title: '📅 Invoice Bulanan / Jatuh Tempo',
    description: 'Dikirim via cron untuk invoice bulanan yang mendekati jatuh tempo',
    variables: ['{{customerName}}', '{{username}}', '{{invoiceNumber}}', '{{amount}}', '{{dueDate}}', '{{daysRemaining}}', '{{paymentLink}}', '{{companyName}}', '{{companyPhone}}'],
  },
  'payment-success': {
    title: '✅ Pembayaran Berhasil',
    description: 'Dikirim otomatis saat pembayaran invoice berhasil',
    variables: ['{{customerName}}', '{{username}}', '{{password}}', '{{profileName}}', '{{invoiceNumber}}', '{{amount}}', '{{companyName}}', '{{companyPhone}}'],
  },
  'maintenance-outage': {
    title: '⚠️ Informasi Gangguan',
    description: 'Template untuk broadcast informasi maintenance atau gangguan jaringan',
    variables: ['{{customerName}}', '{{username}}', '{{issueType}}', '{{description}}', '{{estimatedTime}}', '{{affectedArea}}', '{{companyName}}', '{{companyPhone}}'],
  },
};

const templateTypes = Object.keys(templateConfig) as (keyof typeof templateConfig)[];

export default function WhatsAppTemplatesPage() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<keyof typeof templateConfig>('registration-approval');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/templates');
      const data = await res.json();

      if (data.success) {
        const templatesMap: Record<string, Template> = {};
        data.data.forEach((t: Template) => {
          templatesMap[t.type] = t;
        });
        setTemplates(templatesMap);
      }
    } catch (error) {
      console.error('Fetch templates error:', error);
      showError('Gagal memuat template');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (type: string, message: string) => {
    const template = templates[type];
    if (!template) return;

    setSaving(type);
    try {
      const res = await fetch(`/api/whatsapp/templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();

      if (data.success) {
        showSuccess('Template berhasil diupdate!');
        fetchTemplates();
      } else {
        showError(data.error || 'Gagal update template');
      }
    } catch (error) {
      console.error('Update template error:', error);
      showError('Gagal update template');
    } finally {
      setSaving(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess('Template berhasil dicopy!');
  };

  const TemplateEditor = ({ type }: { type: string }) => {
    const template = templates[type];
    const config = templateConfig[type as keyof typeof templateConfig];
    const [message, setMessage] = useState(template?.message || '');

    useEffect(() => {
      setMessage(template?.message || '');
    }, [template]);

    if (!config) return null;

    const isChanged = template && message !== template.message;

    const insertVariable = (variable: string) => {
      const textarea = document.getElementById(`textarea-${type}`) as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newText = message.slice(0, start) + variable + message.slice(end);
        setMessage(newText);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + variable.length;
          textarea.focus();
        }, 0);
      }
    };

    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
        <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{config.title}</h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{config.description}</p>
            </div>
            {template && (
              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${template.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                {template.isActive ? 'Aktif' : 'Nonaktif'}
              </span>
            )}
          </div>
        </div>

        <div className="p-3 space-y-3">
          {!template ? (
            <div className="text-center py-6 text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-xs">{t('whatsapp.templateNotCreated')}</p>
              <p className="text-[10px] mt-0.5">{t('whatsapp.createDefaultOrManual')}</p>
            </div>
          ) : (
            <>
              {/* Message Textarea */}
              <div>
                <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                  {t('whatsapp.templateMessage')}
                </label>
                <textarea
                  id={`textarea-${type}`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs font-mono bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white resize-none"
                  rows={10}
                  placeholder="Tulis template WhatsApp Anda di sini..."
                />
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{message.length} {t('whatsapp.characters')}</p>
              </div>

              {/* Variables */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <label className="text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    {t('whatsapp.availableVariables')}
                  </label>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md border border-blue-200 dark:border-blue-800">
                  <div className="flex flex-wrap gap-1">
                    {config.variables.map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        onClick={() => insertVariable(variable)}
                        className="px-2 py-1 text-[10px] bg-white dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded font-mono transition-colors text-gray-700 dark:text-gray-300"
                      >
                        {variable}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-blue-600 dark:text-blue-400 mt-1.5">
                    💡 {t('whatsapp.clickToInsert')}
                  </p>
                </div>
              </div>

              {/* Format Info */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-2 rounded-md border border-gray-200 dark:border-gray-700">
                <p className="text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('whatsapp.waFormat')}:</p>
                <div className="grid grid-cols-2 gap-1 text-[10px] text-gray-600 dark:text-gray-400">
                  <div>• *bold* → <strong>bold</strong></div>
                  <div>• _italic_ → <em>italic</em></div>
                  <div>• ~strikethrough~ → <del>strikethrough</del></div>
                  <div>• ```code``` → <code className="text-[9px]">code</code></div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdate(type, message)}
                  className={`flex-1 h-7 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5 ${
                    !isChanged || saving === type
                      ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed'
                      : 'bg-teal-600 hover:bg-teal-700 text-white'
                  }`}
                  disabled={!isChanged || saving === type}
                >
                  {saving === type ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {t('whatsapp.saving')}
                    </>
                  ) : isChanged ? (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      {t('whatsapp.saveChanges')}
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t('whatsapp.saved')}
                    </>
                  )}
                </button>
                <button
                  onClick={() => copyToClipboard(message)}
                  className="h-7 px-3 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {t('whatsapp.copy')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
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
      <div className="max-w-5xl mx-auto space-y-3">
        {/* Header */}
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {t('whatsapp.templatesTitle')}
          </h1>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('whatsapp.templatesSubtitle')}</p>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-1">
          <div className="flex flex-wrap gap-1">
            {templateTypes.map((type) => (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                className={`px-2 py-1.5 text-[10px] font-medium rounded transition-colors ${
                  activeTab === type
                    ? 'bg-teal-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {templateConfig[type].title}
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <TemplateEditor type={activeTab} />

        {/* Info Card */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-3">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-100">📋 {t('whatsapp.howToUse')}</p>
              <ul className="text-[10px] text-blue-800 dark:text-blue-200 space-y-0.5">
                <li>• <strong>Persetujuan Pendaftaran</strong>: Dikirim saat admin approve registrasi baru</li>
                <li>• <strong>Admin Create User</strong>: Dikirim saat admin create user manual</li>
                <li>• <strong>Invoice Instalasi</strong>: Dikirim saat mark installed dan invoice dibuat</li>
                <li>• <strong>Invoice Jatuh Tempo</strong>: Dikirim via cron untuk reminder invoice (H-5, H-3, H-1, H-0)</li>
                <li>• <strong>Pembayaran Berhasil</strong>: Dikirim otomatis saat invoice dibayar</li>
                <li>• <strong>Informasi Gangguan</strong>: Template untuk broadcast maintenance</li>
                <li>• Variabel <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{'{{nama}}'}</code> akan diganti otomatis dengan data real</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
