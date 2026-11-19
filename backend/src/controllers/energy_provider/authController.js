/**
 * Authentication controller.
 *
 * Thin HTTP wrapper around `authService`: it validates the request shape and
 * hands the work to the service, which owns the OTP rules and token issuing.
 */

const AuthService = require('../../services/energy_provider/authService');
const { signAccessToken, signRefreshToken, verifyToken } = require('../../utils/energy_provider/jwt');
const config = require('../../config/energy_provider/env');
const { asyncHandler, ok, ApiError } = require('../../utils/energy_provider/apiError');

/** POST /api/v1/auth/otp/request - request an OTP for login/registration. */
const requestOtp = asyncHandler(async (req, res) => {
  const { mobile, purpose = 'login', email } = req.body || {};
  if (!mobile) {
    throw ApiError.badRequest('Mobile number is required');
  }
  return ok(res, `OTP sent to ${mobile}`, await AuthService.requestOtp({ mobile, purpose, email }));
});

/** POST /api/v1/auth/otp/verify - verify the OTP and issue the tokens. */
const verifyOtp = asyncHandler(async (req, res) => {
  const { mobile, otp, purpose = 'login' } = req.body || {};
  if (!mobile || !otp) {
    throw ApiError.badRequest('Mobile and OTP are required');
  }
  const result = await AuthService.verifyOtp({ mobile, otp, purpose });
  return ok(
    res,
    result.requiresRegistration ? 'OTP verified. Please complete registration.' : result.requiresRoleSelection ? 'OTP verified. Select an approved partner role.' : 'Login successful',
    result
  );
});

const selectRole = asyncHandler(async (req, res) => {
  const { roleSelectionToken, role } = req.body || {};
  if (!roleSelectionToken || !role) throw ApiError.badRequest('Role selection token and role are required');
  let decoded;
  try {
    decoded = verifyToken(roleSelectionToken, config.JWT_SECRET);
  } catch (_error) {
    throw ApiError.unauthorized('Role selection expired. Request a new OTP.');
  }
  if (decoded.purpose !== 'role-selection') throw ApiError.forbidden('A role-selection token is required');
  const user = await AuthService.getApprovedRoleAccount(decoded.mobile, role, decoded.userId);
  const token = signAccessToken({ userId: user.id, mobile: user.mobile, role: user.role }, config.JWT_SECRET, config.JWT_EXPIRES_IN);
  const refresh = signRefreshToken({ userId: user.id, mobile: user.mobile }, config.JWT_SECRET, config.REFRESH_TOKEN_EXPIRES_IN);
  return ok(res, 'Partner role selected', { token, refreshToken: refresh, user: { id: user.id, mobile: user.mobile, email: user.email, role: user.role, status: user.status } });
});

/** POST /api/v1/auth/refresh - exchange a refresh token for a new access token. */
const refreshToken = asyncHandler(async (req, res) => {
  const token = (req.body || {}).refreshToken;
  if (!token) {
    throw ApiError.badRequest('Refresh token is required');
  }

  let decoded;
  try {
    decoded = verifyToken(token, config.JWT_SECRET);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const accessToken = signAccessToken(
    { userId: decoded.userId, mobile: decoded.mobile },
    config.JWT_SECRET,
    config.JWT_EXPIRES_IN
  );
  return ok(res, 'Token refreshed', { token: accessToken });
});

/** POST /api/v1/auth/logout - the client discards the token. */
const logout = asyncHandler(async (req, res) => ok(res, 'Logged out successfully'));

module.exports = {
  requestOtp,
  verifyOtp,
  selectRole,
  refreshToken,
  logout,
};

