const { Router } = require('express');
const supportController = require('../../controllers/energy_service/support.controller');
const { asyncHandler } = require('../../utils/energy_service/asyncHandler');
const { validate } = require('../../middleware/energy_service/validate.middleware');
const { requireAuth } = require('../../middleware/energy_service/auth.middleware');
const { createSupportRequestSchema, assistSupportSchema } = require('../../validators/energy_service/support.validator');

const router = Router();

router.use(requireAuth);
router.post('/', validate(createSupportRequestSchema), asyncHandler(supportController.create));
router.post('/assist', validate(assistSupportSchema), asyncHandler(supportController.assist));

module.exports = router;
