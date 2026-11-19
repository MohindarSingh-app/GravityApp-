const { Router } = require('express');
const siteController = require('../../controllers/energy_service/site.controller');
const { asyncHandler } = require('../../utils/energy_service/asyncHandler');
const { validate } = require('../../middleware/energy_service/validate.middleware');
const { requireAuth } = require('../../middleware/energy_service/auth.middleware');
const { requireAccess } = require('../../middleware/energy_service/role.middleware');
const { siteIdSchema, updateSiteSchema, siteStatusSchema } = require('../../validators/energy_service/site.validator');

const router = Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get(
  '/:id',
  requireAuth,
  requireAccess('sites.read'),
  validate(siteIdSchema),
  asyncHandler(siteController.get),
);
router.patch(
  '/:id/status',
  requireAuth,
  requireAccess('sites.status'),
  validate(siteStatusSchema),
  asyncHandler(siteController.setStatus),
);
router.patch(
  '/:id/primary',
  requireAuth,
  requireAccess('sites.update'),
  validate(siteIdSchema),
  asyncHandler(siteController.setPrimary),
);
router.patch(
  '/:id',
  requireAuth,
  requireAccess('sites.update'),
  validate(updateSiteSchema),
  asyncHandler(siteController.update),
);
router.delete(
  '/:id',
  requireAuth,
  requireAccess('sites.delete'),
  validate(siteIdSchema),
  asyncHandler(siteController.remove),
);

module.exports = router;
