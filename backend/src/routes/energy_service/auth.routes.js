const { Router } = require('express');
const authController = require('../../controllers/energy_service/auth.controller');
const { asyncHandler } = require('../../utils/energy_service/asyncHandler');
const { validate } = require('../../middleware/energy_service/validate.middleware');
const { requireAuth, optionalAuth, requireSession } = require('../../middleware/energy_service/auth.middleware');
const { requireAccess } = require('../../middleware/energy_service/role.middleware');
const { authLimiter, refreshLimiter, otpLimiter } = require('../../middleware/energy_service/rateLimit.middleware');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  profileSchema,
  verifyEmailSchema,
  sendOtpSchema,
  verifyOtpSchema,
  setPasswordSchema,
  sessionIdSchema,
} = require('../../validators/energy_service/auth.validator');

const router = Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.post('/register', authLimiter, validate(registerSchema), asyncHandler(authController.register));
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(authController.login));
router.post('/send-otp', otpLimiter, validate(sendOtpSchema), asyncHandler(authController.sendOtp));
router.post('/verify-otp', otpLimiter, validate(verifyOtpSchema), asyncHandler(authController.verifyOtp));
router.post('/refresh', refreshLimiter, validate(refreshSchema), asyncHandler(authController.refresh));
router.post('/logout', authLimiter, validate(refreshSchema), asyncHandler(authController.logout));
router.post('/logout-all', authLimiter, requireAuth, requireSession, asyncHandler(authController.logoutAll));
router.get('/sessions', requireAuth, requireSession, requireAccess('sessions.read'), asyncHandler(authController.listSessions));
router.post(
  '/sessions/:id/revoke',
  requireAuth,
  requireSession,
  requireAccess('sessions.revoke'),
  validate(sessionIdSchema),
  asyncHandler(authController.revokeSession),
);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), asyncHandler(authController.forgotPassword));
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), asyncHandler(authController.resetPassword));
router.post('/set-password', authLimiter, requireAuth, requireSession, validate(setPasswordSchema), asyncHandler(authController.setPassword));
router.post('/change-password', authLimiter, requireAuth, requireSession, validate(changePasswordSchema), asyncHandler(authController.changePassword));
router.get('/me', requireAuth, asyncHandler(authController.me));
router.patch('/profile', requireAuth, validate(profileSchema), asyncHandler(authController.updateProfile));
router.post('/verify-email', authLimiter, optionalAuth, validate(verifyEmailSchema), asyncHandler(authController.verifyEmail));
router.post('/resend-verification', authLimiter, requireAuth, asyncHandler(authController.resendVerification));

module.exports = router;
