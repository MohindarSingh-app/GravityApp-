const { Router } = require('express');
const authRoutes = require('./auth.routes');
const adminRoutes = require('./admin.routes');
const companyRoutes = require('./company.routes');
const siteRoutes = require('./site.routes');
const profileRoutes = require('./profile.routes');
const apiKeyRoutes = require('./apiKey.routes');
const userRoutes = require('./user.routes');
const roleRoutes = require('./role.routes');
const dashboardRoutes = require('./dashboard.routes');
const fieldRoutes = require('./field.routes');
const customerRoutes = require('./customer.routes');
const notificationRoutes = require('./notification.routes');
const supportRoutes = require('./support.routes');
const marketplaceRoutes = require('./marketplace.routes');
const catalogRoutes = require('./catalog.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/companies', companyRoutes);
router.use('/sites', siteRoutes);
router.use('/profile', profileRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/api-keys', apiKeyRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/field', fieldRoutes);
router.use('/customer', customerRoutes);
router.use('/notifications', notificationRoutes);
router.use('/support', supportRoutes);
router.use('/marketplace', marketplaceRoutes);
router.use('/catalog', catalogRoutes);

module.exports = router;
