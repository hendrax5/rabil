'use client';

import { useState, useEffect } from 'react';
import { showSuccess, showError, showConfirm } from '@/lib/sweetalert';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Plus, Pencil, Trash2, Users, MapPin, X, RefreshCcw,
  User, Box, Server, HardDrive, Link2, Navigation, Search,
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  username: string;
  phone: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  profile: {
    name: string;
  };
}

interface ODP {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  ponPort: number;
  portCount: number;
  distance?: number;
  availablePorts?: number[];
  assignedCount?: number;
  odc: {
    name: string;
  } | null;
  olt: {
    name: string;
  };
}

interface Assignment {
  id: string;
  customerId: string;
  odpId: string;
  portNumber: number;
  distance: number | null;
  notes: string | null;
  createdAt: string;
  customer: Customer;
  odp: ODP;
}

export default function CustomerAssignmentPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  
  // Form states
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedOdpId, setSelectedOdpId] = useState('');
  const [selectedPort, setSelectedPort] = useState('');
  const [notes, setNotes] = useState('');
  
  // For customer search
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  // For nearest ODPs
  const [nearestOdps, setNearestOdps] = useState<ODP[]>([]);
  const [loadingNearestOdps, setLoadingNearestOdps] = useState(false);

  // Filter
  const [filterSearch, setFilterSearch] = useState('');

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    try {
      const res = await fetch('/api/network/customers/assign');
      const data = await res.json();
      setAssignments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchCustomers = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const res = await fetch(`/api/pppoe/users?search=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();
      // Filter out customers that are already assigned
      const assignedIds = assignments.map(a => a.customerId);
      const available = (data.users || []).filter((u: Customer) => !assignedIds.includes(u.id));
      setSearchResults(available);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const loadNearestOdps = async (customerId: string) => {
    setLoadingNearestOdps(true);
    try {
      const res = await fetch(`/api/network/customers/assign?customerId=${customerId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setNearestOdps(data);
      } else {
        await showError(data.error || 'Failed to load nearest ODPs');
        setNearestOdps([]);
      }
    } catch (error) {
      console.error('Load nearest ODPs error:', error);
      setNearestOdps([]);
    } finally {
      setLoadingNearestOdps(false);
    }
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSelectedCustomerId(customer.id);
    setCustomerSearch('');
    setSearchResults([]);
    
    // Load nearest ODPs
    if (customer.latitude && customer.longitude) {
      loadNearestOdps(customer.id);
    } else {
      setNearestOdps([]);
    }
  };

  const handleOdpSelect = (odp: ODP) => {
    setSelectedOdpId(odp.id);
    // Auto-select first available port
    if (odp.availablePorts && odp.availablePorts.length > 0) {
      setSelectedPort(odp.availablePorts[0].toString());
    }
  };

  const resetForm = () => {
    setSelectedCustomerId('');
    setSelectedOdpId('');
    setSelectedPort('');
    setNotes('');
    setCustomerSearch('');
    setSearchResults([]);
    setSelectedCustomer(null);
    setNearestOdps([]);
  };

  const handleEdit = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setSelectedCustomerId(assignment.customerId);
    setSelectedCustomer(assignment.customer);
    setSelectedOdpId(assignment.odpId);
    setSelectedPort(assignment.portNumber.toString());
    setNotes(assignment.notes || '');
    // Load nearest ODPs for editing
    loadNearestOdps(assignment.customerId);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCustomerId || !selectedOdpId || !selectedPort) {
      await showError('Please fill all required fields');
      return;
    }

    try {
      const method = editingAssignment ? 'PUT' : 'POST';
      const payload = {
        ...(editingAssignment && { id: editingAssignment.id }),
        customerId: selectedCustomerId,
        odpId: selectedOdpId,
        portNumber: parseInt(selectedPort),
        notes: notes || null,
      };

      const res = await fetch('/api/network/customers/assign', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (res.ok) {
        await showSuccess(editingAssignment ? 'Assignment updated!' : 'Customer assigned to ODP!');
        setIsDialogOpen(false);
        setEditingAssignment(null);
        resetForm();
        loadAssignments();
      } else {
        await showError(result.error || 'Failed to save assignment');
      }
    } catch (error) {
      console.error('Submit error:', error);
      await showError('Failed to save assignment');
    }
  };

  const handleDelete = async (assignment: Assignment) => {
    const confirmed = await showConfirm(
      'Remove Assignment',
      `Are you sure you want to remove "${assignment.customer.name}" from ODP "${assignment.odp.name}"?`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/network/customers/assign?id=${assignment.id}`, {
        method: 'DELETE',
      });

      const result = await res.json();
      if (res.ok) {
        await showSuccess('Assignment removed!');
        loadAssignments();
      } else {
        await showError(result.error || 'Failed to remove assignment');
      }
    } catch (error) {
      await showError('Failed to remove assignment');
    }
  };

  const filteredAssignments = assignments.filter(a => {
    if (!filterSearch) return true;
    const search = filterSearch.toLowerCase();
    return (
      a.customer.name.toLowerCase().includes(search) ||
      a.customer.username.toLowerCase().includes(search) ||
      a.odp.name.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCcw className="h-6 w-6 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Link2 className="h-5 w-5 text-purple-600" />
            Customer - ODP Assignment
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Assign customers to ODP ports for FTTH network
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setEditingAssignment(null); setIsDialogOpen(true); }}
          className="inline-flex items-center px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded"
        >
          <Plus className="h-3 w-3 mr-1" />
          New Assignment
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Total Assignments</p>
              <p className="text-base font-bold text-purple-600">{assignments.length}</p>
            </div>
            <Link2 className="h-5 w-5 text-purple-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Unique ODPs</p>
              <p className="text-base font-bold text-blue-600">
                {new Set(assignments.map(a => a.odpId)).size}
              </p>
            </div>
            <Box className="h-5 w-5 text-blue-600" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Avg Distance</p>
              <p className="text-base font-bold text-green-600">
                {assignments.length > 0 
                  ? (assignments.reduce((sum, a) => sum + (a.distance || 0), 0) / assignments.length).toFixed(2)
                  : '0'} km
              </p>
            </div>
            <Navigation className="h-5 w-5 text-green-600" />
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            placeholder="Search by customer name, username, or ODP..."
            className="flex-1 px-2 py-1 text-xs border-0 bg-transparent focus:ring-0"
          />
          {filterSearch && (
            <button
              onClick={() => setFilterSearch('')}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-3 py-2 border-b dark:border-gray-800">
          <span className="text-xs font-medium">Assignment List ({filteredAssignments.length})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">ODP</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden sm:table-cell">Port</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden md:table-cell">Distance</th>
                <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden lg:table-cell">Notes</th>
                <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-500 text-xs">
                    No assignments found. Click "New Assignment" to create one.
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((assignment) => (
                  <tr key={assignment.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-teal-600" />
                        <div>
                          <span className="text-xs font-medium block">{assignment.customer.name}</span>
                          <span className="text-[10px] text-gray-500">@{assignment.customer.username}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Box className="h-3 w-3 text-blue-600" />
                          <span className="text-xs">{assignment.odp.name}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                          <Server className="h-2.5 w-2.5" />
                          {assignment.odp.olt?.name}
                          {assignment.odp.odc && (
                            <>
                              <span className="mx-0.5">→</span>
                              <HardDrive className="h-2.5 w-2.5" />
                              {assignment.odp.odc.name}
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell">
                      <span className="px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 rounded font-mono">
                        Port {assignment.portNumber}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs hidden md:table-cell">
                      {assignment.distance !== null ? (
                        <span className="flex items-center gap-1">
                          <Navigation className="h-3 w-3 text-green-600" />
                          {assignment.distance.toFixed(2)} km
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 hidden lg:table-cell max-w-[150px] truncate">
                      {assignment.notes || '-'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleEdit(assignment)}
                          className="p-1 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(assignment)}
                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                          <Trash2 className="h-3 w-3" />
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

      {/* Add/Edit Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b dark:border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">
                  {editingAssignment ? 'Edit Assignment' : 'New Assignment'}
                </h2>
                <p className="text-[10px] text-gray-500">
                  Assign customer to ODP port
                </p>
              </div>
              <button
                onClick={() => { setIsDialogOpen(false); setEditingAssignment(null); resetForm(); }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Customer Selection */}
              <div>
                <label className="block text-[10px] font-medium mb-1">Customer *</label>
                {selectedCustomer ? (
                  <div className="p-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-teal-600" />
                        <div>
                          <span className="text-xs font-medium">{selectedCustomer.name}</span>
                          <span className="text-[10px] text-gray-500 ml-2">@{selectedCustomer.username}</span>
                        </div>
                      </div>
                      {!editingAssignment && (
                        <button
                          type="button"
                          onClick={() => { setSelectedCustomer(null); setSelectedCustomerId(''); setNearestOdps([]); }}
                          className="text-[10px] text-red-600 hover:underline"
                        >
                          Change
                        </button>
                      )}
                    </div>
                    {selectedCustomer.latitude && selectedCustomer.longitude ? (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-500">
                        <MapPin className="h-2.5 w-2.5" />
                        GPS: {selectedCustomer.latitude.toFixed(6)}, {selectedCustomer.longitude.toFixed(6)}
                      </div>
                    ) : (
                      <div className="mt-1 text-[10px] text-amber-600">
                        ⚠ No GPS coordinates - distance cannot be calculated
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        searchCustomers(e.target.value);
                      }}
                      placeholder="Search customer by name or username..."
                      className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                    />
                    {isSearching && (
                      <RefreshCcw className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-gray-400" />
                    )}
                    {searchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-lg max-h-48 overflow-y-auto">
                        {searchResults.map(customer => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => handleCustomerSelect(customer)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <div className="text-xs font-medium">{customer.name}</div>
                            <div className="text-[10px] text-gray-500">
                              @{customer.username} • {customer.phone || 'No phone'}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Nearest ODPs */}
              {selectedCustomer && (
                <div>
                  <label className="block text-[10px] font-medium mb-1">
                    Select ODP * 
                    {loadingNearestOdps && (
                      <RefreshCcw className="inline h-2.5 w-2.5 ml-1 animate-spin" />
                    )}
                  </label>
                  {nearestOdps.length === 0 && !loadingNearestOdps ? (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-500 text-center">
                      {selectedCustomer.latitude && selectedCustomer.longitude
                        ? 'No ODPs found or no ODPs available'
                        : 'Customer has no GPS coordinates - showing all ODPs'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {nearestOdps.map(odp => (
                        <button
                          key={odp.id}
                          type="button"
                          onClick={() => handleOdpSelect(odp)}
                          disabled={(odp.availablePorts?.length || 0) === 0}
                          className={`p-2 text-left rounded border ${
                            selectedOdpId === odp.id
                              ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/20'
                              : (odp.availablePorts?.length || 0) === 0
                                ? 'bg-gray-100 border-gray-200 dark:bg-gray-800 opacity-50 cursor-not-allowed'
                                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <Box className="h-3 w-3 text-blue-600" />
                            <span className="text-xs font-medium">{odp.name}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                            <span className="flex items-center gap-0.5">
                              <Navigation className="h-2.5 w-2.5 text-green-600" />
                              {odp.distance?.toFixed(2)} km
                            </span>
                            <span>•</span>
                            <span className={
                              (odp.availablePorts?.length || 0) > 0
                                ? 'text-green-600'
                                : 'text-red-600'
                            }>
                              {odp.availablePorts?.length || 0}/{odp.portCount} ports free
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Port Selection */}
              {selectedOdpId && (
                <div>
                  <label className="block text-[10px] font-medium mb-1">Port Number *</label>
                  <select
                    value={selectedPort}
                    onChange={(e) => setSelectedPort(e.target.value)}
                    required
                    className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                  >
                    <option value="">Select port</option>
                    {(nearestOdps.find(o => o.id === selectedOdpId)?.availablePorts || []).map(port => (
                      <option key={port} value={port}>Port {port}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-medium mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional notes about this assignment..."
                  className="w-full px-2 py-1.5 text-xs border dark:border-gray-700 rounded dark:bg-gray-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => { setIsDialogOpen(false); setEditingAssignment(null); resetForm(); }}
                  className="px-3 py-1.5 text-xs border dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedCustomerId || !selectedOdpId || !selectedPort}
                  className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded"
                >
                  {editingAssignment ? 'Update' : 'Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
