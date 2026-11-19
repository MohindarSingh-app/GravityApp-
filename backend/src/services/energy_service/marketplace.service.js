const AppError = require('../../utils/energy_service/AppError');
const marketplaceModel = require('../../models/energy_service/marketplace.model');
const { can, canAccessCompany } = require('./rbac.service');
const { withTransaction } = require('../../utils/energy_service/transaction');

const DELIVERY_FEE_PAISE = 0;
const transitions = {
  confirmed: ['processing', 'cancelled'],
  processing: ['dispatched', 'cancelled'],
  dispatched: ['delivered'],
};

function requireCompany(user, action) {
  if (!user.company_id || !canAccessCompany(user, user.company_id)) {
    throw new AppError('Select an active company before using marketplace.', 403, 'COMPANY_REQUIRED');
  }
  if (!can(user.role, action)) {
    throw new AppError('You do not have access to this area.', 403, 'FORBIDDEN');
  }
}

function amountToMinor(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new AppError('Marketplace contains an invalid price.', 500, 'INVALID_PRODUCT_PRICE');
  }
  return Math.round(number * 100);
}

function majorAmount(value) {
  return (value / 100).toFixed(2);
}

function presentProduct(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    category: row.category,
    supplierId: row.supplier_id,
    supplier: row.supplier,
    sku: row.sku,
    name: row.name,
    brand: row.brand,
    summary: row.summary,
    description: row.description,
    unit: row.unit,
    price: Number(row.price),
    currency: row.currency,
    stockQuantity: row.stock_quantity,
    imageUrl: row.image_url,
  };
}

function presentCart(items) {
  const currencyConflict = new Set(items.map((item) => item.currency)).size > 1;
  const currency = currencyConflict ? null : items[0] ? items[0].currency : 'INR';
  const totalMinor = items.reduce(
    (sum, item) => sum + amountToMinor(item.price) * item.quantity,
    0,
  );
  return {
    items: items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      sku: item.sku,
      name: item.name,
      summary: item.summary,
      unit: item.unit,
      price: Number(item.price),
      currency: item.currency,
      quantity: item.quantity,
      stockQuantity: item.stock_quantity,
      imageUrl: item.image_url,
      lineTotal: Number(item.line_total),
    })),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: currencyConflict ? null : Number(majorAmount(totalMinor)),
    currency,
    currencyConflict,
  };
}

async function listCatalog(user, query) {
  requireCompany(user, 'marketplace.read');
  const [categories, rows] = await Promise.all([
    marketplaceModel.listCategories(),
    marketplaceModel.listProducts({
      query: query.q,
      categoryId: query.categoryId,
      limit: query.limit,
      offset: 0,
    }),
  ]);
  return {
    categories,
    products: rows.map(presentProduct),
  };
}

async function getCart(user) {
  requireCompany(user, 'marketplace.read');
  const cart = await marketplaceModel.getOrCreateCart(user.id, user.company_id);
  return presentCart(await marketplaceModel.listCartItems(cart.id));
}

async function addToCart(user, input) {
  requireCompany(user, 'marketplace.write');
  return withTransaction(async (client) => {
    const cart = await marketplaceModel.getOrCreateCart(user.id, user.company_id, client);
    const product = await marketplaceModel.getCartProduct(input.productId, client);
    if (!product || !product.active) {
      throw new AppError('Product is unavailable.', 409, 'PRODUCT_UNAVAILABLE');
    }

    const items = await marketplaceModel.listCartItems(cart.id, client);
    if (items.some((item) => item.currency !== product.currency)) {
      throw new AppError('All items in a cart must use the same currency.', 409, 'MIXED_CURRENCY');
    }

    const existingItem = items.find((item) => item.product_id === input.productId);
    const nextQuantity = (existingItem ? Number(existingItem.quantity) : 0) + input.quantity;
    if (nextQuantity > 99) {
      throw new AppError('A cart item cannot exceed 99 units.', 409, 'CART_QUANTITY_LIMIT');
    }
    if (nextQuantity > Number(product.stock_quantity)) {
      throw new AppError('There is not enough stock for this quantity.', 409, 'INSUFFICIENT_STOCK');
    }

    const added = await marketplaceModel.addCartItem(
      cart.id,
      input.productId,
      input.quantity,
      client,
    );
    if (!added) {
      throw new AppError('Product availability or stock changed. Refresh the cart and try again.', 409, 'INSUFFICIENT_STOCK');
    }
    return presentCart(await marketplaceModel.listCartItems(cart.id, client));
  });
}

async function setCartItemQuantity(user, productId, quantity) {
  requireCompany(user, 'marketplace.write');
  return withTransaction(async (client) => {
    const cart = await marketplaceModel.getOrCreateCart(user.id, user.company_id, client);
    if (quantity > 0) {
      const product = await marketplaceModel.getCartProduct(productId, client);
      if (!product || !product.active) {
        throw new AppError('Product is unavailable.', 409, 'PRODUCT_UNAVAILABLE');
      }
      const items = await marketplaceModel.listCartItems(cart.id, client);
      if (items.some((item) => item.currency !== product.currency)) {
        throw new AppError('All items in a cart must use the same currency.', 409, 'MIXED_CURRENCY');
      }
    }

    const updated = await marketplaceModel.setCartQuantity(cart.id, productId, quantity, client);
    if (!updated && quantity > 0) {
      throw new AppError('Product is unavailable or there is not enough stock.', 409, 'INSUFFICIENT_STOCK');
    }
    return presentCart(await marketplaceModel.listCartItems(cart.id, client));
  });
}

async function checkout(user, input) {
  requireCompany(user, 'marketplace.write');
  if (input.paymentMode === 'provider') {
    throw new AppError(
      'A real payment provider is not configured. Use the clearly labelled sandbox checkout for testing.',
      501,
      'PAYMENT_PROVIDER_NOT_CONFIGURED',
    );
  }
  const client = await marketplaceModel.db().connect();
  try {
    await client.query('BEGIN');
    const site = await marketplaceModel.findSite(input.siteId, user.company_id, client);
    if (!site) {
      throw new AppError('Choose an active site that belongs to the selected company.', 400, 'INVALID_SITE');
    }
    const cart = await marketplaceModel.getOrCreateCart(user.id, user.company_id, client);
    const rows = await marketplaceModel.lockCartItems(cart.id, client);
    if (!rows.length) {
      throw new AppError('Add at least one available product before checkout.', 400, 'EMPTY_CART');
    }
    if (rows.some((item) => item.quantity > item.stock_quantity)) {
      throw new AppError('One or more products no longer have enough stock.', 409, 'INSUFFICIENT_STOCK');
    }
    const currencies = new Set(rows.map((item) => item.currency));
    if (currencies.size !== 1) {
      throw new AppError('Cart products must use the same currency.', 409, 'MIXED_CURRENCY');
    }
    const items = rows.map((item) => {
      const priceMinor = amountToMinor(item.price);
      const lineTotal = priceMinor * item.quantity;
      return {
        productId: item.product_id,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        price: majorAmount(priceMinor),
        lineTotal: majorAmount(lineTotal),
      };
    });
    const subtotalMinor = items.reduce(
      (sum, item) => sum + amountToMinor(item.lineTotal),
      0,
    );
    const deliveryFeeMinor = DELIVERY_FEE_PAISE;
    const order = await marketplaceModel.createOrder({
      userId: user.id,
      companyId: user.company_id,
      siteId: site.id,
      currency: rows[0].currency,
      subtotal: majorAmount(subtotalMinor),
      deliveryFee: majorAmount(deliveryFeeMinor),
      total: majorAmount(subtotalMinor + deliveryFeeMinor),
      shippingAddress: {
        siteName: site.site_name,
        address: site.address,
        city: site.city,
        state: site.state,
        postalCode: site.pincode,
      },
    }, client);
    await marketplaceModel.insertOrderItems(order.id, items, client);
    const stockUpdated = await marketplaceModel.decrementStock(items, client);
    if (!stockUpdated) {
      throw new AppError('Stock changed while checkout was in progress.', 409, 'INSUFFICIENT_STOCK');
    }
    const settled = await marketplaceModel.settleSandbox(order.id, order.total, client);
    await marketplaceModel.clearCart(cart.id, client);
    await client.query('COMMIT');
    return {
      order: {
        id: settled.order.id,
        orderNumber: String(settled.order.order_number),
        status: settled.order.status,
        total: Number(settled.order.total),
        currency: settled.order.currency,
        paymentMode: settled.order.payment_mode,
        createdAt: settled.order.created_at,
      },
      payment: {
        provider: settled.payment.provider,
        reference: settled.payment.provider_reference,
        status: settled.payment.status,
        charged: false,
      },
      sandbox: true,
      message: 'Sandbox order saved. No real payment was collected.',
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Marketplace checkout rollback failed:', rollbackError.code || rollbackError.name);
    }
    throw error;
  } finally {
    client.release();
  }
}

function presentOrder(row) {
  return {
    id: row.id,
    orderNumber: String(row.order_number),
    status: row.status,
    currency: row.currency,
    subtotal: Number(row.subtotal),
    deliveryFee: Number(row.delivery_fee),
    total: Number(row.total),
    paymentMode: row.payment_mode,
    siteName: row.site_name,
    createdAt: row.created_at,
  };
}

async function listOrders(user) {
  requireCompany(user, 'marketplace.read');
  return { orders: (await marketplaceModel.listOrders(user.id, user.company_id)).map(presentOrder) };
}

async function getOrder(user, id) {
  requireCompany(user, 'marketplace.read');
  const order = await marketplaceModel.getOrder(id, user.id, user.company_id);
  if (!order) throw new AppError('Order was not found.', 404, 'ORDER_NOT_FOUND');
  return {
    ...presentOrder(order),
    shippingAddress: order.shipping_address,
    updatedAt: order.updated_at,
    items: order.items.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.product_name,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      lineTotal: Number(item.line_total),
    })),
    history: order.history.map((event) => ({
      id: event.id,
      status: event.status,
      note: event.note,
      createdAt: event.created_at,
    })),
    payment: order.payment && {
      provider: order.payment.provider,
      reference: order.payment.provider_reference,
      status: order.payment.status,
      amount: Number(order.payment.amount),
      currency: order.payment.currency,
      sandbox: Boolean(order.payment.metadata.sandbox),
      charged: false,
    },
  };
}

async function changeOrderStatus(user, id, input) {
  requireCompany(user, 'marketplace.manage');
  const client = await marketplaceModel.db().connect();
  try {
    await client.query('BEGIN');
    const order = await marketplaceModel.lockOrder(id, user.company_id, client);
    if (!order) throw new AppError('Order was not found.', 404, 'ORDER_NOT_FOUND');
    if (!transitions[order.status] || !transitions[order.status].includes(input.status)) {
      throw new AppError(`Order cannot move from ${order.status} to ${input.status}.`, 409, 'INVALID_ORDER_TRANSITION');
    }
    await marketplaceModel.updateOrderStatus(
      id,
      input.status,
      input.note || null,
      user.id,
      client,
    );
    if (input.status === 'cancelled') {
      await marketplaceModel.restoreOrderStock(id, client);
    }
    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Marketplace status rollback failed:', rollbackError.code || rollbackError.name);
    }
    throw error;
  } finally {
    client.release();
  }
  return getOrder(user, id);
}

module.exports = {
  listCatalog,
  getCart,
  addToCart,
  setCartItemQuantity,
  checkout,
  listOrders,
  getOrder,
  changeOrderStatus,
};
