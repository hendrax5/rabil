'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import Swal from 'sweetalert2';

interface User {
  id: string;
  name: string;
  username: string;
  phone: string;
  address: string;
  status: string;
  profile?: { name: string };
  router?: { name: string };
  odpAssignment?: {
    odp: {
      id: string;
      name: string;
      odcId: string | null;
      odc?: { id: string; name: string } | null;
    };
  } | null;
}

export default function SendMessagePage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'single' | 'broadcast'>('single');
  
  // Single message states
  const [phoneNumber, setPhoneNumber] = useState('');
  const [singleMessage, setSingleMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; provider?: string; error?: string } | null>(null);

  // Broadcast states
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ total: number; successCount: number; failCount: number } | null>(null);

  // Filter states
  const [filters, setFilters] = useState<{
    profiles: { id: string; name: string }[];
    routers: { id: string; name: string }[];
    statuses: string[];
    odcs: { id: string; name: string }[];
    odps: { id: string; name: string; odcId: string }[];
  }>({ profiles: [], routers: [], statuses: [], odcs: [], odps: [] });
  const [statusFilter, setStatusFilter] = useState('');
  const [profileFilter, setProfileFilter] = useState('');
  const [routerFilter, setRouterFilter] = useState('');
  const [addressFilter, setAddressFilter] = useState('');
  const [odcFilter, setOdcFilter] = useState('');
  const [odpFilters, setOdpFilters] = useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Template states
  const [templates, setTemplates] = useState<{ id: string; name: string; message: string }[]>([]);

  useEffect(() => {
    loadUsers();
    loadTemplates();
  }, [statusFilter, profileFilter, routerFilter, addressFilter, odcFilter, odpFilters]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (profileFilter) params.append('profileId', profileFilter);
      if (routerFilter) params.append('routerId', routerFilter);
      if (addressFilter) params.append('address', addressFilter);
      if (odcFilter) params.append('odcId', odcFilter);
      if (odpFilters.length > 0) params.append('odpIds', odpFilters.join(','));

      const res = await fetch(`/api/users/list?${params}`);
      const data = await res.json();

      if (data.success) {
        setUsers(data.users);
        setFilters(data.filters);
      }
    } catch (error) {
      console.error('Load users error:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/whatsapp/templates');
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error('Load templates error:', error);
    }
  };

  const loadTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setBroadcastMessage(template.message);
      Swal.fire({ icon: 'success', title: 'Template Loaded!', text: `${template.name} loaded.`, timer: 2000, showConfirmButton: false });
    }
  };

  const handleSingleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneNumber || !singleMessage) {
      Swal.fire('Error!', 'Phone number and message are required', 'error');
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber, message: singleMessage }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        Swal.fire('Berhasil!', `Message sent via ${data.provider}!`, 'success');
        setResult({ success: true, provider: data.provider });
        setSingleMessage('');
      } else {
        Swal.fire('Error!', data.error || 'Failed to send message', 'error');
        setResult({ success: false, error: data.error });
      }
    } catch {
      Swal.fire('Error!', 'Failed to send message', 'error');
      setResult({ success: false, error: 'Network error' });
    } finally {
      setSending(false);
    }
  };

  const handleBroadcast = async () => {
    if (selectedUsers.size === 0) {
      Swal.fire('Error!', 'Please select at least one user', 'error');
      return;
    }

    if (!broadcastMessage) {
      Swal.fire('Error!', 'Message is required', 'error');
      return;
    }

    const confirmed = await Swal.fire({
      title: 'Confirm Broadcast',
      html: `Send message to <strong>${selectedUsers.size}</strong> users?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Send!',
      cancelButtonText: 'Cancel',
    });

    if (!confirmed.isConfirmed) return;

    setBroadcasting(true);
    setBroadcastResult(null);

    try {
      const res = await fetch('/api/whatsapp/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: Array.from(selectedUsers),
          message: broadcastMessage,
          delay: 2000,
        }),
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire('Broadcast Complete!', `✅ Success: ${data.successCount} | ❌ Failed: ${data.failCount}`, 'success');
        setBroadcastResult(data);
        setSelectedUsers(new Set());
      } else {
        Swal.fire('Error!', data.error || 'Broadcast failed', 'error');
      }
    } catch {
      Swal.fire('Error!', 'Failed to send broadcast', 'error');
    } finally {
      setBroadcasting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map((u) => u.id)));
    }
  };

  const toggleUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const toggleOdpFilter = (odpId: string) => {
    setOdpFilters((prev) => prev.includes(odpId) ? prev.filter((id) => id !== odpId) : [...prev, odpId]);
  };

  const getFilteredOdps = () => {
    if (!odcFilter) return filters.odps;
    return filters.odps.filter((odp) => odp.odcId === odcFilter);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-3 sm:p-4">
      <div className="max-w-7xl mx-auto space-y-3">
        {/* Header */}
        <div>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">{t('whatsapp.sendTitle')}</h1>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('whatsapp.sendSubtitle')}</p>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-1 inline-flex gap-1">
          <button
            onClick={() => setActiveTab('single')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
              activeTab === 'single' ? 'bg-teal-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            {t('whatsapp.singleMessage')}
          </button>
          <button
            onClick={() => setActiveTab('broadcast')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
              activeTab === 'broadcast' ? 'bg-teal-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {t('whatsapp.broadcast')}
          </button>
        </div>

        {/* Single Message Tab */}
        {activeTab === 'single' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
              <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('whatsapp.sendMessage')}</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('whatsapp.messageViaSent')}</p>
              </div>
              <form onSubmit={handleSingleSend} className="p-3 space-y-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">{t('whatsapp.phoneNumber')}</label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="628123456789"
                    className="w-full h-8 px-2.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">{t('whatsapp.message')}</label>
                  <textarea
                    value={singleMessage}
                    onChange={(e) => setSingleMessage(e.target.value)}
                    placeholder={t('whatsapp.typeMessage')}
                    rows={6}
                    className="w-full px-2.5 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white resize-none"
                    required
                  />
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{singleMessage.length} {t('whatsapp.characters')}</p>
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full h-8 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {sending ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {t('whatsapp.sending')}
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      {t('whatsapp.sendMessage')}
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
              <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('whatsapp.result')}</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('whatsapp.sendStatus')}</p>
              </div>
              <div className="p-3 flex items-center justify-center min-h-[200px]">
                {!result ? (
                  <div className="text-center text-gray-400">
                    <svg className="w-10 h-10 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <p className="text-xs">{t('whatsapp.sendToSeeResult')}</p>
                  </div>
                ) : result.success ? (
                  <div className="flex items-center gap-3 text-green-600">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold">{t('whatsapp.messageSent')}</p>
                      <p className="text-xs">{t('whatsapp.via')} {result.provider}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-red-600">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold">{t('whatsapp.failed')}</p>
                      <p className="text-xs">{result.error}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Broadcast Tab */}
        {activeTab === 'broadcast' && (
          <div className="space-y-3">
            {/* Filters */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
              <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('whatsapp.filterUsers')}</h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('whatsapp.selectForBroadcast')}</p>
                </div>
                <span className="px-2 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 text-xs font-medium rounded">
                  {selectedUsers.size} / {users.length} {t('whatsapp.selected')}
                </span>
              </div>
              <div className="p-3 space-y-3">
                {/* Network Location Filter */}
                <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-1.5 mb-2">
                    <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-[10px] font-semibold text-blue-900 dark:text-blue-100">{t('whatsapp.filterByNetwork')}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-0.5">ODC</label>
                      <select
                        value={odcFilter || 'all'}
                        onChange={(e) => { setOdcFilter(e.target.value === 'all' ? '' : e.target.value); setOdpFilters([]); }}
                        className="w-full h-7 px-2 text-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white"
                      >
                        <option value="all">{t('whatsapp.allOdcs')}</option>
                        {filters.odcs.map((odc) => (
                          <option key={odc.id} value={odc.id}>{odc.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[10px] font-medium text-gray-600 dark:text-gray-400">ODP</label>
                        {odpFilters.length > 0 && (
                          <button onClick={() => setOdpFilters([])} className="text-[9px] text-teal-600 hover:underline">
                            {t('common.clear')} ({odpFilters.length})
                          </button>
                        )}
                      </div>
                      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-1.5 max-h-20 overflow-y-auto">
                        {getFilteredOdps().length === 0 ? (
                          <p className="text-[10px] text-gray-400 text-center py-1">
                            {odcFilter ? t('whatsapp.noOdps') : t('whatsapp.selectOdcFirst')}
                          </p>
                        ) : (
                          <div className="space-y-0.5">
                            {getFilteredOdps().map((odp) => (
                              <label key={odp.id} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded p-0.5">
                                <input
                                  type="checkbox"
                                  checked={odpFilters.includes(odp.id)}
                                  onChange={() => toggleOdpFilter(odp.id)}
                                  className="w-3 h-3 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                />
                                <span className="text-[10px] text-gray-700 dark:text-gray-300">{odp.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Other Filters */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-0.5">Status</label>
                    <select
                      value={statusFilter || 'all'}
                      onChange={(e) => setStatusFilter(e.target.value === 'all' ? '' : e.target.value)}
                      className="w-full h-7 px-2 text-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white"
                    >
                      <option value="all">{t('whatsapp.allStatus')}</option>
                      {filters.statuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-0.5">Profile</label>
                    <select
                      value={profileFilter || 'all'}
                      onChange={(e) => setProfileFilter(e.target.value === 'all' ? '' : e.target.value)}
                      className="w-full h-7 px-2 text-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white"
                    >
                      <option value="all">{t('whatsapp.allProfiles')}</option>
                      {filters.profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>{profile.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-0.5">Router</label>
                    <select
                      value={routerFilter || 'all'}
                      onChange={(e) => setRouterFilter(e.target.value === 'all' ? '' : e.target.value)}
                      className="w-full h-7 px-2 text-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white"
                    >
                      <option value="all">{t('whatsapp.allRouters')}</option>
                      {filters.routers.map((router) => (
                        <option key={router.id} value={router.id}>{router.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-0.5">Address</label>
                    <input
                      type="text"
                      placeholder={t('whatsapp.searchAddress')}
                      value={addressFilter}
                      onChange={(e) => setAddressFilter(e.target.value)}
                      className="w-full h-7 px-2 text-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Users Table */}
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full">
                        <thead className="sticky top-0">
                          <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                            <th className="px-2 py-1.5 text-left">
                              <input
                                type="checkbox"
                                checked={selectedUsers.size === users.length && users.length > 0}
                                onChange={toggleSelectAll}
                                className="w-3 h-3 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                              />
                            </th>
                            <th className="px-2 py-1.5 text-left text-[9px] font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('common.name')}</th>
                            <th className="px-2 py-1.5 text-left text-[9px] font-semibold text-gray-600 dark:text-gray-400 uppercase hidden sm:table-cell">{t('common.username')}</th>
                            <th className="px-2 py-1.5 text-left text-[9px] font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('common.phone')}</th>
                            <th className="px-2 py-1.5 text-left text-[9px] font-semibold text-gray-600 dark:text-gray-400 uppercase hidden md:table-cell">{t('common.profile')}</th>
                            <th className="px-2 py-1.5 text-left text-[9px] font-semibold text-gray-600 dark:text-gray-400 uppercase hidden lg:table-cell">ODP</th>
                            <th className="px-2 py-1.5 text-left text-[9px] font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('common.status')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {users.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-2 py-6 text-center text-[10px] text-gray-400">{t('whatsapp.noUsersFound')}</td>
                            </tr>
                          ) : (
                            users.map((user) => (
                              <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="px-2 py-1">
                                  <input
                                    type="checkbox"
                                    checked={selectedUsers.has(user.id)}
                                    onChange={() => toggleUser(user.id)}
                                    className="w-3 h-3 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                  />
                                </td>
                                <td className="px-2 py-1 text-[10px] font-medium text-gray-900 dark:text-white">{user.name}</td>
                                <td className="px-2 py-1 text-[10px] text-gray-600 dark:text-gray-400 hidden sm:table-cell">{user.username}</td>
                                <td className="px-2 py-1 text-[10px] text-gray-600 dark:text-gray-400 font-mono">{user.phone || '-'}</td>
                                <td className="px-2 py-1 text-[10px] text-gray-600 dark:text-gray-400 hidden md:table-cell">{user.profile?.name || '-'}</td>
                                <td className="px-2 py-1 hidden lg:table-cell">
                                  {user.odpAssignment ? (
                                    <span className="text-[9px] text-gray-600 dark:text-gray-400">
                                      {user.odpAssignment.odp.name}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-2 py-1">
                                  <span className={`inline-flex px-1 py-0.5 text-[9px] font-medium rounded ${
                                    user.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                  }`}>
                                    {user.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Broadcast Message */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
              <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('whatsapp.broadcastMessage')}</h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  Variabel: {'{{customerName}}'}, {'{{username}}'}, {'{{profileName}}'}, {'{{companyName}}'}
                </p>
              </div>
              <div className="p-3 space-y-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">{t('whatsapp.loadFromTemplate')}</label>
                  <select
                    onChange={(e) => e.target.value && loadTemplate(e.target.value)}
                    className="w-full h-7 px-2 text-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white"
                  >
                    <option value="">{t('whatsapp.selectTemplate')}</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                </div>

                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder={t('whatsapp.typeBroadcast')}
                  rows={6}
                  className="w-full px-2.5 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white resize-none"
                />
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{broadcastMessage.length} {t('whatsapp.characters')}</p>

                <button
                  onClick={handleBroadcast}
                  disabled={broadcasting || selectedUsers.size === 0}
                  className="w-full h-8 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {broadcasting ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {t('whatsapp.sendingTo', { count: selectedUsers.size })}
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      {t('whatsapp.sendBroadcastTo', { count: selectedUsers.size })}
                    </>
                  )}
                </button>

                {broadcastResult && (
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-[10px] font-medium text-blue-900 dark:text-blue-100 mb-1.5">{t('whatsapp.broadcastSummary')}:</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{broadcastResult.total}</p>
                        <p className="text-[9px] text-gray-500">{t('common.total')}</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-green-600">{broadcastResult.successCount}</p>
                        <p className="text-[9px] text-gray-500">{t('whatsapp.success')}</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-600">{broadcastResult.failCount}</p>
                        <p className="text-[9px] text-gray-500">{t('whatsapp.failed')}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
