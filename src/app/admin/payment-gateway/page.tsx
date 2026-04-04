'use client';
import { useTranslation } from '@/hooks/useTranslation';
import { showSuccess, showError, showConfirm, showToast } from '@/lib/sweetalert';
import { formatWIB } from '@/lib/timezone';

import { useState, useEffect } from 'react';
import { 
  Loader2, CreditCard, Wallet, Save, Eye, EyeOff, CheckCircle2, AlertCircle, 
  Copy, Check, List, RefreshCw, Search, ChevronLeft, ChevronRight, X
} from 'lucide-react';

interface PaymentGateway {
  id: string;
  provider: string;
  name: string;
  isActive: boolean;
  midtransClientKey?: string | null;
  midtransServerKey?: string | null;
  midtransEnvironment: string;
  xenditApiKey?: string | null;
  xenditWebhookToken?: string | null;
  xenditEnvironment: string;
  duitkuMerchantCode?: string | null;
  duitkuApiKey?: string | null;
  duitkuEnvironment: string;
}

interface WebhookLog {
  id: string;
  gateway: string;
  orderId: string;
  status: string;
  transactionId: string | null;
  amount: number | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
  payload: string | null;
  response: string | null;
}

export default function PaymentGatewayPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState<PaymentGateway[]>([]);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('logs');
  
  // Webhook logs state
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsFilter, setLogsFilter] = useState({ gateway: '', orderId: '', success: '' });
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);

  const [midtransForm, setMidtransForm] = useState({ clientKey: '', serverKey: '', environment: 'sandbox', isActive: false });
  const [xenditForm, setXenditForm] = useState({ apiKey: '', webhookToken: '', environment: 'sandbox', isActive: false });
  const [duitkuForm, setDuitkuForm] = useState({ merchantCode: '', apiKey: '', environment: 'sandbox', isActive: false });

  useEffect(() => {
    fetchConfigs();
    fetchWebhookLogs();
  }, []);
  
  useEffect(() => {
    fetchWebhookLogs();
  }, [logsPage, logsFilter]);

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/payment-gateway/config');
      const data = await res.json();
      setConfigs(data);
      
      const midtrans = data.find((c: PaymentGateway) => c.provider === 'midtrans');
      if (midtrans) {
        setMidtransForm({
          clientKey: midtrans.midtransClientKey || '',
          serverKey: midtrans.midtransServerKey || '',
          environment: midtrans.midtransEnvironment || 'sandbox',
          isActive: midtrans.isActive
        });
      }

      const xendit = data.find((c: PaymentGateway) => c.provider === 'xendit');
      if (xendit) {
        setXenditForm({
          apiKey: xendit.xenditApiKey || '',
          webhookToken: xendit.xenditWebhookToken || '',
          environment: xendit.xenditEnvironment || 'sandbox',
          isActive: xendit.isActive
        });
      }

      const duitku = data.find((c: PaymentGateway) => c.provider === 'duitku');
      if (duitku) {
        setDuitkuForm({
          merchantCode: duitku.duitkuMerchantCode || '',
          apiKey: duitku.duitkuApiKey || '',
          environment: duitku.duitkuEnvironment || 'sandbox',
          isActive: duitku.isActive
        });
      }
    } catch (error) {
      console.error('Fetch configs error:', error);
      await showError('Failed to load payment gateway configs');
    } finally {
      setLoading(false);
    }
  };

  const saveGateway = async (provider: string, data: any) => {
    setSaving(true);
    try {
      const res = await fetch('/api/payment-gateway/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, ...data })
      });

      if (res.ok) {
        await showSuccess(`${provider.charAt(0).toUpperCase() + provider.slice(1)} configuration saved`);
        fetchConfigs();
      } else {
        const result = await res.json();
        await showError(result.error || 'Failed to save config');
      }
    } catch (error) {
      await showError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const toggleSecret = (key: string) => setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));

  const copyWebhookUrl = async () => {
    const webhookUrl = `${window.location.origin}/api/payment/webhook`;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied('webhook');
      await showToast('Webhook URL copied!', 'success');
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      await showError('Failed to copy webhook URL');
    }
  };
  
  const fetchWebhookLogs = async () => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({ page: logsPage.toString(), limit: '20' });
      if (logsFilter.gateway) params.append('gateway', logsFilter.gateway);
      if (logsFilter.orderId) params.append('orderId', logsFilter.orderId);
      if (logsFilter.success) params.append('success', logsFilter.success);
      
      const res = await fetch(`/api/payment-gateway/webhook-logs?${params}`);
      const data = await res.json();
      
      if (res.ok) {
        setWebhookLogs(data.logs);
        setLogsTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch webhook logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  const formatAmount = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
      </div>
    );
  }

  const midtransActive = configs.find(c => c.provider === 'midtrans')?.isActive;
  const xenditActive = configs.find(c => c.provider === 'xendit')?.isActive;
  const duitkuActive = configs.find(c => c.provider === 'duitku')?.isActive;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-lg p-3 text-white">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          <div>
            <h1 className="text-base font-semibold">{t('paymentGateway.title')}</h1>
            <p className="text-[11px] text-teal-100">{t('paymentGateway.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Webhook URL */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs font-medium text-blue-800 dark:text-blue-300">{t('paymentGateway.webhookUrl')}</span>
        </div>
        <div className="flex gap-1.5">
          <input
            value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/payment/webhook`}
            readOnly
            className="flex-1 px-2 py-1 text-[10px] font-mono bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded"
          />
          <button
            onClick={copyWebhookUrl}
            className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50"
          >
            {copied === 'webhook' ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
        <p className="text-[10px] text-blue-600 mt-1">✅ {t('paymentGateway.webhookNote')}</p>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
          {[
            { id: 'logs', label: t('paymentGateway.webhookLogs'), icon: List },
            { id: 'midtrans', label: 'Midtrans', icon: CreditCard, active: midtransActive },
            { id: 'xendit', label: 'Xendit', icon: Wallet, active: xenditActive },
            { id: 'duitku', label: 'Duitku', icon: Wallet, active: duitkuActive }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50 dark:bg-teal-900/20'
                  : 'text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
              {tab.active && <CheckCircle2 className="w-2.5 h-2.5 text-green-600" />}
            </button>
          ))}
        </div>

        <div className="p-3">
          {/* Webhook Logs Tab */}
          {activeTab === 'logs' && (
            <div className="space-y-2">
              {/* Filters */}
              <div className="flex flex-wrap gap-2">
                <select
                  value={logsFilter.gateway}
                  onChange={(e) => { setLogsFilter({ ...logsFilter, gateway: e.target.value }); setLogsPage(1); }}
                  className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                >
                  <option value="">{t('paymentGateway.allGateways')}</option>
                  <option value="midtrans">Midtrans</option>
                  <option value="xendit">Xendit</option>
                  <option value="duitku">Duitku</option>
                </select>
                <div className="relative flex-1 min-w-[120px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                  <input
                    value={logsFilter.orderId}
                    onChange={(e) => { setLogsFilter({ ...logsFilter, orderId: e.target.value }); setLogsPage(1); }}
                    placeholder="Order ID..."
                    className="w-full pl-6 pr-2 py-1 text-xs border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                  />
                </div>
                <select
                  value={logsFilter.success}
                  onChange={(e) => { setLogsFilter({ ...logsFilter, success: e.target.value }); setLogsPage(1); }}
                  className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                >
                  <option value="">{t('paymentGateway.allStatus')}</option>
                  <option value="true">{t('common.success')}</option>
                  <option value="false">{t('common.failed')}</option>
                </select>
                <button
                  onClick={() => fetchWebhookLogs()}
                  disabled={logsLoading}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-teal-600 border border-teal-600 rounded hover:bg-teal-50"
                >
                  <RefreshCw className={`w-3 h-3 ${logsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Logs Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-gray-500 uppercase">{t('common.time')}</th>
                      <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-gray-500 uppercase">Gateway</th>
                      <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-gray-500 uppercase">Order ID</th>
                      <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-gray-500 uppercase">{t('common.status')}</th>
                      <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-gray-500 uppercase hidden md:table-cell">{t('common.amount')}</th>
                      <th className="text-center py-1.5 px-2 text-[10px] font-semibold text-gray-500 uppercase">{t('paymentGateway.result')}</th>
                      <th className="text-right py-1.5 px-2 text-[10px] font-semibold text-gray-500 uppercase">{t('common.action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logsLoading ? (
                      <tr><td colSpan={7} className="text-center py-6"><Loader2 className="w-4 h-4 animate-spin mx-auto text-teal-600" /></td></tr>
                    ) : webhookLogs.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-6 text-gray-500 text-xs">{t('paymentGateway.noLogs')}</td></tr>
                    ) : (
                      webhookLogs.map((log) => (
                        <tr key={log.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-1.5 px-2 text-[10px] text-gray-500">{formatWIB(new Date(log.createdAt), 'dd/MM HH:mm')}</td>
                          <td className="py-1.5 px-2">
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 rounded">{log.gateway}</span>
                          </td>
                          <td className="py-1.5 px-2 font-mono text-[10px]">{log.orderId}</td>
                          <td className="py-1.5 px-2">
                            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                              log.status === 'settlement' ? 'bg-green-100 text-green-700' :
                              log.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                            }`}>{log.status}</span>
                          </td>
                          <td className="py-1.5 px-2 hidden md:table-cell">{formatAmount(log.amount)}</td>
                          <td className="py-1.5 px-2 text-center">
                            {log.success ? <CheckCircle2 className="w-3 h-3 text-green-600 mx-auto" /> : <AlertCircle className="w-3 h-3 text-red-600 mx-auto" />}
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            <button onClick={() => setSelectedLog(log)} className="text-[10px] text-teal-600 hover:underline">Detail</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {logsTotalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-[10px] text-gray-500">Page {logsPage} of {logsTotalPages}</p>
                  <div className="flex gap-1">
                    <button onClick={() => setLogsPage(p => Math.max(1, p - 1))} disabled={logsPage === 1} className="p-1 border rounded disabled:opacity-50">
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <button onClick={() => setLogsPage(p => Math.min(logsTotalPages, p + 1))} disabled={logsPage === logsTotalPages} className="p-1 border rounded disabled:opacity-50">
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Midtrans Tab */}
          {activeTab === 'midtrans' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="text-xs font-medium">{t('paymentGateway.enableMidtrans')}</p>
                  <p className="text-[10px] text-gray-500">Snap payment gateway</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={midtransForm.isActive} onChange={(e) => setMidtransForm({ ...midtransForm, isActive: e.target.checked })} className="sr-only peer" />
                  <div className="w-8 h-4 bg-gray-300 peer-focus:ring-2 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Environment</label>
                <select value={midtransForm.environment} onChange={(e) => setMidtransForm({ ...midtransForm, environment: e.target.value })} className="w-full mt-1 px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Client Key</label>
                <div className="relative mt-1">
                  <input type={showSecrets['mt-client'] ? 'text' : 'password'} value={midtransForm.clientKey} onChange={(e) => setMidtransForm({ ...midtransForm, clientKey: e.target.value })} className="w-full px-2.5 py-1.5 text-sm font-mono border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 pr-8" placeholder="SB-Mid-client-xxxxx" />
                  <button type="button" onClick={() => toggleSecret('mt-client')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                    {showSecrets['mt-client'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Server Key</label>
                <div className="relative mt-1">
                  <input type={showSecrets['mt-server'] ? 'text' : 'password'} value={midtransForm.serverKey} onChange={(e) => setMidtransForm({ ...midtransForm, serverKey: e.target.value })} className="w-full px-2.5 py-1.5 text-sm font-mono border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 pr-8" placeholder="SB-Mid-server-xxxxx" />
                  <button type="button" onClick={() => toggleSecret('mt-server')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                    {showSecrets['mt-server'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <button onClick={() => saveGateway('midtrans', { midtransClientKey: midtransForm.clientKey, midtransServerKey: midtransForm.serverKey, midtransEnvironment: midtransForm.environment, isActive: midtransForm.isActive })} disabled={saving || !midtransForm.clientKey || !midtransForm.serverKey} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-lg disabled:opacity-50">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {t('paymentGateway.saveMidtrans')}
              </button>
            </div>
          )}

          {/* Xendit Tab */}
          {activeTab === 'xendit' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="text-xs font-medium">{t('paymentGateway.enableXendit')}</p>
                  <p className="text-[10px] text-gray-500">Payment gateway Indonesia</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={xenditForm.isActive} onChange={(e) => setXenditForm({ ...xenditForm, isActive: e.target.checked })} className="sr-only peer" />
                  <div className="w-8 h-4 bg-gray-300 peer-focus:ring-2 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Environment</label>
                <select value={xenditForm.environment} onChange={(e) => setXenditForm({ ...xenditForm, environment: e.target.value })} className="w-full mt-1 px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-700 dark:text-gray-300">API Key (Secret Key)</label>
                <div className="relative mt-1">
                  <input type={showSecrets['xn-api'] ? 'text' : 'password'} value={xenditForm.apiKey} onChange={(e) => setXenditForm({ ...xenditForm, apiKey: e.target.value })} className="w-full px-2.5 py-1.5 text-sm font-mono border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 pr-8" placeholder="xnd_development_xxxxx" />
                  <button type="button" onClick={() => toggleSecret('xn-api')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                    {showSecrets['xn-api'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Webhook Token (Optional)</label>
                <div className="relative mt-1">
                  <input type={showSecrets['xn-webhook'] ? 'text' : 'password'} value={xenditForm.webhookToken} onChange={(e) => setXenditForm({ ...xenditForm, webhookToken: e.target.value })} className="w-full px-2.5 py-1.5 text-sm font-mono border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 pr-8" placeholder="Optional verification token" />
                  <button type="button" onClick={() => toggleSecret('xn-webhook')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                    {showSecrets['xn-webhook'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <button onClick={() => saveGateway('xendit', { xenditApiKey: xenditForm.apiKey, xenditWebhookToken: xenditForm.webhookToken, xenditEnvironment: xenditForm.environment, isActive: xenditForm.isActive })} disabled={saving || !xenditForm.apiKey} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-lg disabled:opacity-50">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {t('paymentGateway.saveXendit')}
              </button>
            </div>
          )}

          {/* Duitku Tab */}
          {activeTab === 'duitku' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="text-xs font-medium">{t('paymentGateway.enableDuitku')}</p>
                  <p className="text-[10px] text-gray-500">Payment gateway Indonesia</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={duitkuForm.isActive} onChange={(e) => setDuitkuForm({ ...duitkuForm, isActive: e.target.checked })} className="sr-only peer" />
                  <div className="w-8 h-4 bg-gray-300 peer-focus:ring-2 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Environment</label>
                <select value={duitkuForm.environment} onChange={(e) => setDuitkuForm({ ...duitkuForm, environment: e.target.value })} className="w-full mt-1 px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Merchant Code</label>
                <input type="text" value={duitkuForm.merchantCode} onChange={(e) => setDuitkuForm({ ...duitkuForm, merchantCode: e.target.value })} className="w-full mt-1 px-2.5 py-1.5 text-sm font-mono border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800" placeholder="D1234" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-700 dark:text-gray-300">API Key</label>
                <div className="relative mt-1">
                  <input type={showSecrets['dk-api'] ? 'text' : 'password'} value={duitkuForm.apiKey} onChange={(e) => setDuitkuForm({ ...duitkuForm, apiKey: e.target.value })} className="w-full px-2.5 py-1.5 text-sm font-mono border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 pr-8" placeholder="Your Duitku API Key" />
                  <button type="button" onClick={() => toggleSecret('dk-api')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                    {showSecrets['dk-api'] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <button onClick={() => saveGateway('duitku', { duitkuMerchantCode: duitkuForm.merchantCode, duitkuApiKey: duitkuForm.apiKey, duitkuEnvironment: duitkuForm.environment, isActive: duitkuForm.isActive })} disabled={saving || !duitkuForm.merchantCode || !duitkuForm.apiKey} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-lg disabled:opacity-50">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {t('paymentGateway.saveDuitku')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedLog(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 max-w-2xl w-full max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold">{t('paymentGateway.logDetail')}</h3>
              <button onClick={() => setSelectedLog(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-[10px] text-gray-500 block">Timestamp</span><span className="font-medium">{formatWIB(new Date(selectedLog.createdAt), 'dd MMM yyyy HH:mm:ss')}</span></div>
                <div><span className="text-[10px] text-gray-500 block">Gateway</span><span className="font-medium capitalize">{selectedLog.gateway}</span></div>
                <div><span className="text-[10px] text-gray-500 block">Order ID</span><span className="font-mono text-[10px]">{selectedLog.orderId}</span></div>
                <div><span className="text-[10px] text-gray-500 block">Transaction ID</span><span className="font-mono text-[10px]">{selectedLog.transactionId || '-'}</span></div>
                <div><span className="text-[10px] text-gray-500 block">Status</span><span className="font-medium">{selectedLog.status}</span></div>
                <div><span className="text-[10px] text-gray-500 block">Amount</span><span className="font-medium">{formatAmount(selectedLog.amount)}</span></div>
                <div><span className="text-[10px] text-gray-500 block">Success</span><span className="font-medium">{selectedLog.success ? '✅ Yes' : '❌ No'}</span></div>
                {selectedLog.errorMessage && <div className="col-span-2"><span className="text-[10px] text-red-500 block">Error</span><span className="text-red-600 text-[10px]">{selectedLog.errorMessage}</span></div>}
              </div>
              {selectedLog.payload && (
                <div>
                  <span className="text-[10px] text-gray-500 block mb-1">Payload</span>
                  <pre className="bg-gray-900 text-gray-100 p-2 rounded text-[10px] overflow-x-auto">{JSON.stringify(JSON.parse(selectedLog.payload), null, 2)}</pre>
                </div>
              )}
              {selectedLog.response && (
                <div>
                  <span className="text-[10px] text-gray-500 block mb-1">Response</span>
                  <pre className="bg-gray-900 text-gray-100 p-2 rounded text-[10px] overflow-x-auto">{JSON.stringify(JSON.parse(selectedLog.response), null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
