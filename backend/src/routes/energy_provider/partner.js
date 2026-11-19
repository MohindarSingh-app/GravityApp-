const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/energy_provider/auth');
const {
  getProfile,
  setOnlineStatus,
  switchRoleAccount,
  updateProfileDetails,
  getDeliveryVerification,
  submitDeliveryVerification,
} = require('../../controllers/energy_provider/partnerController');

router.use(authenticate);

router.get('/profile', getProfile);
router.put('/profile', updateProfileDetails);
router.post('/role/switch', switchRoleAccount);
router.post('/status', setOnlineStatus);
router.get('/delivery-verification', getDeliveryVerification);
router.post('/delivery-verification', submitDeliveryVerification);

module.exports = router;
