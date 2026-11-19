const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function gstinChecksumChar(gstin14) {
  let factor = 2;
  let sum = 0;
  for (let i = 13; i >= 0; i -= 1) {
    let product = factor * CHARSET.indexOf(gstin14[i]);
    factor = factor === 2 ? 1 : 2;
    product = Math.floor(product / CHARSET.length) + (product % CHARSET.length);
    sum += product;
  }
  const checksum = (CHARSET.length - (sum % CHARSET.length)) % CHARSET.length;
  return CHARSET[checksum];
}

function normalizeGstin(value) {
  return String(value || '').trim().toUpperCase();
}

function isValidGstin(value) {
  const gstin = normalizeGstin(value);
  return GSTIN_PATTERN.test(gstin);
}

module.exports = {
  GSTIN_PATTERN,
  normalizeGstin,
  isValidGstin,
  gstinChecksumChar,
};
