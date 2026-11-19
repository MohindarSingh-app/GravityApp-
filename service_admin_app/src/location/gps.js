import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

function loadGeolocation() {
  try {
    const mod = Geolocation && (Geolocation.default || Geolocation);
    if (mod && typeof mod.getCurrentPosition === 'function') return mod;
    if (typeof Geolocation.getCurrentPosition === 'function') return Geolocation;
    return null;
  } catch (_error) {
    return null;
  }
}

function unavailable(message) {
  return {
    status: 'unavailable',
    message: message || 'Location is unavailable right now. Enter the coordinates instead.',
  };
}

async function requestAndroidPermission() {
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location for this site',
        message: 'Service Admin uses your location only when you pin a site.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (_error) {
    return false;
  }
}

export async function captureCurrentLocation() {
  try {
    if (Platform.OS === 'android') {
      const granted = await requestAndroidPermission();
      if (!granted) {
        return { status: 'denied' };
      }
    }

    const geo = loadGeolocation();
    if (!geo || typeof geo.getCurrentPosition !== 'function') {
      return unavailable('GPS module is not available on this device. Enter the coordinates instead.');
    }

    return new Promise((resolve) => {
      let settled = false;
      const done = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      try {
        geo.getCurrentPosition(
          (position) => {
            const latitude = position && position.coords ? position.coords.latitude : undefined;
            const longitude = position && position.coords ? position.coords.longitude : undefined;
            if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
              done(unavailable('Could not read GPS coordinates. Enter them manually.'));
              return;
            }
            done({ status: 'granted', latitude, longitude });
          },
          (error) => {
            if (error && error.code === 1) {
              done({ status: 'denied' });
              return;
            }
            done(unavailable());
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
        );
        // Safety net: native callback kabhi na aaye to hang nahi hoga.
        setTimeout(() => done(unavailable('GPS timed out. Enter the coordinates instead.')), 20000);
      } catch (_error) {
        done(unavailable());
      }
    });
  } catch (_error) {
    // Kabhi reject/throw nahi — SiteForm me uncaught redbox na aaye.
    return unavailable();
  }
}
