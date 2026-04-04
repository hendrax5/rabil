'use client';

import { useState, useEffect } from 'react';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Plus, Pencil, Trash2, Server, MapPin, Map, X, RefreshCcw,
  Activity, Box, Users, HardDrive, Link as LinkIcon,
} from 'lucide-react';
import MapPicker from '@/components/MapPicker';

interface ODP {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: string;
  followRoad: boolean;
  odcId: string | null;
  oltId: string;
  ponPort: number;
  portCount: number;
  parentOdpId: string | null;
  createdAt: string;
  olt: {
    name: string;
    ipAddress: string;
  };
  odc: {
    name: string;
  } | null;
  parentOdp: {
    name: string;
  } | null;
  _count: {
    childOdps: number;
  };
}

interface OLT {
  id: string;
  name: string;
  ipAddress: string;
}

interface ODC {
  id: string;
  name: string;
  oltId: string;
}

export default function ODPsPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [odps, setOdps] = useState<ODP[]>([]);
  const [olts, setOlts] = useState<OLT[]>([]);
  const [odcs, setOdcs] = useState<ODC[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOdp, setEditingOdp] = useState<ODP | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [filterOlt, setFilterOlt] = useState('');
  const [filterOdc, setFilterOdc] = useState('');
  const [connectionType, setConnectionType] = useState<'odc' | 'odp'>('odc');

  const [formData, setFormData] = useState({
    name: '',
    latitude: '',
    longitude: '',
    oltId: '',
    ponPort: '',
    portCount: '8',
    odcId: '',
    parentOdpId: '',
    status: 'active',
    followRoad: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [odpsRes, oltsRes, odcsRes] = await Promise.all([
        fetch('/api/network/odps'),
        fetch('/api/network/olts'),
        fetch('/api/network/odcs'),
      ]);
      const [odpsData, oltsData, odcsData] = await Promise.all([
        odpsRes.json(),
        oltsRes.json(),
        odcsRes.json(),
      ]);
      setOdps(odpsData.odps || []);
      setOlts(oltsData.olts || []);
      setOdcs(odcsData.odcs || []);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      latitude: '',
      longitude: '',
      oltId: '',
      ponPort: '',
      portCount: '8',
      odcId: '',
      parentOdpId: '',
      status: 'active',
      followRoad: false,
    });
    setConnectionType('odc');
  };

  const handleEdit = (odp: ODP) => {
    setEditingOdp(odp);
    setFormData({
      name: odp.name,
      latitude: odp.latitude.toString(),
      longitude: odp.longitude.toString(),
      oltId: odp.oltId,
      ponPort: odp.ponPort.toString(),
      portCount: odp.portCount.toString(),
      odcId: odp.odcId || '',
      parentOdpId: odp.parentOdpId || '',
      status: odp.status,
      followRoad: odp.followRoad,
    });
    setConnectionType(odp.parentOdpId ? 'odp' : 'odc');
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingOdp ? 'PUT' : 'POST';
      const payload = {
        ...formData,
        odcId: connectionType === 'odc' ? formData.odcId : null,
        parentOdpId: connectionType === 'odp' ? formData.parentOdpId : null,
        ...(editingOdp && { id: editingOdp.id }),
      };

      const res = await fetch('/api/network/odps', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (result.success) {
        await showSuccess(editingOdp ? 'ODP updated!' : 'ODP created!');
        setIsDialogOpen(false);
        setEditingOdp(null);
        resetForm();
        loadData();
      } else {
        await showError(result.error || 'Failed to save ODP');
      }
    } catch (error) {
      console.error('Submit error:', error);
      await showError('Failed to save ODP');
    }
  };

  const handleDelete = async (odp: ODP) => {
    const confirmed = await showConfirm(
      'Delete ODP',
      `Are you sure you want to delete "${odp.name}"? This will also delete all child ODPs and customer assignments.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch('/api/network/odps', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: odp.id }),
      });

      const result = await res.json();
      if (result.success) {
        await showSuccess('ODP deleted!');
        loadData();
      } else {
        await showError(result.error || 'Failed to delete ODP');
      }
    } catch (error) {
      await showError('Failed to delete ODP');
    }
  };

  const filteredOdps = odps.filter(odp => {
    if (filterOlt && odp.oltId !== filterOlt) return false;
    if (filterOdc && odp.odcId !== filterOdc) return false;
    return true;
  });

  // Filter ODCs by selected OLT
  const filteredOdcs = formData.oltId
    ? odcs.filter(odc => odc.oltId === formData.oltId)
    : odcs;

  // Filter parent ODPs by selected OLT
  const filteredParentOdps = formData.oltId
    ? odps.filter(odp => odp.oltId === formData.oltId && odp.id !== editingOdp?.id)
    : [];

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
            <Box className="h-5 w-5 text-blue-600" />
            ODP Management
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Manage Optical Distribution Points (ODP) for FTTH network
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setEditingOdp(null); setIsDialogOpen(true); }}
          className="inline-flex items-center px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add ODP
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Total ODPs</p>
              <p className="text-base font-bold text-blue-600">{odps.length}</p>
            </div>
            <Box className="h-5 w-5 text-blue-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Active</p>
              <p className="text-base font-bold text-green-600">
                {odps.filter(o => o.status === 'active').length}
              </p>
            </div>
            <Activity className="h-5 w-5 text-green-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Total Ports</p>
              <p className="text-base font-bold text-purple-600">
                {odps.reduce((sum, o) => sum + o.portCount, 0)}
              </p>
            </div>
            <LinkIcon className="h-5 w-5 text-purple-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">With Children</p>
              <p className="text-base font-bold text-orange-600">
                {odps.filter(o => (o._count?.childOdps || 0) > 0).length}
              </p>
            </div>
            <Users className="h-5 w-5 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-medium text-gray-500">OLT:</label>
            <select
              value={filterOlt}
              onChange={(e) => { setFilterOlt(e.target.value); setFilterOdc(''); }}
              className="px-2 py-1 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
            >
              <option value="">All OLTs</option>
              {olts.map(olt => (
                <option key={olt.id} value={olt.id}>{olt.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-medium text-gray-500">ODC:</label>
            <select
              value={filterOdc}
              onChange={(e) => setFilterOdc(e.target.value)}
              className="px-2 py-1 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
            >
              <option value="">All ODCs</option>
              {(filterOlt ? odcs.filter(o => o.oltId === filterOlt) : odcs).map(odc => (
                <option key={odc.id} value={odc.id}>{odc.name}</option>
              ))}
            </select>
          </div>
          <span className="text-[10px] text-gray-500">
            Showing {filteredOdps.length} of {odps.length} ODPs
          </span>
          {(filterOlt || filterOdc) && (
            <button
              onClick={() => { setFilterOlt(''); setFilterOdc(''); }}
              className="text-[10px] text-teal-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-3 py-2 border-b dark:border-gray-800">
          <span className="text-xs font-medium">ODP List</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Name</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Connection</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden sm:table-cell">PON</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden md:table-cell">Location</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Ports</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Status</th>
                <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredOdps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500 text-xs">
                    No ODPs found. Click "Add ODP" to create one.
                  </td>
                </tr>
              ) : (
                filteredOdps.map((odp) => (
                  <tr key={odp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Box className="h-4 w-4 text-blue-600" />
                        <div>
                          <span className="text-xs font-medium">{odp.name}</span>
                          {(odp._count?.childOdps || 0) > 0 && (
                            <span className="ml-1 px-1 py-0.5 text-[9px] bg-orange-100 text-orange-700 rounded">
                              {odp._count.childOdps} children
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Server className="h-3 w-3 text-teal-600" />
                          <span className="text-[10px]">{odp.olt?.name}</span>
                        </div>
                        {odp.odc && (
                          <div className="flex items-center gap-1">
                            <HardDrive className="h-3 w-3 text-orange-600" />
                            <span className="text-[10px] text-gray-500">{odp.odc.name}</span>
                          </div>
                        )}
                        {odp.parentOdp && (
                          <div className="flex items-center gap-1">
                            <Box className="h-3 w-3 text-blue-600" />
                            <span className="text-[10px] text-gray-500">{odp.parentOdp.name}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs hidden sm:table-cell">
                      <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-mono">
                        PON {odp.ponPort}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 hidden md:table-cell">
                      <a
                        href={`https://www.google.com/maps?q=${odp.latitude},${odp.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <MapPin className="h-3 w-3" />
                        View
                      </a>
                    </td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 rounded">
                        {odp.portCount} ports
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                          odp.status === 'active'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30'
                        }`}
                      >
                        {odp.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleEdit(odp)}
                          className="p-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(odp)}
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
                <h2 className="text-sm font-semibold">{editingOdp ? 'Edit ODP' : 'Add ODP'}</h2>
                <p className="text-[10px] text-gray-500">Configure Optical Distribution Point</p>
              </div>
              <button
                onClick={() => { setIsDialogOpen(false); setEditingOdp(null); resetForm(); }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="ODP-01-001"
                  className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium mb-1">OLT *</label>
                  <select
                    value={formData.oltId}
                    onChange={(e) => setFormData({ ...formData, oltId: e.target.value, odcId: '', parentOdpId: '' })}
                    required
                    className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                  >
                    <option value="">Select OLT</option>
                    {olts.map(olt => (
                      <option key={olt.id} value={olt.id}>{olt.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-1">PON Port *</label>
                  <input
                    type="number"
                    value={formData.ponPort}
                    onChange={(e) => setFormData({ ...formData, ponPort: e.target.value })}
                    required
                    min="1"
                    placeholder="1"
                    className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                  />
                </div>
              </div>

              {/* Connection Type */}
              <div>
                <label className="block text-[10px] font-medium mb-1">Connect To *</label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setConnectionType('odc')}
                    className={`flex-1 px-2 py-1.5 text-xs rounded border ${
                      connectionType === 'odc'
                        ? 'bg-orange-100 border-orange-500 text-orange-700 dark:bg-orange-900/30'
                        : 'border-gray-300 dark:border-gray-700'
                    }`}
                  >
                    <HardDrive className="h-3 w-3 inline mr-1" />
                    ODC (Cabinet)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConnectionType('odp')}
                    className={`flex-1 px-2 py-1.5 text-xs rounded border ${
                      connectionType === 'odp'
                        ? 'bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900/30'
                        : 'border-gray-300 dark:border-gray-700'
                    }`}
                  >
                    <Box className="h-3 w-3 inline mr-1" />
                    Parent ODP
                  </button>
                </div>
                
                {connectionType === 'odc' ? (
                  <select
                    value={formData.odcId}
                    onChange={(e) => setFormData({ ...formData, odcId: e.target.value })}
                    required={connectionType === 'odc'}
                    className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                  >
                    <option value="">Select ODC</option>
                    {filteredOdcs.map(odc => (
                      <option key={odc.id} value={odc.id}>{odc.name}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={formData.parentOdpId}
                    onChange={(e) => setFormData({ ...formData, parentOdpId: e.target.value })}
                    required={connectionType === 'odp'}
                    className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                  >
                    <option value="">Select Parent ODP</option>
                    {filteredParentOdps.map(odp => (
                      <option key={odp.id} value={odp.id}>{odp.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium mb-1">Port Count</label>
                  <input
                    type="number"
                    value={formData.portCount}
                    onChange={(e) => setFormData({ ...formData, portCount: e.target.value })}
                    min="1"
                    placeholder="8"
                    className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                  />
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
                  onClick={() => { setIsDialogOpen(false); setEditingOdp(null); resetForm(); }}
                  className="px-3 py-1.5 text-xs border dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                >
                  {editingOdp ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
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
