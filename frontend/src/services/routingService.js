/**
 * NITI Routing & Geocoding Service
 * Uses OpenStreetMap OSRM public API with configurable endpoints and robust fallbacks.
 */

const DEFAULT_ROUTING_URL = 'https://router.project-osrm.org/route/v1/driving';
const DEFAULT_GEOCODING_URL = 'https://nominatim.openstreetmap.org';

// Uttar Pradesh district approximate central coordinates for graceful fallback
export const UP_DISTRICT_COORDINATES = {
  'Aligarh': { lat: 27.8974, lng: 78.0880 },
  'Agra': { lat: 27.1767, lng: 78.0081 },
  'Sitapur': { lat: 27.5684, lng: 80.6829 },
  'Bareilly': { lat: 28.3670, lng: 79.4304 },
  'Etah': { lat: 27.5590, lng: 78.6659 },
  'Varanasi': { lat: 25.3176, lng: 82.9739 },
  'Mathura': { lat: 27.4924, lng: 77.6737 },
  'Meerut': { lat: 28.9845, lng: 77.7064 },
  'Lucknow': { lat: 26.8467, lng: 80.9462 },
  'Kanpur': { lat: 26.4499, lng: 80.3319 },
  'Gorakhpur': { lat: 26.7606, lng: 83.3732 },
  'Ayodhya': { lat: 26.7922, lng: 82.1998 },
  'Faizabad': { lat: 26.7922, lng: 82.1998 },
  'Jhansi': { lat: 25.4484, lng: 78.5685 },
  'Prayagraj': { lat: 25.4358, lng: 81.8463 },
  'Allahabad': { lat: 25.4358, lng: 81.8463 },
  'Hathras': { lat: 27.5969, lng: 78.0519 },
  'Muzaffarnagar': { lat: 29.4727, lng: 77.7085 },
  'Moradabad': { lat: 28.8386, lng: 78.7733 },
  'Saharanpur': { lat: 29.9671, lng: 77.5510 },
  'Lakhimpur Kheri': { lat: 27.9462, lng: 80.7780 }
};

/**
 * Calculate Great-Circle distance using Haversine formula (km)
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Fetch driving road route between two coordinates using OSRM
 * Falls back gracefully to winding-adjusted Haversine if service is offline or errors.
 *
 * @param {Object} start { lat, lng }
 * @param {Object} end { lat, lng }
 * @returns {Promise<Object>}
 */
export async function calculateRoute(start, end) {
  if (!start || !end || isNaN(start.lat) || isNaN(start.lng) || isNaN(end.lat) || isNaN(end.lng)) {
    return {
      success: false,
      distanceKm: 0,
      durationMinutes: 0,
      coordinates: [],
      isEstimated: true,
      error: 'Invalid coordinates provided'
    };
  }

  const routingBaseUrl = import.meta.env.VITE_ROUTING_API_URL || DEFAULT_ROUTING_URL;
  const url = `${routingBaseUrl}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Routing HTTP error ${response.status}`);
    }

    const data = await response.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const primaryRoute = data.routes[0];
      const distanceKm = Number((primaryRoute.distance / 1000).toFixed(2));
      // For agricultural machinery (tractors/harvesters), average transit speed ~25 km/h
      // If duration is car duration, adjust appropriately for tractor transit
      const durationMinutes = Math.max(1, Math.round((distanceKm / 25) * 60));
      // GeoJSON is [lng, lat], Leaflet polyline expects [lat, lng]
      const leafletCoordinates = (primaryRoute.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]);

      return {
        success: true,
        distanceKm,
        durationMinutes,
        coordinates: leafletCoordinates,
        isEstimated: false,
        provider: 'OSRM'
      };
    } else {
      throw new Error(data.message || 'No route found by routing engine');
    }
  } catch (err) {
    console.warn('[NitiRouting] Real route service call failed, using graceful estimation:', err.message);
    const straightLine = calculateHaversineDistance(start.lat, start.lng, end.lat, end.lng);
    const estimatedRoadKm = Number((straightLine * 1.3).toFixed(2)); // Rural road factor
    const estimatedMinutes = Math.max(1, Math.round((estimatedRoadKm / 25) * 60));

    return {
      success: false,
      fallback: true,
      distanceKm: estimatedRoadKm,
      durationMinutes: estimatedMinutes,
      coordinates: [
        [start.lat, start.lng],
        [end.lat, end.lng]
      ],
      isEstimated: true,
      error: err.message,
      provider: 'Haversine Winding Estimation'
    };
  }
}

/**
 * Reverse geocode a latitude and longitude to a village/district label
 */
export async function reverseGeocode(lat, lng) {
  try {
    const geocodingBase = import.meta.env.VITE_GEOCODING_API_URL || DEFAULT_GEOCODING_URL;
    const url = `${geocodingBase}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept-Language': 'en,hi' }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const village = addr.village || addr.hamlet || addr.suburb || addr.town || addr.county || 'Farm Location';
      const district = addr.state_district || addr.district || addr.city || 'Uttar Pradesh';
      return {
        success: true,
        displayName: `${village}, ${district}`,
        village,
        district
      };
    }
  } catch (err) {
    console.warn('[NitiGeocoding] Reverse geocode error:', err.message);
  }

  return {
    success: false,
    displayName: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    village: `Field (${lat.toFixed(3)}, ${lng.toFixed(3)})`,
    district: 'Uttar Pradesh'
  };
}
