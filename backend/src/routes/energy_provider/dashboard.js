const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/energy_provider/auth');
const { getDashboard } = require('../../controllers/energy_provider/dashboardController');

router.use(authenticate);

// The dashboard is scoped to the authenticated partner.  The `:role` variant
// is kept for older clients that pass the role in the path.
router.get('/', getDashboard);
router.get('/:role', getDashboard);

module.exports = router;
