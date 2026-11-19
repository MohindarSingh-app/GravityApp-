const { db, nowIso } = require('../../db/energy_provider/index');
const { insertInto, updateTable, parseJson } = require('./helpers');

const TABLE = 'products';

const ProductModel = {
  TABLE,

  findById: async (id, handle = db) =>
    handle.get(`SELECT * FROM \`${TABLE}\` WHERE \`id\` = ?`, [id]),

  findBySupplier: async (supplierId, handle = db) =>
    handle.query(`SELECT * FROM \`${TABLE}\` WHERE \`supplier_id\` = ? ORDER BY \`id\``, [
      supplierId,
    ]),

  findAll: async (handle = db) => handle.query(`SELECT * FROM \`${TABLE}\` ORDER BY \`id\``),

  findBySku: async (supplierId, sku, handle = db) =>
    handle.get(`SELECT * FROM \`${TABLE}\` WHERE \`supplier_id\` = ? AND \`sku\` = ?`, [
      supplierId,
      sku,
    ]),

  create: async (productData, handle = db) => {
    const id = await insertInto(
      TABLE,
      {
        supplier_id: productData.supplierId,
        name: productData.name,
        category: productData.category || '',
        brand: productData.brand || '',
        description: productData.description || '',
        price: productData.price || 0,
        stock: productData.stock || 0,
        sku: productData.sku || '',
        image_ref: productData.imageRef || '',
        status: productData.status || 'active',
        created_at: nowIso(),
        updated_at: nowIso(),
      },
      handle
    );
    return ProductModel.findById(id, handle);
  },

  updateById: async (id, updates, handle = db) => {
    await updateTable(TABLE, id, { ...updates, updated_at: nowIso() }, handle);
    return ProductModel.findById(id, handle);
  },

  /** Decrement stock only while enough stock remains. */
  decrementStock: async (id, quantity, handle = db) => {
    const result = await handle.run(
      `UPDATE \`${TABLE}\` SET \`stock\` = \`stock\` - ?, \`updated_at\` = ?
        WHERE \`id\` = ? AND \`stock\` >= ?`,
      [quantity, nowIso(), id, quantity]
    );
    return result.affectedRows > 0;
  },

  deleteById: async (id, handle = db) => {
    const result = await handle.run(`DELETE FROM \`${TABLE}\` WHERE \`id\` = ?`, [id]);
    return result.affectedRows > 0;
  },

  toApi: (row) => ({
    id: row.id,
    supplierId: row.supplier_id,
    name: row.name,
    category: row.category,
    brand: row.brand,
    description: row.description,
    price: row.price,
    stock: row.stock,
    sku: row.sku,
    imageRef: row.image_ref,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }),
};

module.exports = ProductModel;
