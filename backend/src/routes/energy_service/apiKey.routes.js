const { Router } = require('express');
const apiKeyController = require('../../controllers/energy_service/apiKey.controller');
const { asyncHandler } = require('../../utils/energy_service/asyncHandler');
const { validate } = require('../../middleware/energy_service/validate.middleware');
const { requireAuth, requireSession } = require('../../middleware/energy_service/auth.middleware');
const { requireAccess } = require('../../middleware/energy_service/role.middleware');
const { createApiKeySchema, apiKeyIdSchema } = require('../../validators/energy_service/apiKey.validator');

const router = Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.post(
  '/',
  requireAuth,
  requireSession,
  requireAccess('api_keys.create'),
  validate(createApiKeySchema),
  asyncHandler(apiKeyController.create),
);
router.get(
  '/',
  requireAuth,
  requireAccess('api_keys.read'),
  asyncHandler(apiKeyController.list),
);
router.post(
  '/:id/revoke',
  requireAuth,
  requireSession,
  requireAccess('api_keys.revoke'),
  validate(apiKeyIdSchema),
  asyncHandler(apiKeyController.revoke),
);
router.delete(
  '/:id',
  requireAuth,
  requireSession,
  requireAccess('api_keys.revoke'),
  validate(apiKeyIdSchema),
  asyncHandler(apiKeyController.revoke),
);
router.post(
  '/:id/rotate',
  requireAuth,
  requireSession,
  requireAccess('api_keys.rotate'),
  validate(apiKeyIdSchema),
  asyncHandler(apiKeyController.rotate),
);

module.exports = router;
