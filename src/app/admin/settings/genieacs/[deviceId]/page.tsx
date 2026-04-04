'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Server, ArrowLeft, RefreshCw, Loader2, Wifi, WifiOff, Settings, Network, 
  User, Key, Globe, Activity, Thermometer, Clock, Radio, Eye, EyeOff,
  ChevronDown, ChevronRight, RotateCcw, Power
} from 'lucide-react';
import Swal from 'sweetalert2';

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
  ponMode: string;
  uptime: string;
  status: string;
  lastInform: string | null;
  macAddress: string;
  softwareVersion: string;
  hardwareVersion: string;
  ssid: string;
  temp: string;
  userConnected: string;
  tags: string[];
  // Raw parameters for detailed view
  parameters?: Record<string, unknown>;
}

interface TabProps {
  label: string;
  value: string;
  icon: React.ReactNode;
}

export default function DeviceDetailPage({ params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = use(params);
  const router = useRouter();
  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    deviceInfo: true,
    connection: true,
    optical: true,
    wifi: true,
  });

  const tabs: TabProps[] = [
    { label: 'Summary', value: 'summary', icon: <Server className="w-3 h-3" /> },
    { label: 'WAN', value: 'wan', icon: <Globe className="w-3 h-3" /> },
    { label: 'LAN', value: 'lan', icon: <Network className="w-3 h-3" /> },
    { label: 'WLAN', value: 'wlan', icon: <Wifi className="w-3 h-3" /> },
    { label: 'USER', value: 'user', icon: <User className="w-3 h-3" /> },
    { label: 'TR069', value: 'tr069', icon: <Settings className="w-3 h-3" /> },
  ];

  useEffect(() => {
    if (deviceId) fetchDeviceDetail();
  }, [deviceId]);

  const fetchDeviceDetail = async () => {
    try {
      const response = await fetch(`/api/settings/genieacs/devices/${encodeURIComponent(deviceId)}/detail`);
      const data = await response.json();
      if (response.ok && data.device) {
        setDevice(data.device);
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: data.error || 'Device tidak ditemukan' });
      }
    } catch (error) {
      console.error('Error:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Gagal mengambil data device' });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDeviceDetail();
    setRefreshing(false);
  };

  const handleRefreshParameters = async () => {
    const result = await Swal.fire({
      title: 'Refresh Parameters?',
      text: `Execute Refresh Parameters on device ${device?.serialNumber}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Refresh!',
      confirmButtonColor: '#0d9488',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        Swal.fire({ title: 'Refreshing...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const response = await fetch(`/api/settings/genieacs/devices/${encodeURIComponent(deviceId)}/refresh`, { method: 'POST' });
        const data = await response.json();
        if (response.ok && data.success) {
          Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Refresh task terkirim', timer: 2000, showConfirmButton: false });
          setTimeout(() => handleRefresh(), 3000);
        } else {
          throw new Error(data.error || 'Gagal');
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Gagal mengirim refresh';
        Swal.fire({ icon: 'error', title: 'Error', text: msg });
      }
    }
  };

  const handleReboot = async () => {
    const result = await Swal.fire({
      title: 'Reboot Device?',
      text: 'Perangkat akan di-restart',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Reboot',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        const response = await fetch(`/api/settings/genieacs/devices/${encodeURIComponent(deviceId)}/reboot`, { method: 'POST' });
        if (response.ok) {
          Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Perintah reboot terkirim', timer: 2000, showConfirmButton: false });
        }
      } catch {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Gagal mengirim perintah' });
      }
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!device) {
    return (
      <div className="text-center py-8">
        <Server className="w-12 h-12 mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-500">Device tidak ditemukan</p>
        <button onClick={() => router.back()} className="mt-4 px-4 py-2 text-xs text-teal-600 border border-teal-600 rounded-lg">
          Kembali
        </button>
      </div>
    );
  }

  const InfoRow = ({ label, value, highlight = false }: { label: string; value: string | null | undefined; highlight?: boolean }) => (
    <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-[11px] text-gray-500">{label}</span>
      <span className={`text-[11px] font-medium ${highlight ? 'text-teal-600' : 'text-gray-800 dark:text-gray-200'}`}>
        {value || '-'}
      </span>
    </div>
  );

  const SectionHeader = ({ title, section, icon }: { title: string; section: string; icon: React.ReactNode }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg mb-2"
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{title}</span>
      </div>
      {expandedSections[section] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
    </button>
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-lg p-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="p-1 hover:bg-white/10 rounded">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-base font-semibold">Device Detail</h1>
              <p className="text-[11px] text-teal-100">{device.serialNumber} - {device.model}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${device.status === 'Online' ? 'bg-green-500' : 'bg-red-500'}`}>
              {device.status}
            </span>
            <button onClick={handleRefresh} disabled={refreshing} className="p-1.5 hover:bg-white/10 rounded">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleRefreshParameters}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-600 border border-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg"
        >
          <RotateCcw className="w-3 h-3" />
          Refresh Parameters
        </button>
        <button
          onClick={handleReboot}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-600 border border-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg"
        >
          <Power className="w-3 h-3" />
          Reboot
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-800">
          {tabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-1 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.value
                  ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50 dark:bg-teal-900/20'
                  : 'text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-3">
          {activeTab === 'summary' && (
            <div className="space-y-3">
              {/* Device Info Section */}
              <SectionHeader title="Device Information" section="deviceInfo" icon={<Server className="w-3.5 h-3.5 text-blue-600" />} />
              {expandedSections.deviceInfo && (
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <InfoRow label="Serial Number" value={device.serialNumber} />
                  <InfoRow label="Product Class" value={device.model} />
                  <InfoRow label="OUI" value={device.oui} />
                  <InfoRow label="Manufacturer" value={device.manufacturer} />
                  <InfoRow label="Hardware Version" value={device.hardwareVersion} />
                  <InfoRow label="Software Version" value={device.softwareVersion} />
                  <InfoRow label="MAC Address" value={device.macAddress} />
                  <InfoRow label="Last Inform" value={device.lastInform ? new Date(device.lastInform).toLocaleString('id-ID') : '-'} />
                </div>
              )}

              {/* Connection Section */}
              <SectionHeader title="Connection Info" section="connection" icon={<Globe className="w-3.5 h-3.5 text-green-600" />} />
              {expandedSections.connection && (
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <InfoRow label="PPPoE Username" value={device.pppoeUsername} highlight />
                  <InfoRow label="PPPoE IP" value={device.pppoeIP} highlight />
                  <InfoRow label="TR-069 IP" value={device.tr069IP} />
                  <InfoRow label="Uptime" value={device.uptime} />
                  <InfoRow label="Status" value={device.status} />
                </div>
              )}

              {/* Optical Section */}
              <SectionHeader title="Optical Info" section="optical" icon={<Activity className="w-3.5 h-3.5 text-purple-600" />} />
              {expandedSections.optical && (
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <InfoRow label="PON Mode" value={device.ponMode} />
                  <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-[11px] text-gray-500">RX Power</span>
                    <span className={`text-[11px] font-medium ${
                      device.rxPower && device.rxPower !== '-' 
                        ? parseFloat(device.rxPower) > -25 ? 'text-green-600' : parseFloat(device.rxPower) > -28 ? 'text-orange-600' : 'text-red-600'
                        : 'text-gray-800'
                    }`}>
                      {device.rxPower && device.rxPower !== '-' ? `${device.rxPower} dBm` : '-'}
                    </span>
                  </div>
                  <InfoRow label="Temperature" value={device.temp && device.temp !== '-' ? `${device.temp}°C` : '-'} />
                </div>
              )}

              {/* WiFi Section */}
              <SectionHeader title="WiFi Info" section="wifi" icon={<Wifi className="w-3.5 h-3.5 text-cyan-600" />} />
              {expandedSections.wifi && (
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <InfoRow label="SSID" value={device.ssid} />
                  <InfoRow label="Connected Devices" value={device.userConnected} />
                </div>
              )}

              {/* Tags */}
              {device.tags && device.tags.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] text-gray-500 mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {device.tags.map((tag, idx) => (
                      <span key={idx} className="px-2 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'wan' && (
            <div className="text-center py-8 text-gray-500">
              <Globe className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">WAN Configuration</p>
              <p className="text-[10px] mt-1">Coming soon...</p>
            </div>
          )}

          {activeTab === 'lan' && (
            <div className="text-center py-8 text-gray-500">
              <Network className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">LAN Configuration</p>
              <p className="text-[10px] mt-1">Coming soon...</p>
            </div>
          )}

          {activeTab === 'wlan' && (
            <div className="text-center py-8 text-gray-500">
              <Wifi className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">WLAN Configuration</p>
              <p className="text-[10px] mt-1">Coming soon...</p>
            </div>
          )}

          {activeTab === 'user' && (
            <div className="text-center py-8 text-gray-500">
              <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">User Management</p>
              <p className="text-[10px] mt-1">Coming soon...</p>
            </div>
          )}

          {activeTab === 'tr069' && (
            <div className="text-center py-8 text-gray-500">
              <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">TR-069 Settings</p>
              <p className="text-[10px] mt-1">Coming soon...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
