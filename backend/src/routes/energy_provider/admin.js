const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/energy_provider/auth');
const {
  requireAdmin,
  listSchedule,
  setJobSchedule,
  listApplications,
  listSpecializationReviews,
  reviewSpecializations,
} = require('../../controllers/energy_provider/adminController');

router.use(authenticate, requireAdmin);

router.get('/schedule', listSchedule);
router.put('/schedule/:id', setJobSchedule);
router.get('/applications', listApplications);
router.get('/expertise-reviews', listSpecializationReviews);
router.put('/applications/:id/expertise-review', reviewSpecializations);

module.exports = router;
