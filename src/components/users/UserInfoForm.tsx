'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, MapPin, Map } from 'lucide-react';

interface UserInfoFormProps {
  user: any;
  profiles: any[];
  routers: any[];
  currentLatLng?: { lat: string; lng: string };
  onLatLngChange?: (lat: string, lng: string) => void;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

export default function UserInfoForm({
  user,
  profiles,
  routers,
  currentLatLng,
  onLatLngChange,
  onSave,
  onClose
}: UserInfoFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    profileId: '',
    routerId: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    ipAddress: '',
    expiredAt: '',
    latitude: '',
    longitude: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        password: '',
        profileId: user.profile?.id || '',
        routerId: user.router?.id || '',
        name: user.name || '',
        phone: user.phone || '',
        email: user.email || '',
        address: user.address || '',
        ipAddress: user.ipAddress || '',
        expiredAt: user.expiredAt ? user.expiredAt.split('T')[0] : '',
        latitude: user.latitude?.toString() || '',
        longitude: user.longitude?.toString() || '',
      });
    }
  }, [user]);

  // Sync lat/lng from parent (for map picker)
  useEffect(() => {
    if (currentLatLng) {
      setFormData(prev => ({
        ...prev,
        latitude: currentLatLng.lat,
        longitude: currentLatLng.lng,
      }));
    }
  }, [currentLatLng]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ ...formData, id: user?.id });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Username</label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            required
            disabled
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg pr-10"
              placeholder="Leave empty to keep current"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            type="text"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Profile</label>
          <select
            value={formData.profileId}
            onChange={(e) => setFormData({ ...formData, profileId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            required
          >
            <option value="">Select Profile</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Router</label>
          <select
            value={formData.routerId}
            onChange={(e) => setFormData({ ...formData, routerId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
          >
            <option value="">Auto-assign</option>
            {routers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">IP Address</label>
          <input
            type="text"
            value={formData.ipAddress}
            onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            placeholder="Auto-assign if empty"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Address</label>
          <textarea
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            rows={2}
          />
        </div>
        
        {/* GPS Location */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">GPS Location (Optional)</label>
            <div className="flex gap-2">
              {onLatLngChange && (
                <button
                  type="button"
                  onClick={() => {
                    onLatLngChange(formData.latitude, formData.longitude);
                  }}
                  className="inline-flex items-center px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                >
                  <Map className="h-3 w-3 mr-1" />
                  Pilih di Peta
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                  
                  if (!isSecure) {
                    alert('GPS Auto memerlukan koneksi HTTPS.\n\nUntuk menggunakan fitur ini:\n1. Akses aplikasi melalui HTTPS, atau\n2. Gunakan "Pilih di Peta" untuk memilih lokasi manual');
                    return;
                  }
                  
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        setFormData({
                          ...formData,
                          latitude: position.coords.latitude.toFixed(6),
                          longitude: position.coords.longitude.toFixed(6),
                        });
                      },
                      (error) => {
                        let errorMessage = 'Gagal mendapatkan lokasi: ';
                        switch (error.code) {
                          case error.PERMISSION_DENIED:
                            errorMessage += 'Akses lokasi ditolak. Silakan izinkan akses lokasi di browser Anda.';
                            break;
                          case error.POSITION_UNAVAILABLE:
                            errorMessage += 'Informasi lokasi tidak tersedia.';
                            break;
                          case error.TIMEOUT:
                            errorMessage += 'Waktu permintaan lokasi habis.';
                            break;
                          default:
                            errorMessage += error.message;
                        }
                        alert(errorMessage);
                      }
                    );
                  } else {
                    alert('Geolocation tidak didukung oleh browser ini.');
                  }
                }}
                className="inline-flex items-center px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition"
              >
                <MapPin className="h-3 w-3 mr-1" />
                GPS Auto
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="any"
              value={formData.latitude}
              onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
              placeholder="Latitude"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
            />
            <input
              type="number"
              step="any"
              value={formData.longitude}
              onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
              placeholder="Longitude"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Pilih di peta atau gunakan GPS otomatis
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Expired At</label>
          <input
            type="date"
            value={formData.expiredAt}
            onChange={(e) => setFormData({ ...formData, expiredAt: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
          />
        </div>
      </div>
      
      <div className="flex justify-end gap-2 pt-4 border-t">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
        >
          Save Changes
        </button>
      </div>
    </form>
  );
}
