/**
 * Supplier service - product catalogue and stock management.
 *
 * Stock is decremented with a conditional UPDATE (`stock >= ?`) so two
 * concurrent orders can never drive the stock negative.
 */

const ProductModel = require('../../models/energy_provider/ProductModel');
const { InventoryModel, AuditLogModel } = require('../../models/energy_provider/MarketplaceModels');
const { ApiError } = require('../../utils/energy_provider/apiError');
const { PRODUCT_CATEGORIES, PRODUCT_STATUSES } = require('../../utils/energy_provider/constants');

const SupplierService = {
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,

  /** Catalogue listing with optional category / status filters. */
  async listProducts({ category, status } = {}) {
    const all = await ProductModel.findAll();
    let products = all;
    if (category) {
      products = products.filter((product) => product.category === category);
    }
    if (status) {
      products = products.filter((product) => product.status === status);
    }
    return products.map((product) => ProductModel.toApi(product));
  },

  /** Management catalogue scoped to the authenticated supplier. */
  async listMyProducts(user, { category, status } = {}) {
    if (user.role !== 'supplier') {
      throw ApiError.forbidden('Only suppliers can manage the catalogue');
    }
    let products = await ProductModel.findBySupplier(user.id);
    if (category) products = products.filter((product) => product.category === category);
    if (status) products = products.filter((product) => product.status === status);
    return products.map((product) => ProductModel.toApi(product));
  },

  /** One product by id. */
  async getProduct(productId) {
    const product = await ProductModel.findById(productId);
    if (!product) throw ApiError.notFound('Product not found');
    return ProductModel.toApi(product);
  },

  /** Create a product - only a supplier may do this. */
  async createProduct(user, productData) {
    if (user.role !== 'supplier') {
      throw ApiError.forbidden('Only suppliers can manage the catalogue');
    }
    if (!productData.name) {
      throw ApiError.badRequest('Product name is required');
    }
    if (productData.category && !PRODUCT_CATEGORIES.includes(productData.category)) {
      throw ApiError.badRequest('Unknown product category');
    }
    if (productData.status && !PRODUCT_STATUSES.includes(productData.status)) {
      throw ApiError.badRequest('Unknown product status');
    }

    const product = await ProductModel.create({
      supplierId: user.id,
      name: productData.name,
      category: productData.category || '',
      brand: productData.brand || '',
      description: productData.description || '',
      price: Number(productData.price) || 0,
      stock: parseInt(productData.stock, 10) || 0,
      sku: productData.sku || '',
      imageRef: productData.imageRef || '',
      status: productData.status || 'active',
    });

    await AuditLogModel.create({
      actorId: user.id,
      entity: 'product',
      entityId: product.id,
      action: 'created',
      afterState: { name: product.name, price: product.price },
    });

    return ProductModel.toApi(product);
  },

  /** Update a product owned by this supplier. */
  async updateProduct(user, productId, updates) {
    const product = await ProductModel.findById(productId);
    if (!product) throw ApiError.notFound('Product not found');
    if (user.role !== 'supplier' || String(product.supplier_id) !== String(user.id)) {
      throw ApiError.forbidden('You can only edit your own products');
    }
    if (updates.status && !PRODUCT_STATUSES.includes(updates.status)) {
      throw ApiError.badRequest('Unknown product status');
    }

    const payload = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.brand !== undefined) payload.brand = updates.brand;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.price !== undefined) payload.price = Number(updates.price) || 0;
    if (updates.stock !== undefined) payload.stock = parseInt(updates.stock, 10) || 0;
    if (updates.sku !== undefined) payload.sku = updates.sku;
    if (updates.status !== undefined) payload.status = updates.status;

    const updated = await ProductModel.updateById(productId, payload);
    return ProductModel.toApi(updated);
  },

  /** Remove a product from the catalogue. */
  async deleteProduct(user, productId) {
    const product = await ProductModel.findById(productId);
    if (!product) throw ApiError.notFound('Product not found');
    if (user.role !== 'supplier' || String(product.supplier_id) !== String(user.id)) {
      throw ApiError.forbidden('You can only delete your own products');
    }
    await ProductModel.deleteById(productId);
    return { id: productId, deleted: true };
  },

  /**
   * Reserve stock for a product.  The conditional UPDATE guarantees the
   * stock never goes below zero.
   */
  async reserveStock(user, productId, quantity) {
    const amount = parseInt(quantity, 10) || 0;
    if (amount <= 0) throw ApiError.badRequest('Quantity must be greater than zero');

    const reserved = await ProductModel.decrementStock(productId, amount);
    if (!reserved) {
      throw ApiError.conflict('Not enough stock for this product');
    }

    await AuditLogModel.create({
      actorId: user.id,
      entity: 'product',
      entityId: productId,
      action: 'stock_reserved',
      afterState: { quantity: amount },
    });

    return this.getProduct(productId);
  },

  // ---- inventory --------------------------------------------------------

  /** The partner's own stock list. */
  async listInventory(user) {
    const items = await InventoryModel.findByPartner(user.id);
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      category: item.category,
      quantity: item.quantity,
      reorderLevel: item.reorder_level,
      unitCost: item.unit_cost,
      lowStock: item.quantity <= item.reorder_level,
    }));
  },

  /** Add an inventory item. */
  async addInventoryItem(user, { name, sku, category, quantity, reorderLevel, unitCost } = {}) {
    if (!name) throw ApiError.badRequest('Item name is required');
    const item = await InventoryModel.create({
      partnerId: user.id,
      name,
      sku: sku || '',
      category: category || '',
      quantity: parseInt(quantity, 10) || 0,
      reorderLevel: parseInt(reorderLevel, 10) || 0,
      unitCost: Number(unitCost) || 0,
    });
    return {
      id: item.id,
      name: item.name,
      sku: item.sku,
      category: item.category,
      quantity: item.quantity,
      reorderLevel: item.reorder_level,
      unitCost: item.unit_cost,
    };
  },

  /** Update an inventory item owned by this partner. */
  async updateInventoryItem(user, itemId, updates) {
    const item = await InventoryModel.findById(itemId);
    if (!item) throw ApiError.notFound('Inventory item not found');
    if (String(item.partner_id) !== String(user.id)) {
      throw ApiError.forbidden('You can only edit your own inventory');
    }

    const updated = await InventoryModel.updateById(itemId, {
      name: updates.name,
      sku: updates.sku,
      category: updates.category,
      quantity:
        updates.quantity === undefined ? undefined : parseInt(updates.quantity, 10) || 0,
      reorderLevel:
        updates.reorderLevel === undefined
          ? undefined
          : parseInt(updates.reorderLevel, 10) || 0,
      unitCost:
        updates.unitCost === undefined ? undefined : Number(updates.unitCost) || 0,
    });

    return {
      id: updated.id,
      name: updated.name,
      sku: updated.sku,
      category: updated.category,
      quantity: updated.quantity,
      reorderLevel: updated.reorder_level,
      unitCost: updated.unit_cost,
      lowStock: updated.quantity <= updated.reorder_level,
    };
  },
};

module.exports = SupplierService;

