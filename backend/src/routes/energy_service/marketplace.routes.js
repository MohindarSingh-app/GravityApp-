const { Router } = require('express');
const marketplace = require('../../controllers/energy_service/marketplace.controller');
const schemas = require('../../validators/energy_service/marketplace.validator');
const { asyncHandler } = require('../../utils/energy_service/asyncHandler');
const { validate } = require('../../middleware/energy_service/validate.middleware');
const { requireAuth } = require('../../middleware/energy_service/auth.middleware');
const { requireAccess } = require('../../middleware/energy_service/role.middleware');

const router = Router();
router.use(requireAuth);
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/products', requireAccess('marketplace.read'), validate(schemas.searchQuery), asyncHandler(marketplace.catalog));
router.get('/cart', requireAccess('marketplace.read'), asyncHandler(marketplace.cart));
router.post('/cart/items', requireAccess('marketplace.write'), validate(schemas.addCartItem), asyncHandler(marketplace.addToCart));
router.put('/cart/items/:productId', requireAccess('marketplace.write'), validate(schemas.updateCartItem), asyncHandler(marketplace.setCartItemQuantity));
router.post('/checkout', requireAccess('marketplace.write'), validate(schemas.checkout), asyncHandler(marketplace.checkout));
router.get('/orders', requireAccess('marketplace.read'), validate(schemas.orderListQuery), asyncHandler(marketplace.orders));
router.get('/orders/:id', requireAccess('marketplace.read'), validate(schemas.orderId), asyncHandler(marketplace.order));
router.post('/orders/:id/status', requireAccess('marketplace.manage'), validate(schemas.updateOrderStatus), asyncHandler(marketplace.updateOrderStatus));

module.exports = router;
