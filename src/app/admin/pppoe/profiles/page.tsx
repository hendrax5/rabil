'use client';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface PPPoEProfile {
  id: string; name: string; description: string | null; price: number;
  downloadSpeed: number; uploadSpeed: number; groupName: string;
  validityValue: number; validityUnit: 'DAYS' | 'MONTHS';
  isActive: boolean; syncedToRadius: boolean; createdAt: string;
}

export default function PPPoEProfilesPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<PPPoEProfile[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PPPoEProfile | null>(null);
  const [deleteProfileId, setDeleteProfileId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', price: '', downloadSpeed: '', uploadSpeed: '', groupName: '', validityValue: '1', validityUnit: 'MONTHS' as 'DAYS' | 'MONTHS' });

  useEffect(() => { loadProfiles(); }, []);

  const loadProfiles = async () => {
    try { const res = await fetch('/api/pppoe/profiles'); const data = await res.json(); setProfiles(data.profiles || []); }
    catch (error) { console.error('Load error:', error); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingProfile ? 'PUT' : 'POST';
      const payload = { ...formData, ...(editingProfile && { id: editingProfile.id }), price: parseInt(formData.price), downloadSpeed: parseInt(formData.downloadSpeed), uploadSpeed: parseInt(formData.uploadSpeed), validityValue: parseInt(formData.validityValue) };
      const res = await fetch('/api/pppoe/profiles', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await res.json();
      if (res.ok) { setIsDialogOpen(false); setEditingProfile(null); resetForm(); loadProfiles(); await showSuccess(editingProfile ? 'Updated!' : 'Created!'); }
      else { await showError('Error: ' + result.error); }
    } catch (error) { console.error('Submit error:', error); await showError('Failed'); }
  };

  const handleEdit = (profile: PPPoEProfile) => {
    setEditingProfile(profile);
    setFormData({ name: profile.name, description: profile.description || '', price: profile.price.toString(), downloadSpeed: profile.downloadSpeed.toString(), uploadSpeed: profile.uploadSpeed.toString(), groupName: profile.groupName, validityValue: profile.validityValue.toString(), validityUnit: profile.validityUnit });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteProfileId) return;
    const confirmed = await showConfirm('Delete? This removes from RADIUS.');
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/pppoe/profiles?id=${deleteProfileId}`, { method: 'DELETE' });
      const result = await res.json();
      if (res.ok) { await showSuccess('Deleted!'); loadProfiles(); }
      else { await showError(result.error || 'Failed'); }
    } catch (error) { console.error('Delete error:', error); await showError('Failed'); }
    finally { setDeleteProfileId(null); }
  };

  const resetForm = () => { setFormData({ name: '', description: '', price: '', downloadSpeed: '', uploadSpeed: '', groupName: '', validityValue: '1', validityUnit: 'MONTHS' }); };

  if (loading) { return <div className="flex items-center justify-center h-64"><p className="text-xs text-gray-500">Loading...</p></div>; }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('pppoe.profilesTitle')}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('pppoe.profilesSubtitle')}</p>
        </div>
        <button onClick={() => { resetForm(); setEditingProfile(null); setIsDialogOpen(true); }} className="inline-flex items-center px-3 py-1.5 text-xs bg-primary hover:bg-primary/90 text-white rounded"><Plus className="h-3 w-3 mr-1" />{t('pppoe.addProfile')}</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div><p className="text-[10px] text-gray-500 uppercase">{t('common.total')}</p><p className="text-base font-bold text-teal-600">{profiles.length}</p></div>
            <FileText className="h-5 w-5 text-teal-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div><p className="text-[10px] text-gray-500 uppercase">{t('pppoe.active')}</p><p className="text-base font-bold text-green-600">{profiles.filter(p => p.isActive).length}</p></div>
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div><p className="text-[10px] text-gray-500 uppercase">{t('pppoe.synced')}</p><p className="text-base font-bold text-purple-600">{profiles.filter(p => p.syncedToRadius).length}</p></div>
            <CheckCircle2 className="h-5 w-5 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-3 py-2 border-b dark:border-gray-800">
          <span className="text-xs font-medium">{t('pppoe.profilesList')}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('common.name')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden md:table-cell">Group</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('hotspot.price')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden sm:table-cell">{t('hotspot.speed')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden lg:table-cell">{t('pppoe.validity')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('common.status')}</th>
                <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {profiles.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500 text-xs">{t('pppoe.noProfiles')}</td></tr>
              ) : (
                profiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2"><p className="font-medium text-xs">{profile.name}</p>{profile.description && <p className="text-[10px] text-gray-500 truncate max-w-[120px]">{profile.description}</p>}</td>
                    <td className="px-3 py-2 font-mono text-xs hidden md:table-cell">{profile.groupName}</td>
                    <td className="px-3 py-2 text-xs">Rp {profile.price.toLocaleString('id-ID')}</td>
                    <td className="px-3 py-2 font-mono text-xs hidden sm:table-cell">{profile.downloadSpeed}M/{profile.uploadSpeed}M</td>
                    <td className="px-3 py-2 text-xs hidden lg:table-cell">{profile.validityValue} {profile.validityUnit === 'MONTHS' ? 'Mo' : 'D'}</td>
                    <td className="px-3 py-2">
                      {profile.syncedToRadius ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30"><CheckCircle2 className="h-2 w-2 mr-0.5" />{t('pppoe.synced')}</span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30"><XCircle className="h-2 w-2 mr-0.5" />{t('pppoe.pending')}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-0.5">
                        <button onClick={() => handleEdit(profile)} className="p-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><Pencil className="h-3 w-3" /></button>
                        <button onClick={() => setDeleteProfileId(profile.id)} className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b dark:border-gray-800">
              <h2 className="text-sm font-semibold">{editingProfile ? t('pppoe.editProfile') : t('pppoe.addProfile')}</h2>
              <p className="text-[10px] text-gray-500">{editingProfile ? t('pppoe.updateConfig') : t('pppoe.createProfile')}</p>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] font-medium mb-1">{t('common.name')} *</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800" /></div>
                <div><label className="block text-[10px] font-medium mb-1">{t('pppoe.radiusGroup')} *</label><input type="text" value={formData.groupName} onChange={(e) => setFormData({ ...formData, groupName: e.target.value })} required className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800" /><p className="text-[9px] text-gray-500 mt-0.5">{t('pppoe.matchMikrotik')}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] font-medium mb-1">{t('pppoe.priceIdr')} *</label><input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} required className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800" /></div>
                <div><label className="block text-[10px] font-medium mb-1">{t('pppoe.validity')} *</label>
                  <div className="flex gap-1">
                    <input type="number" min="1" value={formData.validityValue} onChange={(e) => setFormData({ ...formData, validityValue: e.target.value })} required className="w-16 px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800" />
                    <select value={formData.validityUnit} onChange={(e) => setFormData({ ...formData, validityUnit: e.target.value as 'DAYS' | 'MONTHS' })} className="flex-1 px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"><option value="DAYS">{t('pppoe.days')}</option><option value="MONTHS">{t('pppoe.months')}</option></select>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] font-medium mb-1">{t('pppoe.downloadMbps')} *</label><input type="number" min="1" value={formData.downloadSpeed} onChange={(e) => setFormData({ ...formData, downloadSpeed: e.target.value })} required className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800" /></div>
                <div><label className="block text-[10px] font-medium mb-1">{t('pppoe.uploadMbps')} *</label><input type="number" min="1" value={formData.uploadSpeed} onChange={(e) => setFormData({ ...formData, uploadSpeed: e.target.value })} required className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800" /></div>
              </div>
              <div><label className="block text-[10px] font-medium mb-1">{t('common.description')}</label><input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800" /></div>
              <div className="flex justify-end gap-2 pt-3 border-t dark:border-gray-800">
                <button type="button" onClick={() => { setIsDialogOpen(false); setEditingProfile(null); resetForm(); }} className="px-3 py-1.5 text-xs border dark:border-gray-700 rounded">{t('common.cancel')}</button>
                <button type="submit" className="px-3 py-1.5 text-xs bg-primary text-white rounded">{editingProfile ? t('common.update') : t('common.create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      {deleteProfileId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-sm w-full p-4">
            <h2 className="text-sm font-semibold mb-1">{t('pppoe.deleteProfile')}</h2>
            <p className="text-xs text-gray-500 mb-4">{t('pppoe.deleteProfileConfirm')}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteProfileId(null)} className="px-3 py-1.5 text-xs border dark:border-gray-700 rounded">{t('common.cancel')}</button>
              <button onClick={handleDelete} className="px-3 py-1.5 text-xs bg-red-600 text-white rounded">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
