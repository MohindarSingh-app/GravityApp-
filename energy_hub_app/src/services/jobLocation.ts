import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export interface JobCoordinates {
  latitude: number;
  longitude: number;
}

export type LocationCapture =
  | { status: 'granted'; location: JobCoordinates }
  | { status: 'denied' | 'unavailable'; location: null };

async function requestForegroundPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const permission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  const current = await PermissionsAndroid.check(permission);
  if (current) return true;

  const result = await PermissionsAndroid.request(permission, {
    title: 'Share location during this job',
    message: 'Your location is shared with Superadmin only while this checked-in job is active and the app is open.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function isValidCoordinates(location: JobCoordinates): boolean {
  return Number.isFinite(location.latitude) && location.latitude >= -90 && location.latitude <= 90 &&
    Number.isFinite(location.longitude) && location.longitude >= -180 && location.longitude <= 180;
}

export async function captureJobLocation(): Promise<LocationCapture> {
  try {
    if (!await requestForegroundPermission()) return { status: 'denied', location: null };
  } catch {
    return { status: 'denied', location: null };
  }

  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      ({ coords }) => {
        const location = { latitude: coords.latitude, longitude: coords.longitude };
        resolve(isValidCoordinates(location)
          ? { status: 'granted', location }
          : { status: 'unavailable', location: null });
      },
      (error) => resolve({
        status: error.code === 1 ? 'denied' : 'unavailable',
        location: null,
      }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  });
}

export async function watchActiveJobLocation(
  onLocation: (location: JobCoordinates) => void,
  onError: (permissionDenied: boolean) => void,
): Promise<{ status: 'watching' | 'denied'; stop: () => void }> {
  if (!await requestForegroundPermission()) {
    return { status: 'denied', stop: () => undefined };
  }

  const watchId = Geolocation.watchPosition(
    ({ coords }) => {
      const location = { latitude: coords.latitude, longitude: coords.longitude };
      if (isValidCoordinates(location)) onLocation(location);
    },
    (error) => onError(error.code === 1),
    {
      enableHighAccuracy: true,
      distanceFilter: 25,
      interval: 60000,
      fastestInterval: 30000,
      maximumAge: 15000,
    },
  );

  return {
    status: 'watching',
    stop: () => Geolocation.clearWatch(watchId),
  };
}
