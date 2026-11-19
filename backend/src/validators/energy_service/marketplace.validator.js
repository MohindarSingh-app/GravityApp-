const { z } = require('zod');
const { requestSchema, uuidParam } = require('./common');

const searchQuery = requestSchema(
  z.object({}).strict(),
  undefined,
  z.object({
    q: z.string().trim().max(120).optional(),
    categoryId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(50),
  }).strict(),
);

const addCartItem = requestSchema(z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
}).strict());

const updateCartItem = requestSchema(z.object({
  quantity: z.number().int().min(0).max(99),
}).strict(), uuidParam('productId'));

const checkout = requestSchema(z.object({
  siteId: z.string().uuid(),
  paymentMode: z.enum(['sandbox', 'provider']).default('sandbox'),
}).strict());

const orderListQuery = requestSchema(
  z.object({}).strict(),
  undefined,
  z.object({}).strict(),
);

const orderId = requestSchema(undefined, uuidParam('id'));

const updateOrderStatus = requestSchema(
  z.object({
    status: z.enum(['processing', 'dispatched', 'delivered', 'cancelled']),
    note: z.string().trim().max(500).optional(),
  }).strict(),
  uuidParam('id'),
);

module.exports = {
  searchQuery,
  addCartItem,
  updateCartItem,
  checkout,
  orderListQuery,
  orderId,
  updateOrderStatus,
};
