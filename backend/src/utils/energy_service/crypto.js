const crypto = require('crypto');
const net = require('net');

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmacSha256(secret, value) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function timingSafeEqualHex(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function normalizeIp(ip) {
  if (!ip || typeof ip !== 'string') return null;
  const cleaned = ip.replace(/^::ffff:/, '');
  return net.isIP(cleaned) ? cleaned : null;
}

module.exports = { randomToken, sha256, hmacSha256, timingSafeEqualHex, normalizeIp };
