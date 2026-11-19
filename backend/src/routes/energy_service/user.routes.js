const { Router } = require('express');
const userController = require('../../controllers/energy_service/user.controller');
const { asyncHandler } = require('../../utils/energy_service/asyncHandler');
const { validate } = require('../../middleware/energy_service/validate.middleware');
const { requireAuth } = require('../../middleware/energy_service/auth.middleware');
const { requireAccess } = require('../../middleware/energy_service/role.middleware');
const {
  createUserSchema,
  updateUserSchema,
  userIdSchema,
  userStatusSchema,
  userRoleSchema,
} = require('../../validators/energy_service/user.validator');

const router = Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/', requireAuth, requireAccess('users.read'), asyncHandler(userController.list));
router.post(
  '/',
  requireAuth,
  requireAccess('users.manage'),
  validate(createUserSchema),
  asyncHandler(userController.create),
);
router.get(
  '/:id',
  requireAuth,
  requireAccess('users.read'),
  validate(userIdSchema),
  asyncHandler(userController.get),
);
router.patch(
  '/:id/status',
  requireAuth,
  requireAccess('users.manage'),
  validate(userStatusSchema),
  asyncHandler(userController.setStatus),
);
router.patch(
  '/:id/role',
  requireAuth,
  requireAccess('users.manage'),
  validate(userRoleSchema),
  asyncHandler(userController.setRole),
);
router.patch(
  '/:id',
  requireAuth,
  requireAccess('users.manage'),
  validate(updateUserSchema),
  asyncHandler(userController.update),
);

module.exports = router;
