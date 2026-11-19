const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../../../src/config/energy_service/db');
const customerModel = require('../../../src/models/energy_service/customer/customer.model');
const { fileBuffer } = require('../../../src/services/energy_service/customer/attachment.service');
const { ensureCustomer, pageOf } = require('../../../src/services/energy_service/customer/support');

after(async () => {
  await pool.end();
});

test('normalizes only absent pagination values and rejects invalid bounds', () => {
  assert.deepEqual(pageOf({}), { page: 1, limit: 20, offset: 0 });
  assert.deepEqual(pageOf({ page: 3, limit: 10 }), { page: 3, limit: 10, offset: 20 });
  assert.throws(() => pageOf({ page: Number.NaN, limit: 20 }), {
    code: 'VALIDATION_ERROR',
    statusCode: 422,
  });
});

test('validates supported document signatures and file extensions', () => {
  const pdf = Buffer.alloc(64, 0x20);
  Buffer.from('%PDF-').copy(pdf);
  assert.equal(fileBuffer({
    fileName: 'layout.pdf',
    mimeType: 'application/pdf',
    contentBase64: pdf.toString('base64'),
    byteSize: pdf.length,
  }).extension, 'pdf');

  const dwg = Buffer.alloc(64, 0x20);
  Buffer.from('AC1027').copy(dwg);
  assert.equal(fileBuffer({
    fileName: 'panel.dwg',
    mimeType: 'application/acad',
    contentBase64: dwg.toString('base64'),
  }).extension, 'dwg');

  const docx = Buffer.alloc(64, 0x20);
  Buffer.from([0x50, 0x4b, 0x03, 0x04]).copy(docx);
  assert.equal(fileBuffer({
    fileName: 'spec.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    contentBase64: docx.toString('base64'),
  }).extension, 'docx');

  assert.throws(() => fileBuffer({
    fileName: 'layout.pdf',
    mimeType: 'application/pdf',
    contentBase64: Buffer.alloc(64, 0x20).toString('base64'),
  }), { code: 'FILE_TYPE_MISMATCH', statusCode: 422 });
});

test('keeps a separate customer record for each company workspace', async () => {
  const findOriginal = customerModel.findByUserAndCompany;
  const insertOriginal = customerModel.insert;
  const userId = 'user-1';
  const customers = new Map([
    ['company-a', { id: 'customer-a', user_id: userId, company_id: 'company-a' }],
  ]);

  customerModel.findByUserAndCompany = async (requestedUserId, companyId) => {
    assert.equal(requestedUserId, userId);
    return customers.get(companyId) || null;
  };
  customerModel.insert = async ({ userId: requestedUserId, companyId }) => {
    const customer = {
      id: `customer-${companyId}`,
      user_id: requestedUserId,
      company_id: companyId,
    };
    customers.set(companyId, customer);
    return customer;
  };

  try {
    const firstCompany = await ensureCustomer({ id: userId, company_id: 'company-a' });
    const secondCompany = await ensureCustomer({ id: userId, company_id: 'company-b' });

    assert.equal(firstCompany.id, 'customer-a');
    assert.equal(firstCompany.company_id, 'company-a');
    assert.equal(secondCompany.id, 'customer-company-b');
    assert.equal(secondCompany.company_id, 'company-b');
  } finally {
    customerModel.findByUserAndCompany = findOriginal;
    customerModel.insert = insertOriginal;
  }
});
