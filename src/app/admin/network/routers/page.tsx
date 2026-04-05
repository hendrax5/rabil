'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { showSuccess, showError } from '@/lib/sweetalert';
import { Server, Plus, Loader2, Trash2, Edit2, CheckCircle2, XCircle, Eye, EyeOff, Shield, FileCode, Copy, Check, Search, RefreshCw, MapPin, Radio, X, Navigation, Download } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

// Dynamic import MapPicker
const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false });

interface Router {
  id: string;
  name: string;
  ipAddress: string;
  nasname?: string;
  username: string;
  password: string;
  port: number;
  isActive: boolean;
  secret?: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface RouterStatus {
  online: boolean;
  identity?: string;
  uptime?: string;
}

interface OLT {
  id: string;
  name: string;
  ipAddress: string;
}

interface UplinkConnection {
  id: string;
  oltId: string;
  oltName: string;
  uplinkPort: string | null;
  priority: number;
  isActive: boolean;
}

interface MikrotikInterface {
  name: string;
  type: string;
  running: boolean;
  disabled: boolean;
}

export default function RoutersPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [routers, setRouters] = useState<Router[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, RouterStatus>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRouter, setEditingRouter] = useState<Router | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteRouterId, setDeleteRouterId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [settingUpIsolir, setSettingUpIsolir] = useState<string | null>(null);
  const [showRadiusScriptModal, setShowRadiusScriptModal] = useState(false);
  const [radiusScriptRouter, setRadiusScriptRouter] = useState<Router | null>(null);
  const [radiusServerIp, setRadiusServerIp] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [vpnIpsecPsk, setVpnIpsecPsk] = useState('aibill-secret');
  const [detectingNas, setDetectingNas] = useState<string | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  
  const [scriptAcsEnabled, setScriptAcsEnabled] = useState(false);
  const [scriptPppoeEnabled, setScriptPppoeEnabled] = useState(false);
  const [scriptAcsIface, setScriptAcsIface] = useState('ether2');
  const [scriptPppoeIface, setScriptPppoeIface] = useState('ether2');
  
  // OLT Uplink states
  const [olts, setOlts] = useState<OLT[]>([]);
  const [showUplinkModal, setShowUplinkModal] = useState(false);
  const [uplinkRouter, setUplinkRouter] = useState<Router | null>(null);
  const [routerUplinks, setRouterUplinks] = useState<UplinkConnection[]>([]);
  const [loadingUplinks, setLoadingUplinks] = useState(false);
  const [routerInterfaces, setRouterInterfaces] = useState<MikrotikInterface[]>([]);
  const [loadingInterfaces, setLoadingInterfaces] = useState(false);
  const [uplinkFormData, setUplinkFormData] = useState({
    oltId: '',
    uplinkPort: '',
    priority: 0,
  });

  const [formData, setFormData] = useState({
    name: '',
    ipAddress: '',
    nasIpAddress: '',
    username: '',
    password: '',
    port: 8728,
    secret: 'secret123',
    latitude: '',
    longitude: '',
    autoVpn: false,
  });

  useEffect(() => {
    loadRoutersAndStatus();
    loadOlts();
    loadSystemEnv();
    const interval = setInterval(() => checkRoutersStatus(), 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSystemEnv = async () => {
    try {
      const res = await fetch('/api/system/env');
      if (res.ok) {
        const data = await res.json();
        if (data && data.VPN_IPSEC_PSK) {
          setVpnIpsecPsk(data.VPN_IPSEC_PSK);
        }
      }
    } catch (err) {
      console.error('Failed to load system env', err);
    }
  };

  const loadOlts = async () => {
    try {
      const res = await fetch('/api/network/olts');
      if (res.ok) {
        const data = await res.json();
        setOlts(data.olts || data);
      }
    } catch (error) {
      console.error('Load OLTs error:', error);
    }
  };

  const loadRoutersAndStatus = async () => {
    try {
      const response = await fetch('/api/network/routers');
      const data = await response.json();
      const loadedRouters = data.routers || [];
      setRouters(loadedRouters);
      setLoading(false);
      if (data.radiusServerIp) setRadiusServerIp(data.radiusServerIp);
      if (loadedRouters.length > 0) {
        const routerIds = loadedRouters.map((r: Router) => r.id);
        const statusResponse = await fetch('/api/network/routers/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ routerIds }),
        });
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          setStatusMap(statusData.statusMap || {});
        }
      }
    } catch (error) {
      console.error('Load routers error:', error);
      setLoading(false);
    }
  };

  const checkRoutersStatus = async () => {
    if (routers.length === 0) return;
    try {
      const routerIds = routers.map((r) => r.id);
      const response = await fetch('/api/network/routers/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routerIds }),
      });
      if (response.ok) {
        const data = await response.json();
        setStatusMap(data.statusMap || {});
      }
    } catch (error) {
      console.error('Check status error:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const method = editingRouter ? 'PUT' : 'POST';
      const response = await fetch('/api/network/routers', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRouter ? { id: editingRouter.id, ...formData } : formData),
      });
      if (response.ok) {
        const data = await response.json();
        setIsDialogOpen(false);
        setEditingRouter(null);
        resetForm();
        if (!editingRouter && data.identity) {
          await showSuccess(`Router added!\nIdentity: ${data.identity}`);
        } else {
          await showSuccess('Router updated!');
        }
        loadRoutersAndStatus();
      } else {
        const error = await response.json();
        await showError('Failed: ' + error.error);
      }
    } catch (error) {
      await showError('Failed to save router');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (router: Router) => {
    setEditingRouter(router);
    setFormData({
      name: router.name,
      ipAddress: router.ipAddress,
      nasIpAddress: router.nasname || '',
      username: router.username,
      password: router.password,
      port: router.port,
      secret: router.secret || 'secret123',
      latitude: router.latitude?.toString() || '',
      longitude: router.longitude?.toString() || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteRouterId) return;
    try {
      const response = await fetch(`/api/network/routers?id=${deleteRouterId}`, { method: 'DELETE' });
      if (response.ok) {
        await showSuccess('Router deleted!');
        loadRoutersAndStatus();
      } else {
        const error = await response.json();
        await showError(error.error || 'Failed');
      }
    } catch (error) {
      await showError('Failed to delete');
    } finally {
      setDeleteRouterId(null);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', ipAddress: '', nasIpAddress: '', username: '', password: '', port: 8728, secret: 'secret123', latitude: '', longitude: '', autoVpn: false });
  };

  // Load uplinks for a router
  const loadRouterUplinks = async (routerId: string) => {
    setLoadingUplinks(true);
    try {
      const res = await fetch(`/api/network/routers/${routerId}/uplinks`);
      if (res.ok) {
        const data = await res.json();
        setRouterUplinks(data.connections || []);
      }
    } catch (error) {
      console.error('Load uplinks error:', error);
    } finally {
      setLoadingUplinks(false);
    }
  };

  // Load interfaces from Mikrotik
  const loadRouterInterfaces = async (routerId: string) => {
    setLoadingInterfaces(true);
    try {
      const res = await fetch(`/api/network/routers/${routerId}/interfaces`);
      if (res.ok) {
        const data = await res.json();
        setRouterInterfaces(data.interfaces || []);
      }
    } catch (error) {
      console.error('Load interfaces error:', error);
      setRouterInterfaces([]);
    } finally {
      setLoadingInterfaces(false);
    }
  };

  // Open uplink modal
  const handleOpenUplinkModal = async (router: Router) => {
    setUplinkRouter(router);
    setShowUplinkModal(true);
    setUplinkFormData({ oltId: '', uplinkPort: '', priority: 0 });
    setRouterInterfaces([]);
    await Promise.all([
      loadRouterUplinks(router.id),
      loadRouterInterfaces(router.id)
    ]);
  };

  // Add uplink
  const handleAddUplink = async () => {
    if (!uplinkRouter || !uplinkFormData.oltId) return;
    try {
      const res = await fetch(`/api/network/routers/${uplinkRouter.id}/uplinks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uplinkFormData),
      });
      if (res.ok) {
        await showSuccess('Uplink added!');
        setUplinkFormData({ oltId: '', uplinkPort: '', priority: 0 });
        await loadRouterUplinks(uplinkRouter.id);
      } else {
        const error = await res.json();
        await showError(error.error || 'Failed to add uplink');
      }
    } catch (error) {
      await showError('Failed to add uplink');
    }
  };

  // Delete uplink
  const handleDeleteUplink = async (connectionId: string) => {
    if (!uplinkRouter) return;
    try {
      const res = await fetch(`/api/network/routers/${uplinkRouter.id}/uplinks?connectionId=${connectionId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await showSuccess('Uplink removed!');
        await loadRouterUplinks(uplinkRouter.id);
      } else {
        const error = await res.json();
        await showError(error.error || 'Failed');
      }
    } catch (error) {
      await showError('Failed to delete uplink');
    }
  };

  const handleDetectNasIp = async (router: Router) => {
    setDetectingNas(router.id);
    try {
      const response = await fetch(`/api/network/routers/${router.id}/detect-public-ip`, { method: 'POST' });
      const data = await response.json();
      if (data.success && data.publicIp) {
        const Swal = (await import('sweetalert2')).default;
        const result = await Swal.fire({
          title: 'Public IP Detected',
          html: `<p><strong>IP:</strong> ${data.publicIp}</p><p class="text-sm text-gray-500">Update NAS IP?</p>`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Update',
          cancelButtonText: 'Cancel',
        });
        if (result.isConfirmed) {
          const updateRes = await fetch('/api/network/routers', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: router.id, nasIpAddress: data.publicIp }),
          });
          if (updateRes.ok) {
            await showSuccess(`NAS IP updated: ${data.publicIp}`);
            loadRoutersAndStatus();
          } else {
            const err = await updateRes.json();
            await showError(err.error || 'Failed');
          }
        }
      } else {
        await showError(data.error || 'Could not detect');
      }
    } catch (error) {
      await showError('Failed to detect');
    } finally {
      setDetectingNas(null);
    }
  };

  const handleShowRadiusScript = async (router: Router) => {
    setRadiusScriptRouter(router);
    setShowRadiusScriptModal(true);
  };

  const generateRadiusScript = () => {
    if (!radiusScriptRouter) return '';
    
    // Check if router uses 172.26.0.X subnet (L2TP Auto-Provisioned)
    const isAutoVpn = radiusScriptRouter.ipAddress?.startsWith('172.26.0.');
    const radiusServer = isAutoVpn ? '172.26.0.1' : (radiusScriptRouter.secret ? radiusServerIp : 'YOUR_RADIUS_SERVER_IP');
    const radiusSecret = radiusScriptRouter.secret || 'secret123';
    
    const vpnUser = radiusScriptRouter.username;
    const vpnPass = radiusScriptRouter.password;
    const serverHostname = typeof window !== 'undefined' ? window.location.hostname : 'IP_SERVER_AIBILL';
    // Use the state loaded from backend API
    const vpnIpsecSecret = vpnIpsecPsk;

    const generateAcsConfig = () => {
       if (!scriptAcsEnabled) return '';
       
       const routerIndex = routers.findIndex(r => r.id === radiusScriptRouter.id);
       // Base VLAN = 100
       const vlanNum = 100 + Math.max(0, routerIndex);
       const vlanId = vlanNum.toString();
       const iface = scriptAcsIface || 'ether2';
       
       // Deterministic Subnet Allocation
       // Network: 10.X.0.0/21 where X is vlanNum. This covers 10.X.0.0 to 10.X.7.255
       const scriptAcsGateway = `10.${vlanNum}.0.1/21`;
       const network = `10.${vlanNum}.0.0/21`;
       const pool = `10.${vlanNum}.0.10-10.${vlanNum}.7.254`;
       const gwIp = `10.${vlanNum}.0.1`;
       
       return `\n\n# ==========================================
# 6. Setup AIBILL GenieACS (TR-069 Management)
# ==========================================
/interface vlan remove [find name="vlan-acs-${vlanId}"]
/interface vlan add name="vlan-acs-${vlanId}" vlan-id=${vlanId} interface="${iface}" comment="VLAN Management ACS"
/ip address remove [find interface="vlan-acs-${vlanId}"]
/ip address add address=${scriptAcsGateway} interface="vlan-acs-${vlanId}" comment="IP Gateway ACS"
/ip pool remove [find name="pool-acs-${vlanId}"]
/ip pool add name="pool-acs-${vlanId}" ranges=${pool}
/ip dhcp-server remove [find name="dhcp-acs-${vlanId}"]
/ip dhcp-server add name="dhcp-acs-${vlanId}" interface="vlan-acs-${vlanId}" address-pool="pool-acs-${vlanId}" disabled=no comment="DHCP Server ACS"
/ip dhcp-server network remove [find gateway="${gwIp}"]
/ip dhcp-server network add address=${network} gateway=${gwIp} dns-server=8.8.8.8 comment="DHCP Network ACS"
/ip firewall nat remove [find comment="NAT ACS ${vlanId}"]
/ip firewall nat add action=masquerade chain=srcnat src-address=${network} out-interface="${isAutoVpn ? 'VPN-AIBILL' : 'ether1'}" comment="NAT ACS ${vlanId}"`;
    };

    const generatePppoeConfig = () => {
       if (!scriptPppoeEnabled) return '';
       
       const routerIndex = routers.findIndex(r => r.id === radiusScriptRouter.id);
       // Base VLAN for PPPoE = 200
       const vlanNum = 200 + Math.max(0, routerIndex);
       const vlanId = vlanNum.toString();
       const iface = scriptPppoeIface || 'ether2';
       
       // Deterministic Subnet Allocation for PPPoE
       // Network: 10.X.0.0/21 where X is vlanNum. Covers 10.X.0.0 to 10.X.7.255
       const network = `10.${vlanNum}.0.0/21`;
       const pool = `10.${vlanNum}.0.10-10.${vlanNum}.7.254`;
       const gwIp = `10.${vlanNum}.0.1`;
       
       return `\n\n# ==========================================
# 7. Setup VLAN & IP Pool untuk PPPoE Client
# ==========================================
/interface vlan remove [find name="vlan-pppoe-${vlanId}"]
/interface vlan add name="vlan-pppoe-${vlanId}" vlan-id=${vlanId} interface="${iface}" comment="VLAN PPPoE NAS"
/ip pool remove [find name="pool-pppoe-${vlanId}"]
/ip pool add name="pool-pppoe-${vlanId}" ranges=${pool}
/ppp profile remove [find name="profile-pppoe-${vlanId}"]
/ppp profile add name="profile-pppoe-${vlanId}" local-address=${gwIp} remote-address="pool-pppoe-${vlanId}" dns-server=8.8.8.8 use-radius=yes comment="Profile PPPoE NAS"
/interface pppoe-server server remove [find service-name="pppoe-server-${vlanId}"]
/interface pppoe-server server add service-name="pppoe-server-${vlanId}" interface="vlan-pppoe-${vlanId}" default-profile="profile-pppoe-${vlanId}" disabled=no
/ip firewall nat remove [find comment="NAT PPPoE ${vlanId}"]
/ip firewall nat add action=masquerade chain=srcnat src-address=${network} out-interface="${isAutoVpn ? 'VPN-AIBILL' : 'ether1'}" comment="NAT PPPoE ${vlanId}"
/ip address remove [find interface="vlan-pppoe-${vlanId}"]
/ip address add address=${gwIp}/21 interface="vlan-pppoe-${vlanId}" comment="IP Gateway PPPoE"`;
    };

    let script = '';

    if (isAutoVpn) {
      script = `# 1. Aktifkan Layanan API (Dibutuhkan AIBILL Dashboard)
/ip service set api disabled=no

# 2. Setup Koneksi VPN L2TP (AIBILL Cloud)
/interface l2tp-client remove [find name="VPN-AIBILL"]
/interface l2tp-client add connect-to=${serverHostname} disabled=no name="VPN-AIBILL" password="${vpnPass}" profile=default-encryption use-ipsec=yes ipsec-secret="${vpnIpsecSecret}" user="${vpnUser}"
/ip route remove [find comment="AIBILL Docker Subnet Routing"]
/ip route add dst-address=10.88.0.0/21 gateway="VPN-AIBILL" comment="AIBILL Docker Subnet Routing"

# 3. Bypass Firewall Mikrotik agar AIBILL bisa akses API (Cegah Timeout)
/ip firewall filter remove [find comment="AIBILL API & Ping"]
/ip firewall filter add action=accept chain=input in-interface="VPN-AIBILL" place-before=0 comment="AIBILL API & Ping"

# 4. Buat User API Akses AIBILL
/user remove [find name="${vpnUser}"]
/user add name="${vpnUser}" group=full password="${vpnPass}" comment="User API AIBILL"

# 5. Setup AIBILL RADIUS - ${radiusScriptRouter.name}
/radius remove [find comment="AIBILL RADIUS"]
/radius add address=${radiusServer} secret="${radiusSecret}" authentication-port=1812 accounting-port=1813 timeout=3000ms service=ppp,hotspot,login comment="AIBILL RADIUS"
/ip hotspot profile set use-radius=yes radius-accounting=yes radius-interim-update=00:05:00 [find name!=""]
/ppp aaa set use-radius=yes accounting=yes interim-update=00:05:00
/radius incoming set accept=yes port=3799`;
    } else {
      script = `# 1. Aktifkan Layanan API (Dibutuhkan AIBILL Dashboard)
/ip service set api disabled=no

# 2. (OPSIONAL) Setup L2TP VPN - Gunakan Jika Router berada di balik NAT
# /interface l2tp-client add connect-to=${serverHostname} disabled=no name=VPN-AIBILL password=admin123 profile=default-encryption use-ipsec=yes ipsec-secret=${vpnIpsecSecret} user=admin
# /ip route add dst-address=10.88.0.0/21 gateway=VPN-AIBILL comment="AIBILL Docker Subnet Routing"

# 3. Setup AIBILL RADIUS - ${radiusScriptRouter.name}
# Jika menggunakan VPN di atas, ganti parameter 'address=' dengan IP Gateway VPN AIBILL (misal: 172.26.0.1)
/radius add address=${radiusServer} secret=${radiusSecret} authentication-port=1812 accounting-port=1813 timeout=3000ms service=ppp,hotspot,login comment="AIBILL RADIUS"
/ip hotspot profile set use-radius=yes radius-accounting=yes radius-interim-update=00:05:00 [find name!=""]
/ppp aaa set use-radius=yes accounting=yes interim-update=00:05:00
/radius incoming set accept=yes port=3799`;
    }

    return script + generateAcsConfig() + generatePppoeConfig();
  };

  const copyRadiusScript = async () => {
    const script = generateRadiusScript();
    try {
      // Try modern clipboard API first (requires HTTPS)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(script);
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 2000);
      } else {
        // Fallback for HTTP - use textarea method
        const textArea = document.createElement('textarea');
        textArea.value = script;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (success) {
          setCopiedScript(true);
          setTimeout(() => setCopiedScript(false), 2000);
        } else {
          throw new Error('execCommand failed');
        }
      }
    } catch (error) {
      // Last resort - show prompt to manually copy
      prompt('Copy script ini:', script);
    }
  };

  const downloadRadiusScript = () => {
    const script = generateRadiusScript();
    const routerName = radiusScriptRouter?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'router';
    const blob = new Blob([script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AIBILL_${routerName}_setup.rsc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSetupIsolir = async (routerId: string) => {
    setSettingUpIsolir(routerId);
    try {
      const res = await fetch(`/api/network/routers/${routerId}/setup-isolir`, { method: 'POST' });
      const result = await res.json();
      if (res.ok) {
        await showSuccess(`${result.message}`);
      } else {
        await showError(`Error: ${result.error}`);
      }
    } catch (error) {
      await showError('Failed to setup isolir');
    } finally {
      setSettingUpIsolir(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  const onlineCount = Object.values(statusMap).filter((s) => s.online).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            {t('nav.routers')}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('network.title')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadRoutersAndStatus} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setEditingRouter(null); resetForm(); setIsDialogOpen(true); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-white rounded-md hover:bg-primary/90">
            <Plus className="w-3.5 h-3.5" />
            {t('network.addRouter')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium text-gray-500 uppercase">{t('common.total')}</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{routers.length}</div>
            </div>
            <Server className="w-4 h-4 text-blue-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium text-green-600 uppercase">{t('network.online')}</div>
              <div className="text-lg font-bold text-green-600">{onlineCount}</div>
            </div>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium text-red-600 uppercase">{t('network.offline')}</div>
              <div className="text-lg font-bold text-red-600">{routers.length - onlineCount}</div>
            </div>
            <XCircle className="w-4 h-4 text-red-600" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('nav.router')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('network.ipAddress')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden sm:table-cell">{t('auth.username')}/{t('auth.password')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('common.status')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden md:table-cell">{t('system.uptime')}</th>
                <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {routers.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500 text-xs">{t('table.noResults')}</td></tr>
              ) : (
                routers.map((router) => {
                  const status = statusMap[router.id];
                  return (
                    <tr key={router.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-3 py-2">
                        <div className="font-medium text-xs text-gray-900 dark:text-white">{router.name}</div>
                        {status?.identity && <div className="text-[10px] text-gray-500">{status.identity}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-mono text-[10px] text-gray-900 dark:text-white">API: {router.ipAddress}</div>
                        <div className="font-mono text-[9px] text-gray-500">NAS: {router.nasname || router.ipAddress}</div>
                        <div className="text-[9px] text-gray-400">Port: {router.port}</div>
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell">
                        <div className="text-[10px] text-gray-500">User: {router.username}</div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-mono text-gray-500">
                            {showPassword[router.id] ? router.password : '••••••••'}
                          </span>
                          <button onClick={() => setShowPassword((prev) => ({ ...prev, [router.id]: !prev[router.id] }))} className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                            {showPassword[router.id] ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {status ? (
                          status.online ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">🟢 {t('network.online')}</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">🔴 {t('network.offline')}</span>
                          )
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">⚪ {t('network.checking')}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-gray-600 hidden md:table-cell">{status?.uptime || '-'}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-0.5 flex-wrap">
                          <button onClick={() => handleOpenUplinkModal(router)} className="p-1 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded" title="OLT Uplinks">
                            <Radio className="w-3 h-3" />
                          </button>
                          <button onClick={() => handleDetectNasIp(router)} disabled={detectingNas === router.id} className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded disabled:opacity-50" title="Detect NAS">
                            {detectingNas === router.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                          </button>
                          <button onClick={() => handleShowRadiusScript(router)} className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" title="RADIUS Script">
                            <FileCode className="w-3 h-3" />
                          </button>
                          <button onClick={() => handleSetupIsolir(router.id)} disabled={settingUpIsolir === router.id} className="p-1 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded disabled:opacity-50" title="Setup Isolir">
                            <Shield className="w-3 h-3" />
                          </button>
                          <button onClick={() => handleEdit(router)} className="p-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Edit">
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button onClick={() => setDeleteRouterId(router.id)} className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="Delete">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{editingRouter ? t('common.edit') + ' ' + t('nav.router') : t('network.addRouter')}</h2>
              <p className="text-[10px] text-gray-500">{t('network.configureMikrotik')}</p>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              {!editingRouter && (
                <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-800">
                  <input 
                    type="checkbox" 
                    id="autoVpn" 
                    checked={formData.autoVpn} 
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setFormData({
                        ...formData, 
                        autoVpn: isChecked,
                        username: isChecked && !formData.username ? `router_${Math.random().toString(36).substring(2, 6)}` : formData.username,
                        password: isChecked && !formData.password ? Math.random().toString(36).substring(2, 10) : formData.password,
                        secret: isChecked && formData.secret === 'secret123' ? Math.random().toString(36).substring(2, 12) : formData.secret
                      });
                    }}
                    className="w-4 h-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500"
                  />
                  <label htmlFor="autoVpn" className="text-[11px] font-semibold text-indigo-900 dark:text-indigo-200 cursor-pointer">
                    Auto-Provision VPN L2TP (Direkomendasikan)
                  </label>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.name')} *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs" placeholder={t('network.mainRouter')} />
              </div>
              
              {!formData.autoVpn && (
                <>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">API IP *</label>
                    <input type="text" value={formData.ipAddress} onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })} required={!formData.autoVpn} className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs" placeholder="10.8.0.2" />
                    <p className="text-[9px] text-gray-400 mt-0.5">{t('network.apiIpDescription')}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">NAS IP</label>
                    <input type="text" value={formData.nasIpAddress} onChange={(e) => setFormData({ ...formData, nasIpAddress: e.target.value })} className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs" placeholder={t('network.nasIpPlaceholder')} />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                {!formData.autoVpn && (
                  <div>
                    <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('network.apiPort')}</label>
                    <input type="number" value={formData.port} onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })} className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs" />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">RADIUS Secret *</label>
                  <input type="text" value={formData.secret} onChange={(e) => setFormData({ ...formData, secret: e.target.value })} required className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('auth.username')} {formData.autoVpn && <span className="text-indigo-600 font-bold">(Auto-VPN User)</span>} *
                </label>
                <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} required className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs" placeholder="admin" />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('auth.password')} {formData.autoVpn && <span className="text-indigo-600 font-bold">(Auto-VPN Pass)</span>} *
                </label>
                <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs" />
              </div>
              
              {/* GPS Coordinates */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-2">
                <label className="flex items-center gap-1.5 text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <MapPin className="w-3 h-3" />
                  GPS Koordinat (untuk Network Map)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input type="text" value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs" placeholder="Latitude (e.g. -6.9175)" />
                  </div>
                  <div>
                    <input type="text" value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs" placeholder="Longitude (e.g. 107.6191)" />
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button 
                    type="button"
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (position) => {
                            setFormData({ 
                              ...formData, 
                              latitude: position.coords.latitude.toFixed(6), 
                              longitude: position.coords.longitude.toFixed(6) 
                            });
                          },
                          (error) => {
                            console.error('Geolocation error:', error);
                            showError('Gagal mendapatkan lokasi. Auto GPS hanya bisa digunakan via HTTPS. Gunakan "Pilih di Peta" untuk memilih lokasi manual.');
                          },
                          { enableHighAccuracy: true, timeout: 10000 }
                        );
                      } else {
                        showError('Browser tidak mendukung Geolocation');
                      }
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-green-600 border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 rounded-md hover:bg-green-100 dark:hover:bg-green-900/40"
                  >
                    <Navigation className="w-3 h-3" />
                    Auto GPS
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-indigo-600 border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                  >
                    <MapPin className="w-3 h-3" />
                    Pilih di Peta
                  </button>
                </div>
                <p className="text-[9px] text-gray-400 mt-1">Opsional - untuk menampilkan router di Network Map</p>
              </div>
              
              {/* Map Picker - Component sudah punya modal sendiri */}
              <MapPicker
                isOpen={showMapPicker}
                onClose={() => setShowMapPicker(false)}
                onSelect={(lat: number, lng: number) => {
                  setFormData({ ...formData, latitude: lat.toFixed(6), longitude: lng.toFixed(6) });
                  setShowMapPicker(false);
                }}
                initialLat={formData.latitude ? parseFloat(formData.latitude) : undefined}
                initialLng={formData.longitude ? parseFloat(formData.longitude) : undefined}
              />
              
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
                <button type="button" onClick={() => { setIsDialogOpen(false); setEditingRouter(null); }} className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50">{t('common.cancel')}</button>
                <button type="submit" disabled={saving} className="px-3 py-1.5 text-xs bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : editingRouter ? t('common.update') : t('common.add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Uplink to OLT Modal */}
      {showUplinkModal && uplinkRouter && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Radio className="w-4 h-4" />
                OLT Uplink - {uplinkRouter.name}
              </h2>
              <p className="text-[10px] text-gray-500">Konfigurasi koneksi router ke OLT untuk Network Map</p>
            </div>
            <div className="p-4 space-y-3">
              {/* Current Uplinks */}
              <div className="space-y-2">
                <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300">Uplink Aktif:</label>
                {loadingUplinks ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  </div>
                ) : routerUplinks.length === 0 ? (
                  <p className="text-[10px] text-gray-400 italic py-2">Belum ada uplink terkonfigurasi</p>
                ) : (
                  <div className="space-y-1.5">
                    {routerUplinks.map((uplink) => (
                      <div key={uplink.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">
                        <div>
                          <p className="text-xs font-medium text-gray-800 dark:text-white">{uplink.oltName}</p>
                          <p className="text-[10px] text-gray-500">
                            Port: {uplink.uplinkPort || 'Auto'} • Priority: {uplink.priority}
                          </p>
                        </div>
                        <button onClick={() => handleDeleteUplink(uplink.id)} className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Add New Uplink */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-2 block">Tambah Uplink:</label>
                <div className="space-y-2">
                  {olts.length === 0 ? (
                    <p className="text-[10px] text-amber-600">⚠️ Belum ada OLT terdaftar. Tambahkan OLT terlebih dahulu di menu Network → OLT.</p>
                  ) : olts.filter(olt => !routerUplinks.some(u => u.oltId === olt.id)).length === 0 ? (
                    <p className="text-[10px] text-green-600">✓ Semua OLT ({olts.length}) sudah terhubung ke router ini.</p>
                  ) : (
                    <>
                      <select 
                        value={uplinkFormData.oltId} 
                        onChange={(e) => setUplinkFormData({ ...uplinkFormData, oltId: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
                      >
                        <option value="">Pilih OLT... ({olts.filter(olt => !routerUplinks.some(u => u.oltId === olt.id)).length} tersedia)</option>
                        {olts.filter(olt => !routerUplinks.some(u => u.oltId === olt.id)).map((olt) => (
                          <option key={olt.id} value={olt.id}>{olt.name} ({olt.ipAddress})</option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <select 
                            value={uplinkFormData.uplinkPort} 
                            onChange={(e) => setUplinkFormData({ ...uplinkFormData, uplinkPort: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
                            disabled={loadingInterfaces}
                          >
                            <option value="">Port uplink...</option>
                            {routerInterfaces.map((iface) => (
                              <option key={iface.name} value={iface.name}>
                                {iface.name} {iface.running ? '✓' : ''} {iface.disabled ? '(off)' : ''}
                              </option>
                            ))}
                          </select>
                          {loadingInterfaces && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                            </div>
                          )}
                        </div>
                        <input 
                          type="number" 
                          value={uplinkFormData.priority} 
                          onChange={(e) => setUplinkFormData({ ...uplinkFormData, priority: parseInt(e.target.value) || 0 })}
                          className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs" 
                          placeholder="Priority (0=primary)" 
                        />
                      </div>
                      {routerInterfaces.length === 0 && !loadingInterfaces && (
                        <p className="text-[9px] text-amber-600">⚠️ Interface tidak dapat dimuat. Pastikan router online.</p>
                      )}
                      <button 
                        onClick={handleAddUplink}
                        disabled={!uplinkFormData.oltId}
                        className="w-full px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-3 h-3 inline mr-1" />
                        Tambah Uplink
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
              <button onClick={() => setShowUplinkModal(false)} className="w-full px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RADIUS Script Modal */}
      {showRadiusScriptModal && radiusScriptRouter && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('network.radiusSetupScript')}</h2>
                <p className="text-[10px] text-gray-500">{radiusScriptRouter.name}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={downloadRadiusScript} className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                  <Download className="w-3 h-3" /> Download .rsc
                </button>
                <button onClick={copyRadiusScript} className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-primary text-white rounded-md hover:bg-primary/90">
                  {copiedScript ? <><Check className="w-3 h-3" /> {t('common.copied')}</> : <><Copy className="w-3 h-3" /> {t('common.copy')}</>}
                </button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {/* Router & RADIUS Info */}
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('nav.router')}</p>
                    <p className="font-medium text-gray-900 dark:text-white">{radiusScriptRouter.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">RADIUS Server IP</p>
                    <p className="font-medium font-mono text-gray-900 dark:text-white">{radiusServerIp || t('network.notConfigured')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">RADIUS Secret</p>
                    <p className="font-medium font-mono text-gray-900 dark:text-white">{radiusScriptRouter.secret || 'secret123'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">RADIUS {t('common.status')}</p>
                    {radiusServerIp && radiusScriptRouter.secret ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle2 className="w-3 h-3" /> {t('network.ready')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                        <XCircle className="w-3 h-3" /> {t('network.incomplete')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* ACS Config Form (Option A: Fully Automatic) */}
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                   <h3 className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                     <Radio className="w-3.5 h-3.5 text-indigo-500" />
                     Sertakan Konfigurasi TR-069 GenieACS <span className="text-amber-500 text-[10px] ml-1 font-normal">(Opsional)</span>
                   </h3>
                   <label className="flex items-center cursor-pointer">
                      <input type="checkbox" checked={scriptAcsEnabled} onChange={e => setScriptAcsEnabled(e.target.checked)} className="sr-only peer" />
                      <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-500 relative"></div>
                   </label>
                </div>
                {scriptAcsEnabled && (
                  <div className="mt-3 p-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded text-xs text-indigo-800 dark:text-indigo-300 space-y-1">
                     <p>✅ <b>Sistem Auto-Kalkulasi (Opsi A) Aktif:</b> AIBILL secara otomatis mengalokasikan parameter berikut untuk NAS ini (No. {routers.findIndex(r => r.id === radiusScriptRouter?.id) + 1}):</p>
                     <ul className="list-disc list-inside ml-2">
                        <li><b>VLAN ID:</b> {100 + Math.max(0, routers.findIndex(r => r.id === radiusScriptRouter?.id))}</li>
                        <li><b>Manajemen Subnet (Gateway):</b> 10.{100 + Math.max(0, routers.findIndex(r => r.id === radiusScriptRouter?.id))}.0.1/21</li>
                     </ul>
                     <div className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">
                       <label className="block mb-1">Pilih Port arah OLT <span className="text-red-500">*</span></label>
                       <input type="text" value={scriptAcsIface} onChange={e => setScriptAcsIface(e.target.value)} placeholder="Misal: ether2, sfp1" className="w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-indigo-500" />
                     </div>
                  </div>
                )}
              </div>

              {/* PPPoE Config Form */}
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                   <h3 className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                     <Radio className="w-3.5 h-3.5 text-blue-500" />
                     Sertakan Konfigurasi VLAN PPPoE <span className="text-amber-500 text-[10px] ml-1 font-normal">(Opsional)</span>
                   </h3>
                   <label className="flex items-center cursor-pointer">
                      <input type="checkbox" checked={scriptPppoeEnabled} onChange={e => setScriptPppoeEnabled(e.target.checked)} className="sr-only peer" />
                      <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-gray-600 peer-checked:bg-blue-500 relative"></div>
                   </label>
                </div>
                {scriptPppoeEnabled && (
                  <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded text-xs text-blue-800 dark:text-blue-300 space-y-1">
                     <p>✅ <b>Sistem Auto-Kalkulasi (Opsi A) Aktif:</b> AIBILL secara otomatis mengalokasikan parameter berikut untuk PPPoE NAS ini (No. {routers.findIndex(r => r.id === radiusScriptRouter?.id) + 1}):</p>
                     <ul className="list-disc list-inside ml-2">
                        <li><b>VLAN ID:</b> {200 + Math.max(0, routers.findIndex(r => r.id === radiusScriptRouter?.id))}</li>
                        <li><b>IP Pool PPPoE:</b> 10.{200 + Math.max(0, routers.findIndex(r => r.id === radiusScriptRouter?.id))}.0.10 - 10.{200 + Math.max(0, routers.findIndex(r => r.id === radiusScriptRouter?.id))}.7.254</li>
                     </ul>
                     <div className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">
                       <label className="block mb-1">Pilih Port arah OLT <span className="text-red-500">*</span></label>
                       <input type="text" value={scriptPppoeIface} onChange={e => setScriptPppoeIface(e.target.value)} placeholder="Misal: ether2, sfp1" className="w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500" />
                     </div>
                  </div>
                )}
              </div>
              
              {/* Script */}
              <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-[10px] overflow-x-auto font-mono">{generateRadiusScript()}</pre>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-2.5 rounded-lg">
                <p className="text-[10px] text-blue-700 dark:text-blue-400">
                  📝 {t('network.radiusScriptNote')}
                </p>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
              <button onClick={() => setShowRadiusScriptModal(false)} className="w-full px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteRouterId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-sm w-full p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('common.delete')} {t('nav.router')}</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 mb-4">{t('notifications.confirmDelete')}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteRouterId(null)} className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50">{t('common.cancel')}</button>
              <button onClick={handleDelete} className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
