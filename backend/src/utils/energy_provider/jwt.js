const jwt = require('jsonwebtoken');

const signAccessToken = (payload, secret, expiresIn) =>
  jwt.sign(payload, secret, { expiresIn });

const signRefreshToken = (payload, secret, expiresIn) =>
  jwt.sign(payload, secret, { expiresIn });

const verifyToken = (token, secret) => jwt.verify(token, secret);

module.exports = { signAccessToken, signRefreshToken, verifyToken };
