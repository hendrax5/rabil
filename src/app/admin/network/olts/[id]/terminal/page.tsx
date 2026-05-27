'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Terminal, Send, Trash2, History, AlertTriangle } from 'lucide-react';

const COMMON_COMMANDS = [
  { label: 'Show ONU State', cmd: 'show gpon onu state' },
  { label: 'Show Uncfg ONU', cmd: 'show gpon onu uncfg' },
  { label: 'Show ONU Optical', cmd: 'show gpon remote-onu optical-info' },
  { label: 'Show Running', cmd: 'show running-config' },
  { label: 'Show Version', cmd: 'show version' },
  { label: 'Show GPON Profiles', cmd: 'show pon onu-type gpon' },
  { label: 'Terminal Length 0', cmd: 'terminal length 0' },
];

interface TerminalLine {
  type: 'command' | 'output' | 'error' | 'info';
  content: string;
  timestamp: Date;
}

export default function OltTerminalPage() {
  const { id } = useParams();
  const router = useRouter();

  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'info', content: '⚡ NexaRadius Web Terminal — Connected to OLT', timestamp: new Date() },
    { type: 'info', content: 'Commands are executed via SSH/Telnet. Type a command and press Enter.', timestamp: new Date() },
    { type: 'info', content: '', timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, []);

  useEffect(scrollToBottom, [lines, scrollToBottom]);

  const appendLine = (line: TerminalLine) => {
    setLines(prev => [...prev, line]);
  };

  const handleCommand = useCallback(async (cmd: string) => {
    if (!cmd.trim() || loading) return;

    // Local clear command
    if (cmd.trim() === 'clear') {
      setLines([]);
      setInput('');
      return;
    }

    appendLine({ type: 'command', content: `> ${cmd}`, timestamp: new Date() });
    setCmdHistory(prev => [cmd, ...prev.slice(0, 49)]);
    setHistoryIdx(-1);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`/api/network/olts/${id}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await res.json();

      if (data.success) {
        const outputLines = (data.output || '').split('\n');
        for (const line of outputLines) {
          appendLine({ type: 'output', content: line, timestamp: new Date() });
        }
      } else {
        appendLine({ type: 'error', content: `Error: ${data.error || 'Command failed'}`, timestamp: new Date() });
      }
    } catch (err: any) {
      appendLine({ type: 'error', content: `Connection error: ${err.message}`, timestamp: new Date() });
    } finally {
      setLoading(false);
    }
  }, [id, loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommand(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIdx = Math.min(historyIdx + 1, cmdHistory.length - 1);
      setHistoryIdx(newIdx);
      setInput(cmdHistory[newIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIdx = Math.max(historyIdx - 1, -1);
      setHistoryIdx(newIdx);
      setInput(newIdx === -1 ? '' : cmdHistory[newIdx] || '');
    }
  };

  return (
    <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
            <ChevronLeft className="h-4 w-4 text-gray-500" />
          </button>
          <h1 className="page-title flex items-center gap-2">
            <Terminal className="h-5 w-5 text-emerald-600" />
            OLT Web Terminal
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">SSH Active</span>
          </div>
          <button
            onClick={() => setLines([])}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600"
            title="Clear terminal"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Quick Commands */}
        <div className="w-48 flex-shrink-0 space-y-1.5">
          <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider px-1">Quick Commands</p>
          {COMMON_COMMANDS.map((c) => (
            <button
              key={c.cmd}
              onClick={() => handleCommand(c.cmd)}
              disabled={loading}
              className="w-full text-left px-3 py-2 text-[11px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-900 hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all disabled:opacity-40 font-mono"
            >
              {c.label}
            </button>
          ))}

          {cmdHistory.length > 0 && (
            <>
              <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider px-1 pt-2 flex items-center gap-1">
                <History className="h-3 w-3" />
                History
              </p>
              {cmdHistory.slice(0, 8).map((h, i) => (
                <button
                  key={i}
                  onClick={() => setInput(h)}
                  className="w-full text-left px-2.5 py-1.5 text-[10px] rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 truncate font-mono"
                >
                  {h}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Terminal Window */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-950 dark:bg-black rounded-2xl border border-gray-800 overflow-hidden">
          {/* Terminal bar */}
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <span className="text-[11px] text-gray-400 font-mono mx-auto">OLT Terminal — {id}</span>
          </div>

          {/* Output area */}
          <div
            ref={outputRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-[12px] leading-5 space-y-0.5"
          >
            {lines.map((line, i) => (
              <div key={i} className={`whitespace-pre-wrap break-all ${
                line.type === 'command' ? 'text-teal-400 font-semibold' :
                line.type === 'error' ? 'text-red-400' :
                line.type === 'info' ? 'text-gray-500' :
                'text-green-300'
              }`}>
                {line.content}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-gray-500">
                <span className="inline-block w-2 h-4 bg-gray-500 animate-pulse" />
                <span>Executing...</span>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-gray-800 flex items-center gap-2">
            <span className="text-teal-400 font-mono text-xs flex-shrink-0">$</span>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Type OLT command... (↑↓ history)"
              className="flex-1 bg-transparent font-mono text-[13px] text-white placeholder-gray-600 focus:outline-none"
              autoFocus
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
            />
            <button
              onClick={() => handleCommand(input)}
              disabled={loading || !input.trim()}
              className="flex-shrink-0 p-1.5 rounded bg-teal-700 hover:bg-teal-600 disabled:opacity-30 transition-colors"
            >
              <Send className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex-shrink-0">
        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          <strong>Peringatan:</strong> Web Terminal memberikan akses langsung ke CLI OLT. 
          Perintah yang salah dapat mengganggu layanan. Gunakan dengan hati-hati dan pastikan Anda memiliki izin yang diperlukan.
        </p>
      </div>
    </div>
  );
}
