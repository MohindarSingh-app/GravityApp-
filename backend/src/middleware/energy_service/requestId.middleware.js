const crypto = require('crypto');

function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  const valid = incoming && /^[A-Za-z0-9_-]{8,64}$/.test(incoming);
  req.requestId = valid ? incoming : crypto.randomUUID();
  res.set('X-Request-Id', req.requestId);
  next();
}

module.exports = { requestId };
