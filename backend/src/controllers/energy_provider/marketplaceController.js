/**
 * Marketplace controller - supplier catalogue, inventory, earnings and
 * notifications.
 */

const SupplierService = require('../../services/energy_provider/supplierService');
const EarningsService = require('../../services/energy_provider/earningsService');
const DashboardService = require('../../services/energy_provider/dashboardService');
const { asyncHandler, ok } = require('../../utils/energy_provider/apiError');

// ---- supplier catalogue -------------------------------------------------

/** GET /api/v1/marketplace/products */
const listProducts = asyncHandler(async (req, res) =>
  ok(res, 'Products fetched', await SupplierService.listProducts(req.query || {}))
);

/** GET /api/v1/marketplace/products/mine */
const listMyProducts = asyncHandler(async (req, res) =>
  ok(res, 'Supplier products fetched', await SupplierService.listMyProducts(req.user, req.query || {}))
);

/** GET /api/v1/marketplace/products/:id */
const getProduct = asyncHandler(async (req, res) =>
  ok(res, 'Product fetched', await SupplierService.getProduct(req.params.id))
);

/** POST /api/v1/marketplace/products */
const createProduct = asyncHandler(async (req, res) =>
  ok(res, 'Product created', await SupplierService.createProduct(req.user, req.body || {}))
);

/** PUT /api/v1/marketplace/products/:id */
const updateProduct = asyncHandler(async (req, res) =>
  ok(res, 'Product updated', await SupplierService.updateProduct(req.user, req.params.id, req.body || {}))
);

/** DELETE /api/v1/marketplace/products/:id */
const deleteProduct = asyncHandler(async (req, res) =>
  ok(res, 'Product deleted', await SupplierService.deleteProduct(req.user, req.params.id))
);

/** POST /api/v1/marketplace/products/:id/reserve */
const reserveStock = asyncHandler(async (req, res) =>
  ok(res, 'Stock reserved', await SupplierService.reserveStock(req.user, req.params.id, (req.body || {}).quantity))
);

// ---- inventory ----------------------------------------------------------

/** GET /api/v1/marketplace/inventory */
const listInventory = asyncHandler(async (req, res) =>
  ok(res, 'Inventory fetched', await SupplierService.listInventory(req.user))
);

/** POST /api/v1/marketplace/inventory */
const addInventoryItem = asyncHandler(async (req, res) =>
  ok(res, 'Inventory item added', await SupplierService.addInventoryItem(req.user, req.body || {}))
);

/** PUT /api/v1/marketplace/inventory/:id */
const updateInventoryItem = asyncHandler(async (req, res) =>
  ok(res, 'Inventory item updated', await SupplierService.updateInventoryItem(req.user, req.params.id, req.body || {}))
);

// ---- earnings -----------------------------------------------------------

/** GET /api/v1/marketplace/earnings */
const listEarnings = asyncHandler(async (req, res) =>
  ok(res, 'Earnings fetched', await EarningsService.listEarnings(req.user, req.query || {}))
);

/** GET /api/v1/marketplace/earnings/summary */
const earningsSummary = asyncHandler(async (req, res) =>
  ok(res, 'Earnings summary fetched', await EarningsService.getSummary(req.user))
);

/** GET /api/v1/marketplace/earnings/:id */
const getEarning = asyncHandler(async (req, res) =>
  ok(res, 'Earning fetched', await EarningsService.getEarning(req.user, req.params.id))
);

/** POST /api/v1/marketplace/earnings/:id/paid */
const markEarningPaid = asyncHandler(async (req, res) =>
  ok(res, 'Earning marked as paid', await EarningsService.markPaid(req.user, req.params.id, req.body || {}))
);

// ---- notifications ------------------------------------------------------

/** GET /api/v1/marketplace/notifications */
const listNotifications = asyncHandler(async (req, res) =>
  ok(res, 'Notifications fetched', await DashboardService.listNotifications(req.user))
);

/** POST /api/v1/marketplace/notifications/:id/read */
const markNotificationRead = asyncHandler(async (req, res) =>
  ok(res, 'Notification marked as read', await DashboardService.markNotificationRead(req.user, req.params.id))
);

module.exports = {
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
};
