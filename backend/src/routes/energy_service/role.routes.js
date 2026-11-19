const { Router } = require('express');
const roleController = require('../../controllers/energy_service/role.controller');
const { asyncHandler } = require('../../utils/energy_service/asyncHandler');
const { validate } = require('../../middleware/energy_service/validate.middleware');
const { requireAuth } = require('../../middleware/energy_service/auth.middleware');
const { requireAccess } = require('../../middleware/energy_service/role.middleware');
const { roleIdSchema, updateRoleSchema } = require('../../validators/energy_service/role.validator');

const router = Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/', requireAuth, requireAccess('roles.read'), asyncHandler(roleController.list));
router.get(
  '/:id',
  requireAuth,
  requireAccess('roles.read'),
  validate(roleIdSchema),
  asyncHandler(roleController.get),
);
router.patch(
  '/:id',
  requireAuth,
  requireAccess('roles.manage'),
  validate(updateRoleSchema),
  asyncHandler(roleController.update),
);

module.exports = router;
