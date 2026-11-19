const { pool } = require('../../config/energy_service/db');

function db(client) {
  return client || pool;
}

async function listCategories(client) {
  const result = await db(client).query(
    `SELECT id, slug, name, description
     FROM product_categories
     WHERE active = TRUE
     ORDER BY sort_order, name`,
  );
  return result.rows;
}

async function listProducts({ query, categoryId, limit = 50, offset = 0 }, client) {
  const values = [];
  const where = ['p.active = TRUE'];
  if (query) {
    values.push(`%${String(query).replace(/[\\%_]/g, '\\$&')}%`);
    where.push(`(p.name ILIKE $${values.length} ESCAPE '\\'
      OR p.sku ILIKE $${values.length} ESCAPE '\\'
      OR COALESCE(p.brand, '') ILIKE $${values.length} ESCAPE '\\')`);
  }
  if (categoryId) {
    values.push(categoryId);
    where.push(`p.category_id = $${values.length}`);
  }
  values.push(limit, offset);
  const result = await db(client).query(
    `SELECT p.id, p.category_id, pc.name AS category, p.supplier_id,
            s.name AS supplier, p.sku, p.name, p.brand, p.summary,
            p.description, p.unit, p.price, p.currency, p.stock_quantity,
            p.image_url
     FROM products p
     LEFT JOIN product_categories pc ON pc.id = p.category_id
     LEFT JOIN suppliers s ON s.id = p.supplier_id
     WHERE ${where.join(' AND ')}
     ORDER BY p.name
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return result.rows;
}

async function getOrCreateCart(userId, companyId, client) {
  const result = await db(client).query(
    `INSERT INTO carts (user_id, company_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, company_id)
     DO UPDATE SET updated_at = NOW()
     RETURNING id, user_id, company_id`,
    [userId, companyId],
  );
  return result.rows[0];
}

async function listCartItems(cartId, client) {
  const result = await db(client).query(
    `SELECT ci.id, ci.product_id, ci.quantity, p.sku, p.name, p.summary,
            p.unit, p.price, p.currency, p.stock_quantity, p.image_url,
            (p.price * ci.quantity)::numeric(12, 2) AS line_total
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.cart_id = $1 AND p.active = TRUE
     ORDER BY ci.created_at`,
    [cartId],
  );
  return result.rows;
}

async function getCartProduct(productId, client) {
  const result = await db(client).query(
    `SELECT id, currency, stock_quantity, active
     FROM products
     WHERE id = $1
     FOR UPDATE`,
    [productId],
  );
  return result.rows[0] || null;
}

async function addCartItem(cartId, productId, quantity, client) {
  const result = await db(client).query(
    `INSERT INTO cart_items (cart_id, product_id, quantity)
     SELECT $1, p.id, $3
     FROM products p
     WHERE p.id = $2 AND p.active = TRUE AND p.stock_quantity >= $3
     ON CONFLICT (cart_id, product_id)
     DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity,
                   updated_at = NOW()
     WHERE cart_items.quantity + EXCLUDED.quantity <= 99
       AND cart_items.quantity + EXCLUDED.quantity <= (
       SELECT stock_quantity FROM products
       WHERE id = EXCLUDED.product_id AND active = TRUE
     )
     RETURNING id`,
    [cartId, productId, quantity],
  );
  return result.rowCount > 0;
}

async function setCartQuantity(cartId, productId, quantity, client) {
  if (quantity === 0) {
    const removed = await db(client).query(
      'DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2',
      [cartId, productId],
    );
    return removed.rowCount > 0;
  }
  const result = await db(client).query(
    `UPDATE cart_items ci
     SET quantity = $3, updated_at = NOW()
     FROM products p
     WHERE ci.cart_id = $1 AND ci.product_id = $2 AND p.id = ci.product_id
       AND p.active = TRUE AND p.stock_quantity >= $3
     RETURNING ci.id`,
    [cartId, productId, quantity],
  );
  return result.rowCount > 0;
}

async function clearCart(cartId, client) {
  await db(client).query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
}

async function findSite(siteId, companyId, client) {
  const result = await db(client).query(
    `SELECT id, site_name, address, city, state, pincode
     FROM sites
     WHERE id = $1 AND company_id = $2 AND status = 'active'`,
    [siteId, companyId],
  );
  return result.rows[0] || null;
}

async function lockCartItems(cartId, client) {
  const result = await db(client).query(
    `SELECT ci.product_id, ci.quantity, p.sku, p.name, p.price,
            p.currency, p.stock_quantity
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id AND p.active = TRUE
     WHERE ci.cart_id = $1
     ORDER BY p.id
     FOR UPDATE OF ci, p`,
    [cartId],
  );
  return result.rows;
}

async function createOrder(record, client) {
  const result = await db(client).query(
    `INSERT INTO orders (
       user_id, company_id, site_id, status, currency, subtotal,
       delivery_fee, total, payment_mode, shipping_address
     )
     VALUES ($1, $2, $3, 'payment_pending', $4, $5, $6, $7, 'sandbox', $8)
     RETURNING id, order_number, user_id, company_id, site_id, status,
               currency, subtotal, delivery_fee, total, payment_mode,
               shipping_address, created_at`,
    [
      record.userId,
      record.companyId,
      record.siteId,
      record.currency,
      record.subtotal,
      record.deliveryFee,
      record.total,
      JSON.stringify(record.shippingAddress),
    ],
  );
  return result.rows[0];
}

async function insertOrderItems(orderId, items, client) {
  for (const item of items) {
    await db(client).query(
      `INSERT INTO order_items
       (order_id, product_id, sku, product_name, quantity, unit_price, line_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [orderId, item.productId, item.sku, item.name, item.quantity, item.price, item.lineTotal],
    );
  }
}

async function decrementStock(items, client) {
  for (const item of items) {
    const result = await db(client).query(
      `UPDATE products
       SET stock_quantity = stock_quantity - $2, updated_at = NOW()
       WHERE id = $1 AND active = TRUE AND stock_quantity >= $2`,
      [item.productId, item.quantity],
    );
    if (result.rowCount !== 1) return false;
  }
  return true;
}

async function settleSandbox(orderId, amount, client) {
  const payment = await db(client).query(
    `INSERT INTO payments (order_id, provider, provider_reference, status, amount, metadata)
     VALUES ($1, 'sandbox', $2, 'succeeded', $3,
             '{"sandbox":true,"charged":false}'::jsonb)
     RETURNING id, provider, provider_reference, status, amount, currency, metadata, created_at`,
    [orderId, `SANDBOX-${String(orderId).replace(/-/g, '').toUpperCase()}`, amount],
  );
  const updated = await db(client).query(
    `UPDATE orders SET status = 'confirmed', updated_at = NOW()
     WHERE id = $1
     RETURNING id, order_number, user_id, company_id, site_id, status,
               currency, subtotal, delivery_fee, total, payment_mode,
               shipping_address, created_at`,
    [orderId],
  );
  await addOrderStatus(orderId, 'payment_pending', 'Sandbox checkout created; no external charge.', null, client);
  await addOrderStatus(orderId, 'confirmed', 'Sandbox payment simulated; order confirmed for testing.', null, client);
  return { order: updated.rows[0], payment: payment.rows[0] };
}

async function addOrderStatus(orderId, status, note, changedBy, client) {
  await db(client).query(
    `INSERT INTO order_status_history (order_id, status, note, changed_by)
     VALUES ($1, $2, $3, $4)`,
    [orderId, status, note, changedBy],
  );
}

async function listOrders(userId, companyId, client) {
  const result = await db(client).query(
    `SELECT o.id, o.order_number, o.status, o.currency, o.subtotal,
            o.delivery_fee, o.total, o.payment_mode, o.created_at,
            s.site_name, count(oi.id)::int AS item_count
     FROM orders o
     JOIN sites s ON s.id = o.site_id
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.user_id = $1 AND o.company_id = $2
     GROUP BY o.id, s.site_name
     ORDER BY o.created_at DESC
     LIMIT 50`,
    [userId, companyId],
  );
  return result.rows;
}

async function getOrder(id, userId, companyId, client) {
  const orderResult = await db(client).query(
    `SELECT o.id, o.order_number, o.user_id, o.company_id, o.site_id,
            o.status, o.currency, o.subtotal, o.delivery_fee, o.total,
            o.payment_mode, o.shipping_address, o.created_at, o.updated_at,
            s.site_name
     FROM orders o
     JOIN sites s ON s.id = o.site_id
     WHERE o.id = $1 AND o.user_id = $2 AND o.company_id = $3`,
    [id, userId, companyId],
  );
  if (!orderResult.rowCount) return null;
  const [items, history, payment] = await Promise.all([
    db(client).query(
      `SELECT id, sku, product_name, quantity, unit_price, line_total
       FROM order_items WHERE order_id = $1 ORDER BY created_at`,
      [id],
    ),
    db(client).query(
      `SELECT id, status, note, created_at
       FROM order_status_history WHERE order_id = $1 ORDER BY created_at, id`,
      [id],
    ),
    db(client).query(
      `SELECT provider, provider_reference, status, amount, currency, metadata, created_at
       FROM payments WHERE order_id = $1`,
      [id],
    ),
  ]);
  return {
    ...orderResult.rows[0],
    items: items.rows,
    history: history.rows,
    payment: payment.rows[0] || null,
  };
}

async function lockOrder(id, companyId, client) {
  const result = await db(client).query(
    `SELECT id, status
     FROM orders
     WHERE id = $1 AND company_id = $2
     FOR UPDATE`,
    [id, companyId],
  );
  return result.rows[0] || null;
}

async function updateOrderStatus(id, status, note, changedBy, client) {
  const updated = await db(client).query(
    `UPDATE orders SET status = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [id, status],
  );
  if (!updated.rowCount) return false;
  await addOrderStatus(id, status, note || null, changedBy, client);
  return true;
}

async function restoreOrderStock(orderId, client) {
  await db(client).query(
    `UPDATE products p
     SET stock_quantity = p.stock_quantity + oi.quantity,
         updated_at = NOW()
     FROM order_items oi
     WHERE oi.order_id = $1 AND oi.product_id = p.id`,
    [orderId],
  );
  await db(client).query(
    `UPDATE payments SET status = 'refunded', updated_at = NOW(),
       metadata = metadata || '{"sandbox":true,"charged":false,"refunded":true}'::jsonb
     WHERE order_id = $1 AND provider = 'sandbox' AND status = 'succeeded'`,
    [orderId],
  );
}

module.exports = {
  db,
  listCategories,
  listProducts,
  getOrCreateCart,
  listCartItems,
  getCartProduct,
  addCartItem,
  setCartQuantity,
  clearCart,
  findSite,
  lockCartItems,
  createOrder,
  insertOrderItems,
  decrementStock,
  settleSandbox,
  listOrders,
  getOrder,
  lockOrder,
  updateOrderStatus,
  restoreOrderStock,
};
