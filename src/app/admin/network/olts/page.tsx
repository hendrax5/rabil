'use client';

import { useState, useEffect } from 'react';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Plus, Pencil, Trash2, Server, MapPin, Map, X, RefreshCcw, Router as RouterIcon,
  Activity, Box, Network, Wrench,
} from 'lucide-react';
import MapPicker from '@/components/MapPicker';

interface OLT {
  id: string;
  name: string;
  ipAddress: string;
  latitude: number;
  longitude: number;
  status: string;
  followRoad: boolean;
  createdAt: string;
  tcontProfiles?: string[];
  vlanProfiles?: string[];
  routers: Array<{
    id: string;
    priority: number;
    isActive: boolean;
    router: {
      id: string;
      name: string;
      nasname: string;
      ipAddress: string;
    };
  }>;
  _count: {
    odps: number;
  };
}

interface Router {
  id: string;
  name: string;
  nasname: string;
  ipAddress: string;
}

export default function OLTsPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [olts, setOlts] = useState<OLT[]>([]);
  const [routers, setRouters] = useState<Router[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOlt, setEditingOlt] = useState<OLT | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Auto-Discovery State
  const [managingOlt, setManagingOlt] = useState<OLT | null>(null);
  const [unconfiguredOnus, setUnconfiguredOnus] = useState<any[]>([]);
  const [onuTypes, setOnuTypes] = useState<string[]>([]);
  const [loadingOnus, setLoadingOnus] = useState(false);
  const [registeringOnu, setRegisteringOnu] = useState<any | null>(null);
  const [pppoeUsers, setPppoeUsers] = useState<any[]>([]);
  const [regData, setRegData] = useState({ 
    vlan: '', mode: 'pppoe', onuType: '', profile: '10M', vlanProfile: '', pppoeUserId: '', vlanAcsProfile: '' 
  });
  
  const [formData, setFormData] = useState({
    name: '',
    ipAddress: '',
    latitude: '',
    longitude: '',
    status: 'active',
    followRoad: false,
    routerIds: [] as string[],
    vendor: 'zte',
    connection: 'ssh',
    port: '22',
    username: '',
    password: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [oltsRes, routersRes, usersRes] = await Promise.all([
        fetch('/api/network/olts'),
        fetch('/api/network/routers'),
        fetch('/api/pppoe/users'),
      ]);
      const [oltsData, routersData, usersData] = await Promise.all([oltsRes.json(), routersRes.json(), usersRes.json()]);
      setOlts(oltsData.olts || []);
      setRouters(routersData.routers || []);
      
      // Filter out users that are already bound to an ONU
      const unboundUsers = (usersData.users || []).filter((u: any) => !u.onuSn);
      setPppoeUsers(unboundUsers);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      ipAddress: '',
      latitude: '',
      longitude: '',
      status: 'active',
      followRoad: false,
      routerIds: [],
      vendor: 'zte',
      connection: 'ssh',
      port: '22',
      username: '',
      password: '',
    });
  };

  const handleEdit = (olt: OLT) => {
    setEditingOlt(olt);
    setFormData({
      name: olt.name,
      ipAddress: olt.ipAddress,
      latitude: olt.latitude.toString(),
      longitude: olt.longitude.toString(),
      status: olt.status,
      followRoad: olt.followRoad,
      routerIds: olt.routers.map(r => r.router.id),
      vendor: (olt as any).vendor || 'zte',
      connection: (olt as any).connection || 'ssh',
      port: (olt as any).port?.toString() || '22',
      username: (olt as any).username || '',
      password: (olt as any).password || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingOlt ? 'PUT' : 'POST';
      const payload = {
        ...formData,
        ...(editingOlt && { id: editingOlt.id }),
      };
      
      const res = await fetch('/api/network/olts', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const result = await res.json();
      if (result.success) {
        await showSuccess(editingOlt ? 'OLT updated!' : 'OLT created!');
        setIsDialogOpen(false);
        setEditingOlt(null);
        resetForm();
        loadData();
      } else {
        await showError(result.error || 'Failed to save OLT');
      }
    } catch (error) {
      console.error('Submit error:', error);
      await showError('Failed to save OLT');
    }
  };

  const handleDelete = async (olt: OLT) => {
    const confirmed = await showConfirm(
      'Delete OLT',
      `Are you sure you want to delete "${olt.name}"? This will also delete all associated ODCs and ODPs.`
    );
    if (!confirmed) return;
    
    try {
      const res = await fetch('/api/network/olts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: olt.id }),
      });
      
      const result = await res.json();
      if (result.success) {
        await showSuccess('OLT deleted!');
        loadData();
      } else {
        await showError(result.error || 'Failed to delete OLT');
      }
    } catch (error) {
      await showError('Failed to delete OLT');
    }
  };

  const toggleRouter = (routerId: string) => {
    setFormData(prev => ({
      ...prev,
      routerIds: prev.routerIds.includes(routerId)
        ? prev.routerIds.filter(id => id !== routerId)
        : [...prev.routerIds, routerId],
    }));
  };

  const handleInitOlt = async (olt: OLT) => {
    const confirmed = await showConfirm(
      'Initialize OLT (UNLIMITED)',
      `This will create an UNLIMITED TCONT Profile and register all required global VLANs on "${olt.name}". Are you sure you want to proceed?`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/network/olts/${olt.id}/init`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        await showSuccess('OLT Initialized Successfully!\n\n' + (data.output || ''));
      } else {
        await showError(data.error || 'Failed to initialize OLT');
      }
    } catch (error) {
      await showError('Network error while initializing OLT');
    }
  };

  const openManageOnus = async (olt: OLT, forceRefresh: boolean = false) => {
    setManagingOlt(olt);
    setUnconfiguredOnus([]);
    setLoadingOnus(true);
    setRegisteringOnu(null);
    try {
      const res = await fetch(`/api/network/olts/${olt.id}/uncfg?refresh=${forceRefresh ? 'true' : 'false'}`);
      const data = await res.json();
      if (res.ok) {
        setUnconfiguredOnus(data.data || []);
        setOnuTypes(data.types || ['1.ZTE-Home', '2.ZTE-Bridge', '3.HUAWEI', '0.ALL-Dual_Band']);
      } else {
        showError(data.error || 'Failed to fetch unconfigured ONUs');
      }
    } catch {
      showError('Network error while fetching ONUs');
    } finally {
      setLoadingOnus(false);
    }
  };

  const handleRegisterOnu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingOlt || !registeringOnu) return;
    
    try {
      const payload = {
        board: registeringOnu.board,
        port: registeringOnu.port,
        sn: registeringOnu.sn,
        pppoeUserId: regData.pppoeUserId,
        mode: regData.mode,
        onuType: regData.onuType || onuTypes[0] || '1.ZTE-Home',
        profile: regData.profile,
        vlanProfile: regData.vlanProfile
      };
      
      const res = await fetch(`/api/network/olts/${managingOlt.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (res.ok) {
        await showSuccess('ONU Registered Successfully!');
        setRegisteringOnu(null);
        setRegData({ vlan: '', mode: 'pppoe', onuType: '', profile: '10M', vlanProfile: '', pppoeUserId: '', vlanAcsProfile: '' });
        // Refresh the list
        openManageOnus(managingOlt);
        // Refresh PPPoE Users to remove the newly bound one
        loadData();
      } else {
        await showError(data.error || 'Failed to register ONU');
      }
    } catch {
      await showError('Error executing registration');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCcw className="h-6 w-6 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Server className="h-5 w-5 text-teal-600" />
            OLT Management
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Manage Optical Line Terminals (OLT) for FTTH network
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setEditingOlt(null); setIsDialogOpen(true); }}
          className="inline-flex items-center px-3 py-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add OLT
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Total OLTs</p>
              <p className="text-base font-bold text-teal-600">{olts.length}</p>
            </div>
            <Server className="h-5 w-5 text-teal-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Active</p>
              <p className="text-base font-bold text-green-600">
                {olts.filter(o => o.status === 'active').length}
              </p>
            </div>
            <Activity className="h-5 w-5 text-green-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Total ODPs</p>
              <p className="text-base font-bold text-blue-600">
                {olts.reduce((sum, o) => sum + (o._count?.odps || 0), 0)}
              </p>
            </div>
            <Box className="h-5 w-5 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-3 py-2 border-b dark:border-gray-800">
          <span className="text-xs font-medium">OLT List</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Name</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">IP Address</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden md:table-cell">Location</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden sm:table-cell">Routers</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">ODPs</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Status</th>
                <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {olts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500 text-xs">
                    No OLTs found. Click "Add OLT" to create one.
                  </td>
                </tr>
              ) : (
                olts.map((olt) => (
                  <tr key={olt.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-teal-600" />
                        <span className="text-xs font-medium">{olt.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs font-mono text-gray-600 dark:text-gray-400">
                      {olt.ipAddress}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 hidden md:table-cell">
                      <a
                        href={`https://www.google.com/maps?q=${olt.latitude},${olt.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <MapPin className="h-3 w-3" />
                        {olt.latitude.toFixed(6)}, {olt.longitude.toFixed(6)}
                      </a>
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {olt.routers.map((r, idx) => (
                          <span
                            key={r.id}
                            className={`px-1.5 py-0.5 text-[9px] rounded ${
                              idx === 0
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800'
                            }`}
                          >
                            {r.router.name}
                          </span>
                        ))}
                        {olt.routers.length === 0 && (
                          <span className="text-[10px] text-gray-400">No router</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 rounded">
                        {olt._count?.odps || 0} ODPs
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                          olt.status === 'active'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30'
                        }`}
                      >
                        {olt.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          title="Init Setup (Global VLAN & UNLIMITED Profile)"
                          onClick={() => handleInitOlt(olt)}
                          className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                        >
                          <Wrench className="h-3 w-3" />
                        </button>
                        <button
                          title="Auto-Discovery & Provisioning"
                          onClick={() => openManageOnus(olt)}
                          className="p-1 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded"
                        >
                          <Network className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleEdit(olt)}
                          className="p-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(olt)}
                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b dark:border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">{editingOlt ? 'Edit OLT' : 'Add OLT'}</h2>
                <p className="text-[10px] text-gray-500">Configure Optical Line Terminal</p>
              </div>
              <button
                onClick={() => { setIsDialogOpen(false); setEditingOlt(null); resetForm(); }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="OLT-01"
                    className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-1">IP Address *</label>
                  <input
                    type="text"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    required
                    placeholder="192.168.1.1"
                    className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-medium">GPS Location *</label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setShowMapPicker(true)}
                      className="inline-flex items-center px-2 py-0.5 text-[10px] bg-teal-600 text-white rounded"
                    >
                      <Map className="h-2.5 w-2.5 mr-1" />
                      Open Map
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!navigator.geolocation) {
                          showError('GPS tidak tersedia di browser ini');
                          return;
                        }
                        navigator.geolocation.getCurrentPosition(
                          (p) => {
                            setFormData({
                              ...formData,
                              latitude: p.coords.latitude.toFixed(6),
                              longitude: p.coords.longitude.toFixed(6),
                            });
                            showSuccess('Lokasi GPS berhasil didapatkan!');
                          },
                          (err) => {
                            console.error('GPS Error:', err);
                            if (err.code === 1) {
                              showError('Izin GPS ditolak. Mohon aktifkan izin lokasi di browser.');
                            } else if (err.code === 2) {
                              showError('Lokasi tidak tersedia. Pastikan GPS aktif.');
                            } else if (err.code === 3) {
                              showError('Waktu habis mendapatkan lokasi. Coba lagi.');
                            } else {
                              showError('Gagal mendapatkan lokasi GPS');
                            }
                          },
                          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
                        );
                      }}
                      className="inline-flex items-center px-2 py-0.5 text-[10px] bg-green-600 text-white rounded"
                    >
                      <MapPin className="h-2.5 w-2.5 mr-1" />
                      Auto GPS
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    required
                    placeholder="Latitude"
                    className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                  />
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    required
                    placeholder="Longitude"
                    className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-[10px] font-medium mb-1">Vendor/Tipe</label>
                  <select
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                  >
                    <option value="zte">ZTE</option>
                    <option value="huawei">Huawei</option>
                    <option value="vsol">VSOL / HiSoft</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-1">Method</label>
                  <select
                    value={formData.connection}
                    onChange={(e) => setFormData({ ...formData, connection: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                  >
                    <option value="ssh">SSH</option>
                    <option value="telnet">Telnet</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-1">Port</label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                    placeholder={formData.connection === 'ssh' ? '22' : '23'}
                    className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="block text-[10px] font-medium mb-1">Username (Management)</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="admin"
                    className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-1">Password (Management)</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="***"
                    className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-medium mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-medium mb-1">
                  Connected Routers (Uplinks)
                </label>
                <div className="border dark:border-gray-700 rounded p-2 max-h-32 overflow-y-auto space-y-1">
                  {routers.length === 0 ? (
                    <p className="text-[10px] text-gray-400">No routers available</p>
                  ) : (
                    routers.map((router) => (
                      <label
                        key={router.id}
                        className="flex items-center gap-2 p-1 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.routerIds.includes(router.id)}
                          onChange={() => toggleRouter(router.id)}
                          className="w-3 h-3 rounded"
                        />
                        <RouterIcon className="h-3 w-3 text-gray-500" />
                        <span className="text-xs">{router.name}</span>
                        <span className="text-[10px] text-gray-400">({router.ipAddress})</span>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-[9px] text-gray-500 mt-1">
                  First selected = Primary uplink
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="followRoad"
                  checked={formData.followRoad}
                  onChange={(e) => setFormData({ ...formData, followRoad: e.target.checked })}
                  className="w-3 h-3 rounded"
                />
                <label htmlFor="followRoad" className="text-xs">
                  Follow road path on map
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => { setIsDialogOpen(false); setEditingOlt(null); resetForm(); }}
                  className="px-3 py-1.5 text-xs border dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded"
                >
                  {editingOlt ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage ONUs Dialog */}
      {managingOlt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b dark:border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Network className="w-4 h-4 text-teal-600" />
                  Auto-Discovery ONU
                </h2>
                <p className="text-[10px] text-gray-500">
                  {managingOlt.name} ({managingOlt.ipAddress})
                </p>
              </div>
              <button
                onClick={() => {
                  setManagingOlt(null);
                  setRegisteringOnu(null);
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900/50">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300">Unconfigured ONUs</h3>
                <button
                  onClick={() => openManageOnus(managingOlt, true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-teal-600/10 text-teal-600 border border-teal-600/20 rounded-md text-xs hover:bg-teal-600/20"
                >
                  <RefreshCcw className={`w-3 h-3 ${loadingOnus ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
              
              {loadingOnus ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCcw className="w-8 h-8 animate-spin text-teal-600" />
                </div>
              ) : unconfiguredOnus.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-lg border dark:border-gray-700 text-center text-gray-500 text-xs">
                  No unconfigured ONUs found on this OLT.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {unconfiguredOnus.map((onu, idx) => (
                     <div key={idx} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-3 shadow-sm relative overflow-hidden">
                       <div className="flex justify-between items-start mb-2">
                         <div>
                            <span className="font-mono text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/50">
                              SN: {onu.sn}
                            </span>
                            <div className="text-[10px] text-gray-500 mt-1">
                               Olt Type: {onu.type || 'Unknown'} | Board: {onu.board} | Port: {onu.port} | LLID: {onu.llid}
                            </div>
                         </div>
                       </div>
                       
                       {registeringOnu?.sn === onu.sn ? (
                         <form onSubmit={handleRegisterOnu} className="mt-3 bg-gray-50 dark:bg-gray-900 p-2 rounded border dark:border-gray-700">
                           <div className="grid grid-cols-2 gap-2 mb-2">
                              {/* MODE TOGGLE */}
                              <div className="col-span-2 flex items-center justify-between bg-white dark:bg-gray-800 p-1.5 rounded border border-gray-200 dark:border-gray-700">
                                <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">Registration Mode:</span>
                                <div className="flex bg-gray-100 dark:bg-gray-900 p-0.5 rounded">
                                  <button
                                    type="button"
                                    onClick={() => setRegData({...regData, mode: 'pppoe'})}
                                    className={`px-3 py-1 text-[10px] font-medium rounded ${regData.mode === 'pppoe' ? 'bg-teal-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                                  >
                                    PPPoE Router
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRegData({...regData, mode: 'bridge'})}
                                    className={`px-3 py-1 text-[10px] font-medium rounded ${regData.mode === 'bridge' ? 'bg-teal-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                                  >
                                    Bridge
                                  </button>
                                </div>
                              </div>
                              
                              <div className="col-span-1">
                                <label className="block text-[9px] font-bold mb-0.5">ONU Type</label>
                                <select
                                  value={regData.onuType || (onuTypes.length > 0 ? onuTypes[0] : '')}
                                  onChange={(e) => setRegData({...regData, onuType: e.target.value})}
                                  className="w-full text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                >
                                  {onuTypes.map((t, i) => <option key={i} value={t}>{t}</option>)}
                                  {onuTypes.length === 0 && <option value="1.ZTE-Home">1.ZTE-Home</option>}
                                </select>
                              </div>

                              <div className="col-span-1">
                                <label className="block text-[9px] font-bold mb-0.5">Assign PPPoE User</label>
                                <select
                                  required
                                  value={regData.pppoeUserId}
                                  onChange={(e) => setRegData({...regData, pppoeUserId: e.target.value})}
                                  className="w-full text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                >
                                  <option value="">-- Select Unbound User --</option>
                                  {pppoeUsers.map((u: any) => (
                                    <option key={u.id} value={u.id}>{u.username} ({u.name})</option>
                                  ))}
                                </select>
                              </div>

                              {regData.mode === 'pppoe' && (
                                <>
                                  <div className="col-span-1">
                                    <label className="block text-[9px] font-bold mb-0.5">T-CONT Profile</label>
                                    {managingOlt?.tcontProfiles && Array.isArray(managingOlt.tcontProfiles) && managingOlt.tcontProfiles.length > 0 ? (
                                      <select
                                        required
                                        value={regData.profile}
                                        onChange={(e) => setRegData({...regData, profile: e.target.value})}
                                        className="w-full text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                      >
                                        <option value="">-- Select Profile --</option>
                                        {managingOlt.tcontProfiles.map((p: string, i: number) => <option key={i} value={p}>{p}</option>)}
                                      </select>
                                    ) : (
                                      <input
                                        required
                                        value={regData.profile}
                                        onChange={(e) => setRegData({...regData, profile: e.target.value})}
                                        placeholder="e.g. 100Mbps or UP"
                                        className="w-full text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                      />
                                    )}
                                  </div>
                                  <div className="col-span-1">
                                    <label className="block text-[9px] font-bold mb-0.5">VLAN Profile</label>
                                    {managingOlt?.vlanProfiles && Array.isArray(managingOlt.vlanProfiles) && managingOlt.vlanProfiles.length > 0 ? (
                                      <select
                                        value={regData.vlanProfile || ''}
                                        onChange={(e) => setRegData({...regData, vlanProfile: e.target.value})}
                                        className="w-full text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                      >
                                        <option value="">-- No VLAN Profile --</option>
                                        {managingOlt.vlanProfiles.map((p: string, i: number) => <option key={i} value={p}>{p}</option>)}
                                      </select>
                                    ) : (
                                      <input
                                        value={regData.vlanProfile || ''}
                                        onChange={(e) => setRegData({...regData, vlanProfile: e.target.value})}
                                        placeholder="Optional. e.g. VLAN-415"
                                        className="w-full text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                      />
                                    )}
                                  </div>
                                </>
                              )}
                           </div>
                           <div className="flex justify-end gap-1 mt-2">
                              <button type="button" onClick={() => setRegisteringOnu(null)} className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-[10px] rounded hover:bg-gray-300 dark:hover:bg-gray-600">Cancel</button>
                              <button type="submit" className="px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white font-bold text-[10px] rounded">Bind & Provision</button>
                           </div>
                         </form>
                       ) : (
                         <button 
                           onClick={() => { 
                             setRegisteringOnu(onu); 
                             setRegData({
                               name:'', mode: 'pppoe', onuType: onuTypes.length > 0 ? onuTypes[0] : '1.ZTE-Home', 
                               profile: '10M', vlanProfile: '', pppoeUser: '', pppoePass: ''
                             }); 
                           }}
                           className="w-full mt-2 py-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400 dark:hover:bg-teal-900/50 rounded flex items-center justify-center gap-1 transition-colors"
                         >
                           <Plus className="w-3 h-3" /> Provision this ONU
                         </button>
                       )}
                     </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Map Picker */}
      <MapPicker
        isOpen={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onSelect={(lat, lng) => {
          setFormData({
            ...formData,
            latitude: lat.toFixed(6),
            longitude: lng.toFixed(6),
          });
        }}
        initialLat={formData.latitude ? parseFloat(formData.latitude) : undefined}
        initialLng={formData.longitude ? parseFloat(formData.longitude) : undefined}
      />
    </div>
  );
}
