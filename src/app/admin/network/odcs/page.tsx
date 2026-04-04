'use client';

import { useState, useEffect } from 'react';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Plus, Pencil, Trash2, Server, MapPin, Map, X, RefreshCcw,
  Activity, Box, HardDrive,
} from 'lucide-react';
import MapPicker from '@/components/MapPicker';

interface ODC {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: string;
  followRoad: boolean;
  oltId: string;
  ponPort: number;
  portCount: number;
  createdAt: string;
  olt: {
    id: string;
    name: string;
    ipAddress: string;
  };
  _count: {
    odps: number;
  };
}

interface OLT {
  id: string;
  name: string;
  ipAddress: string;
}

export default function ODCsPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [odcs, setOdcs] = useState<ODC[]>([]);
  const [olts, setOlts] = useState<OLT[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOdc, setEditingOdc] = useState<ODC | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [filterOlt, setFilterOlt] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    latitude: '',
    longitude: '',
    oltId: '',
    ponPort: '',
    portCount: '8',
    status: 'active',
    followRoad: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [odcsRes, oltsRes] = await Promise.all([
        fetch('/api/network/odcs'),
        fetch('/api/network/olts'),
      ]);
      const [odcsData, oltsData] = await Promise.all([odcsRes.json(), oltsRes.json()]);
      setOdcs(odcsData.odcs || []);
      setOlts(oltsData.olts || []);
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
      status: 'active',
      followRoad: false,
    });
  };

  const handleEdit = (odc: ODC) => {
    setEditingOdc(odc);
    setFormData({
      name: odc.name,
      latitude: odc.latitude.toString(),
      longitude: odc.longitude.toString(),
      oltId: odc.oltId,
      ponPort: odc.ponPort.toString(),
      portCount: odc.portCount.toString(),
      status: odc.status,
      followRoad: odc.followRoad,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingOdc ? 'PUT' : 'POST';
      const payload = {
        ...formData,
        ...(editingOdc && { id: editingOdc.id }),
      };

      const res = await fetch('/api/network/odcs', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (result.success) {
        await showSuccess(editingOdc ? 'ODC updated!' : 'ODC created!');
        setIsDialogOpen(false);
        setEditingOdc(null);
        resetForm();
        loadData();
      } else {
        await showError(result.error || 'Failed to save ODC');
      }
    } catch (error) {
      console.error('Submit error:', error);
      await showError('Failed to save ODC');
    }
  };

  const handleDelete = async (odc: ODC) => {
    const confirmed = await showConfirm(
      'Delete ODC',
      `Are you sure you want to delete "${odc.name}"? This will also delete all associated ODPs.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch('/api/network/odcs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: odc.id }),
      });

      const result = await res.json();
      if (result.success) {
        await showSuccess('ODC deleted!');
        loadData();
      } else {
        await showError(result.error || 'Failed to delete ODC');
      }
    } catch (error) {
      await showError('Failed to delete ODC');
    }
  };

  const filteredOdcs = filterOlt
    ? odcs.filter(odc => odc.oltId === filterOlt)
    : odcs;

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
            <HardDrive className="h-5 w-5 text-orange-600" />
            ODC Management
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Manage Optical Distribution Cabinets (ODC) for FTTH network
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setEditingOdc(null); setIsDialogOpen(true); }}
          className="inline-flex items-center px-3 py-1.5 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add ODC
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Total ODCs</p>
              <p className="text-base font-bold text-orange-600">{odcs.length}</p>
            </div>
            <HardDrive className="h-5 w-5 text-orange-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Active</p>
              <p className="text-base font-bold text-green-600">
                {odcs.filter(o => o.status === 'active').length}
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
                {odcs.reduce((sum, o) => sum + (o._count?.odps || 0), 0)}
              </p>
            </div>
            <Box className="h-5 w-5 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
        <div className="flex items-center gap-3">
          <label className="text-[10px] font-medium text-gray-500">Filter by OLT:</label>
          <select
            value={filterOlt}
            onChange={(e) => setFilterOlt(e.target.value)}
            className="px-2 py-1 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
          >
            <option value="">All OLTs</option>
            {olts.map(olt => (
              <option key={olt.id} value={olt.id}>{olt.name}</option>
            ))}
          </select>
          <span className="text-[10px] text-gray-500">
            Showing {filteredOdcs.length} of {odcs.length} ODCs
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-3 py-2 border-b dark:border-gray-800">
          <span className="text-xs font-medium">ODC List</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Name</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">OLT</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden sm:table-cell">PON Port</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden md:table-cell">Location</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Ports/ODPs</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Status</th>
                <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredOdcs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500 text-xs">
                    No ODCs found. Click "Add ODC" to create one.
                  </td>
                </tr>
              ) : (
                filteredOdcs.map((odc) => (
                  <tr key={odc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-orange-600" />
                        <span className="text-xs font-medium">{odc.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Server className="h-3 w-3 text-teal-600" />
                        <span className="text-xs">{odc.olt?.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs hidden sm:table-cell">
                      <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-mono">
                        PON {odc.ponPort}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 hidden md:table-cell">
                      <a
                        href={`https://www.google.com/maps?q=${odc.latitude},${odc.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <MapPin className="h-3 w-3" />
                        {odc.latitude.toFixed(6)}, {odc.longitude.toFixed(6)}
                      </a>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className="px-1.5 py-0.5 text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 rounded">
                          {odc.portCount} ports
                        </span>
                        <span className="px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 rounded">
                          {odc._count?.odps || 0} ODPs
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                          odc.status === 'active'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30'
                        }`}
                      >
                        {odc.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleEdit(odc)}
                          className="p-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(odc)}
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
                <h2 className="text-sm font-semibold">{editingOdc ? 'Edit ODC' : 'Add ODC'}</h2>
                <p className="text-[10px] text-gray-500">Configure Optical Distribution Cabinet</p>
              </div>
              <button
                onClick={() => { setIsDialogOpen(false); setEditingOdc(null); resetForm(); }}
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
                  placeholder="ODC-01"
                  className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium mb-1">OLT *</label>
                  <select
                    value={formData.oltId}
                    onChange={(e) => setFormData({ ...formData, oltId: e.target.value })}
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
                  onClick={() => { setIsDialogOpen(false); setEditingOdc(null); resetForm(); }}
                  className="px-3 py-1.5 text-xs border dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded"
                >
                  {editingOdc ? 'Update' : 'Create'}
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
