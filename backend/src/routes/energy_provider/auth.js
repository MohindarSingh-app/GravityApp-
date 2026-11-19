const express = require('express');
const router = express.Router();
const { requestOtp, verifyOtp, selectRole, refreshToken, logout } = require('../../controllers/energy_provider/authController');

router.post('/otp/request', requestOtp);
router.post('/otp/verify', verifyOtp);
router.post('/role/select', selectRole);
router.post('/refresh', refreshToken);
router.post('/logout', logout);

module.exports = router;
