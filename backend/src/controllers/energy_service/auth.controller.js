const authService = require('../../services/energy_service/auth.service');
const { sendSuccess } = require('../../utils/energy_service/response');

async function register(req, res) {
  const result = await authService.register(req.body, req);
  sendSuccess(res, result, 201);
}

async function login(req, res) {
  const result = await authService.login(req.body, req);
  sendSuccess(res, result);
}

async function sendOtp(req, res) {
  const result = await authService.sendOtp(req.body, req);
  sendSuccess(res, result, 200, 'If the number can receive messages, a verification code has been sent.');
}

async function verifyOtp(req, res) {
  const result = await authService.verifyOtp(req.body, req);
  sendSuccess(res, result);
}

async function refresh(req, res) {
  const result = await authService.refresh(req.body.refreshToken, req);
  sendSuccess(res, result);
}

async function logout(req, res) {
  await authService.logout(req.body.refreshToken, req);
  sendSuccess(res, { message: 'Signed out.' });
}

async function logoutAll(req, res) {
  await authService.logoutAll(req.auth.userId, req);
  sendSuccess(res, { message: 'Signed out of all devices.' });
}

async function listSessions(req, res) {
  const result = await authService.listSessions(req.auth.userId, req.auth.sessionId);
  sendSuccess(res, result);
}

async function revokeSession(req, res) {
  const result = await authService.revokeSession(
    req.auth.userId,
    req.params.id,
    req.auth.sessionId,
    req,
  );
  sendSuccess(res, result);
}

async function forgotPassword(req, res) {
  const message = await authService.forgotPassword(req.body, req);
  sendSuccess(res, { message });
}

async function resetPassword(req, res) {
  await authService.resetPassword(req.body, req);
  sendSuccess(res, { message: 'Your password has been reset. Sign in with the new password.' });
}

async function changePassword(req, res) {
  await authService.changePassword({
    userId: req.auth.userId,
    sessionId: req.auth.sessionId,
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword,
    req,
  });
  sendSuccess(res, { message: 'Password updated. Other devices have been signed out.' });
}

async function setPassword(req, res) {
  const result = await authService.setPassword({
    userId: req.auth.userId,
    password: req.body.password,
    req,
  });
  sendSuccess(res, result);
}

async function me(req, res) {
  const result = await authService.getMe(req.auth.userId);
  sendSuccess(res, result);
}

async function updateProfile(req, res) {
  const user = await authService.updateProfile({
    userId: req.auth.userId,
    fullName: req.body.fullName,
  });
  sendSuccess(res, { user });
}

async function verifyEmail(req, res) {
  const user = await authService.verifyEmail({
    token: req.body.token,
    currentUserId: req.auth ? req.auth.userId : null,
  });
  sendSuccess(res, { user });
}

async function resendVerification(req, res) {
  const result = await authService.resendVerification(req.auth.userId);
  sendSuccess(res, {
    alreadyVerified: result.alreadyVerified,
    message: result.alreadyVerified
      ? 'This email is already verified.'
      : 'If the account still needs verification, a new code has been sent.',
  });
}

module.exports = {
  register,
  login,
  sendOtp,
  verifyOtp,
  refresh,
  logout,
  logoutAll,
  listSessions,
  revokeSession,
  forgotPassword,
  resetPassword,
  changePassword,
  setPassword,
  me,
  updateProfile,
  verifyEmail,
  resendVerification,
};
