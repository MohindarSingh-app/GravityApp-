import { Linking } from 'react-native';

export function siteCoords(site) {
  if (!site) return null;
  const lat = Number(site.latitude ?? site.lat);
  const lng = Number(site.longitude ?? site.lng ?? site.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

export function siteLabel(site) {
  if (!site) return '';
  return [site.siteName, site.address, site.city].filter(Boolean).join(', ');
}

export function googleMapsUrl({ coords, label, zoom = 15 }) {
  if (coords) {
    const query = `${coords.latitude},${coords.longitude}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&zoom=${zoom}`;
  }
  if (label) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`;
  return '';
}

export function googleMapsEmbedUrl({ coords, label, zoom = 15 }) {
  const query = coords ? `${coords.latitude},${coords.longitude}` : label || '';
  if (!query) return '';
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&output=embed`;
}

export async function openLiveMap({ coords, label }) {
  const url = googleMapsUrl({ coords, label });
  if (!url) throw new Error('Location is not available for live tracking.');
  const can = await Linking.canOpenURL(url);
  if (!can) throw new Error('Google Maps could not be opened on this device.');
  await Linking.openURL(url);
}
