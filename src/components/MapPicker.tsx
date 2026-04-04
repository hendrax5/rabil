'use client';

import { useEffect, useState, useRef } from 'react';
import { X, Layers, MapPin, Navigation } from 'lucide-react';

interface MapPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}

export default function MapPicker({
  isOpen,
  onClose,
  onSelect,
  initialLat = -7.0712854057077745,
  initialLng = 108.04477186751905,
}: MapPickerProps) {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [basemap, setBasemap] = useState<'street' | 'satellite'>('street');
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && initialLat && initialLng) {
      setPosition([initialLat, initialLng]);
    }
  }, [isOpen, initialLat, initialLng]);

  // Initialize map when dialog opens
  useEffect(() => {
    if (!isOpen || !isMounted || !mapContainerRef.current) return;
    
    let isCancelled = false;

    const initMap = async () => {
      // Dynamic import Leaflet
      const L = (await import('leaflet')).default;
      
      // Import CSS via link tag
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Fix default marker icon
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (isCancelled || !mapContainerRef.current) return;

      // Check if map already exists
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      // Create map
      const center: [number, number] = position || [initialLat, initialLng];
      const map = L.map(mapContainerRef.current).setView(center, 15);
      mapRef.current = map;

      // Add tile layer based on basemap selection
      const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      });

      const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; <a href="https://www.esri.com">Esri</a>',
      });

      if (basemap === 'street') {
        streetLayer.addTo(map);
      } else {
        satelliteLayer.addTo(map);
      }

      // Add marker if position exists
      if (position) {
        markerRef.current = L.marker(position).addTo(map);
      }

      // Handle map click
      map.on('click', (e: any) => {
        const newPos: [number, number] = [e.latlng.lat, e.latlng.lng];
        setPosition(newPos);

        // Update or create marker
        if (markerRef.current) {
          markerRef.current.setLatLng(newPos);
        } else {
          markerRef.current = L.marker(newPos).addTo(map);
        }
      });

      setMapLoaded(true);
    };

    initMap();

    return () => {
      isCancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
      setMapLoaded(false);
    };
  }, [isOpen, isMounted]);

  // Handle basemap change
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const L = require('leaflet');
    
    // Remove existing tile layers
    mapRef.current.eachLayer((layer: any) => {
      if (layer instanceof L.TileLayer) {
        mapRef.current.removeLayer(layer);
      }
    });

    // Add new tile layer
    if (basemap === 'street') {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapRef.current);
    } else {
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; <a href="https://www.esri.com">Esri</a>',
      }).addTo(mapRef.current);
    }
  }, [basemap, mapLoaded]);

  const handleConfirm = () => {
    if (position) {
      onSelect(position[0], position[1]);
      onClose();
    }
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setPosition(newPos);
          
          if (mapRef.current) {
            mapRef.current.flyTo(newPos, 17);
            
            // Update or create marker
            const L = require('leaflet');
            if (markerRef.current) {
              markerRef.current.setLatLng(newPos);
            } else {
              markerRef.current = L.marker(newPos).addTo(mapRef.current);
            }
          }
        },
        (err) => {
          console.error('GPS Error:', err);
          alert('Gagal mendapatkan lokasi GPS. Pastikan izin lokasi diaktifkan.');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      alert('Browser tidak mendukung GPS');
    }
  };

  if (!isOpen || !isMounted) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-teal-600" />
            <h3 className="text-sm font-semibold">Pilih Lokasi di Peta</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Map Container */}
        <div className="p-4">
          <div className="relative h-[400px] md:h-[500px] rounded-lg overflow-hidden border dark:border-gray-700">
            {/* Controls Overlay */}
            <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
              {/* Basemap Toggle */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <button
                  onClick={() => setBasemap('street')}
                  className={`px-3 py-2 text-xs font-medium transition flex items-center gap-1.5 w-full ${
                    basemap === 'street'
                      ? 'bg-teal-600 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Layers className="h-3 w-3" />
                  Street
                </button>
                <button
                  onClick={() => setBasemap('satellite')}
                  className={`px-3 py-2 text-xs font-medium transition flex items-center gap-1.5 w-full border-t dark:border-gray-700 ${
                    basemap === 'satellite'
                      ? 'bg-teal-600 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Layers className="h-3 w-3" />
                  Satelit
                </button>
              </div>

              {/* GPS Button */}
              <button
                onClick={handleGetCurrentLocation}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                title="Gunakan lokasi saya"
              >
                <Navigation className="h-4 w-4 text-blue-600" />
              </button>
            </div>

            {/* Map div */}
            <div 
              ref={mapContainerRef} 
              className="h-full w-full"
              style={{ minHeight: '400px' }}
            />

            {/* Loading overlay */}
            {!mapLoaded && (
              <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Memuat peta...</p>
                </div>
              </div>
            )}
          </div>

          {/* Coordinates Display */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {position ? (
              <div className="text-xs bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
                <span className="text-gray-500">Koordinat:</span>{' '}
                <span className="font-mono font-medium">
                  {position[0].toFixed(6)}, {position[1].toFixed(6)}
                </span>
              </div>
            ) : (
              <div className="text-xs text-gray-500">
                Klik pada peta untuk memilih lokasi
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs border dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={!position}
            className="px-4 py-2 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Pilih Lokasi Ini
          </button>
        </div>
      </div>
    </div>
  );
}
