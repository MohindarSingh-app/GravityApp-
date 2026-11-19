const { Router } = require('express');
const companyController = require('../../controllers/energy_service/company.controller');
const siteController = require('../../controllers/energy_service/site.controller');
const { asyncHandler } = require('../../utils/energy_service/asyncHandler');
const { validate } = require('../../middleware/energy_service/validate.middleware');
const { requireAuth } = require('../../middleware/energy_service/auth.middleware');
const { requireAccess } = require('../../middleware/energy_service/role.middleware');
const {
  createCompanySchema,
  updateCompanySchema,
  companyStatusSchema,
  companyIdSchema,
} = require('../../validators/energy_service/company.validator');
const {
  createSiteSchema,
  listSitesSchema,
} = require('../../validators/energy_service/site.validator');

const router = Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.post(
  '/',
  requireAuth,
  requireAccess('companies.create'),
  validate(createCompanySchema),
  asyncHandler(companyController.create),
);
router.get(
  '/mine',
  requireAuth,
  requireAccess('companies.read'),
  asyncHandler(companyController.listMine),
);
router.post(
  '/:id/select',
  requireAuth,
  requireAccess('companies.read'),
  validate(companyIdSchema),
  asyncHandler(companyController.select),
);
router.get(
  '/:id',
  requireAuth,
  requireAccess('companies.read'),
  validate(companyIdSchema),
  asyncHandler(companyController.get),
);
router.patch(
  '/:id/status',
  requireAuth,
  requireAccess('companies.status'),
  validate(companyStatusSchema),
  asyncHandler(companyController.setStatus),
);
router.get(
  '/:id/users',
  requireAuth,
  requireAccess('users.read'),
  validate(companyIdSchema),
  asyncHandler(companyController.listUsers),
);
router.patch(
  '/:id',
  requireAuth,
  requireAccess('companies.update'),
  validate(updateCompanySchema),
  asyncHandler(companyController.update),
);

router.post(
  '/:companyId/sites',
  requireAuth,
  requireAccess('sites.create'),
  validate(createSiteSchema),
  asyncHandler(siteController.create),
);
router.get(
  '/:companyId/sites',
  requireAuth,
  requireAccess('sites.read'),
  validate(listSitesSchema),
  asyncHandler(siteController.list),
);

module.exports = router;
