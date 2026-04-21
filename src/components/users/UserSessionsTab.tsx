'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, Clock } from 'lucide-react';
import { formatWIB } from '@/lib/timezone';

interface Session {
  id: string;
  sessionId: string;
  startTime: string | Date;
  stopTime: string | Date | null;
  durationFormatted: string;
  download: string;
  upload: string;
  total: string;
  nasIp: string;
  terminateCause: string;
  macAddress?: string;
  isOnline: boolean;
}

export default function UserSessionsTab({ userId }: { userId: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch(`/api/pppoe/users/${userId}/activity?type=sessions`);
        const data = await res.json();
        if (data.success) {
          setSessions(data.data);
        }
      } catch (error) {
        console.error('Failed to load sessions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>No session history found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                {session.isOnline ? (
                  <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                    <CheckCircle2 className="w-3 h-3" />
                    Online
                  </span>
                ) : (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    Offline
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {session.durationFormatted}
                </span>
              </div>
              <p className="text-sm font-medium mt-1">
                {formatWIB(new Date(session.startTime), 'dd MMM yyyy HH:mm')}
                {session.stopTime && (
                  <> - {formatWIB(new Date(session.stopTime), 'HH:mm')}</>
                )}
              </p>
              {session.macAddress && session.macAddress !== '-' && (
                <p className="text-xs text-gray-500 mt-1 font-mono">
                  MAC: {session.macAddress}
                </p>
              )}
            </div>
            <div className="text-right text-xs text-gray-500">
              <div>↓ {session.download}</div>
              <div>↑ {session.upload}</div>
              <div className="font-medium text-gray-900 dark:text-white">
                Total: {session.total}
              </div>
            </div>
          </div>
          {session.terminateCause && !session.isOnline && (
            <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              Terminate: {session.terminateCause}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
