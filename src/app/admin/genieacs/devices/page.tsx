'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Server, RefreshCw, Wifi, WifiOff, Search, Loader2, Power, Trash2, Eye, Settings2, CheckCircle, XCircle, RotateCcw, X, Globe, Network, Activity, Smartphone, Monitor, Radio, Edit, Save, Lock, Signal, Thermometer, Info } from 'lucide-react';
import Swal from 'sweetalert2';

interface GenieACSDevice {
  _id: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  pppoeUsername: string;
  pppoeIP: string;
  tr069IP: string;
  rxPower: string;
  ponMode: string;
  uptime: string;
  status: string;
  lastInform: string | null;
}

interface WLANConfig {
  index: number;
  ssid: string;
  enabled: boolean;
  channel: string;
  standard: string;
  security: string;
  password: string;
  band: string;
  totalAssociations: number;
}

interface ConnectedHost {
  hostName: string;
  ipAddress: string;
  macAddress: string;
  interfaceType: string;
  active: boolean;
  layer2Interface: string;
  ssidIndex: number;
  rssi?: number;
  mode?: string;
  ssidName?: string;
}

interface DeviceDetail {
  _id: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  oui: string;
  pppoeUsername: string;
  pppoeIP: string;
  tr069IP: string;
  rxPower: string;
  txPower: string;
  ponMode: string;
  uptime: string;
  status: string;
  lastInform: string | null;
  macAddress: string;
  softwareVersion: string;
  hardwareVersion: string;
  temp: string;
  voltage: string;
  biasCurrent: string;
  lanIP: string;
  lanSubnet: string;
  dhcpEnabled: string;
  dhcpStart: string;
  dhcpEnd: string;
  dns1: string;
  memoryFree: string;
  memoryTotal: string;
  cpuUsage: string;
  wlanConfigs: WLANConfig[];
  connectedDevices: ConnectedHost[];
  totalConnected: number;
  isDualBand: boolean;
  tags: string[];
}

export default function GenieACSDevicesPage() {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<GenieACSDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);

  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Edit WiFi Modal
  const [showEditWifiModal, setShowEditWifiModal] = useState(false);
  const [editWifiData, setEditWifiData] = useState({
    deviceId: '',
    wlanIndex: 1,
    ssid: '',
    password: '',
    securityMode: 'WPA2-PSK',
    enabled: true
  });
  const [savingWifi, setSavingWifi] = useState(false);

  const fetchDevices = useCallback(async () => {
    try {
      const [devicesRes, settingsRes] = await Promise.all([
        fetch('/api/settings/genieacs/devices'),
        fetch('/api/settings/genieacs')
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setIsConfigured(!!data?.settings?.host);
      }

      if (devicesRes.ok) {
        const data = await devicesRes.json();
        setDevices(data.devices || []);
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDevices();
    setRefreshing(false);
  };

  const handleReboot = async (deviceId: string) => {
    const result = await Swal.fire({
      title: 'Reboot Device?',
      text: 'Perangkat akan di-restart. Koneksi akan terputus sementara.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Reboot',
      confirmButtonColor: '#f97316',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        Swal.fire({ title: 'Sending...', text: 'Mengirim perintah reboot', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const response = await fetch(`/api/settings/genieacs/devices/${encodeURIComponent(deviceId)}/reboot`, { method: 'POST' });
        const data = await response.json();
        if (response.ok && data.success) {
          Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Perintah reboot terkirim', timer: 2000, showConfirmButton: false });
        } else {
          throw new Error(data.error || 'Gagal mengirim perintah');
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Gagal mengirim perintah';
        Swal.fire({ icon: 'error', title: 'Error', text: msg });
      }
    }
  };

  // Force connection request to execute pending tasks
  const handleForceSync = async (deviceId: string) => {
    try {
      Swal.fire({
        title: 'Sync Device...',
        text: 'Mengirim connection request ke device',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });
      
      const response = await fetch(`/api/genieacs/devices/${encodeURIComponent(deviceId)}/connection-request`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Berhasil',
          html: `
            <div class="text-sm">
              <p>Connection request dikirim ke device.</p>
              <p class="text-gray-500 mt-2">Device akan memproses task pending dalam beberapa detik.</p>
            </div>
          `,
          timer: 3000,
          showConfirmButton: false
        });
        // Refresh after a short delay
        setTimeout(() => handleRefresh(), 3000);
      } else {
        throw new Error(data.error || 'Gagal mengirim connection request');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Gagal sync device';
      Swal.fire({ icon: 'error', title: 'Error', text: msg });
    }
  };

  const handleDelete = async (deviceId: string) => {
    const result = await Swal.fire({
      title: 'Hapus Device?',
      text: 'Device akan dihapus dari GenieACS. Data tidak dapat dikembalikan.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      confirmButtonColor: '#dc2626',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        const response = await fetch(`/api/settings/genieacs/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' });
        if (response.ok) {
          setDevices(devices.filter(d => d._id !== deviceId));
          Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Device dihapus', timer: 2000, showConfirmButton: false });
        } else {
          throw new Error('Gagal menghapus device');
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Gagal menghapus device';
        Swal.fire({ icon: 'error', title: 'Error', text: msg });
      }
    }
  };

  const handleRefreshParameters = async (deviceId: string, serialNumber: string) => {
    const result = await Swal.fire({
      title: 'Refresh Parameters?',
      text: `Refresh semua parameter dari device ${serialNumber}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Refresh',
      confirmButtonColor: '#0d9488',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        Swal.fire({ title: 'Refreshing...', text: 'Mengirim task refresh ke device', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const response = await fetch(`/api/settings/genieacs/devices/${encodeURIComponent(deviceId)}/refresh`, { method: 'POST' });
        const data = await response.json();
        if (response.ok && data.success) {
          Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Refresh parameters task terkirim', timer: 2000, showConfirmButton: false });
          setTimeout(() => handleRefresh(), 2000);
        } else {
          throw new Error(data.error || 'Gagal mengirim task');
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Gagal mengirim perintah refresh';
        Swal.fire({ icon: 'error', title: 'Error', text: msg });
      }
    }
  };

  const handleViewDetail = async (deviceId: string) => {
    setLoadingDetail(true);
    setShowDetailModal(true);
    try {
      const response = await fetch(`/api/settings/genieacs/devices/${encodeURIComponent(deviceId)}/detail`);
      const data = await response.json();
      if (response.ok && data.success && data.device) {
        setSelectedDevice(data.device);
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: data.error || 'Gagal mengambil detail device' });
        setShowDetailModal(false);
      }
    } catch (error) {
      console.error('Error fetching device detail:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Gagal mengambil detail device' });
      setShowDetailModal(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedDevice(null);
  };

  // Open Edit WiFi Modal
  const openEditWifiModal = (deviceId: string, wlan?: WLANConfig) => {
    // Normalize security mode - map various formats to our options
    let secMode = wlan?.security || 'WPA2-PSK';
    if (secMode.toLowerCase().includes('none') || secMode.toLowerCase().includes('open') || secMode === '') {
      secMode = 'None';
    } else if (secMode.includes('WPA2') || secMode.includes('11i')) {
      secMode = 'WPA2-PSK';
    } else if (secMode.includes('WPA') && !secMode.includes('WPA2')) {
      secMode = 'WPA-PSK';
    }
    
    setEditWifiData({
      deviceId,
      wlanIndex: wlan?.index || 1,
      ssid: wlan?.ssid || '',
      password: '',  // Always start empty for security
      securityMode: secMode,
      enabled: wlan?.enabled ?? true
    });
    setShowEditWifiModal(true);
  };

  const closeEditWifiModal = () => {
    setShowEditWifiModal(false);
    setEditWifiData({
      deviceId: '',
      wlanIndex: 1,
      ssid: '',
      password: '',
      securityMode: 'WPA2-PSK',
      enabled: true
    });
  };

  // Save WiFi Config
  const handleSaveWifi = async () => {
    // Validation
    if (!editWifiData.ssid || editWifiData.ssid.length < 1 || editWifiData.ssid.length > 32) {
      Swal.fire({ icon: 'warning', title: 'Validasi', text: 'SSID harus 1-32 karakter' });
      return;
    }
    
    // Password only required when NOT using None (Open)
    const isOpenNetwork = editWifiData.securityMode === 'None';
    if (!isOpenNetwork && (!editWifiData.password || editWifiData.password.length < 8 || editWifiData.password.length > 63)) {
      Swal.fire({ icon: 'warning', title: 'Validasi', text: 'Password harus 8-63 karakter' });
      return;
    }

    const result = await Swal.fire({
      title: 'Update WiFi Config?',
      html: `
        <div class="text-left text-sm">
          <p><strong>SSID:</strong> ${editWifiData.ssid}</p>
          <p><strong>Security:</strong> ${editWifiData.securityMode}</p>
          <p><strong>WLAN Index:</strong> ${editWifiData.wlanIndex}</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Update',
      confirmButtonColor: '#0d9488',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      setSavingWifi(true);
      try {
        const response = await fetch(`/api/genieacs/devices/${encodeURIComponent(editWifiData.deviceId)}/wifi`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wlanIndex: editWifiData.wlanIndex,
            ssid: editWifiData.ssid,
            password: editWifiData.password,
            securityMode: editWifiData.securityMode,
            enabled: editWifiData.enabled
          })
        });
        const data = await response.json();
        if (response.ok && data.success) {
          const isExecuted = data.taskStatus && data.taskStatus !== 'pending';
          
          Swal.fire({
            icon: isExecuted ? 'success' : 'info',
            title: isExecuted ? 'Berhasil!' : 'Task Dikirim',
            html: `
              <div class="text-left text-sm space-y-2">
                <p class="text-gray-700">${data.message || 'Konfigurasi WiFi dikirim ke device'}</p>
                ${data.info ? `<p class="${isExecuted ? 'text-green-600' : 'text-blue-600'} text-xs">${data.info}</p>` : ''}
                ${data.taskStatus === 'fault' ? '<p class="text-red-600 text-xs">⚠️ Task gagal dieksekusi, cek halaman Tasks</p>' : ''}
                ${data.taskId ? `<p class="text-gray-400 text-xs font-mono mt-2">Task: ${data.taskId}</p>` : ''}
              </div>
            `,
            showConfirmButton: true,
            confirmButtonText: isExecuted ? 'OK' : 'Lihat Tasks',
            showCancelButton: !isExecuted,
            cancelButtonText: 'Tutup',
            confirmButtonColor: '#0d9488',
            timer: isExecuted ? 3000 : undefined
          }).then((result) => {
            if (result.isConfirmed && !isExecuted) {
              window.location.href = '/admin/genieacs/tasks';
            }
          });
          closeEditWifiModal();
          // Refresh device detail to see changes
          if (selectedDevice) {
            setTimeout(() => handleViewDetail(selectedDevice._id), isExecuted ? 3000 : 5000);
          }
        } else {
          throw new Error(data.error || 'Gagal update WiFi config');
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Gagal update WiFi config';
        Swal.fire({ icon: 'error', title: 'Error', text: msg });
      } finally {
        setSavingWifi(false);
      }
    }
  };

  const InfoRow = ({ label, value, highlight = false }: { label: string; value: string | null | undefined; highlight?: boolean }) => (
    <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-[11px] text-gray-500">{label}</span>
      <span className={`text-[11px] font-medium ${highlight ? 'text-teal-600' : 'text-gray-800 dark:text-gray-200'}`}>
        {value || '-'}
      </span>
    </div>
  );

  const filteredDevices = devices.filter(d =>
    d.serialNumber?.toLowerCase().includes(search.toLowerCase()) ||
    d.manufacturer?.toLowerCase().includes(search.toLowerCase()) ||
    d.model?.toLowerCase().includes(search.toLowerCase()) ||
    d.pppoeUsername?.toLowerCase().includes(search.toLowerCase()) ||
    d.pppoeIP?.toLowerCase().includes(search.toLowerCase()) ||
    d.tr069IP?.toLowerCase().includes(search.toLowerCase())
  );

  const onlineCount = devices.filter(d => d.status === 'Online').length;
  const offlineCount = devices.filter(d => d.status === 'Offline').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-lg p-4 text-white">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5" />
            <div>
              <h1 className="text-lg font-semibold">GenieACS Devices</h1>
              <p className="text-sm text-teal-100">Kelola perangkat CPE via TR-069</p>
            </div>
          </div>
        </div>

        {/* Not Configured */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
            <Info className="w-8 h-8 text-yellow-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">GenieACS Belum Dikonfigurasi</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Silakan konfigurasi koneksi GenieACS terlebih dahulu di halaman Settings.
          </p>
          <a
            href="/admin/settings/genieacs"
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            Buka Pengaturan
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-lg p-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4" />
            <div>
              <h1 className="text-base font-semibold">GenieACS Devices</h1>
              <p className="text-[11px] text-teal-100">Kelola perangkat CPE via TR-069</p>
            </div>
          </div>
          <a 
            href="/admin/settings/genieacs" 
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-white/20 hover:bg-white/30 rounded transition-colors"
          >
            <Settings2 className="w-3 h-3" />
            Settings
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Server className="w-3 h-3 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500">Total</p>
              <p className="text-sm font-semibold">{devices.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30">
              <Wifi className="w-3 h-3 text-green-600" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500">Online</p>
              <p className="text-sm font-semibold text-green-600">{onlineCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30">
              <WifiOff className="w-3 h-3 text-red-600" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500">Offline</p>
              <p className="text-sm font-semibold text-red-600">{offlineCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Devices Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Search & Actions */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari serial, model, IP, PPPoE..."
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <th className="text-left py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">Serial Number</th>
                <th className="text-left py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">Model</th>
                <th className="text-left py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">IP TR069</th>
                <th className="text-left py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">PPPoE</th>
                <th className="text-left py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">PON</th>
                <th className="text-left py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">RX Power</th>
                <th className="text-left py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">Uptime</th>
                <th className="text-center py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">Status</th>
                <th className="text-center py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-gray-500">
                    <Server className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Tidak ada device</p>
                    <p className="text-[10px] text-gray-400 mt-1">Device akan muncul setelah terhubung ke GenieACS</p>
                  </td>
                </tr>
              ) : (
                filteredDevices.map((device) => (
                  <tr key={device._id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-2 px-2">
                      <div>
                        <p className="font-medium text-gray-800 dark:text-gray-200">{device.serialNumber || '-'}</p>
                        <p className="text-[10px] text-gray-500">{device.manufacturer || '-'}</p>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{device.model || '-'}</td>
                    <td className="py-2 px-2 font-mono text-[10px] text-gray-600 dark:text-gray-400 whitespace-nowrap">{device.tr069IP || '-'}</td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      <div>
                        <p className="text-blue-600 dark:text-blue-400">{device.pppoeUsername || '-'}</p>
                        {device.pppoeIP && device.pppoeIP !== '-' && (
                          <p className="text-[10px] text-gray-500">{device.pppoeIP}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      {device.ponMode && device.ponMode !== '-' ? (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 rounded">
                          {device.ponMode}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      {device.rxPower && device.rxPower !== '-' ? (
                        <span className={`font-medium ${parseFloat(device.rxPower) > -25 ? 'text-green-600' : parseFloat(device.rxPower) > -28 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {device.rxPower} dBm
                        </span>
                      ) : '-'}
                    </td>
                    <td className="py-2 px-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{device.uptime || '-'}</td>
                    <td className="py-2 px-2 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${
                        device.status === 'Online' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {device.status}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => handleViewDetail(device._id)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                          title="Detail"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRefreshParameters(device._id, device.serialNumber)}
                          className="p-1.5 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded transition-colors"
                          title="Refresh Parameters"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleReboot(device._id)}
                          className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded transition-colors"
                          title="Reboot"
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(device._id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Device Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden mx-4">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-teal-600 to-cyan-600 p-3 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4" />
                <div>
                  <h2 className="text-sm font-semibold">Device Detail</h2>
                  {selectedDevice && (
                    <p className="text-[10px] text-teal-100">{selectedDevice.serialNumber} - {selectedDevice.model}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedDevice && (
                  <>
                    {selectedDevice.isDualBand && (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-purple-500">
                        Dual Band
                      </span>
                    )}
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${selectedDevice.status === 'Online' ? 'bg-green-500' : 'bg-red-500'}`}>
                      {selectedDevice.status}
                    </span>
                  </>
                )}
                <button onClick={closeDetailModal} className="p-1 hover:bg-white/10 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                </div>
              ) : selectedDevice ? (
                <div className="space-y-4">
                  {/* Quick Actions */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleForceSync(selectedDevice._id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Force Sync
                    </button>
                    <button
                      onClick={() => handleRefreshParameters(selectedDevice._id, selectedDevice.serialNumber)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-600 border border-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Refresh Parameters
                    </button>
                    <button
                      onClick={() => handleReboot(selectedDevice._id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-600 border border-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-colors"
                    >
                      <Power className="w-3 h-3" />
                      Reboot
                    </button>
                    {selectedDevice.wlanConfigs && selectedDevice.wlanConfigs.length > 0 && (
                      <button
                        onClick={() => openEditWifiModal(selectedDevice._id, selectedDevice.wlanConfigs[0])}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
                      >
                        <Edit className="w-3 h-3" />
                        Edit WiFi
                      </button>
                    )}
                  </div>

                  {/* Main Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Device Information */}
                    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <Server className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Device Information</span>
                      </div>
                      <div className="p-3">
                        <InfoRow label="Serial Number" value={selectedDevice.serialNumber} />
                        <InfoRow label="Product Class" value={selectedDevice.model} />
                        <InfoRow label="OUI" value={selectedDevice.oui} />
                        <InfoRow label="Manufacturer" value={selectedDevice.manufacturer} />
                        <InfoRow label="Hardware Version" value={selectedDevice.hardwareVersion} />
                        <InfoRow label="Software Version" value={selectedDevice.softwareVersion} />
                        <InfoRow label="MAC Address" value={selectedDevice.macAddress} />
                      </div>
                    </div>

                    {/* Connection Info */}
                    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <Globe className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Connection Info</span>
                      </div>
                      <div className="p-3">
                        <InfoRow label="PPPoE Username" value={selectedDevice.pppoeUsername} highlight />
                        <InfoRow label="PPPoE IP" value={selectedDevice.pppoeIP} highlight />
                        <InfoRow label="TR-069 IP" value={selectedDevice.tr069IP} />
                        <InfoRow label="Uptime" value={selectedDevice.uptime} />
                        <InfoRow label="Last Inform" value={selectedDevice.lastInform ? new Date(selectedDevice.lastInform).toLocaleString('id-ID') : '-'} />
                        <InfoRow label="DNS" value={selectedDevice.dns1} />
                      </div>
                    </div>

                    {/* Optical Info */}
                    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <Activity className="w-3.5 h-3.5 text-purple-600" />
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Optical Info</span>
                      </div>
                      <div className="p-3">
                        <InfoRow label="PON Mode" value={selectedDevice.ponMode} />
                        <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-[11px] text-gray-500">RX Power</span>
                          <span className={`text-[11px] font-medium ${
                            selectedDevice.rxPower && selectedDevice.rxPower !== '-' 
                              ? parseFloat(selectedDevice.rxPower) > -25 ? 'text-green-600' : parseFloat(selectedDevice.rxPower) > -28 ? 'text-yellow-600' : 'text-red-600'
                              : 'text-gray-800'
                          }`}>
                            {selectedDevice.rxPower && selectedDevice.rxPower !== '-' ? `${selectedDevice.rxPower} dBm` : '-'}
                          </span>
                        </div>
                        <InfoRow label="TX Power" value={selectedDevice.txPower && selectedDevice.txPower !== '-' ? `${selectedDevice.txPower} dBm` : '-'} />
                        <InfoRow label="Temperature" value={selectedDevice.temp && selectedDevice.temp !== '-' ? `${selectedDevice.temp}°C` : '-'} />
                        <InfoRow label="Voltage" value={selectedDevice.voltage && selectedDevice.voltage !== '-' ? `${selectedDevice.voltage} V` : '-'} />
                      </div>
                    </div>

                    {/* LAN Info */}
                    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <Network className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">LAN Info</span>
                      </div>
                      <div className="p-3">
                        <InfoRow label="LAN IP" value={selectedDevice.lanIP} />
                        <InfoRow label="Subnet Mask" value={selectedDevice.lanSubnet} />
                        <InfoRow label="DHCP Enabled" value={selectedDevice.dhcpEnabled === 'true' || selectedDevice.dhcpEnabled === '1' ? 'Yes' : selectedDevice.dhcpEnabled === 'false' || selectedDevice.dhcpEnabled === '0' ? 'No' : '-'} />
                        <InfoRow label="DHCP Range" value={selectedDevice.dhcpStart && selectedDevice.dhcpEnd && selectedDevice.dhcpStart !== '-' ? `${selectedDevice.dhcpStart} - ${selectedDevice.dhcpEnd}` : '-'} />
                      </div>
                    </div>
                  </div>

                  {/* WiFi SSIDs */}
                  {selectedDevice.wlanConfigs && selectedDevice.wlanConfigs.length > 0 && (
                    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                          <Radio className="w-3.5 h-3.5 text-cyan-600" />
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">WiFi Networks ({selectedDevice.wlanConfigs.length})</span>
                        </div>
                        <span className="text-[10px] text-gray-500">{selectedDevice.totalConnected} devices connected</span>
                      </div>
                      <div className="p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {selectedDevice.wlanConfigs.map((wlan, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-lg ${wlan.enabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-200 dark:bg-gray-700'}`}>
                                  <Wifi className={`w-3 h-3 ${wlan.enabled ? 'text-green-600' : 'text-gray-400'}`} />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{wlan.ssid || '-'}</p>
                                  <p className="text-[10px] text-gray-500">
                                    {wlan.band} • Ch {wlan.channel !== '-' ? wlan.channel : 'Auto'} • {wlan.security || 'Open'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-right">
                                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${wlan.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                                    {wlan.enabled ? 'ON' : 'OFF'}
                                  </span>
                                  {wlan.totalAssociations > 0 && (
                                    <p className="text-[10px] text-gray-500 mt-0.5">{wlan.totalAssociations} connected</p>
                                  )}
                                </div>
                                <button
                                  onClick={() => openEditWifiModal(selectedDevice._id, wlan)}
                                  className="p-1 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded transition-colors"
                                  title="Edit WiFi"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Connected Devices */}
                  {selectedDevice.connectedDevices && selectedDevice.connectedDevices.length > 0 && (
                    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Connected Devices ({selectedDevice.connectedDevices.length})</span>
                        </div>
                        <span className="text-[10px] text-gray-500">{selectedDevice.connectedDevices.filter(d => d.active).length} online</span>
                      </div>
                      <div className="p-3">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-gray-500">Device</th>
                                <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-gray-500">IP Address</th>
                                <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-gray-500">MAC Address</th>
                                <th className="text-left py-1.5 px-2 text-[10px] font-semibold text-gray-500">Interface</th>
                                <th className="text-center py-1.5 px-2 text-[10px] font-semibold text-gray-500">Signal</th>
                                <th className="text-center py-1.5 px-2 text-[10px] font-semibold text-gray-500">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedDevice.connectedDevices.map((host, idx) => {
                                const isWifi = host.ssidIndex > 0 || host.ssidName;
                                return (
                                  <tr key={idx} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                                    <td className="py-1.5 px-2">
                                      <div className="flex items-center gap-1.5">
                                        {isWifi ? (
                                          <Wifi className="w-3 h-3 text-cyan-500" />
                                        ) : (
                                          <Monitor className="w-3 h-3 text-blue-500" />
                                        )}
                                        <span className="text-gray-800 dark:text-gray-200">{host.hostName !== '-' ? host.hostName : 'Unknown'}</span>
                                      </div>
                                    </td>
                                    <td className="py-1.5 px-2 text-gray-600 dark:text-gray-400">{host.ipAddress}</td>
                                    <td className="py-1.5 px-2 font-mono text-[10px] text-gray-600 dark:text-gray-400">{host.macAddress}</td>
                                    <td className="py-1.5 px-2 text-gray-600 dark:text-gray-400">
                                      {host.ssidName || (isWifi ? `WiFi ${host.ssidIndex}` : 'LAN')}
                                    </td>
                                    <td className="py-1.5 px-2 text-center">
                                      {host.rssi ? (
                                        <span className={`font-medium ${host.rssi >= -50 ? 'text-green-600' : host.rssi >= -70 ? 'text-yellow-600' : 'text-red-600'}`}>
                                          {host.rssi} dBm
                                        </span>
                                      ) : '-'}
                                    </td>
                                    <td className="py-1.5 px-2 text-center">
                                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${host.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                                        {host.active ? 'Online' : 'Offline'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Server className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Device tidak ditemukan</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex justify-end">
              <button
                onClick={closeDetailModal}
                className="px-4 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit WiFi Modal */}
      {showEditWifiModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md mx-4">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-teal-600 to-cyan-600 p-3 text-white flex items-center justify-between rounded-t-lg">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4" />
                <h2 className="text-sm font-semibold">Edit WiFi Configuration</h2>
              </div>
              <button onClick={closeEditWifiModal} className="p-1 hover:bg-white/10 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-4">
              {/* WLAN Index */}
              <div>
                <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                  WLAN Index
                </label>
                <select
                  value={editWifiData.wlanIndex}
                  onChange={(e) => setEditWifiData({ ...editWifiData, wlanIndex: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500"
                >
                  {selectedDevice?.wlanConfigs?.map((wlan) => (
                    <option key={wlan.index} value={wlan.index}>
                      WLAN {wlan.index} - {wlan.ssid || 'No SSID'} ({wlan.band})
                    </option>
                  )) || (
                    <>
                      <option value={1}>WLAN 1 (2.4GHz)</option>
                      <option value={2}>WLAN 2</option>
                      <option value={3}>WLAN 3</option>
                      <option value={4}>WLAN 4</option>
                      <option value={5}>WLAN 5 (5GHz)</option>
                    </>
                  )}
                </select>
              </div>

              {/* SSID */}
              <div>
                <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                  SSID (Nama WiFi) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editWifiData.ssid}
                  onChange={(e) => setEditWifiData({ ...editWifiData, ssid: e.target.value })}
                  maxLength={32}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500"
                  placeholder="Nama WiFi"
                />
                <p className="text-[10px] text-gray-500 mt-1">1-32 karakter</p>
              </div>

              {/* Security Mode */}
              <div>
                <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Security Mode
                </label>
                <select
                  value={editWifiData.securityMode}
                  onChange={(e) => setEditWifiData({ ...editWifiData, securityMode: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500"
                >
                  <option value="None">None (Open)</option>
                  <option value="WPA-PSK">WPA-PSK</option>
                  <option value="WPA2-PSK">WPA2-PSK</option>
                  <option value="WPA-WPA2-PSK">WPA/WPA2-PSK</option>
                </select>
              </div>

              {/* Password */}
              {editWifiData.securityMode !== 'None' && (
                <div>
                  <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={editWifiData.password}
                      onChange={(e) => setEditWifiData({ ...editWifiData, password: e.target.value })}
                      maxLength={63}
                      className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-teal-500"
                      placeholder="Password WiFi"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">8-63 karakter</p>
                </div>
              )}

              {/* Enable/Disable */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">WiFi Status</p>
                  <p className="text-[10px] text-gray-500">Aktifkan atau nonaktifkan WiFi</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditWifiData({ ...editWifiData, enabled: !editWifiData.enabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    editWifiData.enabled ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      editWifiData.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex justify-end gap-2">
              <button
                onClick={closeEditWifiModal}
                className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Batal
              </button>
              <button
                onClick={handleSaveWifi}
                disabled={savingWifi}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50 transition-colors"
              >
                {savingWifi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
