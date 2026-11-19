const jwt = require('jsonwebtoken');
const config = require('../../config/energy_provider/env');
const UserModel = require('../../models/energy_provider/UserModel');

/**
 * Verify the bearer token and load the partner record.
 *
 * The JWT only carries the identity; the role and the busy/online flags are
 * read from the database on every request so a suspended partner or a newly
 * completed job is reflected immediately.
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token required',
    });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, config.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }

  try {
    const user = await UserModel.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Account no longer exists',
      });
    }
    req.user = user;
    req.token = decoded;
    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = { authenticate };
