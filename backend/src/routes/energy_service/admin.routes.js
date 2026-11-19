const { Router } = require('express');
const adminController = require('../../controllers/energy_service/admin.controller');
const { requireAuth } = require('../../middleware/energy_service/auth.middleware');
const { requireRole, requireVerifiedEmail } = require('../../middleware/energy_service/role.middleware');
const { ROLES } = require('../../constants/energy_service/roles');

const router = Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get(
  '/overview',
  requireAuth,
  requireRole(ROLES.ADMIN),
  requireVerifiedEmail,
  adminController.overview,
);

module.exports = router;
