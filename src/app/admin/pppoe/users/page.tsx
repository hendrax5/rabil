'use client';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { usePermissions } from '@/hooks/usePermissions';
import { useTranslation } from '@/hooks/useTranslation';
import { useState, useEffect } from 'react';
import {
  Plus, Pencil, Trash2, Users, CheckCircle2, MapPin, Map, MoreVertical,
  Shield, ShieldOff, Ban, Download, Upload, Search, Filter, X, Eye, EyeOff, RefreshCcw, Router
} from 'lucide-react';
import MapPicker from '@/components/MapPicker';
import UserDetailModal from '@/components/UserDetailModal';
import { formatWIB, isExpiredWIB as isExpired, endOfDayWIBtoUTC } from '@/lib/timezone';

interface PppoeUser {
  id: string; username: string; name: string; phone: string; email: string | null;
  address: string | null; latitude: number | null; longitude: number | null;
  status: string; ipAddress: string | null; expiredAt: string | null;
  syncedToRadius: boolean; createdAt: string;
  profile: { id: string; name: string; groupName: string };
  router?: { id: string; name: string; nasname: string; ipAddress: string } | null;
  routerId?: string | null;
}

interface Profile { id: string; name: string; groupName: string; price: number; }
interface Router { id: string; name: string; nasname: string; ipAddress: string; }

export default function PppoeUsersPage() {
  const { hasPermission, loading: permLoading } = usePermissions();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<PppoeUser[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [routers, setRouters] = useState<Router[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<PppoeUser | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [modalLatLng, setModalLatLng] = useState<{ lat: string; lng: string } | undefined>();
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProfile, setFilterProfile] = useState('');
  const [filterRouter, setFilterRouter] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProfileId, setImportProfileId] = useState('');
  const [importRouterId, setImportRouterId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Sync from MikroTik states
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [syncRouterId, setSyncRouterId] = useState('');
  const [syncProfileId, setSyncProfileId] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncPreview, setSyncPreview] = useState<any>(null);
  const [syncSelectedUsers, setSyncSelectedUsers] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const [formData, setFormData] = useState({
    username: '', password: '', profileId: '', routerId: '', name: '', phone: '',
    email: '', address: '', latitude: '', longitude: '', ipAddress: '', expiredAt: '',
  });

  // Assign Modem states
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [userToAssign, setUserToAssign] = useState<PppoeUser | null>(null);
  const [assignTab, setAssignTab] = useState<'acs' | 'olt'>('acs');
  
  const [unassignedDevices, setUnassignedDevices] = useState<any[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [assignFormData, setAssignFormData] = useState({
    deviceId: '',
    saveWifi: true,
    wifiSsid: '',
    wifiPassword: '12345678',
    macAddress: ''
  });
  const [assigning, setAssigning] = useState(false);

  // OLT Discovery states
  const [olts, setOlts] = useState<any[]>([]);
  const [selectedOltId, setSelectedOltId] = useState('');
  const [uncfgOnus, setUncfgOnus] = useState<any[]>([]);
  const [loadingUncfg, setLoadingUncfg] = useState(false);
  const [oltAssignData, setOltAssignData] = useState({
    sn: '', board: '', port: '', vlan: '', mode: 'pppoe', onuType: ''
  });
  const [onuTypes, setOnuTypes] = useState<string[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [usersRes, profilesRes, routersRes] = await Promise.all([
        fetch('/api/pppoe/users'), fetch('/api/pppoe/profiles'), fetch('/api/network/routers'),
      ]);
      const [usersData, profilesData, routersData] = await Promise.all([usersRes.json(), profilesRes.json(), routersRes.json()]);
      setUsers(usersData.users || []);
      setProfiles(profilesData.profiles || []);
      setRouters(routersData.routers || []);
    } catch (error) { console.error('Load data error:', error); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingUser ? 'PUT' : 'POST';
      const payload = { ...formData, ...(editingUser && { id: editingUser.id }),
        ...(formData.expiredAt && { expiredAt: endOfDayWIBtoUTC(new Date(formData.expiredAt + 'T23:59:59')).toISOString() }),
      };
      const res = await fetch('/api/pppoe/users', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await res.json();
      if (res.ok) {
        setIsDialogOpen(false); setEditingUser(null); resetForm(); loadData();
        await showSuccess(editingUser ? 'User updated!' : 'User created!');
      } else { await showError('Error: ' + result.error); }
    } catch (error) { console.error('Submit error:', error); await showError('Failed to save'); }
  };

  const handleSaveUser = async (data: any) => {
    try {
      const res = await fetch('/api/pppoe/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const result = await res.json();
      if (res.ok) { loadData(); await showSuccess('User updated!'); }
      else { await showError('Error: ' + result.error); throw new Error(result.error); }
    } catch (error) { console.error('Save user error:', error); await showError('Failed to save'); throw error; }
  };

  const handleEdit = (user: PppoeUser) => {
    setEditingUser(user);
    setFormData({ username: user.username, password: '', profileId: user.profile.id, routerId: user.routerId || '',
      name: user.name, phone: user.phone, email: user.email || '', address: user.address || '',
      latitude: user.latitude?.toString() || '', longitude: user.longitude?.toString() || '',
      ipAddress: user.ipAddress || '', expiredAt: user.expiredAt ? formatWIB(user.expiredAt, 'yyyy-MM-dd') : '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteUserId) return;
    const confirmed = await showConfirm('Delete? This removes user from RADIUS.');
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/pppoe/users?id=${deleteUserId}`, { method: 'DELETE' });
      const result = await res.json();
      if (res.ok) { await showSuccess('Deleted!'); loadData(); }
      else { await showError(result.error || 'Failed'); }
    } catch (error) { console.error('Delete error:', error); await showError('Failed'); }
    finally { setDeleteUserId(null); }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/pppoe/users/status', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, status: newStatus }) });
      const result = await res.json();
      if (res.ok) { await showSuccess(`Status: ${newStatus}`); loadData(); setActionMenuOpen(null); }
      else { await showError(result.error || 'Failed'); }
    } catch (error) { console.error('Status error:', error); await showError('Failed'); }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedUsers.size === 0) return;
    const confirmed = await showConfirm(`Update ${selectedUsers.size} user(s) to ${newStatus}?`);
    if (!confirmed) return;
    try {
      const res = await fetch('/api/pppoe/users/bulk-status', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userIds: Array.from(selectedUsers), status: newStatus }) });
      const result = await res.json();
      if (res.ok) { await showSuccess(`${selectedUsers.size} updated`); setSelectedUsers(new Set()); loadData(); }
      else { await showError(result.error || 'Failed'); }
    } catch (error) { console.error('Bulk error:', error); await showError('Failed'); }
  };

  const toggleSelectUser = (userId: string) => { const n = new Set(selectedUsers); n.has(userId) ? n.delete(userId) : n.add(userId); setSelectedUsers(n); };
  const toggleSelectAll = () => { selectedUsers.size === filteredUsers.length && filteredUsers.length > 0 ? setSelectedUsers(new Set()) : setSelectedUsers(new Set(filteredUsers.map(u => u.id))); };
  const resetForm = () => { setFormData({ username: '', password: '', profileId: '', routerId: '', name: '', phone: '', email: '', address: '', latitude: '', longitude: '', ipAddress: '', expiredAt: '' }); };

  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) return;
    const confirmed = await showConfirm(`Delete ${selectedUsers.size} user(s)?`);
    if (!confirmed) return;
    try {
      await Promise.all(Array.from(selectedUsers).map(id => fetch(`/api/pppoe/users?id=${id}`, { method: 'DELETE' })));
      await showSuccess(`${selectedUsers.size} deleted!`); setSelectedUsers(new Set()); loadData();
    } catch (error) { console.error('Bulk delete error:', error); await showError('Failed'); }
  };

  const handleExportSelected = async () => {
    if (selectedUsers.size === 0) return;
    try {
      const selectedUsersData = users.filter(u => selectedUsers.has(u.id));
      const usersWithPasswords = await Promise.all(selectedUsersData.map(async (u) => {
        try { const res = await fetch(`/api/pppoe/users/${u.id}`); const data = await res.json(); return { ...u, password: data.user?.password || '' }; }
        catch { return { ...u, password: '' }; }
      }));
      const csvContent = [['Username', 'Password', 'Name', 'Phone', 'Email', 'Address', 'IP', 'Profile', 'Router', 'Status', 'Expired'].join(','),
        ...usersWithPasswords.map(u => [u.username, u.password, u.name, u.phone, u.email || '', u.address || '', u.ipAddress || '', u.profile.name, u.router?.name || 'Global', u.status, u.expiredAt ? formatWIB(u.expiredAt) : ''].join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' }); const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `pppoe-users-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
    } catch (error) { console.error('Export error:', error); await showError('Export failed'); }
  };

  const handleDownloadTemplate = async () => { try { const res = await fetch('/api/pppoe/users/bulk?type=template'); const blob = await res.blob(); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'pppoe-template.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url); } catch (error) { console.error('Template error:', error); await showError('Failed'); } };
  const handleExportData = async () => { try { const res = await fetch('/api/pppoe/users/bulk?type=export'); const blob = await res.blob(); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `pppoe-export-${new Date().toISOString().split('T')[0]}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url); } catch (error) { console.error('Export error:', error); await showError('Failed'); } };

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams();
      params.set('format', 'excel');
      if (filterProfile) params.set('profileId', filterProfile);
      if (filterRouter) params.set('routerId', filterRouter);
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/pppoe/users/export?${params}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `PPPoE-Users-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
    } catch (error) { console.error('Export error:', error); await showError('Export failed'); }
  };

  const handleExportPDF = async () => {
    try {
      const params = new URLSearchParams();
      params.set('format', 'pdf');
      if (filterProfile) params.set('profileId', filterProfile);
      if (filterRouter) params.set('routerId', filterRouter);
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/pppoe/users/export?${params}`);
      const data = await res.json();
      if (data.pdfData) {
        const jsPDF = (await import('jspdf')).default;
        const autoTable = (await import('jspdf-autotable')).default;
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(14); doc.text(data.pdfData.title, 14, 15);
        if (data.pdfData.subtitle) { doc.setFontSize(10); doc.text(data.pdfData.subtitle, 14, 21); }
        doc.setFontSize(8); doc.text(`Generated: ${data.pdfData.generatedAt}`, 14, 27);
        autoTable(doc, { head: [data.pdfData.headers], body: data.pdfData.rows, startY: 32, styles: { fontSize: 7 }, headStyles: { fillColor: [13, 148, 136] } });
        if (data.pdfData.summary) {
          const finalY = (doc as any).lastAutoTable.finalY + 8;
          doc.setFontSize(9); doc.setFont('helvetica', 'bold');
          data.pdfData.summary.forEach((s: any, i: number) => { doc.text(`${s.label}: ${s.value}`, 14, finalY + (i * 5)); });
        }
        doc.save(`PPPoE-Users-${new Date().toISOString().split('T')[0]}.pdf`);
      }
    } catch (error) { console.error('PDF error:', error); await showError('PDF export failed'); }
  };

  const openAssignModal = async (user: PppoeUser) => {
    setUserToAssign(user);
    setIsAssignModalOpen(true);
    setLoadingDevices(true);
    setAssignTab('acs');
    setSelectedOltId('');
    setUncfgOnus([]);
    setOnuTypes([]);
    setOltAssignData({ sn: '', board: '', port: '', vlan: '', mode: 'pppoe', onuType: '' });
    
    // Fetch user password
    try {
        const uRes = await fetch(`/api/pppoe/users/${user.id}`);
        if(uRes.ok) {
           const uData = await uRes.json();
           setUserToAssign((prev: any) => ({ ...prev, password: uData.user?.password || '' }));
        }
    } catch(e) {}
    
    try {
      const [acsRes, oltRes] = await Promise.all([
        fetch('/api/settings/genieacs/devices?unassigned=true'),
        fetch('/api/network/olts')
      ]);
      if (acsRes.ok) {
        const data = await acsRes.json();
        setUnassignedDevices(data.devices || []);
      } else {
        await showError('Gagal mengambil daftar modem dari ACS');
      }
      if (oltRes.ok) {
        const data = await oltRes.json();
        // Only load ZTE OLTs for auto discovery
        setOlts((data.olts || []).filter((o: any) => o.vendor === 'zte'));
      }
    } catch (e) {
      console.error(e);
      await showError('Gagal memuat preferensi');
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleFetchUncfgOnus = async (oltId: string, forceRefresh: boolean = false) => {
    setSelectedOltId(oltId);
    if (!oltId) return setUncfgOnus([]);
    
    setLoadingUncfg(true);
    try {
      const res = await fetch(`/api/network/olts/${oltId}/uncfg?refresh=${forceRefresh ? 'true' : 'false'}`);
      const data = await res.json();
      if (res.ok) {
        setUncfgOnus(data.data || []);
        setOnuTypes(data.types || []);
      } else {
        await showError(data.error || 'Gagal memuat modem dari OLT');
      }
    } catch (e) {
      await showError('Gagal terhubung ke backend OLT');
    } finally {
      setLoadingUncfg(false);
    }
  };

  const handleAssignOlt = async () => {
    if (!userToAssign || !selectedOltId || !oltAssignData.sn || !oltAssignData.vlan) return;
    
    setAssigning(true);
    try {
      const payload = {
        board: oltAssignData.board,
        port: oltAssignData.port,
        sn: oltAssignData.sn,
        name: userToAssign.username,
        vlan: oltAssignData.vlan,
        mode: oltAssignData.mode,
        onuType: oltAssignData.onuType || (onuTypes.length > 0 ? onuTypes[0] : '1.ZTE-Home'),
        profile: userToAssign.profile.name,
        pppoeUser: userToAssign.username,
        pppoePass: (userToAssign as any).password || ''
      };

      const res = await fetch(`/api/network/olts/${selectedOltId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        await showSuccess(`Registrasi OLT Berhasil! ONT sedang reboot. Pindah ke tab GenieACS dalam ~2 menit untuk assign TR-069.`);
        // Don't close modal, just clear selection and wait so they can assign ACS later
        setOltAssignData({ sn: '', board: '', port: '', vlan: '', mode: 'pppoe', onuType: '' });
        handleFetchUncfgOnus(selectedOltId);
        setAssignTab('acs');
        setLoadingDevices(true);
        const acsRes = await fetch('/api/settings/genieacs/devices?unassigned=true');
        if (acsRes.ok) {
          const d = await acsRes.json();
          setUnassignedDevices(d.devices || []);
        }
        setLoadingDevices(false);
      } else {
        const error = await res.json();
        await showError(`Gagal: ${error.error || 'Terjadi kesalahan CLI'}`);
      }
    } catch (e) {
      console.error(e);
      await showError('Gagal mengeksekusi script OLT');
    } finally {
      setAssigning(false);
    }
  };

  const handleAssignModem = async () => {
    if (!userToAssign || !assignFormData.deviceId) return;
    
    setAssigning(true);
    try {
      const payload = {
        pppoeUserId: userToAssign.id,
        ...(assignFormData.saveWifi && {
          wifiSsid: assignFormData.wifiSsid,
          wifiPassword: assignFormData.wifiPassword
        })
      };

      const res = await fetch(`/api/settings/genieacs/devices/${assignFormData.deviceId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        await showSuccess(`Modem berhasil di-assign ke ${userToAssign.username} dan sedang diprovisioning!`);
        setIsAssignModalOpen(false);
        setUserToAssign(null);
        setAssignFormData({ deviceId: '', saveWifi: true, wifiSsid: '', wifiPassword: '12345678', macAddress: '' });
        loadData(); // Memuat ulang data
      } else {
        const error = await res.json();
        await showError(`Gagal: ${error.error || 'Terjadi kesalahan'}`);
      }
    } catch (e) {
      console.error(e);
      await showError('Gagal mengirim perintah provisioning ke sistem');
    } finally {
      setAssigning(false);
    }
  };

  // Sync from MikroTik functions
  const handleSyncPreview = async () => {
    if (!syncRouterId) { await showError('Pilih router terlebih dahulu'); return; }
    setSyncLoading(true); setSyncPreview(null); setSyncSelectedUsers(new Set()); setSyncResult(null);
    try {
      const res = await fetch(`/api/pppoe/users/sync-mikrotik?routerId=${syncRouterId}`);
      const data = await res.json();
      if (data.success) {
        setSyncPreview(data);
        // Auto-select all new users
        const newUsers = data.data.secrets.filter((s: any) => s.isNew && !s.disabled);
        setSyncSelectedUsers(new Set(newUsers.map((s: any) => s.username)));
      } else {
        await showError(data.error || 'Gagal mengambil data dari MikroTik');
      }
    } catch (error) { console.error('Sync preview error:', error); await showError('Gagal terhubung ke MikroTik'); }
    finally { setSyncLoading(false); }
  };

  const handleSyncImport = async () => {
    if (!syncRouterId || !syncProfileId || syncSelectedUsers.size === 0) {
      await showError('Pilih router, profile, dan minimal 1 user');
      return;
    }
    setSyncing(true); setSyncResult(null);
    try {
      const res = await fetch('/api/pppoe/users/sync-mikrotik', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routerId: syncRouterId,
          profileId: syncProfileId,
          selectedUsernames: Array.from(syncSelectedUsers),
          syncToRadius: true,
          defaultPhone: '08',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncResult(data);
        loadData();
        if (data.stats.failed === 0) {
          await showSuccess(`Berhasil import ${data.stats.imported} user!`);
        }
      } else {
        await showError(data.error || 'Gagal import users');
      }
    } catch (error) { console.error('Sync import error:', error); await showError('Gagal import users'); }
    finally { setSyncing(false); }
  };

  const toggleSyncSelectUser = (username: string) => {
    const newSelected = new Set(syncSelectedUsers);
    if (newSelected.has(username)) { newSelected.delete(username); }
    else { newSelected.add(username); }
    setSyncSelectedUsers(newSelected);
  };

  const toggleSyncSelectAll = (selectNew: boolean) => {
    if (!syncPreview?.data?.secrets) return;
    if (selectNew) {
      const newUsers = syncPreview.data.secrets.filter((s: any) => s.isNew && !s.disabled);
      setSyncSelectedUsers(new Set(newUsers.map((s: any) => s.username)));
    } else {
      setSyncSelectedUsers(new Set());
    }
  };

  const handleImport = async () => {
    if (!importFile || !importProfileId) { await showError('Select file and profile'); return; }
    setImporting(true); setImportResult(null);
    try {
      const formData = new FormData(); formData.append('file', importFile); formData.append('pppoeProfileId', importProfileId);
      if (importRouterId) formData.append('routerId', importRouterId);
      const res = await fetch('/api/pppoe/users/bulk', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) { setImportResult(data.results); loadData(); if (data.results.failed === 0) setTimeout(() => { setIsImportDialogOpen(false); setImportFile(null); setImportProfileId(''); setImportRouterId(''); setImportResult(null); }, 3000); }
      else { await showError('Import failed: ' + data.error); }
    } catch (error) { console.error('Import error:', error); await showError('Import failed'); }
    finally { setImporting(false); }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch = searchQuery === '' || user.username.toLowerCase().includes(searchQuery.toLowerCase()) || user.name.toLowerCase().includes(searchQuery.toLowerCase()) || user.phone.includes(searchQuery);
    const matchesProfile = filterProfile === '' || user.profile.id === filterProfile;
    const matchesRouter = filterRouter === '' || (filterRouter === 'global' ? !user.routerId : user.routerId === filterRouter);
    const matchesStatus = filterStatus === '' || user.status === filterStatus;
    return matchesSearch && matchesProfile && matchesRouter && matchesStatus;
  });

  const activeUsers = filteredUsers.filter((u) => u.status === 'active').length;
  const expiredUsers = filteredUsers.filter((u) => u.expiredAt ? isExpired(u.expiredAt) : false).length;

  const canView = hasPermission('customers.view');
  const canCreate = hasPermission('customers.create');

  if (!permLoading && !canView) {
    return (<div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Shield className="w-12 h-12 text-gray-400 mb-3" /><h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{t('pppoe.accessDenied')}</h2>
      <p className="text-xs text-gray-500">{t('pppoe.noPermission')}</p></div>);
  }

  if (loading) { return <div className="flex items-center justify-center h-64"><p className="text-xs text-gray-500">{t('common.loading')}</p></div>; }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('pppoe.title')}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('pppoe.subtitle')}</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => { setIsSyncDialogOpen(true); setSyncPreview(null); setSyncResult(null); setSyncRouterId(''); setSyncProfileId(''); }} className="inline-flex items-center px-2 py-1.5 text-xs border border-blue-500 text-blue-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"><RefreshCcw className="h-3 w-3 mr-1" />Sync MikroTik</button>
          <button onClick={handleDownloadTemplate} className="inline-flex items-center px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"><Download className="h-3 w-3 mr-1" />{t('pppoe.template')}</button>
          <button onClick={handleExportExcel} className="inline-flex items-center px-2 py-1.5 text-xs border border-green-500 text-green-600 rounded hover:bg-green-50 dark:hover:bg-green-900/20"><Download className="h-3 w-3 mr-1" />Excel</button>
          <button onClick={handleExportPDF} className="inline-flex items-center px-2 py-1.5 text-xs border border-red-500 text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20"><Download className="h-3 w-3 mr-1" />PDF</button>
          <button onClick={() => setIsImportDialogOpen(true)} className="inline-flex items-center px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"><Upload className="h-3 w-3 mr-1" />{t('common.import')}</button>
          {canCreate && (<button onClick={() => { resetForm(); setEditingUser(null); setIsDialogOpen(true); }} className="inline-flex items-center px-3 py-1.5 text-xs bg-primary hover:bg-primary/90 text-white rounded"><Plus className="h-3 w-3 mr-1" />{t('pppoe.addUser')}</button>)}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div><p className="text-[10px] text-gray-500 uppercase">{t('pppoe.active')}</p><p className="text-base font-bold text-green-600">{activeUsers}</p></div>
            <Users className="h-5 w-5 text-green-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div><p className="text-[10px] text-gray-500 uppercase">{t('pppoe.expired')}</p><p className="text-base font-bold text-red-600">{expiredUsers}</p></div>
            <Users className="h-5 w-5 text-red-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div><p className="text-[10px] text-gray-500 uppercase">{t('common.total')}</p><p className="text-base font-bold text-teal-600">{users.length}</p></div>
            <Users className="h-5 w-5 text-teal-600" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input type="text" placeholder={t('common.search')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-7 pr-7 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>}
          </div>
          <select value={filterProfile} onChange={(e) => setFilterProfile(e.target.value)} className="px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800">
            <option value="">{t('pppoe.allProfiles')}</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={filterRouter} onChange={(e) => setFilterRouter(e.target.value)} className="px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800">
            <option value="">{t('pppoe.allNas')}</option><option value="global">{t('pppoe.global')}</option>
            {routers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <Filter className="h-3 w-3 text-gray-500" /><span className="text-[10px] text-gray-500">{t('common.status')}:</span>
          {['', 'active', 'isolated', 'blocked'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-2 py-0.5 text-[10px] rounded-full transition ${filterStatus === s ? (s === '' ? 'bg-teal-600 text-white' : s === 'active' ? 'bg-green-600 text-white' : s === 'isolated' ? 'bg-yellow-600 text-white' : 'bg-red-600 text-white') : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}>
              {s === '' ? t('common.all') : s === 'active' ? t('pppoe.active') : s === 'isolated' ? t('pppoe.isolir') : t('pppoe.block')}
            </button>
          ))}
          {(searchQuery || filterProfile || filterRouter || filterStatus) && <button onClick={() => { setSearchQuery(''); setFilterProfile(''); setFilterRouter(''); setFilterStatus(''); }} className="ml-auto text-[10px] text-teal-600 hover:text-teal-700">{t('common.reset')}</button>}
        </div>
        <div className="mt-2 text-[10px] text-gray-500">{t('table.showing')} {filteredUsers.length} {t('table.of')} {users.length}</div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-3 py-2 border-b dark:border-gray-800 flex items-center justify-between">
          <span className="text-xs font-medium">{t('pppoe.usersList')}</span>
          {selectedUsers.size > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500">{selectedUsers.size} {t('pppoe.selected')}</span>
              <button onClick={() => handleBulkStatusChange('active')} className="px-1.5 py-0.5 text-[10px] bg-green-600 text-white rounded flex items-center gap-0.5"><Shield className="h-2.5 w-2.5" />{t('pppoe.active')}</button>
              <button onClick={() => handleBulkStatusChange('isolated')} className="px-1.5 py-0.5 text-[10px] bg-yellow-600 text-white rounded flex items-center gap-0.5"><ShieldOff className="h-2.5 w-2.5" />{t('pppoe.isolir')}</button>
              <button onClick={() => handleBulkStatusChange('blocked')} className="px-1.5 py-0.5 text-[10px] bg-red-600 text-white rounded flex items-center gap-0.5"><Ban className="h-2.5 w-2.5" />{t('pppoe.block')}</button>
              <button onClick={handleExportSelected} className="px-1.5 py-0.5 text-[10px] bg-teal-600 text-white rounded flex items-center gap-0.5"><Download className="h-2.5 w-2.5" />{t('common.export')}</button>
              <button onClick={handleBulkDelete} className="px-1.5 py-0.5 text-[10px] bg-gray-600 text-white rounded flex items-center gap-0.5"><Trash2 className="h-2.5 w-2.5" />{t('common.delete')}</button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-2 py-2 text-center w-8"><input type="checkbox" checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0} onChange={toggleSelectAll} className="rounded border-gray-300 w-3 h-3" /></th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('pppoe.username')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('common.name')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden md:table-cell">{t('common.phone')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden lg:table-cell">{t('pppoe.profile')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden sm:table-cell">{t('pppoe.expired')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('pppoe.status')}</th>
                <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredUsers.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-500 text-xs">{users.length === 0 ? t('pppoe.noUsers') : t('pppoe.noMatch')}</td></tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-2 py-2 text-center"><input type="checkbox" checked={selectedUsers.has(user.id)} onChange={() => toggleSelectUser(user.id)} className="rounded border-gray-300 w-3 h-3" /></td>
                    <td className="px-3 py-2"><p className="font-medium text-xs">{user.username}</p>{user.ipAddress && <p className="text-[10px] text-gray-500">IP: {user.ipAddress}</p>}</td>
                    <td className="px-3 py-2"><p className="text-xs">{user.name}</p>{user.email && <p className="text-[10px] text-gray-500 truncate max-w-[120px]">{user.email}</p>}</td>
                    <td className="px-3 py-2 text-xs hidden md:table-cell">{user.phone}</td>
                    <td className="px-3 py-2 hidden lg:table-cell"><span className="text-xs font-medium">{user.profile.name}</span><br/><span className="text-[10px] text-gray-500 font-mono">{user.profile.groupName}</span></td>
                    <td className="px-3 py-2 text-xs hidden sm:table-cell">{user.expiredAt ? <span className={isExpired(user.expiredAt) ? 'text-red-600 font-medium' : ''}>{formatWIB(user.expiredAt, 'dd/MM/yyyy')}</span> : '-'}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${user.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : user.status === 'isolated' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30' : 'bg-red-100 text-red-700 dark:bg-red-900/30'}`}>{user.status}</span>
                        {user.syncedToRadius && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30"><CheckCircle2 className="h-2 w-2 mr-0.5" />{t('pppoe.synced')}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-0.5">
                        <div className="relative">
                          <button onClick={() => setActionMenuOpen(actionMenuOpen === user.id ? null : user.id)} className="p-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><MoreVertical className="h-3 w-3" /></button>
                          {actionMenuOpen === user.id && (
                            <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-gray-800 rounded shadow-lg border dark:border-gray-700 z-10">
                              <button onClick={() => handleStatusChange(user.id, 'active')} className="w-full px-2 py-1.5 text-left text-[10px] hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5"><Shield className="h-3 w-3 text-green-600" />{t('pppoe.active')}</button>
                              <button onClick={() => handleStatusChange(user.id, 'isolated')} className="w-full px-2 py-1.5 text-left text-[10px] hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5"><ShieldOff className="h-3 w-3 text-yellow-600" />{t('pppoe.isolir')}</button>
                              <button onClick={() => handleStatusChange(user.id, 'blocked')} className="w-full px-2 py-1.5 text-left text-[10px] hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5"><Ban className="h-3 w-3 text-red-600" />{t('pppoe.block')}</button>
                            </div>
                          )}
                        </div>
                        <button onClick={() => handleEdit(user)} className="p-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><Pencil className="h-3 w-3" /></button>
                                <button onClick={() => setDeleteUserId(user.id)} className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="h-3 w-3" /></button>
                                <button onClick={() => openAssignModal(user)} className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" title="Assign Modem (Auto Provisioning)"><Router className="h-3 w-3" /></button>
                              </div>
                            </td>
                          </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New User Dialog */}
      {isDialogOpen && !editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b dark:border-gray-800">
              <h2 className="text-sm font-semibold">{t('pppoe.addUser')}</h2>
              <p className="text-[10px] text-gray-500">{t('pppoe.createPppoe')}</p>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] font-medium mb-1">{t('pppoe.username')} *</label><input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} required className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800" /></div>
                <div><label className="block text-[10px] font-medium mb-1">{t('pppoe.password')} *</label>
                  <div className="relative"><input type={showPassword ? 'text' : 'password'} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required={!editingUser} className="w-full px-2 py-1.5 pr-7 text-xs border dark:border-gray-700 rounded dark:bg-gray-800" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500">{showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</button>
                  </div>
                </div>
              </div>
              <div><label className="block text-[10px] font-medium mb-1">{t('pppoe.profile')} *</label><select value={formData.profileId} onChange={(e) => setFormData({ ...formData, profileId: e.target.value })} required className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"><option value="">{t('common.select')}</option>{profiles.map((p) => <option key={p.id} value={p.id}>{p.name} - Rp {p.price.toLocaleString('id-ID')}</option>)}</select></div>
              <div><label className="block text-[10px] font-medium mb-1">NAS ({t('common.optional')})</label><select value={formData.routerId} onChange={(e) => setFormData({ ...formData, routerId: e.target.value })} className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"><option value="">{t('pppoe.global')}</option>{routers.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.ipAddress})</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] font-medium mb-1">{t('common.name')} *</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800" /></div>
                <div><label className="block text-[10px] font-medium mb-1">{t('common.phone')} *</label><input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800" /></div>
              </div>
              <div><label className="block text-[10px] font-medium mb-1">{t('common.email')}</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800" /></div>
              <div><label className="block text-[10px] font-medium mb-1">{t('common.address')}</label><input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800" /></div>
              <div>
                <div className="flex items-center justify-between mb-1"><label className="text-[10px] font-medium">{t('pppoe.gpsLocation')}</label>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setShowMapPicker(true)} className="inline-flex items-center px-2 py-0.5 text-[10px] bg-teal-600 text-white rounded"><Map className="h-2.5 w-2.5 mr-1" />{t('pppoe.openMap')}</button>
                    <button type="button" onClick={async () => { if (navigator.geolocation) { navigator.geolocation.getCurrentPosition((p) => { setFormData({ ...formData, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) }); }, async (e) => { await showError('GPS failed'); }, { enableHighAccuracy: true, timeout: 10000 }); } }} className="inline-flex items-center px-2 py-0.5 text-[10px] bg-green-600 text-white rounded"><MapPin className="h-2.5 w-2.5 mr-1" />{t('pppoe.autoGps')}</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" step="any" value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} placeholder={t('pppoe.latitude')} className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800" />
                  <input type="number" step="any" value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} placeholder={t('pppoe.longitude')} className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] font-medium mb-1">{t('pppoe.staticIp')}</label><input type="text" value={formData.ipAddress} onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })} placeholder="10.10.10.2" className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800" /></div>
                <div><label className="block text-[10px] font-medium mb-1">{t('pppoe.expiryDate')}</label><input type="date" value={formData.expiredAt} onChange={(e) => setFormData({ ...formData, expiredAt: e.target.value })} className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800" /></div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t dark:border-gray-800">
                <button type="button" onClick={() => { setIsDialogOpen(false); setEditingUser(null); resetForm(); }} className="px-3 py-1.5 text-xs border dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-800">{t('common.cancel')}</button>
                <button type="submit" className="px-3 py-1.5 text-xs bg-primary text-white rounded hover:bg-primary/90">{t('common.create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Map Picker */}
      <MapPicker isOpen={showMapPicker} onClose={() => setShowMapPicker(false)} onSelect={(lat, lng) => { setFormData({ ...formData, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }); if (editingUser) setModalLatLng({ lat: lat.toFixed(6), lng: lng.toFixed(6) }); }} initialLat={formData.latitude ? parseFloat(formData.latitude) : undefined} initialLng={formData.longitude ? parseFloat(formData.longitude) : undefined} />

      {/* Import Dialog */}
      {isImportDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-sm font-semibold mb-1">{t('pppoe.importCsv')}</h2>
            <p className="text-[10px] text-gray-500 mb-4">{t('common.upload')} CSV</p>
            <div className="space-y-3">
              <div><label className="block text-[10px] font-medium mb-1">{t('pppoe.selectFile')} *</label><input type="file" accept=".csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800" /></div>
              <div><label className="block text-[10px] font-medium mb-1">{t('pppoe.profile')} *</label><select value={importProfileId} onChange={(e) => setImportProfileId(e.target.value)} className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"><option value="">{t('common.select')}</option>{profiles.map((p) => <option key={p.id} value={p.id}>{p.name} - Rp {p.price.toLocaleString('id-ID')}</option>)}</select></div>
              <div><label className="block text-[10px] font-medium mb-1">NAS</label><select value={importRouterId} onChange={(e) => setImportRouterId(e.target.value)} className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"><option value="">{t('pppoe.global')}</option>{routers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
              {importResult && (
                <div className="p-2 border rounded bg-gray-50 dark:bg-gray-800 text-xs">
                  <div className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3 w-3" />{importResult.success} {t('common.create')}</div>
                  {importResult.failed > 0 && <div className="text-red-600 mt-1">{importResult.failed} {t('notifications.failed')}</div>}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setIsImportDialogOpen(false); setImportFile(null); setImportProfileId(''); setImportRouterId(''); setImportResult(null); }} className="px-3 py-1.5 text-xs border dark:border-gray-700 rounded">{t('common.cancel')}</button>
              <button onClick={handleImport} disabled={!importFile || !importProfileId || importing} className="px-3 py-1.5 text-xs bg-primary text-white rounded disabled:opacity-50">{importing ? t('notifications.processing') : t('common.import')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      <UserDetailModal isOpen={isDialogOpen && !!editingUser} onClose={() => { setIsDialogOpen(false); setEditingUser(null); resetForm(); setModalLatLng(undefined); }} user={editingUser} onSave={handleSaveUser} profiles={profiles} routers={routers} currentLatLng={modalLatLng} onLatLngChange={(lat, lng) => { setFormData({ ...formData, latitude: lat, longitude: lng }); setShowMapPicker(true); }} />

      {/* Delete Dialog */}
      {deleteUserId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-sm w-full p-4">
            <h2 className="text-sm font-semibold mb-1">{t('pppoe.deleteUser')}</h2>
            <p className="text-xs text-gray-500 mb-4">{t('pppoe.deleteConfirm')}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteUserId(null)} className="px-3 py-1.5 text-xs border dark:border-gray-700 rounded">{t('common.cancel')}</button>
              <button onClick={handleDelete} className="px-3 py-1.5 text-xs bg-red-600 text-white rounded">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Sync from MikroTik Dialog */}
      {isSyncDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b dark:border-gray-800">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <RefreshCcw className="h-4 w-4 text-blue-600" />
                Sync PPPoE dari MikroTik
              </h2>
              <p className="text-[10px] text-gray-500">Import PPPoE secrets dari MikroTik ke database RADIUS</p>
            </div>
            
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              {/* Step 1: Select Router */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium mb-1">Pilih Router *</label>
                  <select 
                    value={syncRouterId} 
                    onChange={(e) => { setSyncRouterId(e.target.value); setSyncPreview(null); setSyncResult(null); }}
                    className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                  >
                    <option value="">-- Pilih Router --</option>
                    {routers.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.ipAddress})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-1">Profile Tujuan *</label>
                  <select 
                    value={syncProfileId} 
                    onChange={(e) => setSyncProfileId(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                  >
                    <option value="">-- Pilih Profile --</option>
                    {profiles.map((p) => <option key={p.id} value={p.id}>{p.name} - Rp {p.price.toLocaleString('id-ID')}</option>)}
                  </select>
                </div>
              </div>

              <button 
                onClick={handleSyncPreview} 
                disabled={!syncRouterId || syncLoading}
                className="w-full px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {syncLoading ? (
                  <>
                    <RefreshCcw className="h-3 w-3 animate-spin" />
                    Mengambil data dari MikroTik...
                  </>
                ) : (
                  <>
                    <Search className="h-3 w-3" />
                    Preview PPPoE Secrets
                  </>
                )}
              </button>

              {/* Preview Results */}
              {syncPreview && (
                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700 flex items-center justify-between">
                    <div className="text-xs">
                      <span className="font-medium">{syncPreview.router?.name}</span>
                      <span className="text-gray-500 ml-2">
                        Total: {syncPreview.data?.total} | 
                        Baru: <span className="text-green-600 font-medium">{syncPreview.data?.new}</span> | 
                        Sudah ada: <span className="text-yellow-600">{syncPreview.data?.existing}</span>
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => toggleSyncSelectAll(true)} 
                        className="text-[10px] text-blue-600 hover:underline"
                      >
                        Pilih Semua Baru
                      </button>
                      <button 
                        onClick={() => toggleSyncSelectAll(false)} 
                        className="text-[10px] text-gray-500 hover:underline"
                      >
                        Batal Pilih
                      </button>
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 w-8"></th>
                          <th className="px-2 py-1.5 text-left">Username</th>
                          <th className="px-2 py-1.5 text-left">Profile (MikroTik)</th>
                          <th className="px-2 py-1.5 text-left">IP</th>
                          <th className="px-2 py-1.5 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {syncPreview.data?.secrets?.map((secret: any) => (
                          <tr 
                            key={secret.username} 
                            className={`${secret.isNew ? 'bg-green-50/50 dark:bg-green-900/10' : 'bg-gray-50/50 dark:bg-gray-800/30'} ${secret.disabled ? 'opacity-50' : ''}`}
                          >
                            <td className="px-2 py-1.5 text-center">
                              <input 
                                type="checkbox" 
                                checked={syncSelectedUsers.has(secret.username)}
                                onChange={() => toggleSyncSelectUser(secret.username)}
                                disabled={!secret.isNew || secret.disabled}
                                className="w-3 h-3 rounded"
                              />
                            </td>
                            <td className="px-2 py-1.5 font-mono">{secret.username}</td>
                            <td className="px-2 py-1.5 text-gray-500">{secret.profile}</td>
                            <td className="px-2 py-1.5 text-gray-500">{secret.remoteAddress || '-'}</td>
                            <td className="px-2 py-1.5">
                              {secret.disabled ? (
                                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px]">Disabled</span>
                              ) : secret.isNew ? (
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[9px]">Baru</span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[9px]">Sudah Ada</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {syncSelectedUsers.size > 0 && (
                    <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-t dark:border-gray-700 text-xs text-blue-700 dark:text-blue-300">
                      ✓ {syncSelectedUsers.size} user dipilih untuk diimport
                    </div>
                  )}
                </div>
              )}

              {/* Sync Result */}
              {syncResult && (
                <div className={`p-3 rounded-lg border ${syncResult.stats?.failed > 0 ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20' : 'bg-green-50 border-green-200 dark:bg-green-900/20'}`}>
                  <div className="text-xs space-y-1">
                    <div className="font-medium">{syncResult.message}</div>
                    <div className="flex gap-4 text-[10px]">
                      <span className="text-green-600">✓ Imported: {syncResult.stats?.imported}</span>
                      <span className="text-yellow-600">⊘ Skipped: {syncResult.stats?.skipped}</span>
                      <span className="text-red-600">✗ Failed: {syncResult.stats?.failed}</span>
                    </div>
                    {syncResult.errors?.length > 0 && (
                      <div className="mt-2 text-[10px] text-red-600">
                        Errors: {syncResult.errors.map((e: any) => `${e.username}: ${e.error}`).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-[10px] text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">ℹ️ Informasi:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>User yang sudah ada di database akan di-skip (tidak akan duplikat)</li>
                  <li>User yang disabled di MikroTik tidak akan diimport</li>
                  <li>Semua user yang diimport akan menggunakan Profile tujuan yang dipilih</li>
                  <li>Password akan disalin dari MikroTik dan disync ke RADIUS</li>
                  <li>Nama customer akan diambil dari comment jika ada, atau username jika tidak ada</li>
                </ul>
              </div>
            </div>

            <div className="px-4 py-3 border-t dark:border-gray-800 flex justify-end gap-2">
              <button 
                onClick={() => { setIsSyncDialogOpen(false); setSyncPreview(null); setSyncResult(null); }}
                className="px-3 py-1.5 text-xs border dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {t('common.cancel')}
              </button>
              <button 
                onClick={handleSyncImport}
                disabled={!syncProfileId || syncSelectedUsers.size === 0 || syncing}
                className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 flex items-center gap-1.5"
              >
                {syncing ? (
                  <>
                    <RefreshCcw className="h-3 w-3 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="h-3 w-3" />
                    Import {syncSelectedUsers.size} User
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modem Dialog */}
      {isAssignModalOpen && userToAssign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b dark:border-gray-800">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Router className="h-4 w-4 text-blue-600" />
                Assign Modem untuk {userToAssign.username}
              </h2>
              <p className="text-[10px] text-gray-500">Auto Provisioning Modem via TR-069</p>
            </div>
            
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div className="flex border-b dark:border-gray-800 mb-2">
                <button
                  className={`px-4 py-2 text-xs font-medium border-b-2 ${assignTab === 'acs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setAssignTab('acs')}
                >
                  Modem di ACS (Existing)
                </button>
                <button
                  className={`px-4 py-2 text-xs font-medium border-b-2 ${assignTab === 'olt' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setAssignTab('olt')}
                >
                  Scan OLT (Modem Baru)
                </button>
              </div>

              {assignTab === 'acs' && (
                <>
                  {loadingDevices ? (
                    <div className="flex items-center justify-center py-4">
                      <RefreshCcw className="h-4 w-4 animate-spin text-gray-400" />
                      <span className="ml-2 text-xs text-gray-500">Memuat daftar modem...</span>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-[10px] font-medium mb-1">Pilih Modem (GenieACS) *</label>
                        <select 
                          value={assignFormData.deviceId} 
                          onChange={(e: any) => {
                            const dev = unassignedDevices.find((d: any) => d._id === e.target.value);
                            setAssignFormData({ ...assignFormData, deviceId: e.target.value, macAddress: dev?.mac || dev?.summary?.mac || '' });
                          }}
                          className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                        >
                          <option value="">-- Pilih Modem Tersedia --</option>
                          {unassignedDevices.map((d: any) => (
                            <option key={d._id} value={d._id}>
                              {d.summary?.productClass || 'Router'} - {d._id} (IP: {d.summary?.ip})
                            </option>
                          ))}
                        </select>
                        {unassignedDevices.length === 0 && (
                          <p className="text-[10px] text-red-500 mt-1">Tidak ada modem baru/tersedia di ACS.</p>
                        )}
                      </div>

                      <div className="border-t dark:border-gray-800 pt-3 mt-3">
                        <label className="flex items-center gap-2 mb-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={assignFormData.saveWifi}
                            onChange={(e: any) => setAssignFormData({...assignFormData, saveWifi: e.target.checked})}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs font-medium">Otomatis Konfigurasi Wi-Fi</span>
                        </label>

                        {assignFormData.saveWifi && (
                          <div className="grid grid-cols-2 gap-3 pl-6">
                            <div>
                              <label className="block text-[10px] text-gray-500 mb-1">WLAN SSID</label>
                              <input 
                                type="text" 
                                value={assignFormData.wifiSsid} 
                                onChange={(e: any) => setAssignFormData({...assignFormData, wifiSsid: e.target.value})}
                                className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-500 mb-1">Wi-Fi Password</label>
                              <input 
                                type="text" 
                                value={assignFormData.wifiPassword} 
                                onChange={(e: any) => setAssignFormData({...assignFormData, wifiPassword: e.target.value})}
                                className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-[10px] text-blue-700 dark:text-blue-300 mt-2">
                        <p className="font-medium mb-1">ℹ️ Informasi Provisioning:</p>
                        <ul className="list-disc list-inside space-y-0.5 ml-1">
                          <li>PPPoE Username: <span className="font-mono">{userToAssign.username}</span></li>
                          <li>PPPoE Password: <span className="font-mono">***</span> (sesuai database RADIUS)</li>
                          <li>Parameter akan dipush langsung ke modem via GenieACS.</li>
                        </ul>
                      </div>
                    </>
                  )}
                </>
              )}

              {assignTab === 'olt' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-medium mb-1">Pilih OLT *</label>
                    <select 
                      value={selectedOltId} 
                      onChange={(e: any) => handleFetchUncfgOnus(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                    >
                      <option value="">-- Pilih OLT ZTE --</option>
                      {olts.map((o: any) => (
                        <option key={o.id} value={o.id}>
                          {o.name} ({o.ipAddress})
                        </option>
                      ))}
                    </select>
                    {olts.length === 0 && (
                      <p className="text-[10px] text-red-500 mt-1">Belum ada OLT ZTE terdaftar.</p>
                    )}
                  </div>

                  {selectedOltId && (
                    <div className="border border-gray-200 dark:border-gray-800 rounded p-2">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-medium text-gray-500">Unconfigured ONUs</label>
                        <button 
                          onClick={() => handleFetchUncfgOnus(selectedOltId, true)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded text-gray-500"
                          title="Refresh"
                        >
                          <RefreshCcw className={`h-3 w-3 ${loadingUncfg ? 'animate-spin text-teal-600' : ''}`} />
                        </button>
                      </div>
                      
                      {loadingUncfg ? (
                        <div className="text-center py-4 text-xs text-gray-500">Memindai OLT...</div>
                      ) : uncfgOnus.length === 0 ? (
                        <div className="text-center py-4 text-xs text-red-500">Tidak ada modem unconfigured di OLT ini. Pastikan modem telah terhubung dengan ODP dengan redaman stabil.</div>
                      ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {uncfgOnus.map((onu: any, i) => (
                            <label key={i} className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${oltAssignData.sn === onu.sn ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                              <input 
                                type="radio" 
                                name="select_onu" 
                                checked={oltAssignData.sn === onu.sn}
                                onChange={() => setOltAssignData({ ...oltAssignData, sn: onu.sn, board: onu.board, port: onu.port })}
                                className="w-3 h-3 text-teal-600"
                              />
                              <div className="flex-1">
                                <p className="text-xs font-medium font-mono">{onu.sn}</p>
                                <p className="text-[10px] text-gray-500">Board: {onu.board} | Port: {onu.port}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {oltAssignData.sn && (
                    <div className="space-y-3 mt-3 border-t dark:border-gray-800 pt-3">
                      <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-1.5 rounded border border-gray-200 dark:border-gray-700">
                        <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">Mode:</span>
                        <div className="flex bg-gray-100 dark:bg-gray-900 p-0.5 rounded">
                          <button
                            type="button"
                            onClick={() => setOltAssignData({...oltAssignData, mode: 'pppoe'})}
                            className={`px-3 py-1 text-[10px] font-medium rounded ${oltAssignData.mode === 'pppoe' ? 'bg-teal-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                          >
                            PPPoE Router
                          </button>
                          <button
                            type="button"
                            onClick={() => setOltAssignData({...oltAssignData, mode: 'bridge'})}
                            className={`px-3 py-1 text-[10px] font-medium rounded ${oltAssignData.mode === 'bridge' ? 'bg-teal-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                          >
                            Bridge
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-medium mb-1">ONU Type</label>
                          <select
                            value={oltAssignData.onuType || (onuTypes.length > 0 ? onuTypes[0] : '')}
                            onChange={(e) => setOltAssignData({...oltAssignData, onuType: e.target.value})}
                            className="w-full text-xs px-2 py-1.5 rounded border dark:border-gray-700 dark:bg-gray-800"
                          >
                            {onuTypes.map((t, i) => <option key={i} value={t}>{t}</option>)}
                            {onuTypes.length === 0 && <option value="1.ZTE-Home">1.ZTE-Home</option>}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium mb-1">VLAN ID *</label>
                          <input 
                            type="number" 
                            value={oltAssignData.vlan} 
                            onChange={(e: any) => setOltAssignData({...oltAssignData, vlan: e.target.value})}
                            placeholder="Contoh: 100"
                            className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                          />
                        </div>
                      </div>

                      {oltAssignData.mode === 'pppoe' && (
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800">
                          <p className="text-[10px] font-semibold text-blue-800 dark:text-blue-300 mb-2">Automated PPPoE Push:</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                               <p className="text-[9px] text-gray-500">Username:</p>
                               <p className="text-xs font-mono">{userToAssign.username}</p>
                            </div>
                            <div>
                               <p className="text-[9px] text-gray-500">Password:</p>
                               <p className="text-xs font-mono">{(userToAssign as any).password ? '*** (Auto-fetched)' : 'Menunggu...'}</p>
                            </div>
                            <div>
                               <p className="text-[9px] text-gray-500">Speed Profile:</p>
                               <p className="text-xs font-mono">{userToAssign.profile.name}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t dark:border-gray-800 flex justify-end gap-2">
              <button 
                onClick={() => { setIsAssignModalOpen(false); setUserToAssign(null); }}
                className="px-3 py-1.5 text-xs border dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {t('common.cancel')}
              </button>
              {assignTab === 'acs' ? (
                <button 
                  onClick={handleAssignModem}
                  disabled={!assignFormData.deviceId || assigning}
                  className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 flex items-center gap-1.5"
                >
                  {assigning ? (
                    <>
                      <RefreshCcw className="h-3 w-3 animate-spin" />
                      Provisioning...
                    </>
                  ) : (
                    <>
                      <Router className="h-3 w-3" />
                      Push Config
                    </>
                  )}
                </button>
              ) : (
                <button 
                  onClick={handleAssignOlt}
                  disabled={!oltAssignData.sn || !oltAssignData.vlan || assigning}
                  className="px-4 py-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded disabled:opacity-50 flex items-center gap-1.5"
                >
                  {assigning ? (
                    <>
                      <RefreshCcw className="h-3 w-3 animate-spin" />
                      Mengeksekusi...
                    </>
                  ) : (
                    <>
                      <Router className="h-3 w-3" />
                      Register ke OLT
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
