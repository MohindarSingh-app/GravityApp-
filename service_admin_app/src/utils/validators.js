import { isValidGstin, normalizeGstin } from './gst';
import { normalizePhone } from './phone';

const CITY_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;

export function validateEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())) {
    return 'Enter a valid email address.';
  }
  return '';
}

export function validateName(name) {
  const value = String(name || '').trim();
  if (value.length < 2) return 'Name must be at least 2 characters.';
  if (value.length > 120) return 'Name must be at most 120 characters.';
  if (!NAME_PATTERN.test(value)) return 'Name contains unsupported characters.';
  return '';
}

export function validatePhone(phone) {
  try {
    normalizePhone(phone);
    return '';
  } catch (error) {
    return error.message || 'Enter a valid phone number.';
  }
}

export function validateOtp(otp) {
  if (!/^\d{6}$/.test(String(otp || '').trim())) {
    return 'Enter the 6-digit code.';
  }
  return '';
}

function validateCity(city) {
  const value = String(city || '').trim();
  if (value.length < 2) return 'City must be at least 2 characters.';
  if (value.length > 80) return 'City must be at most 80 characters.';
  if (!CITY_PATTERN.test(value)) return 'City contains unsupported characters.';
  return '';
}

export function validateCompany(values) {
  const errors = {};
  const companyName = String(values.companyName || '').trim();
  if (companyName.length < 2) errors.companyName = 'Company name must be at least 2 characters.';
  else if (companyName.length > 200) errors.companyName = 'Company name must be at most 200 characters.';

  if (!isValidGstin(values.gst)) {
    errors.gst = 'Enter a GSTIN in the 15-character format (for example, 27AAPFU0939F1ZV).';
  }

  const industry = String(values.industry || '').trim();
  if (industry.length < 2) errors.industry = 'Industry must be at least 2 characters.';
  else if (industry.length > 80) errors.industry = 'Industry must be at most 80 characters.';

  const cityError = validateCity(values.city);
  if (cityError) errors.city = cityError;
  return errors;
}

export function companyPayload(values) {
  return {
    companyName: String(values.companyName || '').trim(),
    gst: normalizeGstin(values.gst),
    industry: String(values.industry || '').trim(),
    city: String(values.city || '').trim(),
  };
}

export function validateSite(values) {
  const errors = {};
  const siteName = String(values.siteName || '').trim();
  if (siteName.length < 2) errors.siteName = 'Site name must be at least 2 characters.';
  else if (siteName.length > 160) errors.siteName = 'Site name must be at most 160 characters.';

  const fullAddress = String(values.fullAddress || '').trim();
  if (fullAddress.length < 5) errors.fullAddress = 'Address must be at least 5 characters.';
  else if (fullAddress.length > 500) errors.fullAddress = 'Address must be at most 500 characters.';

  const cityError = validateCity(values.city);
  if (cityError) errors.city = cityError;

  if (!values.siteType) errors.siteType = 'Choose a site type.';

  const latitudeText = String(values.latitude ?? '').trim();
  const longitudeText = String(values.longitude ?? '').trim();
  const latitude = Number(latitudeText);
  const longitude = Number(longitudeText);
  if (!latitudeText || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    errors.latitude = 'Latitude must be between -90 and 90.';
  }
  if (!longitudeText || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    errors.longitude = 'Longitude must be between -180 and 180.';
  }
  return errors;
}

export function sitePayload(values) {
  return {
    siteName: String(values.siteName || '').trim(),
    fullAddress: String(values.fullAddress || '').trim(),
    city: String(values.city || '').trim(),
    latitude: Number(values.latitude),
    longitude: Number(values.longitude),
    siteType: values.siteType,
    isPrimary: Boolean(values.isPrimary),
  };
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}
