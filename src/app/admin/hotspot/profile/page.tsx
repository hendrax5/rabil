"use client"

import { useEffect, useState } from "react"
import { Plus, Loader2, Trash2, Edit, Ticket, RefreshCw } from "lucide-react"
import { useTranslation } from '@/hooks/useTranslation'

interface HotspotProfile {
  id: string
  name: string
  costPrice: number
  resellerFee: number
  sellingPrice: number
  speed: string
  groupProfile: string | null
  sharedUsers: number
  validityValue: number
  validityUnit: string
  agentAccess: boolean
  eVoucherAccess: boolean
  isActive: boolean
}

export default function HotspotProfilePage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<HotspotProfile[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<HotspotProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteProfileId, setDeleteProfileId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    costPrice: "",
    resellerFee: "0",
    speed: "",
    groupProfile: "",
    sharedUsers: "1",
    validityValue: "",
    validityUnit: "HOURS",
    agentAccess: true,
    eVoucherAccess: true,
  })

  useEffect(() => {
    loadProfiles()
  }, [])

  const loadProfiles = async () => {
    try {
      const res = await fetch('/api/hotspot/profiles')
      const data = await res.json()
      setProfiles(data.profiles || [])
    } catch (error) {
      console.error('Load profiles error:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      costPrice: "",
      resellerFee: "0",
      speed: "",
      groupProfile: "",
      sharedUsers: "1",
      validityValue: "",
      validityUnit: "HOURS",
      agentAccess: true,
      eVoucherAccess: true,
    })
    setEditingProfile(null)
  }

  const handleEdit = (profile: HotspotProfile) => {
    setEditingProfile(profile)
    setFormData({
      name: profile.name,
      costPrice: profile.costPrice.toString(),
      resellerFee: profile.resellerFee.toString(),
      speed: profile.speed,
      groupProfile: profile.groupProfile || "",
      sharedUsers: profile.sharedUsers.toString(),
      validityValue: profile.validityValue.toString(),
      validityUnit: profile.validityUnit,
      agentAccess: profile.agentAccess,
      eVoucherAccess: profile.eVoucherAccess,
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const url = '/api/hotspot/profiles'
      const method = editingProfile ? 'PUT' : 'POST'
      const body = editingProfile ? { id: editingProfile.id, ...formData } : formData
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setIsDialogOpen(false)
        resetForm()
        loadProfiles()
      } else {
        const error = await res.json()
        alert('Failed: ' + error.error)
      }
    } catch (error) {
      alert('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteProfileId) return
    try {
      const res = await fetch(`/api/hotspot/profiles?id=${deleteProfileId}`, { method: 'DELETE' })
      if (res.ok) {
        loadProfiles()
      } else {
        const error = await res.json()
        alert('Failed: ' + error.error)
      }
    } catch (error) {
      alert('Failed to delete profile')
    } finally {
      setDeleteProfileId(null)
    }
  }

  const formatValidity = (value: number, unit: string) => {
    const unitMap: Record<string, string> = {
      MINUTES: t('hotspot.minutes'),
      HOURS: t('hotspot.hours'),
      DAYS: t('hotspot.days'),
      MONTHS: t('hotspot.months'),
    }
    return `${value} ${unitMap[unit] || unit}`
  }

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)

  const sellingPrice = parseFloat(formData.costPrice || '0') + parseFloat(formData.resellerFee || '0')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary" />
            {t('hotspot.profiles')}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('hotspot.profilesSubtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadProfiles}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { resetForm(); setIsDialogOpen(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-white rounded-md hover:bg-primary/90"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('hotspot.addProfile')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium text-gray-500 uppercase">{t('common.total')}</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{profiles.length}</div>
            </div>
            <Ticket className="w-4 h-4 text-blue-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium text-gray-500 uppercase">{t('common.active')}</div>
              <div className="text-lg font-bold text-green-600">{profiles.filter(p => p.isActive).length}</div>
            </div>
            <Ticket className="w-4 h-4 text-green-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium text-gray-500 uppercase">{t('hotspot.avgPrice')}</div>
              <div className="text-sm font-bold text-purple-600">
                {profiles.length > 0 ? formatCurrency(profiles.reduce((sum, p) => sum + p.sellingPrice, 0) / profiles.length) : 'Rp 0'}
              </div>
            </div>
            <Ticket className="w-4 h-4 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('hotspot.profile')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('hotspot.speed')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('hotspot.validity')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden sm:table-cell">{t('hotspot.costPrice')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('hotspot.sellingPrice')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('common.status')}</th>
                <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500 text-xs">
                    {t('hotspot.noProfiles')}
                  </td>
                </tr>
              ) : (
                profiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2">
                      <span className="font-medium text-xs text-gray-900 dark:text-white">{profile.name}</span>
                      {profile.groupProfile && (
                        <span className="ml-1 text-[9px] text-gray-400">({profile.groupProfile})</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-gray-600">{profile.speed}</td>
                    <td className="px-3 py-2 text-[10px] text-gray-600">{formatValidity(profile.validityValue, profile.validityUnit)}</td>
                    <td className="px-3 py-2 text-[10px] text-gray-500 hidden sm:table-cell">{formatCurrency(profile.costPrice)}</td>
                    <td className="px-3 py-2 text-xs font-medium text-green-600">{formatCurrency(profile.sellingPrice)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        profile.isActive 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {profile.isActive ? t('common.active') : t('common.inactive')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleEdit(profile)}
                          className="p-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteProfileId(profile.id)}
                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Delete"
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

      {/* Add/Edit Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                {editingProfile ? t('hotspot.editProfile') : t('hotspot.addProfile')}
              </h2>
              <p className="text-[10px] text-gray-500">{editingProfile ? t('common.update') : t('common.create')}</p>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.name')} *</label>
                <input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., 3Jam-5M"
                  required
                  className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hotspot.costPrice')} *</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    placeholder="0"
                    required
                    className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hotspot.resellerFee')}</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.resellerFee}
                    onChange={(e) => setFormData({ ...formData, resellerFee: e.target.value })}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
                  />
                </div>
              </div>
              <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 p-2 rounded-lg">
                <div className="text-[10px] text-gray-600 dark:text-gray-400">{t('hotspot.sellingPrice')}</div>
                <div className="text-base font-bold text-green-600">{formatCurrency(sellingPrice)}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hotspot.speed')} *</label>
                  <input
                    value={formData.speed}
                    onChange={(e) => setFormData({ ...formData, speed: e.target.value })}
                    placeholder="e.g. 5M/5M"
                    required
                    className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hotspot.groupProfile')}</label>
                  <input
                    value={formData.groupProfile}
                    onChange={(e) => setFormData({ ...formData, groupProfile: e.target.value })}
                    placeholder={t('common.optional')}
                    className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hotspot.sharedUsers')} *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.sharedUsers}
                    onChange={(e) => setFormData({ ...formData, sharedUsers: e.target.value })}
                    required
                    className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hotspot.validity')} *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.validityValue}
                    onChange={(e) => setFormData({ ...formData, validityValue: e.target.value })}
                    required
                    className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.type')}</label>
                  <select
                    value={formData.validityUnit}
                    onChange={(e) => setFormData({ ...formData, validityUnit: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
                  >
                    <option value="MINUTES">{t('hotspot.minutes')}</option>
                    <option value="HOURS">{t('hotspot.hours')}</option>
                    <option value="DAYS">{t('hotspot.days')}</option>
                    <option value="MONTHS">{t('hotspot.months')}</option>
                  </select>
                </div>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-800 pt-3 space-y-2">
                <div className="text-[10px] font-medium text-gray-700 dark:text-gray-300">{t('hotspot.accessSettings')}</div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.agentAccess}
                    onChange={(e) => setFormData({ ...formData, agentAccess: e.target.checked })}
                    className="rounded border-gray-300 w-3.5 h-3.5 text-primary"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">{t('hotspot.agentAccess')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.eVoucherAccess}
                    onChange={(e) => setFormData({ ...formData, eVoucherAccess: e.target.checked })}
                    className="rounded border-gray-300 w-3.5 h-3.5 text-primary"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">{t('hotspot.evoucherAccess')}</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => { setIsDialogOpen(false); resetForm() }}
                  className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3 py-1.5 text-xs bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : editingProfile ? t('common.update') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteProfileId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-sm w-full p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('hotspot.deleteProfile')}</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 mb-4">
              {t('hotspot.confirmDeleteProfile')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteProfileId(null)}
                className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
