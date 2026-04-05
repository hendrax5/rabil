'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Terminal, RefreshCw, Download, Play, Pause, AlertCircle, FileText } from 'lucide-react';

const SERVICES = [
  { id: 'aibill-l2tp', name: 'L2TP VPN Server' },
  { id: 'aibill-freeradius', name: 'FreeRADIUS Server' },
  { id: 'aibill-genieacs', name: 'GenieACS Server' },
  { id: 'aibill-db', name: 'MySQL Database' },
  { id: 'aibill-vpn', name: 'Wireguard VPN' },
  { id: 'aibill-app', name: 'AIBILL App (Frontend/API)' },
];

export default function SystemLogsPage() {
  const { t } = useTranslation();
  const [activeService, setActiveService] = useState('aibill-l2tp');
  const [logs, setLogs] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [linesSize, setLinesSize] = useState('200');
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const fetchLogs = async (isAuto = false) => {
    if (!isAuto) setLoading(true);
    
    try {
      const res = await fetch(`/api/system/logs?service=${activeService}&tail=${linesSize}`);
      const data = await res.json();
      
      if (res.ok) {
        setLogs(data.logs || 'No logs available.');
        setErrorMsg('');
      } else {
        setErrorMsg(data.error || 'Failed to fetch logs');
        if (data.logs) setLogs(data.logs);
      }
    } catch (error: any) {
      setErrorMsg('Connection error. Could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [activeService, linesSize]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => fetchLogs(true), 3000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, activeService, linesSize]);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const downloadLogs = () => {
    const blob = new Blob([logs], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeService}_logs_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-h-[800px] space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-500" />
            System Logs Monitor
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">View real-time docker container logs for system services</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-gray-500 mb-1 uppercase tracking-wider">Service Container</label>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {SERVICES.map((s) => (
              <button
                key={s.id}
                onClick={() => { setActiveService(s.id); setLogs(''); setErrorMsg(''); }}
                className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap font-medium transition-colors ${
                  activeService === s.id 
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' 
                    : 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="font-medium whitespace-pre-wrap">{errorMsg}</p>
        </div>
      )}

      <div className="flex-1 flex flex-col bg-gray-950 rounded-lg border border-gray-800 shadow-inner overflow-hidden">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <span className="ml-2 text-xs font-mono text-gray-400">root@{activeService}: ~</span>
          </div>
          <div className="flex items-center gap-2">
            <select 
              value={linesSize} 
              onChange={(e) => setLinesSize(e.target.value)}
              className="text-[10px] bg-gray-800 text-gray-300 border-gray-700 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="50">Last 50 lines</option>
              <option value="200">Last 200 lines</option>
              <option value="500">Last 500 lines</option>
              <option value="1000">Last 1000 lines</option>
            </select>

            <button 
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                autoRefresh ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
              }`}
            >
              {autoRefresh ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {autoRefresh ? 'Auto-Refresh (ON)' : 'Auto-Refresh (OFF)'}
            </button>
            <button 
              onClick={() => fetchLogs()} 
              disabled={loading}
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
              title="Refresh Logs"
            >
              <RefreshCw className={`w-4 h-4 ${loading && !autoRefresh ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={downloadLogs} 
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              title="Download Logs"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Terminal Body */}
        <div 
          className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
          ref={scrollContainerRef}
          onScroll={handleScroll}
        >
          {loading && !logs && !autoRefresh ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-gray-500 font-mono text-sm animate-pulse">Loading logs...</span>
            </div>
          ) : (
            <pre className="text-gray-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all">
              {logs}
            </pre>
          )}
          <div ref={bottomRef} />
        </div>
        
        {/* Terminal Footer (Auto-scroll status) */}
        {!autoScroll && logs && (
          <div className="px-3 py-1.5 bg-gray-900 border-t border-gray-800 flex justify-center">
            <button 
              onClick={() => {
                setAutoScroll(true);
                bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              Auto-scroll disabled. Click to resume tracking tail ↓
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
