const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/energy_provider/auth');
const {
  listProducts,
  listMyProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  reserveStock,
  listInventory,
  addInventoryItem,
  updateInventoryItem,
  listEarnings,
  earningsSummary,
  getEarning,
  markEarningPaid,
  listNotifications,
  markNotificationRead,
} = require('../../controllers/energy_provider/marketplaceController');

router.use(authenticate);

// Supplier catalogue
router.get('/products', listProducts);
router.get('/products/mine', listMyProducts);
router.get('/products/:id', getProduct);
router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);
router.post('/products/:id/reserve', reserveStock);

// Inventory
router.get('/inventory', listInventory);
router.post('/inventory', addInventoryItem);
router.put('/inventory/:id', updateInventoryItem);

// Earnings
router.get('/earnings/summary', earningsSummary);
router.get('/earnings', listEarnings);
router.get('/earnings/:id', getEarning);
router.post('/earnings/:id/paid', markEarningPaid);

// Notifications
router.get('/notifications', listNotifications);
router.post('/notifications/:id/read', markNotificationRead);

module.exports = router;
