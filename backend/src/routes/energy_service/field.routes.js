const { Router } = require('express');
const fieldController = require('../../controllers/energy_service/field.controller');
const { asyncHandler } = require('../../utils/energy_service/asyncHandler');
const { validate } = require('../../middleware/energy_service/validate.middleware');
const { requireAuth } = require('../../middleware/energy_service/auth.middleware');
const { requireAccess } = require('../../middleware/energy_service/role.middleware');
const {
  createJobSchema,
  jobStatusSchema,
  createSignalSchema,
  createAmcSchema,
  createCertSchema,
} = require('../../validators/energy_service/field.validator');

const router = Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/catalog', requireAuth, requireAccess('jobs.read'), asyncHandler(fieldController.catalog));
router.get('/products', requireAuth, requireAccess('marketplace.read'), asyncHandler(fieldController.products));
router.get('/jobs', requireAuth, requireAccess('jobs.read'), asyncHandler(fieldController.jobs));
router.post('/jobs', requireAuth, requireAccess('jobs.create'), validate(createJobSchema), asyncHandler(fieldController.createJob));
router.patch(
  '/jobs/:id/status',
  requireAuth,
  requireAccess('jobs.update'),
  validate(jobStatusSchema),
  asyncHandler(fieldController.setStatus),
);
router.get('/signals', requireAuth, requireAccess('jobs.read'), asyncHandler(fieldController.signals));
router.post('/signals', requireAuth, requireAccess('dashboard.read'), validate(createSignalSchema), asyncHandler(fieldController.createSignal));
router.get('/amc', requireAuth, requireAccess('amc.read'), asyncHandler(fieldController.amc));
router.post('/amc', requireAuth, requireAccess('amc.quote'), validate(createAmcSchema), asyncHandler(fieldController.createAmc));
router.get('/certs', requireAuth, requireAccess('certs.read'), asyncHandler(fieldController.certs));
router.post('/certs', requireAuth, requireAccess('certs.manage'), validate(createCertSchema), asyncHandler(fieldController.createCert));

module.exports = router;
