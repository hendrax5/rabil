"use client"
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { formatToWIB, formatDateOnly, formatTimeOnly, calculateTimeLeft } from "@/lib/utils/dateUtils"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Plus, Loader2, Trash2, Ticket, Printer, Check, Download, Upload, FileSpreadsheet, MessageCircle } from "lucide-react"
import { renderVoucherTemplate, getPrintableHtml } from '@/lib/utils/templateRenderer'
import { Switch } from "@/components/ui/switch"
import { useTranslation } from '@/hooks/useTranslation'

interface Voucher {
  id: string; code: string; password: string | null; batchCode: string | null;
  status: 'WAITING' | 'ACTIVE' | 'EXPIRED'; voucherType: string; codeType: string;
  firstLoginAt: string | null; expiresAt: string | null; lastUsedBy: string | null; createdAt: string;
  profile: { name: string; sellingPrice: number; validityValue: number; validityUnit: string };
  router?: { id: string; name: string; shortname: string } | null;
  agent?: { id: string; name: string; phone: string } | null;
}
interface Profile { id: string; name: string; sellingPrice: number }
interface RouterItem { id: string; name: string; shortname: string; nasname: string }
interface Agent { id: string; name: string; phone: string }

export default function HotspotVoucherPage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [routers, setRouters] = useState<RouterItem[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [batches, setBatches] = useState<string[]>([])
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [deleteBatchCode, setDeleteBatchCode] = useState<string | null>(null)
  const [selectedVouchers, setSelectedVouchers] = useState<string[]>([])
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false)
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [deletingVouchers, setDeletingVouchers] = useState(false)
  const [isWhatsAppDialogOpen, setIsWhatsAppDialogOpen] = useState(false)
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)
  const [filterProfile, setFilterProfile] = useState("")
  const [filterBatch, setFilterBatch] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterRouter, setFilterRouter] = useState("")
  const [filterAgent, setFilterAgent] = useState("")
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importProfileId, setImportProfileId] = useState('')
  const [importBatchCode, setImportBatchCode] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [formData, setFormData] = useState({ quantity: "", profileId: "", routerId: "", agentId: "", codeLength: "6", prefix: "", voucherType: "same", codeType: "alpha-upper", lockMac: false })

  useEffect(() => { loadProfiles(); loadRouters(); loadAgents(); loadVouchers(); loadTemplates(); }, [])
  useEffect(() => { loadVouchers(); }, [filterProfile, filterBatch, filterStatus, filterRouter, filterAgent])

  const loadProfiles = async () => { try { const res = await fetch('/api/hotspot/profiles'); const data = await res.json(); setProfiles(data.profiles || []); } catch (e) { console.error(e); } }
  const loadRouters = async () => { try { const res = await fetch('/api/network/routers'); const data = await res.json(); setRouters(data.routers || []); } catch (e) { console.error(e); } }
  const loadAgents = async () => { try { const res = await fetch('/api/hotspot/agents'); const data = await res.json(); setAgents(data.agents || []); } catch (e) { console.error(e); } }
  const loadTemplates = async () => { try { const res = await fetch('/api/voucher-templates'); if (res.ok) { const data = await res.json(); setTemplates(data.filter((t: any) => t.isActive)); const def = data.find((t: any) => t.isDefault); if (def) setSelectedTemplate(def.id); } } catch (e) { console.error(e); } }
  const loadVouchers = async () => {
    try {
      const params = new URLSearchParams();
      if (filterProfile && filterProfile !== 'all') params.append('profileId', filterProfile);
      if (filterBatch && filterBatch !== 'all') params.append('batchCode', filterBatch);
      if (filterStatus && filterStatus !== 'all') params.append('status', filterStatus);
      if (filterRouter && filterRouter !== 'all') params.append('routerId', filterRouter);
      if (filterAgent && filterAgent !== 'all') params.append('agentId', filterAgent);
      const res = await fetch(`/api/hotspot/voucher?${params}`);
      const data = await res.json();
      setVouchers(data.vouchers || []); setBatches(data.batches || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault(); setGenerating(true);
    try {
      const res = await fetch('/api/hotspot/voucher', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...formData, quantity: parseInt(formData.quantity), codeLength: parseInt(formData.codeLength) }) });
      const data = await res.json();
      if (res.ok) { await showSuccess(`${data.count} vouchers generated\nBatch: ${data.batchCode}`); setIsGenerateDialogOpen(false); setFormData({ quantity: "", profileId: "", routerId: "", agentId: "", codeLength: "6", prefix: "", voucherType: "same", codeType: "alpha-upper", lockMac: false }); loadVouchers(); }
      else { await showError(data.error); }
    } catch (e) { console.error(e); await showError('Failed'); } finally { setGenerating(false); }
  }

  const handleDeleteBatch = async () => {
    if (!deleteBatchCode) return;
    const confirmed = await showConfirm(`Delete unused vouchers from ${deleteBatchCode}?`);
    if (!confirmed) { setDeleteBatchCode(null); return; }
    try {
      const res = await fetch(`/api/hotspot/voucher?batchCode=${deleteBatchCode}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) { await showSuccess(`${data.count} deleted`); loadVouchers(); }
      else { await showError(data.error); }
    } catch (e) { console.error(e); await showError('Failed'); } finally { setDeleteBatchCode(null); }
  }

  const handleDeleteVoucher = async (voucherId: string, code: string) => {
    const confirmed = await showConfirm(`Delete ${code}?`);
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/hotspot/voucher/${voucherId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) { await showSuccess('Deleted'); loadVouchers(); }
      else { await showError(data.error); }
    } catch (e) { console.error(e); await showError('Failed'); }
  }

  const handleDeleteSelected = async () => {
    if (selectedVouchers.length === 0) { await showError('Select vouchers first'); return; }
    const confirmed = await showConfirm(`Delete ${selectedVouchers.length} voucher(s)?`);
    if (!confirmed) return;
    setDeletingVouchers(true);
    try {
      const res = await fetch('/api/hotspot/voucher/delete-multiple', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voucherIds: selectedVouchers }) });
      const data = await res.json();
      if (res.ok) { await showSuccess(`${data.deleted} deleted`); setSelectedVouchers([]); loadVouchers(); }
      else { await showError(data.error); }
    } catch (e) { console.error(e); await showError('Failed'); } finally { setDeletingVouchers(false); }
  }

  const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
  const handleSelectVoucher = (id: string) => { setSelectedVouchers(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); }
  const handleSelectAll = () => { const w = vouchers.filter(v => v.status === 'WAITING').map(v => v.id); setSelectedVouchers(w.length === selectedVouchers.length ? [] : w); }
  const handlePrintSelected = async () => { if (selectedVouchers.length === 0) { await showError('Select vouchers'); return; } setIsPrintDialogOpen(true); }
  const handleSendWhatsApp = async () => { if (selectedVouchers.length === 0) { await showError('Select vouchers'); return; } setIsWhatsAppDialogOpen(true); }
  
  const handleWhatsAppSubmit = async () => {
    if (!whatsappPhone) { await showError('Enter phone'); return; }
    setSendingWhatsApp(true);
    try {
      const vouchersToSend = vouchers.filter(v => selectedVouchers.includes(v.id));
      const res = await fetch('/api/hotspot/voucher/send-whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: whatsappPhone, vouchers: vouchersToSend.map(v => ({ code: v.code, profileName: v.profile.name, price: v.profile.sellingPrice, validity: `${v.profile.validityValue} ${v.profile.validityUnit.toLowerCase()}` })) }) });
      const data = await res.json();
      if (data.success) { await showSuccess('Sent!'); setIsWhatsAppDialogOpen(false); setWhatsappPhone(''); setSelectedVouchers([]); }
      else { await showError(data.error); }
    } catch (e) { console.error(e); await showError('Failed'); } finally { setSendingWhatsApp(false); }
  }

  const handlePrintBatch = async () => { if (!filterBatch || filterBatch === 'all') { await showError('Filter by batch first'); return; } const bv = vouchers.filter(v => v.batchCode === filterBatch && v.status === 'WAITING').map(v => v.id); setSelectedVouchers(bv); setIsPrintDialogOpen(true); }
  const handlePrint = async () => {
    if (!selectedTemplate) { await showError('Select template'); return; }
    const template = templates.find(t => t.id === selectedTemplate); if (!template) return;
    const vouchersToPrint = vouchers.filter(v => selectedVouchers.includes(v.id));
    const voucherData = vouchersToPrint.map(v => ({ code: v.code, secret: v.code, total: v.profile.sellingPrice }));
    const rendered = renderVoucherTemplate(template.htmlTemplate, voucherData, { currencyCode: 'Rp', companyName: 'AIBILL' });
    const printHtml = getPrintableHtml(rendered);
    const printWindow = window.open('', '_blank');
    if (printWindow) { printWindow.document.write(printHtml); printWindow.document.close(); printWindow.focus(); setTimeout(() => { printWindow.print(); }, 500); }
    setIsPrintDialogOpen(false); setSelectedVouchers([]);
  }

  const handleDownloadTemplate = async () => { try { const res = await fetch('/api/hotspot/voucher/bulk?type=template'); const blob = await res.blob(); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'voucher-template.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url); } catch (e) { console.error(e); await showError('Failed'); } }
  const handleExportData = async () => { try { const res = await fetch('/api/hotspot/voucher/bulk?type=export'); const blob = await res.blob(); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `vouchers-${new Date().toISOString().split('T')[0]}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url); } catch (e) { console.error(e); await showError('Failed'); } }
  
  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams();
      params.set('format', 'excel');
      if (filterProfile && filterProfile !== 'all') params.set('profileId', filterProfile);
      if (filterBatch && filterBatch !== 'all') params.set('batchCode', filterBatch);
      if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus);
      if (filterRouter && filterRouter !== 'all') params.set('routerId', filterRouter);
      if (filterAgent && filterAgent !== 'all') params.set('agentId', filterAgent);
      const res = await fetch(`/api/hotspot/voucher/export?${params}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `Vouchers-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
    } catch (e) { console.error(e); await showError('Export failed'); }
  };

  const handleExportPDFList = async () => {
    try {
      const params = new URLSearchParams();
      params.set('format', 'pdf');
      if (filterProfile && filterProfile !== 'all') params.set('profileId', filterProfile);
      if (filterBatch && filterBatch !== 'all') params.set('batchCode', filterBatch);
      if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus);
      const res = await fetch(`/api/hotspot/voucher/export?${params}`);
      const data = await res.json();
      if (data.pdfData) {
        const { jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(14); doc.text(data.pdfData.title, 14, 15);
        doc.setFontSize(8); doc.text(`Generated: ${data.pdfData.generatedAt}`, 14, 21);
        autoTable(doc, { head: [data.pdfData.headers], body: data.pdfData.rows, startY: 26, styles: { fontSize: 7 }, headStyles: { fillColor: [13, 148, 136] } });
        if (data.pdfData.summary) {
          const finalY = (doc as any).lastAutoTable.finalY + 8;
          doc.setFontSize(9); doc.setFont('helvetica', 'bold');
          data.pdfData.summary.forEach((s: any, i: number) => { doc.text(`${s.label}: ${s.value}`, 14, finalY + (i * 5)); });
        }
        doc.save(`Vouchers-${new Date().toISOString().split('T')[0]}.pdf`);
      }
    } catch (e) { console.error(e); await showError('PDF export failed'); }
  };

  const handleExportVoucherCards = async () => {
    const vouchersToExport = selectedVouchers.length > 0 
      ? vouchers.filter(v => selectedVouchers.includes(v.id))
      : vouchers.filter(v => v.status === 'WAITING');
    
    if (vouchersToExport.length === 0) { await showError('No vouchers to export'); return; }
    
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    // 4 cards per page (2x2)
    const cardWidth = 85;
    const cardHeight = 55;
    const margin = 12;
    const cardsPerRow = 2;
    const cardsPerPage = 4;
    
    vouchersToExport.forEach((v, idx) => {
      if (idx > 0 && idx % cardsPerPage === 0) doc.addPage();
      
      const pageIdx = idx % cardsPerPage;
      const row = Math.floor(pageIdx / cardsPerRow);
      const col = pageIdx % cardsPerRow;
      const x = margin + col * (cardWidth + margin);
      const y = margin + row * (cardHeight + margin);
      
      // Card border
      doc.setDrawColor(200); doc.setLineWidth(0.5);
      doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3);
      
      // Title
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('HOTSPOT VOUCHER', x + cardWidth/2, y + 8, { align: 'center' });
      
      // Code
      doc.setFontSize(16); doc.setFont('courier', 'bold');
      doc.text(v.code, x + cardWidth/2, y + 22, { align: 'center' });
      
      // Password if different
      if (v.password && v.voucherType === 'different') {
        doc.setFontSize(8); doc.setFont('helvetica', 'normal');
        doc.text(`Password: ${v.password}`, x + cardWidth/2, y + 28, { align: 'center' });
      }
      
      // Profile & price
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(v.profile.name, x + cardWidth/2, y + 36, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(v.profile.sellingPrice), x + cardWidth/2, y + 43, { align: 'center' });
      
      // Validity
      doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      doc.text(`Valid: ${v.profile.validityValue} ${v.profile.validityUnit.toLowerCase()}`, x + cardWidth/2, y + 50, { align: 'center' });
    });
    
    doc.save(`Voucher-Cards-${new Date().toISOString().split('T')[0]}.pdf`);
    setSelectedVouchers([]);
  };

  const handleImport = async () => {
    if (!importFile || !importProfileId) { await showError('Select file and profile'); return; }
    setImporting(true); setImportResult(null);
    try {
      const fd = new FormData(); fd.append('file', importFile); fd.append('profileId', importProfileId); if (importBatchCode) fd.append('batchCode', importBatchCode);
      const res = await fetch('/api/hotspot/voucher/bulk', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) { setImportResult(data.results); loadVouchers(); if (data.results.failed === 0) setTimeout(() => { setIsImportDialogOpen(false); setImportFile(null); setImportProfileId(''); setImportBatchCode(''); setImportResult(null); }, 3000); }
      else { await showError(data.error); }
    } catch (e) { console.error(e); await showError('Failed'); } finally { setImporting(false); }
  }

  const selectedProfile = profiles.find(p => p.id === formData.profileId);
  if (loading) { return <div className="flex items-center justify-center h-64"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>; }
  const stats = { total: vouchers.length, waiting: vouchers.filter(v => v.status === 'WAITING').length, active: vouchers.filter(v => v.status === 'ACTIVE').length, expired: vouchers.filter(v => v.status === 'EXPIRED').length, totalValue: vouchers.filter(v => v.status === 'WAITING').reduce((sum, v) => sum + Number(v.profile.sellingPrice), 0) };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('hotspot.title')}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('hotspot.generateVoucher')}</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="h-7 text-[10px] px-2"><Download className="h-3 w-3 mr-1" />{t('nav.template')}</Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-7 text-[10px] px-2 border-green-500 text-green-600 hover:bg-green-50"><Download className="h-3 w-3 mr-1" />Excel</Button>
          <Button variant="outline" size="sm" onClick={handleExportPDFList} className="h-7 text-[10px] px-2 border-red-500 text-red-600 hover:bg-red-50"><Download className="h-3 w-3 mr-1" />PDF</Button>
          <Button variant="outline" size="sm" onClick={handleExportVoucherCards} className="h-7 text-[10px] px-2 border-purple-500 text-purple-600 hover:bg-purple-50"><Printer className="h-3 w-3 mr-1" />Cards</Button>
          <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)} className="h-7 text-[10px] px-2"><Upload className="h-3 w-3 mr-1" />{t('common.import')}</Button>
          <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
            <DialogTrigger asChild><Button size="sm" className="h-7 text-[10px] px-2"><Plus className="h-3 w-3 mr-1" />{t('hotspot.generateVoucher')}</Button></DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="text-sm">{t('hotspot.generateVoucher')}</DialogTitle><DialogDescription className="text-xs">{t('hotspot.bulkGenerate')}</DialogDescription></DialogHeader>
              <form onSubmit={handleGenerate} className="space-y-3">
                <div><Label className="text-[10px]">{t('nav.router')}</Label><Select value={formData.routerId} onValueChange={(v) => setFormData({ ...formData, routerId: v === 'all' ? '' : v })}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('common.all')} /></SelectTrigger><SelectContent><SelectItem value="all">{t('common.all')} (Global)</SelectItem>{routers.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[10px]">{t('common.type')}</Label><Select value={formData.voucherType} onValueChange={(v) => setFormData({ ...formData, voucherType: v })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="same">User=Pass</SelectItem><SelectItem value="different">Different</SelectItem></SelectContent></Select></div>
                  <div><Label className="text-[10px]">{t('hotspot.code')} {t('common.type')}</Label><Select value={formData.codeType} onValueChange={(v) => setFormData({ ...formData, codeType: v })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="alpha-upper">UPPER</SelectItem><SelectItem value="alpha-lower">lower</SelectItem><SelectItem value="numeric">123456</SelectItem><SelectItem value="alphanumeric-upper">ABC123</SelectItem></SelectContent></Select></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[10px]">Prefix</Label><Input value={formData.prefix} onChange={(e) => setFormData({ ...formData, prefix: e.target.value.toUpperCase() })} maxLength={5} className="h-8 text-xs" placeholder="HS-" /></div>
                  <div><Label className="text-[10px]">Length (4-10)</Label><Input type="number" min="4" max="10" value={formData.codeLength} onChange={(e) => setFormData({ ...formData, codeLength: e.target.value })} className="h-8 text-xs" required /></div>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <div><Label className="text-[10px]">Lock MAC</Label><p className="text-[9px] text-gray-500">Bind to first device</p></div>
                  <Switch checked={formData.lockMac} onCheckedChange={(c) => setFormData({ ...formData, lockMac: c })} />
                </div>
                <div><Label className="text-[10px]">{t('nav.agent')}</Label><Select value={formData.agentId} onValueChange={(v) => setFormData({ ...formData, agentId: v === 'none' ? '' : v })}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="No Agent" /></SelectTrigger><SelectContent><SelectItem value="none">No Agent</SelectItem>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-[10px]">{t('hotspot.profile')} *</Label><Select value={formData.profileId} onValueChange={(v) => setFormData({ ...formData, profileId: v })} required><SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('common.select')} /></SelectTrigger><SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name} - {formatCurrency(p.sellingPrice)}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-[10px]">{t('common.quantity')} *</Label><Input type="number" min="1" max="500" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} className="h-8 text-xs" required /></div>
                {selectedProfile && <div className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded text-xs text-teal-700 dark:text-teal-300"><strong>{t('common.total')}:</strong> {formatCurrency(selectedProfile.sellingPrice * parseInt(formData.quantity || '0'))}</div>}
                <DialogFooter className="gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setIsGenerateDialogOpen(false)} className="h-7 text-xs">{t('common.cancel')}</Button><Button type="submit" size="sm" disabled={generating} className="h-7 text-xs">{generating ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />{t('common.loading')}</> : t('hotspot.generateVoucher')}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-2">
          <div className="flex items-center justify-between"><div><p className="text-[9px] text-gray-500 uppercase">{t('common.total')}</p><p className="text-base font-bold text-teal-600">{stats.total}</p></div><Ticket className="h-4 w-4 text-teal-600" /></div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-2">
          <div className="flex items-center justify-between"><div><p className="text-[9px] text-gray-500 uppercase">{t('hotspot.waiting')}</p><p className="text-base font-bold text-yellow-600">{stats.waiting}</p></div><Ticket className="h-4 w-4 text-yellow-600" /></div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-2">
          <div className="flex items-center justify-between"><div><p className="text-[9px] text-gray-500 uppercase">{t('hotspot.active')}</p><p className="text-base font-bold text-green-600">{stats.active}</p></div><Ticket className="h-4 w-4 text-green-600" /></div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-2">
          <div className="flex items-center justify-between"><div><p className="text-[9px] text-gray-500 uppercase">{t('hotspot.expired')}</p><p className="text-base font-bold text-red-600">{stats.expired}</p></div><Ticket className="h-4 w-4 text-red-600" /></div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-2 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between"><div><p className="text-[9px] text-gray-500 uppercase">{t('common.total')} {t('common.price')}</p><p className="text-sm font-bold text-purple-600">{formatCurrency(stats.totalValue)}</p></div><Ticket className="h-4 w-4 text-purple-600" /></div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <select value={filterProfile} onChange={(e) => setFilterProfile(e.target.value)} className="px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"><option value="">{t('common.all')} {t('nav.profiles')}</option><option value="all">{t('common.all')} {t('nav.profiles')}</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <select value={filterRouter} onChange={(e) => setFilterRouter(e.target.value)} className="px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"><option value="">{t('common.all')} {t('nav.routers')}</option><option value="all">{t('common.all')} {t('nav.routers')}</option>{routers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
          <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)} className="px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"><option value="">{t('common.all')} {t('nav.agent')}</option><option value="all">{t('common.all')} {t('nav.agent')}</option>{agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <select value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)} className="px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"><option value="">{t('common.all')} Batch</option><option value="all">{t('common.all')} Batch</option>{batches.map(b => <option key={b} value={b}>{b}</option>)}</select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"><option value="">{t('common.all')} {t('common.status')}</option><option value="all">{t('common.all')} {t('common.status')}</option><option value="WAITING">{t('hotspot.waiting')}</option><option value="ACTIVE">{t('hotspot.active')}</option><option value="EXPIRED">{t('hotspot.expired')}</option></select>
        </div>
      </div>

      {/* Vouchers Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-3 py-2 border-b dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium">{t('nav.voucher')} ({vouchers.length})</span>
          <div className="flex gap-1 flex-wrap">
            {selectedVouchers.length > 0 && (
              <>
                <button onClick={handleDeleteSelected} disabled={deletingVouchers} className="px-2 py-1 text-[10px] bg-red-600 text-white rounded flex items-center gap-0.5">{deletingVouchers ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Trash2 className="h-2.5 w-2.5" />}{t('common.delete')} ({selectedVouchers.length})</button>
                <button onClick={handleSendWhatsApp} className="px-2 py-1 text-[10px] bg-green-600 text-white rounded flex items-center gap-0.5"><MessageCircle className="h-2.5 w-2.5" />WA ({selectedVouchers.length})</button>
                <button onClick={handlePrintSelected} className="px-2 py-1 text-[10px] bg-primary text-white rounded flex items-center gap-0.5"><Printer className="h-2.5 w-2.5" />{t('common.print')} ({selectedVouchers.length})</button>
              </>
            )}
            {filterBatch && filterBatch !== 'all' && <button onClick={handlePrintBatch} className="px-2 py-1 text-[10px] bg-gray-600 text-white rounded flex items-center gap-0.5"><Printer className="h-2.5 w-2.5" />Batch</button>}
            {stats.expired > 0 && <button onClick={async () => { const c = await showConfirm(`${t('common.delete')} ${t('hotspot.expired')}?`); if (!c) return; const res = await fetch('/api/hotspot/voucher/delete-expired', { method: 'POST' }); const data = await res.json(); if (res.ok) { await showSuccess(`${data.count} ${t('notifications.deleted')}`); loadVouchers(); } else { await showError(data.error); } }} className="px-2 py-1 text-[10px] bg-red-600 text-white rounded flex items-center gap-0.5"><Trash2 className="h-2.5 w-2.5" />{t('hotspot.expired')} ({stats.expired})</button>}
            {filterBatch && filterBatch !== 'all' && <button onClick={() => setDeleteBatchCode(filterBatch)} className="px-2 py-1 text-[10px] bg-red-600 text-white rounded flex items-center gap-0.5"><Trash2 className="h-2.5 w-2.5" />{t('common.delete')} Batch</button>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 py-2"><input type="checkbox" checked={selectedVouchers.length > 0 && selectedVouchers.length === vouchers.filter(v => v.status === 'WAITING').length} onChange={handleSelectAll} className="rounded border-gray-300 w-3 h-3" /></TableHead>
                <TableHead className="text-[10px] py-2">{t('hotspot.code')}</TableHead>
                <TableHead className="text-[10px] py-2 hidden sm:table-cell">{t('hotspot.profile')}</TableHead>
                <TableHead className="text-[10px] py-2 hidden md:table-cell">{t('nav.router')}</TableHead>
                <TableHead className="text-[10px] py-2 hidden lg:table-cell">{t('nav.agent')}</TableHead>
                <TableHead className="text-[10px] py-2 hidden xl:table-cell">Batch</TableHead>
                <TableHead className="text-[10px] py-2">{t('hotspot.price')}</TableHead>
                <TableHead className="text-[10px] py-2">{t('common.status')}</TableHead>
                <TableHead className="text-[10px] py-2 hidden sm:table-cell">First Login</TableHead>
                <TableHead className="text-[10px] py-2 hidden md:table-cell">{t('hotspot.validUntil')}</TableHead>
                <TableHead className="text-[10px] py-2 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vouchers.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-gray-500 text-xs">{t('table.noResults')}</TableCell></TableRow>
              ) : (
                vouchers.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="py-1.5">{v.status === 'WAITING' && <input type="checkbox" checked={selectedVouchers.includes(v.id)} onChange={() => handleSelectVoucher(v.id)} className="rounded border-gray-300 w-3 h-3" />}</TableCell>
                    <TableCell className="py-1.5 font-mono font-bold text-xs">{v.code}{v.password && v.voucherType === 'different' && <div className="text-[9px] text-gray-500 font-normal">P: {v.password}</div>}</TableCell>
                    <TableCell className="py-1.5 text-xs hidden sm:table-cell">{v.profile.name}</TableCell>
                    <TableCell className="py-1.5 hidden md:table-cell">{v.router ? <Badge variant="outline" className="text-[9px] px-1">{v.router.shortname || v.router.name}</Badge> : <span className="text-[9px] text-gray-400">Global</span>}</TableCell>
                    <TableCell className="py-1.5 hidden lg:table-cell">{v.agent ? <Badge variant="secondary" className="text-[9px] px-1">{v.agent.name}</Badge> : <span className="text-[9px] text-gray-400">-</span>}</TableCell>
                    <TableCell className="py-1.5 hidden xl:table-cell"><span className="text-[9px] font-mono text-gray-500">{v.batchCode || 'N/A'}</span></TableCell>
                    <TableCell className="py-1.5 text-xs font-medium">{formatCurrency(v.profile.sellingPrice)}</TableCell>
                    <TableCell className="py-1.5">
                      {v.status === 'WAITING' && <Badge className="text-[9px] px-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30">{t('hotspot.waiting')}</Badge>}
                      {v.status === 'ACTIVE' && <Badge className="text-[9px] px-1 bg-green-100 text-green-700 dark:bg-green-900/30">{t('hotspot.active')}</Badge>}
                      {v.status === 'EXPIRED' && <Badge className="text-[9px] px-1 bg-red-100 text-red-700 dark:bg-red-900/30">{t('hotspot.expired')}</Badge>}
                    </TableCell>
                    <TableCell className="py-1.5 text-[10px] hidden sm:table-cell">{v.firstLoginAt ? <div><div>{formatDateOnly(v.firstLoginAt)}</div><div className="text-gray-500">{formatTimeOnly(v.firstLoginAt)}</div></div> : <span className="text-gray-400 italic">-</span>}</TableCell>
                    <TableCell className="py-1.5 text-[10px] hidden md:table-cell">{v.expiresAt ? <div><div>{formatDateOnly(v.expiresAt)}</div>{v.status === 'ACTIVE' && <div className="text-teal-600 font-medium">{calculateTimeLeft(v.expiresAt)}</div>}</div> : <span className="text-gray-400">-</span>}</TableCell>
                    <TableCell className="py-1.5 text-right"><button onClick={() => handleDeleteVoucher(v.id, v.code)} className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="h-3 w-3" /></button></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* WhatsApp Dialog */}
      <Dialog open={isWhatsAppDialogOpen} onOpenChange={setIsWhatsAppDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">{t('whatsapp.send')}</DialogTitle><DialogDescription className="text-xs">{t('whatsapp.send')} {selectedVouchers.length} voucher(s)</DialogDescription></DialogHeader>
          <div><Label className="text-[10px]">{t('whatsapp.phoneNumber')}</Label><Input type="tel" placeholder="628123456789" value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} className="h-8 text-xs" /></div>
          <DialogFooter className="gap-2"><Button variant="outline" size="sm" onClick={() => { setIsWhatsAppDialogOpen(false); setWhatsappPhone(''); }} className="h-7 text-xs">{t('common.cancel')}</Button><Button size="sm" onClick={handleWhatsAppSubmit} disabled={sendingWhatsApp || !whatsappPhone} className="h-7 text-xs">{sendingWhatsApp ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />{t('common.loading')}</> : <><MessageCircle className="h-3 w-3 mr-1" />{t('whatsapp.send')}</>}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">{t('hotspot.printVoucher')}</DialogTitle><DialogDescription className="text-xs">{t('common.select')} {t('nav.template')} ({selectedVouchers.length} voucher)</DialogDescription></DialogHeader>
          <div><Label className="text-[10px]">{t('nav.template')}</Label><Select value={selectedTemplate} onValueChange={setSelectedTemplate}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('common.select')} /></SelectTrigger><SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name} {t.isDefault && '(Default)'}</SelectItem>)}</SelectContent></Select></div>
          {templates.length === 0 && <p className="text-xs text-yellow-600">{t('common.noData')}</p>}
          <DialogFooter className="gap-2"><Button variant="outline" size="sm" onClick={() => setIsPrintDialogOpen(false)} className="h-7 text-xs">{t('common.cancel')}</Button><Button size="sm" onClick={handlePrint} disabled={!selectedTemplate} className="h-7 text-xs"><Printer className="h-3 w-3 mr-1" />{t('common.print')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">{t('common.import')} CSV</DialogTitle><DialogDescription className="text-xs">{t('common.upload')} {t('hotspot.code')}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-[10px]">CSV File *</Label><div className="flex items-center gap-2"><Input type="file" accept=".csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} className="flex-1 h-8 text-xs" />{importFile && <FileSpreadsheet className="h-4 w-4 text-green-600" />}</div></div>
            <div><Label className="text-[10px]">{t('hotspot.profile')} *</Label><Select value={importProfileId} onValueChange={setImportProfileId}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('common.select')} /></SelectTrigger><SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name} - {formatCurrency(p.sellingPrice)}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-[10px]">Batch Code</Label><Input value={importBatchCode} onChange={(e) => setImportBatchCode(e.target.value)} className="h-8 text-xs" placeholder="Auto-generate" /></div>
            {importResult && <div className="p-2 border rounded bg-gray-50 dark:bg-gray-800 text-xs"><div className="flex items-center gap-1 text-green-600"><Check className="h-3 w-3" />{importResult.success} {t('notifications.success')}</div>{importResult.failed > 0 && <div className="text-red-600">{importResult.failed} {t('notifications.failed')}</div>}</div>}
          </div>
          <DialogFooter className="gap-2"><Button variant="outline" size="sm" onClick={() => { setIsImportDialogOpen(false); setImportFile(null); setImportProfileId(''); setImportBatchCode(''); setImportResult(null); }} className="h-7 text-xs">{t('common.cancel')}</Button><Button size="sm" onClick={handleImport} disabled={!importFile || !importProfileId || importing} className="h-7 text-xs">{importing ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />{t('common.loading')}</> : <><Upload className="h-3 w-3 mr-1" />{t('common.import')}</>}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Batch Confirmation */}
      <AlertDialog open={!!deleteBatchCode} onOpenChange={() => setDeleteBatchCode(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader><AlertDialogTitle className="text-sm">{t('common.delete')} Batch</AlertDialogTitle><AlertDialogDescription className="text-xs">{t('common.delete')} {t('hotspot.unused')}: <strong>{deleteBatchCode}</strong></AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="h-7 text-xs">{t('common.cancel')}</AlertDialogCancel><AlertDialogAction onClick={handleDeleteBatch} className="h-7 text-xs bg-red-600 hover:bg-red-700">{t('common.delete')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
