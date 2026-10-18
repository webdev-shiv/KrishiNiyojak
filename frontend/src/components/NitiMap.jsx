import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { 
  Plus, 
  Minus, 
  Crosshair, 
  Navigation, 
  MapPin, 
  Car, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  Tractor,
  Search,
  Filter,
  X,
  Building2,
  User,
  Wrench,
  Layers,
  ArrowRight,
  ShieldAlert,
  Info,
  Calendar,
  Compass,
  RotateCcw,
  Tag,
  Check
} from 'lucide-react';
import { calculateRoute, reverseGeocode, UP_DISTRICT_COORDINATES } from '../services/routingService';

/**
 * Creates custom SVG DivIcons for Leaflet
 * Supports CHC (green building), FARMER (blue person), CONTRIBUTOR (purple tool/person), MACHINERY (orange tractor), PICKER (amber)
 */
const createCustomMarker = (type = 'FIELD', label = '', active = false, status = '') => {
  let bgColor = '#2563eb'; // Default blue
  let iconSvg = '';

  const isMaintenance = status === 'Maintenance' || status === 'Under Maintenance' || status === 'CRITICAL';
  const isUnavailable = status === 'Unavailable' || status === 'On Leave';

  if (type === 'CHC') {
    bgColor = '#15803d'; // Green building marker
    iconSvg = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 21h18M5 21V7l7-4 7 4v14M9 10v11M15 10v11M9 7h6"/>
      </svg>
    `;
  } else if (type === 'FARMER' || type === 'FIELD') {
    bgColor = active ? '#1d4ed8' : '#2563eb'; // Blue person marker
    iconSvg = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="7" r="4"></circle>
        <path d="M5.5 21v-2a6.5 6.5 0 0 1 13 0v2"></path>
      </svg>
    `;
  } else if (type === 'CONTRIBUTOR') {
    bgColor = isUnavailable ? '#6b7280' : '#7c3aed'; // Purple person/tool marker
    iconSvg = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
    `;
  } else if (type === 'MACHINERY') {
    bgColor = isMaintenance ? '#dc2626' : (active ? '#c2410c' : '#ea580c'); // Orange tractor/machine marker
    iconSvg = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 11l4-4h4l3 3h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1M7 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm10-2a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
      </svg>
    `;
  } else if (type === 'PICKER') {
    bgColor = '#d97706'; // Vibrant amber
    iconSvg = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff" stroke="#92400e" stroke-width="1.5">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
    `;
  }

  // Prevent overlapping labels with compact truncated label (max 14 chars)
  const truncatedLabel = label && label.length > 15 ? label.substring(0, 14) + '…' : label;

  const html = `
    <div style="
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${active ? '38px' : '32px'};
      height: ${active ? '38px' : '32px'};
      background: ${bgColor};
      border: ${active ? '3px solid #fef08a' : '2.5px solid #ffffff'};
      border-radius: 50%;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      cursor: pointer;
      transition: all 0.2s ease;
    ">
      ${iconSvg}
      ${isMaintenance ? `
        <div style="
          position: absolute;
          top: -2px;
          right: -2px;
          width: 9px;
          height: 9px;
          background: #ef4444;
          border: 1.5px solid #ffffff;
          border-radius: 50%;
        "></div>
      ` : ''}
      ${truncatedLabel ? `
        <div style="
          position: absolute;
          top: -24px;
          background: #0f172a;
          color: #ffffff;
          padding: 1.5px 6px;
          border-radius: 5px;
          font-size: 9.5px;
          font-weight: 700;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.25);
          pointer-events: none;
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
        ">${truncatedLabel}</div>
      ` : ''}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'niti-map-marker',
    iconSize: active ? [38, 38] : [32, 32],
    iconAnchor: active ? [19, 19] : [16, 16],
    popupAnchor: [0, -18]
  });
};

/**
 * NitiMap Component
 * Interactive Leaflet Map with OpenStreetMap tiles, live multi-entity operations markers, category filtering, search, and entity detail drawer.
 */
export const NitiMap = ({
  center = { lat: 27.8974, lng: 78.0880 }, // Default Aligarh/UP
  zoom = 10,
  operatingRadiusKm = 25,
  markers = [],
  selectedMarker = null,
  onSelectMarker = null,
  routeTo = null, // { lat, lng, label }
  mode = 'view', // 'view' | 'picker'
  onLocationSelect = null, // Callback for picker mode: ({ lat, lng, displayName })
  height = '480px',
  className = '',
  title = 'Service Area Map'
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const circleLayerRef = useRef(null);
  const pickerMarkerRef = useRef(null);

  const [routeInfo, setRouteInfo] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [activeRouteTarget, setActiveRouteTarget] = useState(null);
  const [pickerCoords, setPickerCoords] = useState(
    mode === 'picker' ? center : null
  );
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  // Category filter state: 'ALL' | 'CHC' | 'FARMER' | 'CONTRIBUTOR' | 'MACHINERY'
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntityDetail, setSelectedEntityDetail] = useState(null);

  // Sync internal selected entity with external selectedMarker
  useEffect(() => {
    if (selectedMarker) {
      setSelectedEntityDetail(selectedMarker);
    }
  }, [selectedMarker]);

  // Compute category counts
  const categoryCounts = useMemo(() => {
    const counts = { ALL: markers.length, CHC: 0, FARMER: 0, CONTRIBUTOR: 0, MACHINERY: 0 };
    markers.forEach(m => {
      const type = (m.type || 'FIELD').toUpperCase();
      if (type === 'CHC') counts.CHC++;
      else if (type === 'FARMER' || type === 'FIELD') counts.FARMER++;
      else if (type === 'CONTRIBUTOR') counts.CONTRIBUTOR++;
      else if (type === 'MACHINERY') counts.MACHINERY++;
    });
    return counts;
  }, [markers]);

  // Filtered markers based on Category & Search
  const visibleMarkers = useMemo(() => {
    return markers.filter(m => {
      const type = (m.type || 'FIELD').toUpperCase();
      // Category filter
      if (categoryFilter !== 'ALL') {
        if (categoryFilter === 'FARMER' && type !== 'FARMER' && type !== 'FIELD') return false;
        if (categoryFilter !== 'FARMER' && type !== categoryFilter) return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (m.name || m.farmer || m.label || '').toLowerCase();
        const village = (m.village || m.farmer_village || '').toLowerCase();
        const district = (m.district || m.farmer_district || '').toLowerCase();
        const operation = (m.operation || m.supported_operations || '').toLowerCase();
        const role = (m.role || '').toLowerCase();
        const id = (m.id || m.machine_id || m.booking_id || '').toLowerCase();
        const matches = name.includes(q) || village.includes(q) || district.includes(q) || operation.includes(q) || role.includes(q) || id.includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [markers, categoryFilter, searchQuery]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const tileUrl = import.meta.env.VITE_MAP_TILES_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      const attribution = import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

      const map = L.map(mapContainerRef.current, {
        center: [center.lat || 27.8974, center.lng || 78.0880],
        zoom: zoom,
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer(tileUrl, {
        attribution,
        maxZoom: 19,
      }).addTo(map);

      // Create LayerGroups
      markersLayerRef.current = L.layerGroup().addTo(map);
      routeLayerRef.current = L.layerGroup().addTo(map);
      circleLayerRef.current = L.layerGroup().addTo(map);

      // Handle map clicks in picker mode
      map.on('click', async (e) => {
        if (mode === 'picker') {
          const { lat, lng } = e.latlng;
          setPickerCoords({ lat, lng });
          if (onLocationSelect) {
            const geo = await reverseGeocode(lat, lng);
            onLocationSelect({
              latitude: Number(lat.toFixed(6)),
              longitude: Number(lng.toFixed(6)),
              displayName: geo.displayName,
              village: geo.village,
              district: geo.district
            });
          }
        }
      });

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Center and Operating Radius Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !circleLayerRef.current) return;

    circleLayerRef.current.clearLayers();

    if (center && !isNaN(center.lat) && !isNaN(center.lng)) {
      if (mode === 'view') {
        // CHC Operational Radius Circle
        L.circle([center.lat, center.lng], {
          radius: (operatingRadiusKm || 25) * 1000,
          color: '#15803d',
          weight: 1.5,
          dashArray: '4, 6',
          fillColor: '#16a34a',
          fillOpacity: 0.08
        }).addTo(circleLayerRef.current);

        // CHC Center Pin (if no explicit CHC in markers list)
        const hasChcInMarkers = visibleMarkers.some(m => (m.type || '').toUpperCase() === 'CHC');
        if (!hasChcInMarkers) {
          const chcMarker = L.marker([center.lat, center.lng], {
            icon: createCustomMarker('CHC', title || 'CHC Hub')
          }).bindPopup(`
            <div style="font-family: sans-serif; padding: 4px;">
              <div style="font-weight: 800; font-size: 13px; color: #15803d;">${title || 'Custom Hiring Centre'}</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Central Machinery & Dispatch Hub</div>
              <div style="font-size: 11px; color: #16a34a; font-weight: 700; margin-top: 4px;">Operating Radius: ${operatingRadiusKm} km</div>
            </div>
          `);
          chcMarker.addTo(circleLayerRef.current);
        }
      }
    }
  }, [center, operatingRadiusKm, mode, title, visibleMarkers]);

  // Update Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !markersLayerRef.current || mode !== 'view') return;

    markersLayerRef.current.clearLayers();

    visibleMarkers.forEach((m) => {
      if (!m.lat || !m.lng || isNaN(m.lat) || isNaN(m.lng)) return;

      const isSelected = (selectedEntityDetail && (selectedEntityDetail.id === m.id || selectedEntityDetail.name === m.name)) ||
                         (selectedMarker && (selectedMarker.id === m.id || selectedMarker.farmer === m.farmer));

      const markerType = (m.type || 'FIELD').toUpperCase();
      const markerLabel = m.label || m.name || m.farmer || m.machine_id;

      const marker = L.marker([m.lat, m.lng], {
        icon: createCustomMarker(markerType, markerLabel, isSelected, m.status)
      });

      // Compact Leaflet Popup
      marker.bindPopup(`
        <div style="font-family: sans-serif; padding: 4px; min-width: 160px; max-width: 220px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 3px;">
            <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; padding: 1px 6px; border-radius: 4px; ${
              markerType === 'CHC' ? 'background: #dcfce7; color: #15803d;' :
              markerType === 'CONTRIBUTOR' ? 'background: #f3e8ff; color: #7c3aed;' :
              markerType === 'MACHINERY' ? 'background: #ffedd5; color: #c2410c;' :
              'background: #dbeafe; color: #1d4ed8;'
            }">
              ${markerType === 'FIELD' ? 'FARMER' : markerType}
            </span>
            ${m.status ? `<span style="font-size: 10px; font-weight: 700; color: ${m.status === 'Completed' || m.status === 'Available' ? '#16a34a' : m.status === 'Maintenance' ? '#dc2626' : '#d97706'}">● ${m.status}</span>` : ''}
          </div>
          <div style="font-weight: 800; font-size: 12px; color: #0f172a; margin-top: 2px;">
            ${m.name || m.farmer || m.machine_id || 'Entity'}
          </div>
          <div style="font-size: 11px; color: #475569; margin-top: 1px;">
            ${m.village ? `${m.village}, ` : ''}${m.district || ''}
          </div>
          ${m.operation ? `<div style="font-size: 11px; font-weight: 600; color: #15803d; margin-top: 3px;">${m.operation}</div>` : ''}
          ${m.acreage ? `<div style="font-size: 10px; color: #64748b;">Area: ${m.acreage} Acres</div>` : ''}
          ${m.role ? `<div style="font-size: 10px; color: #7c3aed; font-weight: 600;">Role: ${m.role}</div>` : ''}
          ${m.horsepower ? `<div style="font-size: 10px; color: #c2410c; font-weight: 600;">Power: ${m.horsepower}</div>` : ''}
          <div style="font-size: 10px; color: #0284c7; font-weight: 700; margin-top: 5px; cursor: pointer;">
            Click marker for full operational panel →
          </div>
        </div>
      `);

      marker.on('click', () => {
        setSelectedEntityDetail(m);
        if (onSelectMarker) {
          onSelectMarker(m);
        }
      });

      marker.addTo(markersLayerRef.current);
    });
  }, [visibleMarkers, selectedEntityDetail, selectedMarker, mode, onSelectMarker]);

  // Handle Full Reset View
  const handleResetView = () => {
    setCategoryFilter('ALL');
    setSearchQuery('');
    setSelectedEntityDetail(null);
    setActiveRouteTarget(null);
    if (onSelectMarker) onSelectMarker(null);
    if (mapInstanceRef.current && center) {
      mapInstanceRef.current.setView([center.lat, center.lng], zoom);
    }
  };

  // Update Interactive Location Picker Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || mode !== 'picker') return;

    if (pickerMarkerRef.current) {
      map.removeLayer(pickerMarkerRef.current);
      pickerMarkerRef.current = null;
    }

    if (pickerCoords && !isNaN(pickerCoords.lat) && !isNaN(pickerCoords.lng)) {
      const marker = L.marker([pickerCoords.lat, pickerCoords.lng], {
        icon: createCustomMarker('PICKER', 'Field Location', true),
        draggable: true
      });

      marker.on('dragend', async (e) => {
        const { lat, lng } = e.target.getLatLng();
        setPickerCoords({ lat, lng });
        if (onLocationSelect) {
          const geo = await reverseGeocode(lat, lng);
          onLocationSelect({
            latitude: Number(lat.toFixed(6)),
            longitude: Number(lng.toFixed(6)),
            displayName: geo.displayName,
            village: geo.village,
            district: geo.district
          });
        }
      });

      marker.addTo(map);
      pickerMarkerRef.current = marker;
      map.panTo([pickerCoords.lat, pickerCoords.lng]);
    }
  }, [pickerCoords, mode]);

  // Calculate and Render Road Route via OSRM
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !routeLayerRef.current) return;

    routeLayerRef.current.clearLayers();
    setRouteInfo(null);

    const destination = activeRouteTarget || routeTo || (selectedMarker && selectedMarker.lat && selectedMarker.lng ? selectedMarker : null);

    if (!destination || !center || isNaN(destination.lat) || isNaN(destination.lng) || isNaN(center.lat) || isNaN(center.lng)) {
      return;
    }

    if (Math.abs(center.lat - destination.lat) < 0.0001 && Math.abs(center.lng - destination.lng) < 0.0001) {
      return;
    }

    let isMounted = true;
    setLoadingRoute(true);

    calculateRoute(center, destination).then((result) => {
      if (!isMounted || !mapInstanceRef.current) return;
      setLoadingRoute(false);
      setRouteInfo(result);

      if (result.coordinates && result.coordinates.length > 0) {
        const polyline = L.polyline(result.coordinates, {
          color: result.isEstimated ? '#f59e0b' : '#15803d',
          weight: 4.5,
          opacity: 0.85,
          dashArray: result.isEstimated ? '6, 6' : undefined,
          lineJoin: 'round'
        }).addTo(routeLayerRef.current);

        map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [center, routeTo, selectedMarker, activeRouteTarget]);

  // Handle GPS "Locate Me" button
  const handleLocateMe = () => {
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your current browser.');
      return;
    }

    const isLocalhost = Boolean(
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]'
    );
    if (!window.isSecureContext && !isLocalhost) {
      setGpsError('Browser geolocation requires a secure HTTPS connection or localhost.');
      return;
    }

    setGpsLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGpsLoading(false);
        setGpsError(null);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPickerCoords({ lat, lng });

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 14, { animate: true });
        }

        if (onLocationSelect) {
          const geo = await reverseGeocode(lat, lng);
          onLocationSelect({
            latitude: Number(lat.toFixed(6)),
            longitude: Number(lng.toFixed(6)),
            displayName: geo.displayName,
            village: geo.village,
            district: geo.district
          });
        }
      },
      (err) => {
        setGpsLoading(false);
        let message = 'Unable to retrieve GPS coordinates.';
        switch (err.code) {
          case 1:
            message = 'GPS permission denied. Please allow location access or click on the map.';
            break;
          case 2:
            message = 'Device GPS position unavailable. Please ensure location services are enabled.';
            break;
          case 3:
            message = 'GPS location request timed out. Please try again or select field on map.';
            break;
          default:
            message = err.message || 'GPS lookup failed.';
            break;
        }
        setGpsError(message);
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 30000 }
    );
  };

  // Zoom helpers
  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };
  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };
  const handleRecenter = () => {
    if (mapInstanceRef.current && center) {
      mapInstanceRef.current.setView([center.lat, center.lng], zoom);
    }
  };

  return (
    <div className={`relative rounded-3xl overflow-hidden border border-gray-200/90 shadow-sm bg-[#eef7ee] flex flex-col ${className}`}>
      
      {/* 1. TOP OPERATIONS CONTROL BAR: Category Filter Tabs, Search & Reset View */}
      {mode === 'view' && (
        <div className="bg-white/95 backdrop-blur-md border-b border-gray-200 p-2.5 sm:p-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5 z-10">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => setCategoryFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'ALL'
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All ({categoryCounts.ALL})</span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter('CHC')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'CHC'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>CHCs ({categoryCounts.CHC})</span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter('FARMER')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'FARMER'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Farmers ({categoryCounts.FARMER})</span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter('CONTRIBUTOR')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'CONTRIBUTOR'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Contributors ({categoryCounts.CONTRIBUTOR})</span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter('MACHINERY')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'MACHINERY'
                  ? 'bg-amber-700 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
              }`}
            >
              <Tractor className="w-3.5 h-3.5" />
              <span>Machinery ({categoryCounts.MACHINERY})</span>
            </button>
          </div>

          {/* Search Box & Reset View Button */}
          <div className="flex items-center gap-2">
            <div className="relative grow sm:w-56">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search entity, ID, village..."
                className="w-full pl-8 pr-7 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:border-emerald-500 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleResetView}
              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-gray-100 border border-gray-200 text-xs font-bold text-gray-700 flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              title="Reset Filters, Search and Center"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset View</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. MAP CONTAINER */}
      <div className="relative grow">
        <div 
          ref={mapContainerRef} 
          style={{ height, width: '100%', minHeight: '340px' }} 
          className="z-0"
        />

        {/* Floating Real Route HUD Card */}
        {routeInfo && (
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-md border border-gray-200 flex items-center gap-3 z-10 animate-fade-in text-xs max-w-[280px] sm:max-w-none">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Car className="w-3.5 h-3.5 text-emerald-800" />
              </div>
              <div>
                <div className="font-extrabold text-gray-900 leading-tight">
                  {routeInfo.distanceKm} km
                </div>
                <div className="text-[10px] text-gray-500">Transit Distance</div>
              </div>
            </div>

            <div className="w-px h-6 bg-gray-200" />

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5 text-blue-800" />
              </div>
              <div>
                <div className="font-extrabold text-gray-900 leading-tight">
                  {routeInfo.durationMinutes} min
                </div>
                <div className="text-[10px] text-gray-500">Transit ETA</div>
              </div>
            </div>

            <div className="w-px h-6 bg-gray-200 hidden sm:block" />

            <div className="hidden sm:block">
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                routeInfo.isEstimated ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {routeInfo.isEstimated ? 'Estimated Road' : 'OSRM Real Route'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveRouteTarget(null);
                setRouteInfo(null);
                if (routeLayerRef.current) routeLayerRef.current.clearLayers();
              }}
              className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 ml-1"
              title="Clear Route"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Route Loading Spinner */}
        {loadingRoute && (
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs rounded-xl px-3 py-2 shadow-sm border border-gray-200 flex items-center gap-2 z-10 text-xs font-medium text-gray-700">
            <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span>Calculating road route...</span>
          </div>
        )}

        {/* Picker Mode Instruction Bar & GPS Button */}
        {mode === 'picker' && (
          <div className="absolute top-3 left-3 right-14 bg-white/95 backdrop-blur-md rounded-xl p-2.5 shadow-md border border-gray-200 flex items-center justify-between gap-2 z-10 text-xs">
            <div className="flex items-center gap-2 truncate">
              <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="font-medium text-gray-800 truncate">
                {pickerCoords ? `Pin: ${pickerCoords.lat.toFixed(4)}, ${pickerCoords.lng.toFixed(4)}` : 'Click anywhere on map to set field pin'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={gpsLoading}
              className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
            >
              <Navigation className="w-3 h-3" />
              <span>{gpsLoading ? 'Locating...' : 'My GPS'}</span>
            </button>
          </div>
        )}

        {/* GPS Error Toast */}
        {gpsError && (
          <div className="absolute bottom-14 left-3 right-14 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-2 text-xs flex items-center gap-2 z-10 shadow-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{gpsError}. You can click directly on the map.</span>
          </div>
        )}

        {/* Custom Clean Map Controls (Top Right) */}
        <div className="absolute top-3 right-3 flex flex-col bg-white rounded-2xl shadow-md border border-gray-200/90 overflow-hidden z-10">
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-2 text-gray-700 hover:bg-gray-50 border-b border-gray-100 transition-colors cursor-pointer"
            title="Zoom In"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-2 text-gray-700 hover:bg-gray-50 border-b border-gray-100 transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRecenter}
            className="p-2 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            title="Recenter Map"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>

        {/* 3. CLICKABLE ENTITY DETAILS FLOATING DRAWER */}
        {selectedEntityDetail && mode === 'view' && (
          <div className="absolute bottom-10 left-3 right-3 sm:right-auto sm:w-96 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200 p-4 z-20 text-xs animate-scale-up space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                  (selectedEntityDetail.type || '').toUpperCase() === 'CHC' ? 'bg-emerald-100 text-emerald-800' :
                  (selectedEntityDetail.type || '').toUpperCase() === 'CONTRIBUTOR' ? 'bg-purple-100 text-purple-800' :
                  (selectedEntityDetail.type || '').toUpperCase() === 'MACHINERY' ? 'bg-orange-100 text-orange-900' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {selectedEntityDetail.type || 'FARMER'}
                </span>
                {selectedEntityDetail.status && (
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                    selectedEntityDetail.status === 'Completed' || selectedEntityDetail.status === 'Available' || selectedEntityDetail.status === 'Operational' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    selectedEntityDetail.status === 'Maintenance' || selectedEntityDetail.status === 'CRITICAL' ? 'bg-red-50 text-red-700 border border-red-200' :
                    'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    ● {selectedEntityDetail.status}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntityDetail(null)}
                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Entity Title & Location */}
            <div>
              <h4 className="font-black text-sm text-gray-900">
                {selectedEntityDetail.name || selectedEntityDetail.farmer || selectedEntityDetail.machine_id || 'Operational Entity'}
              </h4>
              <div className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                <MapPin className="w-3 h-3 text-emerald-700 shrink-0" />
                <span>{selectedEntityDetail.village || selectedEntityDetail.farmer_village || 'District Node'}, {selectedEntityDetail.district || selectedEntityDetail.farmer_district || 'Uttar Pradesh'}</span>
                {selectedEntityDetail.lat && (
                  <span className="font-mono text-[10px] text-gray-400">({selectedEntityDetail.lat.toFixed(4)}, {selectedEntityDetail.lng.toFixed(4)})</span>
                )}
              </div>
            </div>

            {/* Dynamic Attributes Based on Entity Type */}
            {/* A. FARMER SPECIFIC DETAILS */}
            {((selectedEntityDetail.type || '').toUpperCase() === 'FARMER' || (selectedEntityDetail.type || '').toUpperCase() === 'FIELD') && (
              <div className="bg-blue-50/60 rounded-xl p-2.5 border border-blue-100 space-y-1.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold block">Active Request</span>
                    <span className="font-extrabold text-blue-900">{selectedEntityDetail.booking_id || selectedEntityDetail.id || 'BK-ACTIVE'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold block">Operation & Crop</span>
                    <span className="font-semibold text-gray-800">{selectedEntityDetail.operation || 'Harvesting'} • {selectedEntityDetail.crop || 'Wheat'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-blue-100/70">
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold block">Farm Parcel Area</span>
                    <span className="font-semibold text-gray-800">{selectedEntityDetail.acreage || 2.5} Acres</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold block">Schedule Window</span>
                    <span className="font-semibold text-gray-800">{selectedEntityDetail.schedule_date || selectedEntityDetail.timestamp || 'Today'}</span>
                  </div>
                </div>
                {selectedEntityDetail.priority_score && (
                  <div className="text-[10px] text-blue-800 font-semibold pt-1">
                    Priority Score: <strong>{selectedEntityDetail.priority_score}/100</strong>
                  </div>
                )}
              </div>
            )}

            {/* B. CONTRIBUTOR SPECIFIC DETAILS (Machine Owner / Operator) */}
            {(selectedEntityDetail.type || '').toUpperCase() === 'CONTRIBUTOR' && (
              <div className="bg-purple-50/60 rounded-xl p-2.5 border border-purple-100 space-y-1.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold block">Role & Certification</span>
                    <span className="font-semibold text-purple-900">{selectedEntityDetail.role || 'Certified Operator'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold block">Associated Machinery</span>
                    <span className="font-semibold text-gray-800">{selectedEntityDetail.associated_machines || 'Combine & Heavy Tractor'}</span>
                  </div>
                </div>
                <div className="pt-1 border-t border-purple-100/70">
                  <span className="text-[10px] text-gray-500 font-bold block">Current Task & Assignment</span>
                  <span className="font-extrabold text-gray-900">{selectedEntityDetail.current_assignment || 'No current assignment'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-purple-100/70">
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold block">Destination Node</span>
                    <span className="font-semibold text-gray-800">{selectedEntityDetail.destination || 'Pur Kalan Village Parcel'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold block">Expected Schedule</span>
                    <span className="font-semibold text-gray-800">{selectedEntityDetail.expected_schedule || '08:00 AM – 12:00 PM'}</span>
                  </div>
                </div>
                <div className="pt-1 border-t border-purple-100/70 flex items-center justify-between text-[10px]">
                  <span className="text-gray-500">Last verified: {selectedEntityDetail.last_verified_at || '18 Oct 2026, 08:30 AM'}</span>
                  <span className="text-purple-700 font-bold">On Schedule</span>
                </div>
                {/* Transparent GPS Status Notice */}
                <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[10px] flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>Live GPS broadcast inactive; base coordinates verified via CHC Registry.</span>
                </div>
              </div>
            )}

            {/* C. CHC SPECIFIC DETAILS */}
            {(selectedEntityDetail.type || '').toUpperCase() === 'CHC' && (
              <div className="bg-emerald-50/60 rounded-xl p-2.5 border border-emerald-100 space-y-1.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold block">Available Machines</span>
                    <span className="font-black text-emerald-900">{selectedEntityDetail.available_machines || 8} / {selectedEntityDetail.total_machines || 10} Units</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold block">Available Operators</span>
                    <span className="font-black text-emerald-900">{selectedEntityDetail.available_operators || 5} / {selectedEntityDetail.total_operators || 6} Staff</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-emerald-100/70">
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold block">Operating Service Radius</span>
                    <span className="font-semibold text-gray-800">{selectedEntityDetail.operatingRadiusKm || operatingRadiusKm} km</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold block">Pending Requests</span>
                    <span className="font-semibold text-amber-800">{selectedEntityDetail.pending_requests || 0} Awaiting Review</span>
                  </div>
                </div>
              </div>
            )}

            {/* D. MACHINERY SPECIFIC DETAILS */}
            {(selectedEntityDetail.type || '').toUpperCase() === 'MACHINERY' && (
              <div className="bg-orange-50/60 rounded-xl p-2.5 border border-orange-100 space-y-1.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold block">Machine Type & Power</span>
                    <span className="font-extrabold text-orange-950">{selectedEntityDetail.machine_type || 'Tractor Unit'} • {selectedEntityDetail.horsepower || '55 HP'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold block">Host CHC Owner</span>
                    <span className="font-semibold text-gray-800">{selectedEntityDetail.owner_chc || 'CHC Pur Kalan'}</span>
                  </div>
                </div>
                <div className="pt-1 border-t border-orange-100/70">
                  <span className="text-[10px] text-gray-500 font-bold block">Supported Operations</span>
                  <span className="font-semibold text-gray-800">{selectedEntityDetail.supported_operations || 'Tillage, Harvesting, Seed Sowing'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-orange-100/70">
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold block">Current Assignment</span>
                    <span className="font-extrabold text-gray-900">{selectedEntityDetail.current_assignment || 'No current assignment'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold block">Fleet Location Node</span>
                    <span className="font-semibold text-gray-800">{selectedEntityDetail.location_node || 'CHC Central Yard'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (selectedEntityDetail.lat && selectedEntityDetail.lng) {
                    setActiveRouteTarget({
                      lat: selectedEntityDetail.lat,
                      lng: selectedEntityDetail.lng,
                      label: selectedEntityDetail.name || selectedEntityDetail.farmer
                    });
                  }
                }}
                className="grow py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Car className="w-3.5 h-3.5" />
                <span>Calculate Road Route from CHC</span>
              </button>
            </div>
          </div>
        )}

        {/* Bottom OSM Attribution Badge */}
        <div className="absolute bottom-1 right-2 bg-white/80 backdrop-blur-2xs rounded px-1.5 py-0.5 text-[9px] text-gray-500 z-10 pointer-events-none">
          Leaflet | &copy; OpenStreetMap
        </div>
      </div>

      {/* 4. BOTTOM LEGEND BAR */}
      <div className="bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-2 flex items-center justify-between text-xs text-gray-600 gap-3 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-700 inline-block" />
            <span className="font-bold text-gray-800">CHC Hubs</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
            <span className="font-bold text-gray-800">Farmer Parcels</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" />
            <span className="font-bold text-gray-800">Contributors / Operators</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-600 inline-block" />
            <span className="font-bold text-gray-800">Machinery Fleet</span>
          </div>
        </div>

        <div className="text-[11px] text-gray-400 font-medium hidden md:block">
          Click any marker to open operational tracking details
        </div>
      </div>
    </div>
  );
};
