'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { showSuccess, showError, showConfirm, showToast } from '@/lib/sweetalert';
import { formatWIB } from '@/lib/timezone';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, DollarSign, FileText, CheckCircle, Clock, RefreshCw, Eye, AlertCircle, Copy, Check, ExternalLink, MessageCircle, Trash2, Search, Download, Printer } from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  userId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerUsername: string | null;
  amount: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  paymentToken: string | null;
  paymentLink: string | null;
  createdAt: string;
  user: {
    name: string;
    phone: string;
    email: string | null;
    username: string;
    profile: {
      name: string;
    } | null;
  } | null;
}

interface Stats {
  total: number;
  unpaid: number;
  paid: number;
  pending: number;
  overdue: number;
  totalUnpaidAmount: number;
  totalPaidAmount: number;
}

export default function InvoicesPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    unpaid: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
    totalUnpaidAmount: 0,
    totalPaidAmount: 0,
  });
  const [activeTab, setActiveTab] = useState('unpaid');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingWA, setSendingWA] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadInvoices();
  }, [activeTab]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const status = activeTab === 'unpaid' ? 'PENDING' : activeTab === 'paid' ? 'PAID' : 'all';
      const res = await fetch(`/api/invoices?status=${status}`);
      const data = await res.json();
      setInvoices(data.invoices || []);
      setStats(data.stats || stats);
    } catch (error) {
      console.error('Load invoices error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsPaymentDialogOpen(true);
  };

  const confirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    setProcessing(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedInvoice.id, status: 'PAID' }),
      });

      if (res.ok) {
        await showSuccess('Invoice marked as paid!');
        setIsPaymentDialogOpen(false);
        loadInvoices();
      } else {
        const data = await res.json();
        await showError(data.error || 'Failed to mark as paid');
      }
    } catch (error) {
      await showError('Failed to mark as paid');
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerateInvoices = async () => {
    const confirmed = await showConfirm('Generate monthly invoices for all active customers?', 'Generate Invoices');
    if (!confirmed) return;

    setGenerating(true);
    try {
      const res = await fetch('/api/invoices/generate', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        await showSuccess(data.message, 'Invoices Generated');
        loadInvoices();
      } else {
        await showError(data.message || 'Failed to generate invoices');
      }
    } catch (error) {
      await showError('Failed to generate invoices');
    } finally {
      setGenerating(false);
    }
  };

  const handleViewDetail = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDetailDialogOpen(true);
  };

  const handleCopyPaymentLink = async (invoice: Invoice) => {
    if (!invoice.paymentLink) return;
    try {
      await navigator.clipboard.writeText(invoice.paymentLink);
      setCopiedId(invoice.id);
      setTimeout(() => setCopiedId(null), 2000);
      showToast('Payment link copied!', 'success');
    } catch (error) {
      showToast('Failed to copy', 'error');
    }
  };

  const handleSendWhatsApp = async (invoice: Invoice) => {
    if (!invoice.customerPhone) {
      await showError('Customer phone not found');
      return;
    }

    const confirmed = await showConfirm(`Send reminder to ${invoice.customerName || invoice.customerUsername}?`, 'Send WhatsApp');
    if (!confirmed) return;

    setSendingWA(invoice.id);
    try {
      const res = await fetch('/api/invoices/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      const data = await res.json();
      if (data.success) {
        await showSuccess('WhatsApp reminder sent!');
      } else {
        await showError(data.error || 'Failed to send');
      }
    } catch (error) {
      await showError('Failed to send WhatsApp');
    } finally {
      setSendingWA(null);
    }
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    const confirmed = await showConfirm(
      `Delete invoice ${invoice.invoiceNumber}?\n\n${invoice.customerName || invoice.customerUsername || 'Unknown'}\n${formatCurrency(Number(invoice.amount))}`,
      'Delete Invoice'
    );
    if (!confirmed) return;

    setDeleting(invoice.id);
    try {
      const res = await fetch(`/api/invoices?id=${invoice.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await showSuccess('Invoice deleted');
        loadInvoices();
      } else {
        await showError(data.error || 'Failed to delete');
      }
    } catch (error) {
      await showError('Failed to delete invoice');
    } finally {
      setDeleting(null);
    }
  };

  // Export functions
  const handleExportExcel = async () => {
    try {
      const status = activeTab === 'unpaid' ? 'PENDING' : activeTab === 'paid' ? 'PAID' : 'all';
      const res = await fetch(`/api/invoices/export?format=excel&status=${status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `Invoices-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
    } catch (error) { console.error('Export error:', error); await showError('Export failed'); }
  };

  const handleExportPDF = async () => {
    try {
      const status = activeTab === 'unpaid' ? 'PENDING' : activeTab === 'paid' ? 'PAID' : 'all';
      const res = await fetch(`/api/invoices/export?format=pdf&status=${status}`);
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
        doc.save(`Invoices-${new Date().toISOString().split('T')[0]}.pdf`);
      }
    } catch (error) { console.error('PDF error:', error); await showError('PDF export failed'); }
  };

  const handlePrintInvoice = async (invoice: Invoice) => {
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/pdf`);
      const data = await res.json();
      if (!data.success || !data.data) { await showError('Failed to get invoice data'); return; }
      const inv = data.data;
      
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text(inv.company.name, 105, 20, { align: 'center' });
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      if (inv.company.address) doc.text(inv.company.address, 105, 26, { align: 'center' });
      if (inv.company.phone) doc.text(`Tel: ${inv.company.phone}`, 105, 31, { align: 'center' });
      
      // Invoice title
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text('INVOICE', 105, 45, { align: 'center' });
      
      // Invoice details
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(`No: ${inv.invoice.number}`, 14, 55);
      doc.text(`Date: ${inv.invoice.date}`, 14, 61);
      doc.text(`Due: ${inv.invoice.dueDate}`, 14, 67);
      doc.text(`Status: ${inv.invoice.status}`, 14, 73);
      
      // Customer
      doc.setFont('helvetica', 'bold'); doc.text('Bill To:', 130, 55);
      doc.setFont('helvetica', 'normal');
      doc.text(inv.customer.name, 130, 61);
      if (inv.customer.phone) doc.text(inv.customer.phone, 130, 67);
      if (inv.customer.username) doc.text(`Username: ${inv.customer.username}`, 130, 73);
      
      // Items table
      const autoTable = (await import('jspdf-autotable')).default;
      autoTable(doc, {
        head: [['Description', 'Qty', 'Price', 'Total']],
        body: inv.items.map((item: any) => [item.description, item.quantity, formatCurrency(item.price), formatCurrency(item.total)]),
        startY: 85,
        headStyles: { fillColor: [13, 148, 136] },
        styles: { fontSize: 10 }
      });
      
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      doc.text(`Total: ${inv.amountFormatted}`, 196, finalY, { align: 'right' });
      
      if (inv.invoice.paidAt) {
        doc.setFontSize(14); doc.setTextColor(0, 128, 0);
        doc.text('PAID', 105, finalY + 15, { align: 'center' });
        doc.setFontSize(9); doc.text(`Paid on: ${inv.invoice.paidAt}`, 105, finalY + 21, { align: 'center' });
      }
      
      doc.save(`Invoice-${inv.invoice.number}.pdf`);
    } catch (error) { console.error('Print error:', error); await showError('Failed to print invoice'); }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateStr: string) => formatWIB(new Date(dateStr), 'd MMM yyyy');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] px-1.5 py-0.5">{t('invoices.paid')}</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-[10px] px-1.5 py-0.5">{t('invoices.pending')}</Badge>;
      case 'OVERDUE':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] px-1.5 py-0.5">{t('invoices.overdue')}</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 text-[10px] px-1.5 py-0.5">{t('invoices.cancelled')}</Badge>;
      default:
        return <Badge className="text-[10px] px-1.5 py-0.5">{status}</Badge>;
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.user?.name?.toLowerCase().includes(q) ||
      inv.customerName?.toLowerCase().includes(q) ||
      inv.user?.phone?.includes(q) ||
      inv.customerPhone?.includes(q)
    );
  });

  if (loading && invoices.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{t('invoices.title')}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('invoices.monthlyBilling')}</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={handleExportExcel} className="inline-flex items-center px-2 py-1.5 text-xs border border-green-500 text-green-600 rounded hover:bg-green-50 dark:hover:bg-green-900/20"><Download className="h-3 w-3 mr-1" />Excel</button>
          <button onClick={handleExportPDF} className="inline-flex items-center px-2 py-1.5 text-xs border border-red-500 text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20"><Download className="h-3 w-3 mr-1" />PDF</button>
          <Button onClick={handleGenerateInvoices} disabled={generating} size="sm" className="h-8 text-xs">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            {t('invoices.generateInvoice')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-medium text-gray-500 uppercase">{t('common.total')}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
            <div className="p-2 rounded-md bg-teal-50 dark:bg-teal-900/20 text-teal-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-medium text-gray-500 uppercase">{t('invoices.pending')}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.unpaid}</p>
              <p className="text-[10px] text-gray-500">{formatCurrency(Number(stats.totalUnpaidAmount))}</p>
            </div>
            <div className="p-2 rounded-md bg-red-50 dark:bg-red-900/20 text-red-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-medium text-gray-500 uppercase">{t('invoices.paid')}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.paid}</p>
              <p className="text-[10px] text-gray-500">{formatCurrency(Number(stats.totalPaidAmount))}</p>
            </div>
            <div className="p-2 rounded-md bg-green-50 dark:bg-green-900/20 text-green-600">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-medium text-gray-500 uppercase">{t('invoices.overdue')}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.overdue}</p>
            </div>
            <div className="p-2 rounded-md bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Invoice List */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
        {/* Tabs & Search */}
        <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
          <div className="flex gap-1">
            {[
              { key: 'unpaid', label: `${t('invoices.pending')} (${stats.unpaid})` },
              { key: 'paid', label: `${t('invoices.paid')} (${stats.paid})` },
              { key: 'all', label: `${t('common.all')} (${stats.total})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === tab.key
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-48 pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-[10px]">
                <TableHead className="text-[10px] py-2">{t('invoices.invoiceNumber')}</TableHead>
                <TableHead className="text-[10px] py-2">{t('invoices.customer')}</TableHead>
                <TableHead className="text-[10px] py-2 hidden md:table-cell">{t('nav.profile')}</TableHead>
                <TableHead className="text-[10px] py-2 text-right">{t('invoices.amount')}</TableHead>
                <TableHead className="text-[10px] py-2">{t('invoices.status')}</TableHead>
                <TableHead className="text-[10px] py-2 hidden sm:table-cell">{t('invoices.dueDate')}</TableHead>
                <TableHead className="text-[10px] py-2 text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                    <AlertCircle className="h-5 w-5 mx-auto mb-1 opacity-50" />
                    <p className="text-xs">{t('common.noData')}</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id} className="text-xs">
                    <TableCell className="py-2 font-mono text-[10px]">{invoice.invoiceNumber}</TableCell>
                    <TableCell className="py-2">
                      <div className="font-medium text-xs truncate max-w-[120px]">{invoice.user?.name || invoice.customerName || 'Deleted'}</div>
                      <div className="text-[10px] text-gray-500 truncate">{invoice.user?.phone || invoice.customerPhone || '-'}</div>
                    </TableCell>
                    <TableCell className="py-2 hidden md:table-cell text-[10px] text-gray-500">{invoice.user?.profile?.name || '-'}</TableCell>
                    <TableCell className="py-2 text-right font-medium text-xs">{formatCurrency(Number(invoice.amount))}</TableCell>
                    <TableCell className="py-2">{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell className="py-2 hidden sm:table-cell text-[10px] text-gray-500">{formatDate(invoice.dueDate)}</TableCell>
                    <TableCell className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {invoice.paymentLink && (
                          <button onClick={() => handleCopyPaymentLink(invoice)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded" title="Copy Link">
                            {copiedId === invoice.id ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-gray-500" />}
                          </button>
                        )}
                        <button onClick={() => handlePrintInvoice(invoice)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded" title="Print PDF">
                          <Printer className="h-3 w-3 text-gray-500" />
                        </button>
                        <button onClick={() => handleViewDetail(invoice)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded" title="View">
                          <Eye className="h-3 w-3 text-gray-500" />
                        </button>
                        {(invoice.status === 'PENDING' || invoice.status === 'OVERDUE') && invoice.customerPhone && (
                          <button onClick={() => handleSendWhatsApp(invoice)} disabled={sendingWA === invoice.id} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded" title="WhatsApp">
                            {sendingWA === invoice.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3 text-gray-500" />}
                          </button>
                        )}
                        {(invoice.status === 'PENDING' || invoice.status === 'OVERDUE') && (
                          <button onClick={() => handleMarkAsPaid(invoice)} className="px-1.5 py-0.5 text-[10px] font-medium bg-primary text-white rounded hover:bg-primary/90">
                            {t('invoices.paid')}
                          </button>
                        )}
                        <button onClick={() => handleDeleteInvoice(invoice)} disabled={deleting === invoice.id} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-600" title="Delete">
                          {deleting === invoice.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">{t('common.details')}</DialogTitle>
            <DialogDescription className="text-xs">{selectedInvoice?.invoiceNumber}</DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-gray-500">{t('invoices.invoiceNumber')}</p>
                  <p className="font-mono font-medium">{selectedInvoice.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">{t('invoices.status')}</p>
                  <div className="mt-0.5">{getStatusBadge(selectedInvoice.status)}</div>
                </div>
              </div>
              <div className="border-t pt-3 dark:border-gray-800">
                <p className="text-[10px] text-gray-500">{t('invoices.customer')}</p>
                <p className="font-medium">{selectedInvoice.user?.name || selectedInvoice.customerName || 'Deleted'}</p>
                <p className="text-gray-500">{selectedInvoice.user?.phone || selectedInvoice.customerPhone || '-'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-gray-500">{t('nav.profile')}</p>
                  <p>{selectedInvoice.user?.profile?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">{t('invoices.amount')}</p>
                  <p className="text-base font-bold text-green-600">{formatCurrency(Number(selectedInvoice.amount))}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-gray-500">{t('invoices.createdAt')}</p>
                  <p>{formatDate(selectedInvoice.createdAt)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">{t('invoices.dueDate')}</p>
                  <p>{formatDate(selectedInvoice.dueDate)}</p>
                </div>
              </div>
              {selectedInvoice.paymentLink && (
                <div className="border-t pt-3 dark:border-gray-800">
                  <p className="text-[10px] text-gray-500 mb-1.5">{t('invoices.paymentLink')}</p>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={selectedInvoice.paymentLink}
                      readOnly
                      className="flex-1 px-2 py-1.5 text-[10px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded font-mono truncate"
                    />
                    <button onClick={() => handleCopyPaymentLink(selectedInvoice)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                      {copiedId === selectedInvoice.id ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => window.open(selectedInvoice.paymentLink!, '_blank')} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsDetailDialogOpen(false)} size="sm" className="h-8 text-xs">{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">{t('invoices.markAsPaid')}</DialogTitle>
            <DialogDescription className="text-xs">{selectedInvoice?.invoiceNumber}</DialogDescription>
          </DialogHeader>
          <form onSubmit={confirmPayment} className="space-y-3">
            <div className="text-xs">
              <p className="text-[10px] text-gray-500">{t('invoices.customer')}</p>
              <p className="font-medium">{selectedInvoice?.user?.name || selectedInvoice?.customerName || 'Deleted'}</p>
            </div>
            <div className="text-xs">
              <p className="text-[10px] text-gray-500">{t('invoices.amount')}</p>
              <p className="text-base font-bold">{formatCurrency(Number(selectedInvoice?.amount || 0))}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-2.5">
              <p className="text-[10px] text-blue-800 dark:text-blue-300">
                ℹ️ {t('invoices.expiryExtendedNote')}
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)} disabled={processing} size="sm" className="h-8 text-xs">
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={processing} size="sm" className="h-8 text-xs">
                {processing && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                {t('common.confirm')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
