const marketplace = require('../../services/energy_service/marketplace.service');
const { sendSuccess } = require('../../utils/energy_service/response');

async function catalog(req, res) {
  sendSuccess(res, await marketplace.listCatalog(req.user, req.query));
}

async function cart(req, res) {
  sendSuccess(res, await marketplace.getCart(req.user));
}

async function addToCart(req, res) {
  sendSuccess(res, await marketplace.addToCart(req.user, req.body), 201, 'Cart updated.');
}

async function setCartItemQuantity(req, res) {
  sendSuccess(
    res,
    await marketplace.setCartItemQuantity(req.user, req.params.productId, req.body.quantity),
  );
}

async function checkout(req, res) {
  sendSuccess(res, await marketplace.checkout(req.user, req.body), 201, 'Sandbox order created.');
}

async function orders(req, res) {
  sendSuccess(res, await marketplace.listOrders(req.user));
}

async function order(req, res) {
  sendSuccess(res, await marketplace.getOrder(req.user, req.params.id));
}

async function updateOrderStatus(req, res) {
  sendSuccess(
    res,
    await marketplace.changeOrderStatus(req.user, req.params.id, req.body),
    200,
    'Order status updated.',
  );
}

module.exports = {
  catalog,
  cart,
  addToCart,
  setCartItemQuantity,
  checkout,
  orders,
  order,
  updateOrderStatus,
};
