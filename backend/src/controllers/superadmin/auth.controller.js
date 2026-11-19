const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Superadmin = require('../../models/superadmin/superadmin.model');
const { successResponse, errorResponse } = require('../../utils/response');

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return errorResponse(res, 400, 'Name, email and password are required');
    }
    const exists = await Superadmin.findByEmail(email);
    if (exists) return errorResponse(res, 400, 'Superadmin already exists with this email');

    const hashed = await bcrypt.hash(password, 10);
    const admin = await Superadmin.create({ name, email, password: hashed });
    return successResponse(res, 201, 'Superadmin created', { id: admin.id, email: admin.email });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const admin = await Superadmin.findByEmail(email, true);
    if (!admin) return errorResponse(res, 401, 'Invalid credentials');

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return errorResponse(res, 401, 'Invalid credentials');

    const token = jwt.sign(
      { id: admin.id, role: 'superadmin', app: 'superadmin' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    return successResponse(res, 200, 'Login successful', { token });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};
