'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Bell, Check, CheckCheck, Trash2, Loader2, Filter } from 'lucide-react';
import { formatWIB } from '@/lib/timezone';
import Link from 'next/link';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
  }, [filter]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const url = filter === 'unread' 
        ? '/api/notifications?unreadOnly=true&limit=100'
        : '/api/notifications?limit=100';
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('Load notifications error:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationIds: string[]) => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds }),
      });
      loadNotifications();
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      loadNotifications();
    } catch (error) {
      console.error('Mark all as read error:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications?id=${id}`, {
        method: 'DELETE',
      });
      loadNotifications();
    } catch (error) {
      console.error('Delete notification error:', error);
    }
  };

  const getNotificationStyle = (type: string) => {
    switch (type) {
      case 'invoice_overdue':
        return 'border-l-red-500 bg-red-50/50 dark:bg-red-900/10';
      case 'new_registration':
        return 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10';
      case 'payment_received':
        return 'border-l-green-500 bg-green-50/50 dark:bg-green-900/10';
      case 'user_expired':
        return 'border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/10';
      case 'system_alert':
        return 'border-l-purple-500 bg-purple-50/50 dark:bg-purple-900/10';
      default:
        return 'border-l-gray-500 bg-gray-50/50 dark:bg-gray-900/10';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'invoice_overdue': return '💸';
      case 'new_registration': return '👤';
      case 'payment_received': return '✅';
      case 'user_expired': return '⏰';
      case 'system_alert': return '⚠️';
      default: return '📢';
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-lg p-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <div>
              <h1 className="text-base font-semibold">Notifikasi</h1>
              <p className="text-[11px] text-teal-100">Kelola semua notifikasi Anda</p>
            </div>
          </div>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-white/20 rounded">
              {unreadCount} belum dibaca
            </span>
          )}
        </div>
      </div>

      {/* Stats & Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-[10px] text-gray-500">Total</p>
              <p className="text-lg font-bold text-gray-800 dark:text-white">{notifications.length}</p>
            </div>
            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700"></div>
            <div className="text-center">
              <p className="text-[10px] text-gray-500">Belum Dibaca</p>
              <p className="text-lg font-bold text-teal-600">{unreadCount}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              <button
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition ${
                  filter === 'all'
                    ? 'bg-teal-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition ${
                  filter === 'unread'
                    ? 'bg-teal-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                Belum Dibaca
              </button>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-medium rounded-lg transition"
              >
                <CheckCheck className="w-3 h-3" />
                Tandai Semua
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">Tidak ada notifikasi</p>
            <p className="text-[10px] mt-0.5">
              {filter === 'unread' ? 'Semua sudah dibaca!' : 'Belum ada notifikasi'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3 border-l-3 transition-colors ${getNotificationStyle(notif.type)} ${!notif.isRead ? '' : 'opacity-60'}`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="text-lg flex-shrink-0">{getNotificationIcon(notif.type)}</div>
                  
                  <div className="flex-1 min-w-0">
                    {notif.link ? (
                      <Link
                        href={notif.link}
                        onClick={() => {
                          if (!notif.isRead) {
                            markAsRead([notif.id]);
                          }
                        }}
                        className="block group"
                      >
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition line-clamp-1">
                          {notif.title}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {formatWIB(notif.createdAt, 'dd MMM yyyy HH:mm')}
                        </p>
                      </Link>
                    ) : (
                      <>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">
                          {notif.title}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {formatWIB(notif.createdAt, 'dd MMM yyyy HH:mm')}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!notif.isRead && (
                      <button
                        onClick={() => markAsRead([notif.id])}
                        className="p-1 hover:bg-teal-100 dark:hover:bg-teal-900/20 rounded transition"
                        title="Tandai dibaca"
                      >
                        <Check className="w-3.5 h-3.5 text-teal-600" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notif.id)}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
