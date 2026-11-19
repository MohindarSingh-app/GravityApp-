const { Router } = require('express');
const dashboardController = require('../../controllers/energy_service/dashboard.controller');
const { asyncHandler } = require('../../utils/energy_service/asyncHandler');
const { requireAuth } = require('../../middleware/energy_service/auth.middleware');
const { requireAccess } = require('../../middleware/energy_service/role.middleware');

const router = Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get(
  '/',
  requireAuth,
  requireAccess('dashboard.read'),
  asyncHandler(dashboardController.get),
);

module.exports = router;
