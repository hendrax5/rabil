'use client';

import { useState, useEffect } from 'react';
import { Activity, Search, RefreshCcw, Server, ShieldCheck, ShieldAlert, Cpu } from 'lucide-react';
import { format } from 'date-fns';

interface ProvisionLog {
  id: string;
  oltId: string;
  sn: string;
  action: string;
  status: string;
  message: string | null;
  createdAt: string;
  olt: {
    name: string;
    ipAddress: string;
  };
}

export default function ProvisionLogsPage() {
  const [logs, setLogs] = useState<ProvisionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/network/provision-logs?limit=100');
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      } else {
        console.error('Failed to fetch logs');
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      log.sn.toLowerCase().includes(searchLower) ||
      log.olt.name.toLowerCase().includes(searchLower) ||
      log.action.toLowerCase().includes(searchLower) ||
      (log.message && log.message.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Provisioning Logs</h1>
          <p className="text-muted-foreground text-sm">
            Monitor zero-touch provisioning and manual registration audit trails.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-card rounded-xl border shadow-sm flex flex-col h-[calc(100vh-200px)]">
        <div className="p-4 border-b flex items-center justify-between gap-4 bg-muted/30">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by SN, OLT name, or message..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background px-3 py-1.5 border rounded-lg shadow-sm">
            <Activity className="w-4 h-4 text-primary" />
            <span>Showing top {logs.length} entries</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
              <RefreshCcw className="w-8 h-8 animate-spin text-primary" />
              <p>Loading provision logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
              <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center">
                <Search className="w-8 h-8" />
              </div>
              <p>No logs found matching your criteria.</p>
            </div>
          ) : (
            <div className="min-w-[800px]">
              <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/50 text-sm font-medium text-muted-foreground sticky top-0 backdrop-blur-md z-10">
                <div className="col-span-2">Date & Time</div>
                <div className="col-span-2">OLT Target</div>
                <div className="col-span-2">ONU Serial</div>
                <div className="col-span-1 text-center">Action</div>
                <div className="col-span-1 text-center">Status</div>
                <div className="col-span-4">Execution Output</div>
              </div>
              <div className="divide-y divide-border/50">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="grid grid-cols-12 gap-4 p-4 items-center text-sm hover:bg-muted/30 transition-colors group">
                    <div className="col-span-2 text-muted-foreground font-mono text-xs">
                      {format(new Date(log.createdAt), 'dd MMM yyyy HH:mm:ss')}
                    </div>
                    
                    <div className="col-span-2 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center">
                        <Server className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium">{log.olt.name}</p>
                        <p className="text-xs text-muted-foreground">{log.olt.ipAddress}</p>
                      </div>
                    </div>
                    
                    <div className="col-span-2 flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-muted-foreground" />
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
                        {log.sn}
                      </span>
                    </div>

                    <div className="col-span-1 flex justify-center">
                      <span className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider">
                        {log.action}
                      </span>
                    </div>

                    <div className="col-span-1 flex justify-center">
                      {log.status === 'SUCCESS' ? (
                        <div className="flex items-center gap-1.5 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>SUCCESS</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>FAILED</span>
                        </div>
                      )}
                    </div>

                    <div className="col-span-4">
                      <div className={`text-xs font-mono p-2 rounded-md border max-h-[80px] overflow-y-auto ${
                        log.status === 'SUCCESS' 
                          ? 'bg-green-50/50 border-green-100 text-green-800 dark:bg-green-950/20 dark:border-green-900/50 dark:text-green-300' 
                          : 'bg-red-50/50 border-red-100 text-red-800 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-300'
                      }`}>
                        {log.message || 'No output details provided.'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
