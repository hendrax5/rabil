'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Shield, Globe, Plus, Trash2, Key, RefreshCw, Network, Lock, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function VPNPage() {
  const [activeTab, setActiveTab] = useState('l2tp');
  const [wgUrl, setWgUrl] = useState('');
  const [l2tpUsers, setL2tpUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '', staticIp: '' });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const host = window.location.hostname;
    setWgUrl(`http://${host}:51821`);
    fetchL2tpUsers();
  }, []);

  const fetchL2tpUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system/vpn-users?type=L2TP');
      const data = await res.json();
      setL2tpUsers(data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/system/vpn-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, type: 'L2TP' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create');
      setFormData({ username: '', password: '', staticIp: '' });
      fetchL2tpUsers();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah anda yakin menghapus L2TP User ini? Koneksi mungkin akan terputus.')) return;
    try {
      await fetch(`/api/system/vpn-users/${id}`, { method: 'DELETE' });
      fetchL2tpUsers();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="h-6 w-6 text-indigo-600" />
            Manajemen VPN & LNS
          </h1>
          <p className="text-gray-500 mt-1">
            Konfigurasi langsung Jaringan L2TP (Native) dan WireGuard (WG-Easy).
          </p>
        </div>
      </div>

      <div className="flex bg-gray-100 p-1 divide-x divide-gray-200 shadow-sm rounded-lg w-full max-w-sm">
        <button 
          onClick={() => setActiveTab('l2tp')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-l-md transition-colors ${activeTab === 'l2tp' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}
        >
          <Network className="w-4 h-4 inline mr-2" /> Native L2TP
        </button>
        <button 
          onClick={() => setActiveTab('wg')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-r-md transition-colors ${activeTab === 'wg' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}
        >
          <Shield className="w-4 h-4 inline mr-2" /> WireGuard
        </button>
      </div>

      {activeTab === 'l2tp' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 border-indigo-100">
            <CardHeader className="bg-indigo-50 border-b border-indigo-100">
              <CardTitle className="text-lg text-indigo-900 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Tambah L2TP Klien
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {errorMsg && <div className="text-sm text-red-600 mb-4 bg-red-50 p-2 rounded">{errorMsg}</div>}
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Username/Router ID</label>
                  <input type="text" required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" placeholder="nas-cabang-1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password / Secret</label>
                  <input type="text" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" placeholder="secret123" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Static IP (Opsional)</label>
                  <input type="text" value={formData.staticIp} onChange={e => setFormData({...formData, staticIp: e.target.value})} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" placeholder="192.168.42.10" />
                  <p className="text-xs text-gray-500 mt-1">Kosongkan untuk DHCP Acak L2TP Pool.</p>
                </div>
                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={submitting}>
                  {submitting ? 'Menyimpan...' : 'Simpan Klien L2TP'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Daftar Klien L2TP Aktif</CardTitle>
              <Button variant="outline" size="sm" onClick={fetchL2tpUsers} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Muat Ulang
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                      <th className="p-3">Username</th>
                      <th className="p-3">Password</th>
                      <th className="p-3">Static IP</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {l2tpUsers.length === 0 ? (
                      <tr><td colSpan={4} className="p-4 text-center text-gray-500">Belum ada Klien L2TP</td></tr>
                    ) : (
                      l2tpUsers.map((user: any) => (
                        <tr key={user.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="p-3 font-medium text-gray-900">{user.username}</td>
                          <td className="p-3 text-gray-500 flex items-center gap-1"><Lock className="w-3 h-3"/> {user.password}</td>
                          <td className="p-3 text-emerald-600 font-mono">{user.staticIp || 'Dynamic DHCP'}</td>
                          <td className="p-3 text-right">
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(user.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'wg' && (
        <Card className="h-[750px] overflow-hidden shadow-sm flex flex-col">
          <div className="bg-[#1a202c] p-2 pl-4 text-slate-200 tracking-wide text-xs font-semibold flex justify-between items-center shadow-md z-10 border-b border-gray-700">
              <span className="flex items-center gap-2 uppercase"><Shield className="w-4 h-4 text-emerald-400"/> WireGuard Native Gateway</span>
          </div>
          <CardContent className="p-0 flex-1 relative bg-slate-50">
            {wgUrl ? (
              <iframe 
                src={wgUrl} 
                className="w-full h-full border-0 absolute top-0 left-0"
                title="WireGuard UI"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              ></iframe>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">Loading UI...</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
