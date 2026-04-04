"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { showSuccess, showError, showConfirm } from "@/lib/sweetalert";
import { formatWIB } from "@/lib/timezone";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  Edit,
  Trash2,
  Filter,
  Download,
  Calendar,
  Tag,
  Search,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  description: string | null;
  _count?: { transactions: number };
}

interface Transaction {
  id: string;
  categoryId: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  description: string;
  date: string;
  reference: string | null;
  notes: string | null;
  category: Category;
}

interface Stats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  incomeCount: number;
  expenseCount: number;
  pppoeIncome?: number;
  pppoeCount?: number;
  hotspotIncome?: number;
  hotspotCount?: number;
  installIncome?: number;
  installCount?: number;
}

export default function KeuanganPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    incomeCount: 0,
    expenseCount: 0,
  });

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  
  // Initialize with current month date range
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const [startDate, setStartDate] = useState(firstDayOfMonth.toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(lastDayOfMonth.toISOString().split("T")[0]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactionForm, setTransactionForm] = useState({
    categoryId: "",
    type: "INCOME" as "INCOME" | "EXPENSE",
    amount: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    reference: "",
    notes: "",
  });

  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    type: "INCOME" as "INCOME" | "EXPENSE",
    description: "",
  });

  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
    setTransactions([]);
    setHasMore(true);
    loadData(1, true);
  }, [filterType, filterCategory, startDate, endDate, debouncedSearch]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 100) {
        if (!loading && !loadingMore && hasMore) loadMoreData();
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loading, loadingMore, hasMore, page]);

  const loadData = async (pageNum = 1, reset = false) => {
    try {
      reset ? setLoading(true) : setLoadingMore(true);

      let url = `/api/keuangan/transactions?page=${pageNum}&limit=50`;
      if (filterType !== "all") url += `&type=${filterType}`;
      if (filterCategory !== "all") url += `&categoryId=${filterCategory}`;
      if (startDate && endDate) url += `&startDate=${startDate}&endDate=${endDate}`;
      if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;

      const [transRes, catRes] = await Promise.all([fetch(url), fetch("/api/keuangan/categories")]);
      const transData = await transRes.json();
      const catData = await catRes.json();

      if (transData.success) {
        reset ? setTransactions(transData.transactions) : setTransactions((prev) => [...prev, ...transData.transactions]);
        setStats(transData.stats);
        setTotal(transData.total || 0);
        setHasMore(transData.transactions.length === 50);
      }
      if (catData.success) setCategories(catData.categories);
    } catch (error) {
      await showError("Failed to load data");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreData = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadData(nextPage, false);
  };

  const handleAddTransaction = () => {
    setEditingTransaction(null);
    setTransactionForm({
      categoryId: "",
      type: "INCOME",
      amount: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
      reference: "",
      notes: "",
    });
    setIsTransactionDialogOpen(true);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setTransactionForm({
      categoryId: transaction.categoryId,
      type: transaction.type,
      amount: transaction.amount.toString(),
      description: transaction.description,
      date: new Date(transaction.date).toISOString().split("T")[0],
      reference: transaction.reference || "",
      notes: transaction.notes || "",
    });
    setIsTransactionDialogOpen(true);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionForm.categoryId || !transactionForm.amount || !transactionForm.description) {
      await showError("Please fill all required fields");
      return;
    }

    setProcessing(true);
    try {
      const method = editingTransaction ? "PUT" : "POST";
      const body = editingTransaction ? { id: editingTransaction.id, ...transactionForm } : transactionForm;
      const res = await fetch("/api/keuangan/transactions", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        await showSuccess(data.message);
        setIsTransactionDialogOpen(false);
        setPage(1);
        setTransactions([]);
        setHasMore(true);
        loadData(1, true);
      } else {
        await showError(data.error);
      }
    } catch (error) {
      await showError("Failed to save transaction");
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteTransaction = async (transaction: Transaction) => {
    const confirmed = await showConfirm(`Delete: ${transaction.description}?`, "Delete");
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/keuangan/transactions?id=${transaction.id}`, { method: "DELETE" });
      const data = await res.json();

      if (data.success) {
        await showSuccess(data.message);
        setPage(1);
        setTransactions([]);
        setHasMore(true);
        loadData(1, true);
      } else {
        await showError(data.error);
      }
    } catch (error) {
      await showError("Failed to delete");
    }
  };

  const handleAddCategory = () => {
    setCategoryForm({ name: "", type: "INCOME", description: "" });
    setIsCategoryDialogOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name) {
      await showError("Category name is required");
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch("/api/keuangan/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm),
      });
      const data = await res.json();

      if (data.success) {
        await showSuccess(data.message);
        setIsCategoryDialogOpen(false);
        setPage(1);
        setTransactions([]);
        setHasMore(true);
        loadData(1, true);
      } else {
        await showError(data.error);
      }
    } catch (error) {
      await showError("Failed to save category");
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);

  const formatDate = (date: string) => formatWIB(new Date(date), "d MMM yyyy");

  const resetFilters = () => {
    setFilterType("all");
    setFilterCategory("all");
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
  };

  const formatDateLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const setQuickDate = (type: "thisMonth" | "lastMonth" | "thisYear") => {
    const now = new Date();
    let start: Date, end: Date;
    if (type === "thisMonth") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (type === "lastMonth") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
    }
    setStartDate(formatDateLocal(start));
    setEndDate(formatDateLocal(end));
  };

  const handleExport = async (format: "excel" | "pdf") => {
    if (!startDate || !endDate) {
      await showError("Select date range first");
      return;
    }
    try {
      const url = `/api/keuangan/export?format=${format}&startDate=${startDate}&endDate=${endDate}&type=${filterType}`;
      if (format === "excel") {
        window.open(url, "_blank");
      } else {
        const res = await fetch(url);
        const data = await res.json();
        if (data.transactions) generatePDF(data.transactions, data.stats);
      }
    } catch (error) {
      await showError("Export failed");
    }
  };

  const generatePDF = async (transactions: any[], stats: any) => {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text("Laporan Keuangan", 14, 15);
    doc.setFontSize(9);
    doc.text(`Periode: ${formatDate(startDate)} - ${formatDate(endDate)}`, 14, 21);

    const tableData = transactions.map((t: any) => [formatDate(t.date), t.description, t.category.name, t.type, formatCurrency(t.amount)]);
    autoTable(doc, { head: [["Tanggal", "Deskripsi", "Kategori", "Tipe", "Jumlah"]], body: tableData, startY: 26, styles: { fontSize: 8 } });

    const finalY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`Income: ${formatCurrency(stats.totalIncome)}`, 14, finalY);
    doc.text(`Expense: ${formatCurrency(stats.totalExpense)}`, 14, finalY + 5);
    doc.text(`Balance: ${formatCurrency(stats.balance)}`, 14, finalY + 10);
    doc.save(`Laporan-${startDate}-${endDate}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{t('keuangan.title')}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('keuangan.transactions')}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleAddCategory} variant="outline" size="sm" className="h-8 text-xs">
            <Tag className="w-3.5 h-3.5 mr-1.5" />
            {t('keuangan.category')}
          </Button>
          <Button onClick={handleAddTransaction} size="sm" className="h-8 text-xs">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            {t('keuangan.addTransaction')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3 border-l-4 border-l-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-medium text-gray-500 uppercase">{t('keuangan.income')}</p>
              <p className="text-base font-bold text-green-600">{formatCurrency(stats.totalIncome)}</p>
              <p className="text-[10px] text-gray-500">{stats.incomeCount} trans</p>
            </div>
            <div className="w-8 h-8 bg-green-50 dark:bg-green-900/20 rounded-md flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 space-y-0.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-gray-500">PPPoE:</span>
              <span className="font-medium">{formatCurrency(stats.pppoeIncome || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Hotspot:</span>
              <span className="font-medium">{formatCurrency(stats.hotspotIncome || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Install:</span>
              <span className="font-medium">{formatCurrency(stats.installIncome || 0)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3 border-l-4 border-l-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-medium text-gray-500 uppercase">{t('keuangan.expense')}</p>
              <p className="text-base font-bold text-red-600">{formatCurrency(stats.totalExpense)}</p>
              <p className="text-[10px] text-gray-500">{stats.expenseCount} trans</p>
            </div>
            <div className="w-8 h-8 bg-red-50 dark:bg-red-900/20 rounded-md flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-red-600" />
            </div>
          </div>
        </div>

        <div className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3 border-l-4 ${stats.balance >= 0 ? "border-l-teal-500" : "border-l-orange-500"}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-medium text-gray-500 uppercase">{t('keuangan.balance')}</p>
              <p className={`text-base font-bold ${stats.balance >= 0 ? "text-teal-600" : "text-orange-600"}`}>{formatCurrency(stats.balance)}</p>
              <p className="text-[10px] text-gray-500">{t('keuangan.income')} - {t('keuangan.expense')}</p>
            </div>
            <div className={`w-8 h-8 ${stats.balance >= 0 ? "bg-teal-50 dark:bg-teal-900/20" : "bg-orange-50 dark:bg-orange-900/20"} rounded-md flex items-center justify-center`}>
              <Wallet className={`w-4 h-4 ${stats.balance >= 0 ? "text-teal-600" : "text-orange-600"}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
            <Filter className="w-3.5 h-3.5" />
            {t('common.filter')}
          </div>
          <button onClick={resetFilters} className="text-[10px] text-gray-500 hover:text-gray-700">
            {t('common.reset')}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {["thisMonth", "lastMonth", "thisYear"].map((tp) => (
            <button
              key={tp}
              onClick={() => setQuickDate(tp as any)}
              className="px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              {tp === "thisMonth" ? t('time.thisMonth') : tp === "lastMonth" ? t('time.lastMonth') : t('time.thisYear')}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div className="relative col-span-2 sm:col-span-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
          >
            <option value="all">{t('common.all')}</option>
            <option value="INCOME">{t('keuangan.income')}</option>
            <option value="EXPENSE">{t('keuangan.expense')}</option>
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
          >
            <option value="all">{t('common.all')} {t('common.category')}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
          />
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
        <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('keuangan.transactions')}</span>
          <div className="flex gap-1">
            <button
              onClick={() => handleExport("excel")}
              disabled={!startDate || !endDate}
              className="px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-50 flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              Excel
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={!startDate || !endDate}
              className="px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-50 flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-[10px]">
                <TableHead className="text-[10px] py-2">{t('keuangan.date')}</TableHead>
                <TableHead className="text-[10px] py-2">{t('keuangan.description')}</TableHead>
                <TableHead className="text-[10px] py-2 hidden sm:table-cell">{t('keuangan.category')}</TableHead>
                <TableHead className="text-[10px] py-2">{t('common.type')}</TableHead>
                <TableHead className="text-[10px] py-2 text-right">{t('keuangan.amount')}</TableHead>
                <TableHead className="text-[10px] py-2 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500 text-xs">
                    {t('common.noData')}
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((t) => (
                  <TableRow key={t.id} className="text-xs">
                    <TableCell className="py-2 text-[10px]">
                      <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                        <Calendar className="w-3 h-3" />
                        {formatDate(t.date)}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="font-medium text-xs truncate max-w-[150px]">{t.description}</div>
                      {t.notes && <div className="text-[10px] text-gray-500 truncate">{t.notes}</div>}
                    </TableCell>
                    <TableCell className="py-2 hidden sm:table-cell">
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">{t.category.name}</Badge>
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge className={`text-[9px] px-1.5 py-0 ${t.type === "INCOME" ? "bg-green-100 text-green-700 dark:bg-green-900/30" : "bg-red-100 text-red-700 dark:bg-red-900/30"}`}>
                        {t.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-right font-medium">
                      <span className={t.type === "INCOME" ? "text-green-600" : "text-red-600"}>
                        {t.type === "INCOME" ? "+" : "-"}{formatCurrency(t.amount)}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => handleEditTransaction(t)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                          <Edit className="w-3 h-3 text-gray-500" />
                        </button>
                        <button onClick={() => handleDeleteTransaction(t)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                          <Trash2 className="w-3 h-3 text-red-600" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {loadingMore && (
          <div className="flex justify-center items-center py-3">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="ml-2 text-[10px] text-gray-500">{t('common.loading')}</span>
          </div>
        )}

        {!loading && !loadingMore && !hasMore && transactions.length > 0 && (
          <div className="text-center py-3 text-[10px] text-gray-500">
            {t('table.showing')} {transactions.length} {t('table.of')} {total}
          </div>
        )}
      </div>

      {/* Transaction Dialog */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">{editingTransaction ? t('common.edit') : t('common.add')} {t('keuangan.transactions')}</DialogTitle>
            <DialogDescription className="text-xs">
              {editingTransaction ? t('common.update') : t('keuangan.addTransaction')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveTransaction} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t('common.type')} *</Label>
                <Select value={transactionForm.type} onValueChange={(v: "INCOME" | "EXPENSE") => setTransactionForm({ ...transactionForm, type: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INCOME">{t('keuangan.income')}</SelectItem>
                    <SelectItem value="EXPENSE">{t('keuangan.expense')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t('keuangan.category')} *</Label>
                <Select value={transactionForm.categoryId} onValueChange={(v) => setTransactionForm({ ...transactionForm, categoryId: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                  <SelectContent>
                    {categories.filter((c) => c.type === transactionForm.type).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t('keuangan.amount')} *</Label>
                <Input
                  type="number"
                  value={transactionForm.amount}
                  onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                  className="h-8 text-xs"
                  placeholder="0"
                  required
                />
              </div>
              <div>
                <Label className="text-xs">{t('keuangan.date')} *</Label>
                <Input
                  type="date"
                  value={transactionForm.date}
                  onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })}
                  className="h-8 text-xs"
                  required
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">{t('keuangan.description')} *</Label>
              <Input
                value={transactionForm.description}
                onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                className="h-8 text-xs"
                placeholder={t('keuangan.description')}
                required
              />
            </div>
            <div>
              <Label className="text-xs">{t('keuangan.reference')}</Label>
              <Input
                value={transactionForm.reference}
                onChange={(e) => setTransactionForm({ ...transactionForm, reference: e.target.value })}
                className="h-8 text-xs"
                placeholder="Invoice #, etc"
              />
            </div>
            <div>
              <Label className="text-xs">{t('common.notes')}</Label>
              <Textarea
                value={transactionForm.notes}
                onChange={(e) => setTransactionForm({ ...transactionForm, notes: e.target.value })}
                className="text-xs"
                placeholder={t('common.notes')}
                rows={2}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsTransactionDialogOpen(false)} disabled={processing} size="sm" className="h-8 text-xs">
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={processing} size="sm" className="h-8 text-xs">
                {processing && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">{t('keuangan.addCategory')}</DialogTitle>
            <DialogDescription className="text-xs">{t('keuangan.categoryDescription')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveCategory} className="space-y-3">
            <div>
              <Label className="text-xs">{t('common.name')} *</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                className="h-8 text-xs"
                placeholder={t('keuangan.categoryPlaceholder')}
                required
              />
            </div>
            <div>
              <Label className="text-xs">{t('common.type')} *</Label>
              <Select value={categoryForm.type} onValueChange={(v: "INCOME" | "EXPENSE") => setCategoryForm({ ...categoryForm, type: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCOME">{t('keuangan.income')}</SelectItem>
                  <SelectItem value="EXPENSE">{t('keuangan.expense')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('keuangan.description')}</Label>
              <Textarea
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                className="text-xs"
                rows={2}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCategoryDialogOpen(false)} disabled={processing} size="sm" className="h-8 text-xs">
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={processing} size="sm" className="h-8 text-xs">
                {processing && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
