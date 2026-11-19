const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/energy_provider/auth');
const {
  listOpenDeliveryJobs,
  acceptDelivery,
  confirmArrival,
  completeDelivery,
} = require('../../controllers/energy_provider/jobController');

router.use(authenticate);

router.get('/open', listOpenDeliveryJobs);
router.post('/:id/accept', acceptDelivery);
router.post('/:id/arrival', confirmArrival);
router.post('/:id/complete', completeDelivery);

module.exports = router;
