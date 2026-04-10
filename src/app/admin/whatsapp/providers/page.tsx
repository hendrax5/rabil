'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import Swal from 'sweetalert2';

interface Provider {
  id: string;
  name: string;
  type: string;
  apiUrl: string;
  apiKey: string | null;
  senderNumber?: string | null;
  priority: number;
  isActive: boolean;
  description: string | null;
}

interface ProviderStatus {
  status: string;
  connected: boolean;
  phone?: string | null;
  name?: string | null;
}

export default function WhatsAppProvidersPage() {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrProvider, setQrProvider] = useState<Provider | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [providerStatuses, setProviderStatuses] = useState<Record<string, ProviderStatus>>({});
  const [restartingProvider, setRestartingProvider] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'mpwa',
    apiUrl: '',
    apiKey: '',
    senderNumber: '',
    priority: 0,
    description: ''
  });

  useEffect(() => {
    fetchProviders();
    const interval = setInterval(() => {
      fetchAllStatuses();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (providers.length > 0) {
      fetchAllStatuses();
    }
  }, [providers]);

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/whatsapp/providers');
      const data = await res.json();
      setProviders(data.sort((a: Provider, b: Provider) => a.priority - b.priority));
    } catch (error) {
      console.error('Error fetching providers:', error);
      Swal.fire('Error!', 'Failed to fetch providers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllStatuses = async () => {
    if (providers.length === 0) return;
    
    const newStatuses: Record<string, ProviderStatus> = {};
    
    await Promise.all(
      providers.map(async (provider) => {
        if (provider.type === 'mpwa' || provider.type === 'waha' || provider.type === 'gowa') {
          try {
            const res = await fetch(`/api/whatsapp/providers/${provider.id}/status`);
            if (res.ok) {
              newStatuses[provider.id] = await res.json();
            }
          } catch (error) {
            console.error(`Error fetching status for ${provider.name}:`, error);
          }
        } else if (provider.type === 'BAILEYS_LOCAL') {
          try {
            // Point to our internal docker compose engine
            const res = await fetch(`/api/whatsapp/providers/baileys/status`);
            if (res.ok) {
              const data = await res.json();
              newStatuses[provider.id] = {
                status: data.status,
                connected: data.status === 'open'
              };
            }
          } catch (error) {
            console.error(`Error fetching Baileys status:`, error);
          }
        }
      })
    );
    
    setProviderStatuses(prev => ({ ...prev, ...newStatuses }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.type || (formData.type !== 'BAILEYS_LOCAL' && !formData.apiUrl)) {
      Swal.fire('Error!', 'Name, Type, and Base URL are required', 'error');
      return;
    }
    
    if ((formData.type === 'mpwa' || formData.type === 'gowa') && !formData.apiKey) {
      Swal.fire('Error!', `API Key is required for ${formData.type.toUpperCase()}`, 'error');
      return;
    }
    
    if (formData.type === 'mpwa' && !formData.senderNumber) {
      Swal.fire('Error!', 'Sender Number is required for MPWA', 'error');
      return;
    }
    
    try {
      const url = editingProvider 
        ? `/api/whatsapp/providers/${editingProvider.id}`
        : '/api/whatsapp/providers';
      
      const res = await fetch(url, {
        method: editingProvider ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        Swal.fire('Berhasil!', editingProvider ? 'Provider updated' : 'Provider created', 'success');
        fetchProviders();
        resetForm();
      } else {
        const data = await res.json();
        Swal.fire('Error!', data.error || 'Failed to save provider', 'error');
      }
    } catch (error) {
      console.error('Error saving provider:', error);
      Swal.fire('Error!', 'Failed to save provider', 'error');
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/whatsapp/providers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      });
      
      if (res.ok) {
        Swal.fire('Berhasil!', !currentStatus ? 'Provider activated' : 'Provider deactivated', 'success');
        fetchProviders();
      } else {
        Swal.fire('Error!', 'Failed to toggle provider', 'error');
      }
    } catch (error) {
      console.error('Error toggling provider:', error);
      Swal.fire('Error!', 'Failed to toggle provider', 'error');
    }
  };

  const deleteProvider = async (id: string) => {
    const result = await Swal.fire({
      title: 'Hapus Provider?',
      text: 'Device ini akan dihapus permanen!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    });

    if (!result.isConfirmed) return;
    
    try {
      const res = await fetch(`/api/whatsapp/providers/${id}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        Swal.fire('Terhapus!', 'Provider deleted successfully', 'success');
        fetchProviders();
      } else {
        Swal.fire('Error!', 'Failed to delete provider', 'error');
      }
    } catch (error) {
      console.error('Error deleting provider:', error);
      Swal.fire('Error!', 'Failed to delete provider', 'error');
    }
  };

  const editProvider = (provider: Provider) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      type: provider.type,
      apiUrl: provider.apiUrl,
      apiKey: provider.apiKey || '',
      senderNumber: provider.senderNumber || '',
      priority: provider.priority,
      description: provider.description || ''
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'mpwa',
      apiUrl: '',
      apiKey: '',
      senderNumber: '',
      priority: 0,
      description: ''
    });
    setEditingProvider(null);
    setShowForm(false);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'mpwa': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'waha': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'fonnte': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'wablas': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'gowa': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
      case 'BAILEYS_LOCAL': return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border border-teal-200';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const restartSession = async (provider: Provider) => {
    const result = await Swal.fire({
      title: t('whatsapp.restartSessionTitle', { name: provider.name }),
      html: `<p class="text-sm mb-2"><strong>${t('whatsapp.restartImportant')}</strong> ${t('whatsapp.restartInstructions')}</p><p class="text-sm">${t('whatsapp.restartDesc')}</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: t('whatsapp.yesRestart'),
      cancelButtonText: t('common.cancel')
    });

    if (!result.isConfirmed) return;

    setRestartingProvider(provider.id);

    try {
      const res = await fetch(`/api/whatsapp/providers/${provider.id}/restart`, {
        method: 'POST'
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Failed to restart session');
      }

      Swal.fire('Berhasil!', 'Session restarted! Silakan scan QR code.', 'success');
      fetchAllStatuses();
      
      setTimeout(() => {
        showQrCode(provider);
      }, 1000);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to restart session';
      Swal.fire('Error!', errorMessage, 'error');
    } finally {
      setRestartingProvider(null);
    }
  };

  const showQrCode = async (provider: Provider) => {
    setQrProvider(provider);
    setShowQrModal(true);
    setQrLoading(true);
    setQrImage(null);
    
    try {
      const url = `/api/whatsapp/providers/${provider.id}/qr`;
      const response = await fetch(url);
      
      if (response.ok) {
        if (provider.type === 'mpwa') {
          const data = await response.json();
          if (data.status === 'qrcode' && data.qrcode) {
            setQrImage(data.qrcode);
          } else {
            Swal.fire('Info', `Device status: ${data.message || data.status}`, 'info');
          }
        } else if (provider.type === 'BAILEYS_LOCAL') {
          const data = await response.json();
          if (data.qrImage) {
            setQrImage(data.qrImage);
          } else {
            Swal.fire('Info', `Status: ${data.status} (No QR Available)`, 'info');
            setShowQrModal(false);
          }
        } else {
          const blob = await response.blob();
          const imageUrl = URL.createObjectURL(blob);
          setQrImage(imageUrl);
        }
      } else if (response.status === 422) {
        const errorData = await response.json();
        Swal.fire('Info', errorData.error || 'Device already connected', 'info');
        setShowQrModal(false);
        fetchAllStatuses();
      } else {
        const errorData = await response.json();
        Swal.fire('Error!', errorData.error || 'Failed to fetch QR code', 'error');
        setShowQrModal(false);
      }
    } catch (error) {
      console.error('Error fetching QR:', error);
      Swal.fire('Error!', 'Error fetching QR code', 'error');
      setShowQrModal(false);
    } finally {
      setQrLoading(false);
    }
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
      <div className="max-w-7xl mx-auto space-y-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white">{t('whatsapp.providersTitle')}</h1>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('whatsapp.providersSubtitle')}</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="h-7 px-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('whatsapp.addProvider')}
          </button>
        </div>

        {/* Provider Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {providers.map((provider) => (
            <div 
              key={provider.id} 
              className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-2.5 ${!provider.isActive ? 'opacity-60' : ''}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{provider.name}</h3>
                  <div className="flex gap-1.5 items-center mt-1 flex-wrap">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${getTypeColor(provider.type)}`}>
                      {provider.type.toUpperCase()}
                    </span>
                    {providerStatuses[provider.id] && (
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        providerStatuses[provider.id].connected 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {providerStatuses[provider.id].connected ? `● ${t('whatsapp.connected')}` : `○ ${t('whatsapp.disconnected')}`}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggleActive(provider.id, provider.isActive)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                  title={provider.isActive ? t('whatsapp.deactivate') : t('whatsapp.activate')}
                >
                  {provider.isActive ? (
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  )}
                </button>
              </div>
              
              {/* Info */}
              <div className="space-y-1.5 text-xs">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">{t('whatsapp.baseUrl')}:</span>
                  <p className="font-mono text-[10px] text-gray-700 dark:text-gray-300 break-all">{provider.apiUrl}</p>
                </div>
                {provider.senderNumber && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">{t('whatsapp.senderNumber')}:</span>
                    <span className="font-mono text-[10px] text-gray-700 dark:text-gray-300 ml-1">{provider.senderNumber}</span>
                  </div>
                )}
                {providerStatuses[provider.id]?.phone && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">{t('whatsapp.connected')}:</span>
                    <span className="font-mono text-[10px] text-green-600 dark:text-green-400 ml-1">{providerStatuses[provider.id].phone}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500 dark:text-gray-400">{t('whatsapp.priority')}:</span>
                  <span className="font-semibold text-gray-900 dark:text-white ml-1">{provider.priority}</span>
                </div>
                {provider.description && (
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{provider.description}</p>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex gap-1.5">
                  {(provider.type === 'waha' || provider.type === 'mpwa' || provider.type === 'gowa' || provider.type === 'BAILEYS_LOCAL') && (
                    <button
                      onClick={() => showQrCode(provider)}
                      className="flex-1 h-7 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-medium rounded flex items-center justify-center gap-1 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                      {t('whatsapp.qrCode')}
                    </button>
                  )}
                  <button
                    onClick={() => editProvider(provider)}
                    className="flex-1 h-7 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-[10px] font-medium rounded flex items-center justify-center gap-1 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => deleteProvider(provider.id)}
                    className="h-7 px-2 bg-red-600 hover:bg-red-700 text-white text-[10px] font-medium rounded transition-colors"
                    title="Delete"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                {(provider.type === 'waha' || provider.type === 'gowa') && (
                  <button
                    onClick={() => restartSession(provider)}
                    disabled={restartingProvider === provider.id}
                    className="w-full h-7 bg-yellow-500 hover:bg-yellow-600 text-white text-[10px] font-medium rounded flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                  >
                    {restartingProvider === provider.id ? (
                      <>
                        <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {t('whatsapp.restarting')}
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {t('whatsapp.restartSession')}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {providers.length === 0 && !showForm && (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-8 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{t('whatsapp.noProviders')}</p>
            <button
              onClick={() => setShowForm(true)}
              className="h-7 px-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('whatsapp.addFirstProvider')}
            </button>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-sm" onClick={() => resetForm()}>
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {editingProvider ? t('whatsapp.editProvider') : t('whatsapp.addProvider')}
              </h3>
              <button onClick={resetForm} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-100px)]">
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">{t('whatsapp.providerName')}</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full h-8 px-2.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white"
                      placeholder="MPWA Device 1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">{t('whatsapp.providerType')}</label>
                    <select
                      value={formData.type}
                      onChange={(e) => {
                        const newType = e.target.value;
                        setFormData({
                          ...formData, 
                          type: newType,
                          apiUrl: newType === 'BAILEYS_LOCAL' ? 'http://wa-engine:3006' : formData.apiUrl
                        })
                      }}
                      className="w-full h-8 px-2.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white"
                    >
                      <option value="mpwa">MPWA</option>
                      <option value="waha">WAHA</option>
                      <option value="gowa">GOWA</option>
                      <option value="fonnte">Fonnte</option>
                      <option value="wablas">Wablas</option>
                      <option value="BAILEYS_LOCAL">Baileys (Local Scan Engine)</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">{t('whatsapp.baseUrl')}</label>
                    <input
                      type="text"
                      value={formData.type === 'BAILEYS_LOCAL' ? 'http://wa-engine:3006' : formData.apiUrl}
                      onChange={(e) => setFormData({...formData, apiUrl: e.target.value})}
                      className="w-full h-8 px-2.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white"
                      placeholder="http://10.100.0.245:2451"
                      required={formData.type !== 'BAILEYS_LOCAL'}
                      disabled={formData.type === 'BAILEYS_LOCAL'}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                      {t('whatsapp.apiKey')} {(formData.type === 'mpwa' || formData.type === 'gowa') && '*'}
                    </label>
                    <input
                      type="text"
                      value={formData.apiKey}
                      onChange={(e) => setFormData({...formData, apiKey: e.target.value})}
                      className="w-full h-8 px-2.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white"
                      placeholder={formData.type === 'gowa' ? 'username:password' : 'API Key or Token'}
                      required={formData.type === 'mpwa' || formData.type === 'gowa'}
                      disabled={formData.type === 'BAILEYS_LOCAL'}
                    />
                    {formData.type === 'gowa' && (
                      <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">Format: username:password</p>
                    )}
                  </div>
                </div>
                
                {formData.type === 'mpwa' && (
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">{t('whatsapp.senderNumber')} *</label>
                    <input
                      type="text"
                      value={formData.senderNumber}
                      onChange={(e) => setFormData({...formData, senderNumber: e.target.value})}
                      className="w-full h-8 px-2.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white"
                      placeholder="0816104997"
                      required
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">{t('whatsapp.priority')} (0=Primary)</label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value) || 0})}
                    className="w-full h-8 px-2.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white"
                    min="0"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">{t('whatsapp.description')}</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white resize-none"
                    rows={2}
                    placeholder={t('whatsapp.additionalNotes')}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <button
                  type="button"
                  onClick={resetForm}
                  className="h-7 px-3 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="h-7 px-3 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md transition-colors"
                >
                  {editingProvider ? t('common.update') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-sm" onClick={() => setShowQrModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('whatsapp.qrCode')} - {qrProvider?.name}</h3>
              <button onClick={() => setShowQrModal(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 flex flex-col items-center justify-center space-y-3">
              {qrLoading ? (
                <div className="flex flex-col items-center space-y-2 py-8">
                  <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
                </div>
              ) : qrImage ? (
                <>
                  <img src={qrImage} alt="QR Code" className="w-48 h-48 border rounded" />
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
                    {t('whatsapp.scanWhatsapp')}
                  </p>
                  <button
                    onClick={() => showQrCode(qrProvider!)}
                    className="h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
                  >
                    {t('whatsapp.refreshQr')}
                  </button>
                </>
              ) : (
                <p className="text-xs text-red-500 py-4">{t('whatsapp.failedLoadQr')}</p>
              )}
            </div>
            <div className="px-4 py-2.5 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setShowQrModal(false)}
                className="w-full h-7 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-medium rounded transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
