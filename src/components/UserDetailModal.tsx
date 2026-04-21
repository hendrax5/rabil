'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import UserInfoForm from './users/UserInfoForm';
import UserSessionsTab from './users/UserSessionsTab';
import UserAuthLogsTab from './users/UserAuthLogsTab';
import UserInvoicesTab from './users/UserInvoicesTab';

interface User {
  id: string;
  username: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  status: string;
  profile: { id: string; name: string };
  router?: { id: string; name: string } | null;
  ipAddress: string | null;
  expiredAt: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface UserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSave: (data: any) => Promise<void>;
  profiles: any[];
  routers: any[];
  currentLatLng?: { lat: string; lng: string };
  onLatLngChange?: (lat: string, lng: string) => void;
}

export default function UserDetailModal({
  isOpen,
  onClose,
  user,
  onSave,
  profiles,
  routers,
  currentLatLng,
  onLatLngChange,
}: UserDetailModalProps) {
  const [activeTab, setActiveTab] = useState('info');

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 modal-overlay p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              User Details
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {user.username}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex px-6">
            {[
              { id: 'info', label: 'User Info' },
              { id: 'sessions', label: 'Sessions' },
              { id: 'auth', label: 'Auth Logs' },
              { id: 'invoices', label: 'Invoices' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'info' && (
            <UserInfoForm
              user={user}
              profiles={profiles}
              routers={routers}
              currentLatLng={currentLatLng}
              onLatLngChange={onLatLngChange}
              onSave={onSave}
              onClose={onClose}
            />
          )}

          {activeTab === 'sessions' && <UserSessionsTab userId={user.id} />}
          
          {activeTab === 'auth' && <UserAuthLogsTab userId={user.id} />}
          
          {activeTab === 'invoices' && <UserInvoicesTab userId={user.id} />}
        </div>
      </div>
    </div>
  );
}
