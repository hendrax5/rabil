'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Upload, Download, ChevronLeft, CheckCircle2, XCircle,
  Loader2, AlertTriangle, Package, FileText, Play, RefreshCw,
} from 'lucide-react';

interface CsvRow {
  sn: string;
  board: string;
  port: string;
  pppoeUser: string;
  pppoePass: string;
  vlan: string;
  onuType: string;
  mode: string;
  vlanProfile: string;
  // runtime
  _status?: 'pending' | 'processing' | 'success' | 'error';
  _message?: string;
}

const TEMPLATE_HEADERS = ['sn', 'board', 'port', 'pppoeUser', 'pppoePass', 'vlan', 'onuType', 'mode', 'vlanProfile'];
const TEMPLATE_EXAMPLE = 'ZTEGABCD1234,1/1,1,user001,pass001,100,1.ZTE-Home,pppoe,vlan100';

function parseCsv(text: string): CsvRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const rows: CsvRow[] = [];
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim());
    const row: any = { _status: 'pending' };
    headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
    if (row.sn) rows.push(row as CsvRow);
  }
  return rows;
}

export default function BulkProvisionPage() {
  const { id } = useParams();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<CsvRow[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      setRows(parsed);
      setProgress(0);
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const csv = [TEMPLATE_HEADERS.join(','), TEMPLATE_EXAMPLE].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk-provision-template.csv';
    a.click();
  };

  const handleRunProvision = async () => {
    if (rows.length === 0 || running) return;
    setRunning(true);
    let done = 0;

    const updated = [...rows];
    for (let i = 0; i < updated.length; i++) {
      updated[i] = { ...updated[i], _status: 'processing' };
      setRows([...updated]);

      try {
        const res = await fetch(`/api/network/olts/${id}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            board: updated[i].board,
            port: updated[i].port,
            sn: updated[i].sn,
            pppoeUser: updated[i].pppoeUser,
            pppoePass: updated[i].pppoePass,
            vlan: updated[i].vlan,
            onuType: updated[i].onuType || '1.ZTE-Home',
            mode: updated[i].mode || 'pppoe',
            vlanProfile: updated[i].vlanProfile,
          }),
        });
        const data = await res.json();
        updated[i] = {
          ...updated[i],
          _status: res.ok ? 'success' : 'error',
          _message: data.message || data.error || '',
        };
      } catch (err: any) {
        updated[i] = { ...updated[i], _status: 'error', _message: err.message };
      }

      done++;
      setProgress(Math.round((done / updated.length) * 100));
      setRows([...updated]);

      // Small delay between ONUs to avoid OLT overload
      if (i < updated.length - 1) await new Promise(r => setTimeout(r, 1500));
    }

    setRunning(false);
  };

  const success = rows.filter(r => r._status === 'success').length;
  const errors  = rows.filter(r => r._status === 'error').length;
  const pending = rows.filter(r => r._status === 'pending').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
            <ChevronLeft className="h-4 w-4 text-gray-500" />
          </button>
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Package className="h-5 w-5 text-teal-600" />
              Bulk ONU Provisioning
            </h1>
            <p className="page-subtitle ml-0">Import CSV dan provision banyak ONU sekaligus</p>
          </div>
        </div>
        <button onClick={downloadTemplate} className="btn-premium border border-gray-200 dark:border-zinc-700 text-gray-600 gap-1.5">
          <Download className="h-3.5 w-3.5" />
          Download Template CSV
        </button>
      </div>

      {/* Upload Zone */}
      {rows.length === 0 && (
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-12 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 dark:hover:bg-teal-900/10 transition-all group"
        >
          <div className="w-16 h-16 bg-teal-100 dark:bg-teal-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <Upload className="h-8 w-8 text-teal-600" />
          </div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Upload CSV File</p>
          <p className="text-xs text-gray-400">
            Format: sn, board, port, pppoeUser, pppoePass, vlan, onuType, mode, vlanProfile
          </p>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
        </div>
      )}

      {/* Preview & Run */}
      {rows.length > 0 && (
        <div className="space-y-4">
          {/* Stats bar */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total', value: rows.length, color: 'text-gray-700 dark:text-white' },
              { label: 'Success', value: success, color: 'text-emerald-600' },
              { label: 'Failed', value: errors, color: 'text-red-600' },
              { label: 'Pending', value: pending, color: 'text-gray-500' },
            ].map(s => (
              <div key={s.label} className="card-soft p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {running && (
            <div className="card-soft p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Provisioning...</span>
                <span className="text-xs text-teal-600 font-bold">{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleRunProvision}
              disabled={running || pending === 0}
              className="btn-premium bg-teal-600 hover:bg-teal-700 text-white gap-1.5 disabled:opacity-50"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {running ? 'Provisioning...' : `Run Provision (${pending} ONUs)`}
            </button>
            <button
              onClick={() => { setRows([]); setProgress(0); }}
              disabled={running}
              className="btn-premium border border-gray-200 dark:border-zinc-700 text-gray-600 gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>

          {/* Table */}
          <div className="card-soft overflow-hidden">
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/80 backdrop-blur-sm">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">SN</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Port</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">PPPoE User</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">VLAN</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Mode</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.map((row, i) => (
                    <tr key={i} className={`${row._status === 'error' ? 'bg-red-50/40 dark:bg-red-900/10' : row._status === 'success' ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : ''}`}>
                      <td className="px-3 py-2">
                        {row._status === 'pending' && <span className="text-[10px] text-gray-400">—</span>}
                        {row._status === 'processing' && <Loader2 className="h-3 w-3 animate-spin text-teal-600" />}
                        {row._status === 'success' && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                        {row._status === 'error' && <XCircle className="h-3 w-3 text-red-600" />}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.sn}</td>
                      <td className="px-3 py-2 text-xs">{row.board}/{row.port}</td>
                      <td className="px-3 py-2 text-xs">{row.pppoeUser}</td>
                      <td className="px-3 py-2 text-xs">{row.vlan}</td>
                      <td className="px-3 py-2 text-xs capitalize">{row.mode || 'pppoe'}</td>
                      <td className="px-3 py-2">
                        {row._message && (
                          <span className={`text-[10px] ${row._status === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
                            {row._message}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
