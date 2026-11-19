const { Router } = require('express');
const profileController = require('../../controllers/energy_service/profile.controller');
const { asyncHandler } = require('../../utils/energy_service/asyncHandler');
const { validate } = require('../../middleware/energy_service/validate.middleware');
const { requireAuth } = require('../../middleware/energy_service/auth.middleware');
const { requireAccess } = require('../../middleware/energy_service/role.middleware');
const { createProfileSchema, patchProfileSchema, avatarSchema } = require('../../validators/energy_service/profile.validator');

const router = Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.post(
  '/',
  requireAuth,
  requireAccess('profile.update'),
  validate(createProfileSchema),
  asyncHandler(profileController.create),
);
router.get(
  '/',
  requireAuth,
  requireAccess('profile.read'),
  asyncHandler(profileController.get),
);
router.patch(
  '/',
  requireAuth,
  requireAccess('profile.update'),
  validate(patchProfileSchema),
  asyncHandler(profileController.update),
);
router.post(
  '/avatar',
  requireAuth,
  requireAccess('profile.update'),
  validate(avatarSchema),
  asyncHandler(profileController.avatar),
);

module.exports = router;
