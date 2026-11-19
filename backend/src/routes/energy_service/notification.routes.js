const { Router } = require('express');
const notificationController = require('../../controllers/energy_service/notification.controller');
const { asyncHandler } = require('../../utils/energy_service/asyncHandler');
const { validate } = require('../../middleware/energy_service/validate.middleware');
const { requireAuth } = require('../../middleware/energy_service/auth.middleware');
const { requireAccess } = require('../../middleware/energy_service/role.middleware');
const { notificationIdSchema } = require('../../validators/energy_service/notification.validator');

const router = Router();

router.use(requireAuth);
router.get('/', requireAccess('notifications.read'), asyncHandler(notificationController.list));
router.post(
  '/:id/read',
  requireAccess('notifications.read'),
  validate(notificationIdSchema),
  asyncHandler(notificationController.markRead),
);

module.exports = router;
