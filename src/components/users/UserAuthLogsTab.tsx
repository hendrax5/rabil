'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { formatWIB } from '@/lib/timezone';

interface AuthLog {
  id: number;
  username: string;
  reply: string;
  authdate: string | Date;
  success: boolean;
}

export default function UserAuthLogsTab({ userId }: { userId: string }) {
  const [authLogs, setAuthLogs] = useState<AuthLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch(`/api/pppoe/users/${userId}/activity?type=auth`);
        const data = await res.json();
        if (data.success) {
          setAuthLogs(data.data);
        }
      } catch (error) {
        console.error('Failed to load auth logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (authLogs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <XCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>No authentication logs found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {authLogs.map((log) => (
        <div
          key={log.id}
          className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <div className="flex items-center gap-3">
            {log.success ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            <div>
              <p className="text-sm font-medium">{log.reply}</p>
              <p className="text-xs text-gray-500">
                {formatWIB(new Date(log.authdate), 'dd MMM yyyy HH:mm:ss')}
              </p>
            </div>
          </div>
          <span
            className={`text-xs px-2 py-1 rounded ${
              log.success
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {log.success ? 'Success' : 'Rejected'}
          </span>
        </div>
      ))}
    </div>
  );
}
