/**
 * Smoke test - part 3: supplier catalogue, inventory and the decline flow.
 */

const { check, expectError, makeUser, makeJob } = require('./smoke.harness');

const JobModel = require('../../models/energy_provider/JobModel');
const JobService = require('../../services/energy_provider/jobService');
const SupplierService = require('../../services/energy_provider/supplierService');

module.exports = async function supplierCases({ partnerA, partnerB }) {
  console.log('\nSupplier catalogue and inventory');
  const supplier = await makeUser({ mobile: '9000000006', role: 'supplier' });

  const product = await SupplierService.createProduct(supplier, {
    name: 'MCCB 250A',
    category: 'Switchgear',
    price: 4500,
    stock: 10,
    sku: 'MCCB-250',
  });
  check('supplier can create a product', product.name === 'MCCB 250A');

  const lightingProduct = await SupplierService.createProduct(supplier, {
    name: 'Industrial LED',
    category: 'Lighting',
    price: 1200,
    stock: 4,
  });
  check('reference lighting category is supported by the catalogue API', lightingProduct.category === 'Lighting');

  const otherSupplier = await makeUser({ mobile: '9000000010', role: 'supplier' });
  await SupplierService.createProduct(otherSupplier, {
    name: 'Other supplier product',
    category: 'Switchgear',
    price: 500,
    stock: 1,
  });
  const managedProducts = await SupplierService.listMyProducts(supplier);
  check(
    'supplier management catalogue contains only the authenticated supplier products',
    managedProducts.length === 2 && managedProducts.every((item) => item.supplierId === supplier.id)
  );

  await expectError(
    'a non-supplier cannot create a product',
    () => SupplierService.createProduct(partnerA, { name: 'Hack' }),
    403
  );

  const reserved = await SupplierService.reserveStock(supplier, product.id, 3);
  check('stock is decremented', reserved.stock === 7);
  await expectError(
    'stock cannot go negative',
    () => SupplierService.reserveStock(supplier, product.id, 100),
    409
  );

  await SupplierService.addInventoryItem(supplier, {
    name: 'Fuse 10A',
    category: 'Switchgear',
    quantity: 2,
    reorderLevel: 5,
    unitCost: 25,
  });
  const inventory = await SupplierService.listInventory(supplier);
  check('inventory item is listed', inventory.length === 1);
  check('low stock is flagged', inventory[0].lowStock === true);

  console.log('\nDecline flow');
  const declineJob = await makeJob({
    referenceId: 'EC-IND-0005',
    targetRole: 'service_partner',
  });
  const declined = await JobService.declineJob(partnerB, declineJob.id, { reason: 'Too far' });
  check('job can be declined', declined.response === 'declined');
  const declinedRow = await JobModel.findById(declineJob.id);
  check('a declined job stays open', declinedRow.status === 'open');
  const refreshedJobs = await JobService.listOpenJobs(partnerB);
  check('a declined job is hidden from the declining partner after refresh', !refreshedJobs.some((job) => job.id === declineJob.id));
};
