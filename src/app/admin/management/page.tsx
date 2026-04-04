'use client';

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { useTranslation } from '@/hooks/useTranslation';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  permissions: string[];
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

const ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'CUSTOMER_SERVICE', label: 'Customer Service' },
  { value: 'TECHNICIAN', label: 'Technician' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'VIEWER', label: 'Viewer' },
];

export default function ManagementPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roleTemplates, setRoleTemplates] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'CUSTOMER_SERVICE',
    permissions: [] as string[],
  });

  useEffect(() => {
    fetchUsers();
    fetchPermissions();
    fetchRoleTemplates();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || data);
      }
    } catch {
      console.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const res = await fetch('/api/permissions');
      if (res.ok) {
        const data = await res.json();
        // API returns grouped object: { category1: [...], category2: [...] }
        // Convert to flat array for state
        if (data.success && data.permissions) {
          const flatPermissions = Object.values(data.permissions).flat();
          setPermissions(flatPermissions as Permission[]);
        } else if (Array.isArray(data)) {
          setPermissions(data);
        }
      }
    } catch {
      console.error('Failed to fetch permissions');
    }
  };

  const fetchRoleTemplates = async () => {
    try {
      const res = await fetch('/api/permissions/role-templates');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.templates) {
          setRoleTemplates(data.templates);
        }
      }
    } catch {
      console.error('Failed to fetch role templates');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingUser ? `/api/admin/users/${editingUser.id}` : '/api/admin/users';
      const method = editingUser ? 'PUT' : 'POST';
      
      const submitData = { ...formData };
      if (editingUser && !submitData.password) {
        const { password, ...rest } = submitData;
        Object.assign(submitData, rest);
        delete (submitData as { password?: string }).password;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: editingUser ? 'User Updated' : 'User Created',
          text: editingUser ? 'User has been updated successfully' : 'New user has been created successfully',
          timer: 2000,
          showConfirmButton: false,
        });
        setShowModal(false);
        resetForm();
        fetchUsers();
      } else {
        const error = await res.json();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.error || 'Failed to save user',
        });
      }
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to save user',
      });
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      permissions: user.permissions || [],
    });
    setShowModal(true);
  };

  const handleDelete = async (user: User) => {
    const result = await Swal.fire({
      title: 'Hapus User?',
      text: `User "${user.username}" akan dihapus permanen`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/admin/users/${user.id}`, {
          method: 'DELETE',
        });

        if (res.ok) {
          Swal.fire({
            icon: 'success',
            title: 'Deleted',
            text: 'User has been deleted',
            timer: 2000,
            showConfirmButton: false,
          });
          fetchUsers();
        } else {
          const error = await res.json();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.error || 'Failed to delete user',
          });
        }
      } catch {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to delete user',
        });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'CUSTOMER_SERVICE',
      permissions: [],
    });
    setEditingUser(null);
  };

  const handleRoleChange = (role: string) => {
    // Auto-load permissions from role template
    const rolePermissions = roleTemplates[role] || [];
    setFormData({
      ...formData,
      role,
      permissions: rolePermissions,
    });
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const togglePermission = (permId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId],
    }));
  };

  const permissionsByCategory = (Array.isArray(permissions) ? permissions : []).reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'FINANCE':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'CUSTOMER_SERVICE':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'TECHNICIAN':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'MARKETING':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'VIEWER':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-500 dark:text-gray-400">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-3 sm:p-4">
      <div className="max-w-7xl mx-auto space-y-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white">{t('management.title')}</h1>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('management.subtitle')}</p>
          </div>
          <button
            onClick={openCreateModal}
            className="h-7 px-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('management.addUser')}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-teal-100 dark:bg-teal-900/30 rounded">
                <svg className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{users.length}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('management.totalUsers')}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded">
                <svg className="w-3.5 h-3.5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {users.filter(u => u.role === 'SUPER_ADMIN').length}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('management.superAdmin')}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded">
                <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {users.filter(u => u.role === 'CUSTOMER_SERVICE').length}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('management.customerService')}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded">
                <svg className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {users.filter(u => u.role === 'TECHNICIAN').length}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('management.technician')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{t('management.username')}</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">{t('management.email')}</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{t('management.role')}</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">{t('management.permissions')}</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">{t('management.createdAt')}</th>
                  <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-xs text-gray-500 dark:text-gray-400">
                      {t('management.noUsersFound')}
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                            <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 uppercase">
                              {user.username.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-900 dark:text-white">{user.username}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 sm:hidden">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 hidden sm:table-cell">
                        <span className="text-xs text-gray-600 dark:text-gray-300">{user.email}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded ${getRoleBadgeColor(user.role)}`}>
                          {user.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 hidden md:table-cell">
                        <div className="flex flex-wrap gap-0.5 max-w-xs">
                          {user.permissions && user.permissions.length > 0 ? (
                            <>
                              {user.permissions.slice(0, 3).map((perm) => (
                                <span
                                  key={perm}
                                  className="inline-flex px-1 py-0.5 text-[9px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded"
                                >
                                  {perm}
                                </span>
                              ))}
                              {user.permissions.length > 3 && (
                                <span className="inline-flex px-1 py-0.5 text-[9px] font-medium bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded">
                                  +{user.permissions.length - 3}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 hidden lg:table-cell">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          {new Date(user.createdAt).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-1 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded transition-colors"
                            title="Edit"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                            title="Hapus"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {editingUser ? t('management.editUser') : t('management.addNewUser')}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-100px)]">
              <div className="p-4 space-y-3">
                {/* Username */}
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                    {t('management.username')}
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full h-8 px-2.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                
                {/* Email */}
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                    {t('management.email')}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full h-8 px-2.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                
                {/* Password */}
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                    {t('management.password')} {editingUser && <span className="text-gray-400">({t('management.passwordHint')})</span>}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full h-8 px-2.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white"
                    {...(!editingUser && { required: true })}
                  />
                </div>
                
                {/* Role */}
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                    {t('management.role')}
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-gray-900 dark:text-white"
                  >
                    {ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                    {t('management.roleAutoLoad')}
                  </p>
                </div>

                {/* Permissions */}
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                    {t('management.permissions')}
                  </label>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-md p-2 max-h-48 overflow-y-auto space-y-2">
                    {Object.entries(permissionsByCategory).map(([category, perms]) => (
                      <div key={category}>
                        <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">
                          {category}
                        </p>
                        <div className="grid grid-cols-2 gap-1">
                          {perms.map((perm) => (
                            <label
                              key={perm.id}
                              className="flex items-center gap-1.5 cursor-pointer p-1 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={formData.permissions.includes(perm.id)}
                                onChange={() => togglePermission(perm.id)}
                                className="w-3 h-3 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                              />
                              <span className="text-[10px] text-gray-700 dark:text-gray-300">{perm.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    {permissions.length === 0 && (
                      <p className="text-[10px] text-gray-400 text-center py-2">{t('management.noPermissions')}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="h-7 px-3 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="h-7 px-3 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md transition-colors"
                >
                  {editingUser ? t('management.saveChanges') : t('management.addUser')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
