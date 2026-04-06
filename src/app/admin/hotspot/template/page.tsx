'use client';

import { useState, useEffect } from 'react';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { Plus, Edit2, Trash2, Eye, X, RefreshCw, FileCode } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { renderVoucherTemplate } from '@/lib/utils/templateRenderer';

const DEFAULT_TEMPLATE = `{include file="rad-template-header.tpl"}
{foreach $v as $vs}
<table style="display: inline-block; width: 188px; border: 1px solid #e0e0e0; border-collapse: collapse; font-family: Arial, sans-serif; margin: 3px; vertical-align: top;">
<tr>
<td style="padding: 0;">
<table style="width: 100%; border-collapse: collapse;">
<tr>
<td style="background: linear-gradient(to bottom, #ffd700, #ffed4e); color: #333; text-align: center; padding: 4px 0; font-size: 10px; font-weight: bold; border-bottom: 1px solid #e0e0e0;">
{if $vs['code'] eq $vs['secret']}Voucher Code{else}Username / Password{/if}
</td>
</tr>
</table>
{if $vs['code'] eq $vs['secret']}
<table style="width: 100%; background: #e6f7ff; border-collapse: collapse;">
<tr>
<td style="text-align: center; padding: 12px 8px;">
<div style="font-family: 'Courier New', monospace; font-size: 18px; font-weight: bold; color: #0066cc; letter-spacing: 1px;">
{$vs['code']}
</div>
</td>
</tr>
</table>
{else}
<table style="width: 100%; background: #e6f7ff; border-collapse: collapse;">
<tr>
<td style="width: 50%; text-align: center; padding: 2px; font-size: 9px; color: #666;">Username</td>
<td style="width: 50%; text-align: center; padding: 2px; font-size: 9px; color: #666;">Password</td>
</tr>
<tr>
<td style="text-align: center; padding: 8px 4px; border-right: 1px solid #d0d0d0;">
<div style="font-family: 'Courier New', monospace; font-size: 13px; font-weight: bold; color: #0066cc;">{$vs['code']}</div>
</td>
<td style="text-align: center; padding: 8px 4px;">
<div style="font-family: 'Courier New', monospace; font-size: 13px; font-weight: bold; color: #0066cc;">{$vs['secret']}</div>
</td>
</tr>
</table>
{/if}
<table style="width: 100%; border-collapse: collapse;">
<tr>
<td style="background: #f0f0f0; text-align: center; padding: 6px 0; font-size: 11px; color: #333; border-top: 1px solid #e0e0e0;">
NexaRadius - {$_c['currency_code']}. {number_format($vs['total'], 0, ',', '.')}
</td>
</tr>
</table>
</td>
</tr>
</table>
{/foreach}
{include file="rad-template-footer.tpl"}`;

interface VoucherTemplate {
  id: string;
  name: string;
  htmlTemplate: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function VoucherTemplatesPage() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<VoucherTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<VoucherTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    htmlTemplate: DEFAULT_TEMPLATE,
    isDefault: false,
    isActive: true
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/voucher-templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingTemplate ? `/api/voucher-templates/${editingTemplate.id}` : '/api/voucher-templates';
      const method = editingTemplate ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        await showSuccess(editingTemplate ? 'Template updated' : 'Template created');
        await fetchTemplates();
        handleCloseDialog();
      } else {
        const error = await res.json();
        await showError(error.error || 'Failed');
      }
    } catch (error) {
      await showError('Failed to save template');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm('Delete this template?');
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/voucher-templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await showSuccess('Template deleted');
        await fetchTemplates();
      } else {
        const error = await res.json();
        await showError(error.error || 'Failed');
      }
    } catch (error) {
      await showError('Failed to delete');
    }
  };

  const handleEdit = (template: VoucherTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      htmlTemplate: template.htmlTemplate,
      isDefault: template.isDefault,
      isActive: template.isActive
    });
    setShowDialog(true);
  };

  const handleAdd = () => {
    setEditingTemplate(null);
    setFormData({ name: '', htmlTemplate: DEFAULT_TEMPLATE, isDefault: false, isActive: true });
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingTemplate(null);
  };

  const sampleVouchers = [
    { code: 'DEMO1234', secret: 'DEMO1234', total: 10000 },
    { code: 'USER5678', secret: 'PASS5678', total: 25000 }
  ];

  const previewHtml = renderVoucherTemplate(
    formData.htmlTemplate,
    sampleVouchers,
    { currencyCode: 'Rp', companyName: 'NexaRadius' }
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileCode className="w-5 h-5 text-primary" />
            {t('hotspot.templateTitle')}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('hotspot.templateSubtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchTemplates}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-white rounded-md hover:bg-primary/90"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('hotspot.addTemplate')}
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-8 text-xs text-gray-500">{t('common.loading')}</div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('common.name')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('common.status')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('common.default')}</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {templates.map((template) => (
                <tr key={template.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-3 py-2">
                    <span className="font-medium text-xs text-gray-900 dark:text-white">{template.name}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      template.isActive
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {template.isActive ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {template.isDefault && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {t('common.default')}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(template)}
                        className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-gray-500 text-xs">
                    {t('hotspot.noTemplates')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {editingTemplate ? t('hotspot.editTemplate') : t('hotspot.addTemplate')}
                </h2>
                <p className="text-[10px] text-gray-500">{t('hotspot.configureTemplate')}</p>
              </div>
              <button onClick={handleCloseDialog} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hotspot.templateName')} *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-xs"
                  placeholder="e.g., Default Card"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hotspot.htmlTemplate')}</label>
                <textarea
                  value={formData.htmlTemplate}
                  onChange={(e) => setFormData({ ...formData, htmlTemplate: e.target.value })}
                  required
                  rows={12}
                  className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-md text-[10px] font-mono"
                  placeholder="Enter HTML template..."
                />
                <p className="text-[9px] text-gray-400 mt-1">
                  Use Smarty: {`{$vs['code']}, {$vs['secret']}, {$vs['total']}, {$_c['currency_code']}`}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="rounded border-gray-300 w-3.5 h-3.5 text-primary"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">{t('hotspot.setDefault')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-gray-300 w-3.5 h-3.5 text-primary"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">{t('common.active')}</span>
                </label>
              </div>
              <div className="flex justify-between pt-3 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary border border-primary rounded-md hover:bg-primary/10"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {t('hotspot.previewTemplate')}
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCloseDialog}
                    className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs bg-primary text-white rounded-md hover:bg-primary/90"
                  >
                    {editingTemplate ? t('common.update') : t('common.create')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('hotspot.previewTemplate')}</h2>
              <button onClick={() => setShowPreview(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-800">
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
