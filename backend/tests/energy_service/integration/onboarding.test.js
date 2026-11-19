const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { setSkipRateLimit } = require('../../../src/middleware/energy_service/rateLimit.middleware');
const { createApp } = require('../../../src/apps/energy_service/app');
const { pool } = require('../../../src/config/energy_service/db');
const customerModel = require('../../../src/models/energy_service/customer/customer.model');
const { env } = require('../../../src/config/energy_service/env');
const smsService = require('../../../src/services/energy_service/sms.service');
const emailService = require('../../../src/services/energy_service/email.service');
const { listen, api, uniquePhone, uniqueGstin, uniqueEmail } = require('../helpers');

const password = 'N0t-a-weak-pass!';
let harness;

before(async () => {
  setSkipRateLimit(true);
  harness = await listen(createApp());
});

after(async () => {
  if (harness) await harness.close();
});

test('health probe confirms the database is reachable', async () => {
  const response = await api(harness.base, '/');
  assert.equal(response.status, 200, response.text);
  assert.equal(response.payload.success, true);
  assert.equal(response.payload.message, 'Service Admin Backend and database are running');
});

async function onboardingUser() {
  const phone = uniquePhone();
  const send = await api(harness.base, '/api/auth/send-otp', {
    method: 'POST',
    body: { phone, purpose: 'signup', fullName: 'Test User' },
  });
  assert.equal(send.status, 200, send.text);
  assert.equal(send.payload.success, true);
  assert.equal(send.payload.data.otp, undefined);
  const otp = smsService.peekDevOtp(`+91${phone}`);
  assert.ok(otp && /^\d{6}$/.test(otp));
  const verified = await api(harness.base, '/api/auth/verify-otp', {
    method: 'POST',
    body: { phone, otp, purpose: 'signup', fullName: 'Test User' },
  });
  assert.equal(verified.status, 200, verified.text);
  assert.equal(verified.payload.data.onboardingStatus, 'COMPANY_PENDING');
  return {
    phone: `+91${phone}`,
    token: verified.payload.data.accessToken,
    refreshToken: verified.payload.data.refreshToken,
    user: verified.payload.data.user,
  };
}

test('OTP send never returns the code and verify creates a session', async () => {
  const session = await onboardingUser();
  assert.ok(session.token);
  assert.ok(!String(session.refreshToken).includes('.'));
  const me = await api(harness.base, '/api/auth/me', { token: session.token });
  assert.equal(me.status, 200);
  assert.equal(me.payload.data.onboardingStatus, 'COMPANY_PENDING');
  assert.equal(me.payload.data.user.phoneVerified, true);
  assert.ok(me.headers.get('x-request-id'));
});

test('OTP login does not register unknown phone numbers', async () => {
  const phone = uniquePhone();
  const response = await api(harness.base, '/api/auth/send-otp', {
    method: 'POST',
    body: { phone },
  });
  assert.equal(response.status, 404);
  assert.equal(response.payload.error.code, 'ACCOUNT_NOT_FOUND');
});

test('email OTP registers an account and signs in existing accounts', async () => {
  const email = uniqueEmail();
  const signup = await api(harness.base, '/api/auth/send-otp', {
    method: 'POST',
    body: { email, purpose: 'signup' },
  });
  assert.equal(signup.status, 200, signup.text);

  const signupOtp = emailService.peekDevOtp(email);
  assert.ok(signupOtp && /^\d{6}$/.test(signupOtp));
  const registered = await api(harness.base, '/api/auth/verify-otp', {
    method: 'POST',
    body: { email, purpose: 'signup', otp: signupOtp },
  });
  assert.equal(registered.status, 200, registered.text);
  assert.equal(registered.payload.data.user.emailVerified, true);
  assert.equal(registered.payload.data.onboardingStatus, 'COMPANY_PENDING');

  const company = await api(harness.base, '/api/companies', {
    method: 'POST',
    token: registered.payload.data.accessToken,
    body: {
      companyName: 'Email Onboarding Co',
      gst: uniqueGstin(),
      industry: 'Manufacturing',
      city: 'Pune',
    },
  });
  assert.equal(company.status, 201, company.text);
  assert.equal(company.payload.data.onboardingStatus, 'SITES_PENDING');
  const companyId = company.payload.data.company.id;

  const site = await api(harness.base, `/api/companies/${companyId}/sites`, {
    method: 'POST',
    token: registered.payload.data.accessToken,
    body: {
      siteName: 'Email User Plant',
      fullAddress: 'Plot 12, MIDC Road',
      city: 'Pune',
      latitude: 18.5204,
      longitude: 73.8567,
      siteType: 'plant',
    },
  });
  assert.equal(site.status, 201, site.text);
  assert.equal(site.payload.data.onboardingStatus, 'PROFILE_PENDING');

  const profile = await api(harness.base, '/api/profile', {
    method: 'POST',
    token: registered.payload.data.accessToken,
    body: { fullName: 'Email User' },
  });
  assert.equal(profile.status, 200, profile.text);
  assert.equal(profile.payload.data.onboardingStatus, 'ONBOARDING_COMPLETED');

  const loginSend = await api(harness.base, '/api/auth/send-otp', {
    method: 'POST',
    body: { email },
  });
  assert.equal(loginSend.status, 200, loginSend.text);
  const loginOtp = emailService.peekDevOtp(email);
  const loggedIn = await api(harness.base, '/api/auth/verify-otp', {
    method: 'POST',
    body: { email, otp: loginOtp },
  });
  assert.equal(loggedIn.status, 200, loggedIn.text);
  assert.equal(loggedIn.payload.data.user.id, registered.payload.data.user.id);
});

test('wrong OTP is rejected and attempt limit is enforced', async () => {
  const phone = uniquePhone();
  await api(harness.base, '/api/auth/send-otp', {
    method: 'POST', body: { phone, purpose: 'signup', fullName: 'Test User' },
  });
  let last;
  for (let i = 0; i < 5; i += 1) {
    last = await api(harness.base, '/api/auth/verify-otp', {
      method: 'POST',
      body: { phone, otp: '000000', purpose: 'signup', fullName: 'Test User' },
    });
    assert.ok([400, 429].includes(last.status));
    assert.equal(last.payload.success, false);
  }
  const limited = await api(harness.base, '/api/auth/verify-otp', {
    method: 'POST',
    body: { phone, otp: '000000', purpose: 'signup', fullName: 'Test User' },
  });
  assert.equal(limited.status, 429);
  assert.equal(limited.payload.error.code, 'OTP_ATTEMPT_LIMIT');
});

test('OTP cooldown rejects an immediate resend', async () => {
  const phone = uniquePhone();
  const first = await api(harness.base, '/api/auth/send-otp', {
    method: 'POST', body: { phone, purpose: 'signup', fullName: 'Test User' },
  });
  assert.equal(first.status, 200);
  const second = await api(harness.base, '/api/auth/send-otp', {
    method: 'POST', body: { phone, purpose: 'signup', fullName: 'Test User' },
  });
  if ((first.payload.data && first.payload.data.cooldownSeconds) > 0) {
    assert.equal(second.status, 429);
    assert.equal(second.payload.error.code, 'OTP_COOLDOWN');
  }
});

test('expired OTP cannot be used', async () => {
  const phone = uniquePhone();
  await api(harness.base, '/api/auth/send-otp', {
    method: 'POST', body: { phone, purpose: 'signup', fullName: 'Test User' },
  });
  const e164 = `+91${phone}`;
  const otp = smsService.peekDevOtp(e164);
  await pool.query(
    `UPDATE otp_verifications SET expires_at = NOW() - INTERVAL '1 minute' WHERE identifier = $1`,
    [e164],
  );
  const verified = await api(harness.base, '/api/auth/verify-otp', {
    method: 'POST',
    body: { phone, otp, purpose: 'signup', fullName: 'Test User' },
  });
  assert.equal(verified.status, 400);
  assert.equal(verified.payload.error.code, 'INVALID_OTP');
});

test('company, city, sites, primary site, GPS, and profile complete onboarding', async () => {
  const session = await onboardingUser();
  const gst = uniqueGstin();
  const created = await api(harness.base, '/api/companies', {
    method: 'POST',
    token: session.token,
    body: {
      companyName: 'Acme Steel',
      gst,
      industry: 'Manufacturing',
      city: 'Pune',
    },
  });
  assert.equal(created.status, 201, created.text);
  assert.equal(created.payload.data.onboardingStatus, 'SITES_PENDING');
  const companyId = created.payload.data.company.id;

  const badCity = await api(harness.base, `/api/companies/${companyId}`, {
    method: 'PATCH',
    token: session.token,
    body: { city: 'Pune###' },
  });
  assert.equal(badCity.status, 422);

  const patched = await api(harness.base, `/api/companies/${companyId}`, {
    method: 'PATCH',
    token: session.token,
    body: { city: 'Mumbai' },
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.payload.data.company.city, 'Mumbai');

  const factory = await api(harness.base, `/api/companies/${companyId}/sites`, {
    method: 'POST',
    token: session.token,
    body: {
      siteName: 'Pune Factory',
      fullAddress: 'Plot 12, MIDC, Pune',
      city: 'Pune',
      state: 'Maharashtra',
      latitude: 18.5204,
      longitude: 73.8567,
      siteType: 'Factory',
    },
  });
  assert.equal(factory.status, 201, factory.text);
  assert.equal(factory.payload.data.site.isPrimary, true);
  assert.equal(factory.payload.data.site.latitude, 18.5204);
  assert.equal(factory.payload.data.site.siteTypeLabel, 'Factory');

  const warehouse = await api(harness.base, `/api/companies/${companyId}/sites`, {
    method: 'POST',
    token: session.token,
    body: {
      siteName: 'Pune Warehouse',
      fullAddress: 'Plot 90, Warehouse Road',
      city: 'Pune',
      latitude: 18.53,
      longitude: 73.86,
      siteType: 'Warehouse',
      isPrimary: true,
    },
  });
  assert.equal(warehouse.status, 201, warehouse.text);
  assert.equal(warehouse.payload.data.site.isPrimary, true);

  const listed = await api(harness.base, `/api/companies/${companyId}/sites`, { token: session.token });
  assert.equal(listed.status, 200);
  const primaryCount = listed.payload.data.sites.filter((site) => site.isPrimary).length;
  assert.equal(primaryCount, 1);
  const factoryReloaded = listed.payload.data.sites.find((site) => site.siteName === 'Pune Factory');
  assert.equal(factoryReloaded.isPrimary, false);

  const profile = await api(harness.base, '/api/profile', {
    method: 'POST',
    token: session.token,
    body: {
      name: 'Amina Shah',
      email: uniqueEmail(),
      role: 'MAINTENANCE_HEAD',
      secondaryPhone: `+91${uniquePhone()}`,
    },
  });
  assert.equal(profile.status, 200, profile.text);
  assert.equal(profile.payload.data.onboardingStatus, 'ONBOARDING_COMPLETED');
  const secondaryPhone = profile.payload.data.user.secondaryPhone;
  assert.match(secondaryPhone, /^\+91[6-9]\d{9}$/);
  assert.equal(profile.payload.data.user.phone, session.phone);

  const me = await api(harness.base, '/api/auth/me', { token: session.token });
  assert.equal(me.payload.data.onboardingStatus, 'ONBOARDING_COMPLETED');
  assert.equal(me.payload.data.user.role, 'MAINTENANCE_HEAD');
  assert.equal(me.payload.data.user.secondaryPhone, secondaryPhone);
  assert.equal(me.payload.data.user.phone, session.phone);

  const updatedSecondary = `+91${uniquePhone()}`;
  const updated = await api(harness.base, '/api/profile', {
    method: 'PATCH',
    token: session.token,
    body: { secondaryPhone: updatedSecondary },
  });
  assert.equal(updated.status, 200, updated.text);
  assert.equal(updated.payload.data.user.secondaryPhone, updatedSecondary);
  assert.equal(updated.payload.data.user.phone, session.phone);

  const secondaryLogin = await api(harness.base, '/api/auth/send-otp', {
    method: 'POST',
    body: { phone: updatedSecondary, purpose: 'login' },
  });
  assert.equal(secondaryLogin.status, 404);
  assert.equal(secondaryLogin.payload.error.code, 'ACCOUNT_NOT_FOUND');

  const cleared = await api(harness.base, '/api/profile', {
    method: 'PATCH',
    token: session.token,
    body: { secondaryPhone: null },
  });
  assert.equal(cleared.status, 200, cleared.text);
  assert.equal(cleared.payload.data.user.secondaryPhone, null);
  assert.equal(cleared.payload.data.user.phone, session.phone);
});

test('users cannot select a role that grants additional permissions', async () => {
  const session = await onboardingUser();
  await pool.query(
    `UPDATE users
     SET role_id = (SELECT id FROM roles WHERE name = 'SITE_ENGINEER')
     WHERE id = $1`,
    [session.user.id],
  );
  const response = await api(harness.base, '/api/profile', {
    method: 'PATCH',
    token: session.token,
    body: { role: 'DIRECTOR_OWNER' },
  });
  assert.equal(response.status, 403);
  assert.equal(response.payload.error.code, 'SELF_ROLE_ESCALATION');
});

test('account notifications can be read and support requests are saved to the database', async () => {
  const session = await onboardingUser();
  const company = await api(harness.base, '/api/companies', {
    method: 'POST',
    token: session.token,
    body: {
      companyName: 'Notification Co',
      gst: uniqueGstin(),
      industry: 'Manufacturing',
      city: 'Pune',
    },
  });
  assert.equal(company.status, 201, company.text);

  const notifications = await api(harness.base, '/api/notifications', { token: session.token });
  assert.equal(notifications.status, 200, notifications.text);
  const notification = notifications.payload.data.notifications.find((item) => item.title === 'Company Created');
  assert.ok(notification);
  assert.equal(notification.isRead, false);

  const marked = await api(harness.base, `/api/notifications/${notification.id}/read`, {
    method: 'POST',
    token: session.token,
    body: {},
  });
  assert.equal(marked.status, 200, marked.text);
  const reloaded = await api(harness.base, '/api/notifications', { token: session.token });
  assert.equal(
    reloaded.payload.data.notifications.find((item) => item.id === notification.id).isRead,
    true,
  );

  const request = await api(harness.base, '/api/support', {
    method: 'POST',
    token: session.token,
    body: {
      subject: 'Need help with company setup',
      message: 'The saved company details do not appear in my account screen.',
    },
  });
  assert.equal(request.status, 201, request.text);
  assert.equal(request.payload.data.request.status, 'open');
  const stored = await pool.query(
    'SELECT user_id, company_id, subject, message FROM support_requests WHERE id = $1',
    [request.payload.data.request.id],
  );
  assert.equal(stored.rows[0].user_id, session.user.id);
  assert.equal(stored.rows[0].company_id, company.payload.data.company.id);
});

test('existing owners can copy a company and sites without changing the originals', async () => {
  const session = await onboardingUser();
  const gst = uniqueGstin();
  const originalCompanyResponse = await api(harness.base, '/api/companies', {
    method: 'POST',
    token: session.token,
    body: {
      companyName: 'Original Steel Works',
      gst,
      industry: 'Manufacturing',
      city: 'Pune',
    },
  });


  assert.equal(originalCompanyResponse.status, 201, originalCompanyResponse.text);
  const originalCompany = originalCompanyResponse.payload.data.company;

  const originalSiteResponse = await api(
    harness.base,
    `/api/companies/${originalCompany.id}/sites`,
    {
      method: 'POST',
      token: session.token,
      body: {
        siteName: 'Original Plant',
        fullAddress: 'Plot 20, MIDC Road',
        city: 'Pune',
        latitude: 18.5204,
        longitude: 73.8567,
        siteType: 'plant',
      },
    },
  );
  assert.equal(originalSiteResponse.status, 201, originalSiteResponse.text);
  const originalSite = originalSiteResponse.payload.data.site;

  const copyResponse = await api(harness.base, '/api/companies', {
    method: 'POST',
    token: session.token,
    body: {
      companyName: 'Copied Steel Works',
      gst,
      industry: 'Manufacturing',
      city: 'Mumbai',
      copyFromCompanyId: originalCompany.id,
    },
  });
  assert.equal(copyResponse.status, 201, copyResponse.text);
  assert.equal(copyResponse.payload.data.copiedSites, 1);
  const copiedCompany = copyResponse.payload.data.company;

  const copiedSitesResponse = await api(
    harness.base,
    `/api/companies/${copiedCompany.id}/sites`,
    { token: session.token },
  );
  assert.equal(copiedSitesResponse.status, 200, copiedSitesResponse.text);
  assert.equal(copiedSitesResponse.payload.data.sites.length, 1);
  const copiedSite = copiedSitesResponse.payload.data.sites[0];
  assert.notEqual(copiedSite.id, originalSite.id);
  assert.equal(copiedSite.siteName, originalSite.siteName);

  const editCopy = await api(harness.base, `/api/sites/${copiedSite.id}`, {
    method: 'PATCH',
    token: session.token,
    body: { siteName: 'Edited New Plant' },
  });
  assert.equal(editCopy.status, 200, editCopy.text);

  const originalReloaded = await api(
    harness.base,
    `/api/companies/${originalCompany.id}/sites`,
    { token: session.token },
  );
  assert.equal(originalReloaded.status, 200, originalReloaded.text);
  assert.equal(originalReloaded.payload.data.sites[0].siteName, 'Original Plant');

  const companies = await api(harness.base, '/api/companies/mine', { token: session.token });
  assert.equal(companies.status, 200, companies.text);
  assert.equal(companies.payload.data.companies.length, 2);
  const anotherAccount = await onboardingUser();
  const duplicateForAnotherAccount = await api(harness.base, '/api/companies', {
    method: 'POST',
    token: anotherAccount.token,
    body: {
      companyName: 'Unrelated Company',
      gst,
      industry: 'Manufacturing',
      city: 'Pune',
    },
  });
  assert.equal(duplicateForAnotherAccount.status, 409);
  assert.equal(duplicateForAnotherAccount.payload.error.code, 'GSTIN_IN_USE');

  const switchBack = await api(
    harness.base,
    `/api/companies/${originalCompany.id}/select`,
    { method: 'POST', token: session.token, body: {} },
  );
  assert.equal(switchBack.status, 200, switchBack.text);
  const me = await api(harness.base, '/api/auth/me', { token: session.token });
  assert.equal(me.payload.data.company.id, originalCompany.id);
});


test('cart quantity update preflight allows PUT from an approved origin', async () => {
  const previousOrigins = env.corsOrigins;
  env.corsOrigins = ['https://customer.test'];
  try {
    const response = await fetch(`${harness.base}/api/marketplace/cart/items/00000000-0000-4000-8000-000000000000`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://customer.test',
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
    assert.equal(response.status, 204);
    assert.match(response.headers.get('access-control-allow-methods') || '', /\bPUT\b/);
  } finally {
    env.corsOrigins = previousOrigins;
  }
});

test('marketplace catalog, persisted cart, sandbox order and tracking use database records', async () => {
  const session = await onboardingUser();
  const companyResponse = await api(harness.base, '/api/companies', {
    method: 'POST',
    token: session.token,
    body: {
      companyName: 'Marketplace Test Co',
      gst: uniqueGstin(),
      industry: 'Manufacturing',
      city: 'Pune',
    },
  });
  assert.equal(companyResponse.status, 201, companyResponse.text);
  const companyId = companyResponse.payload.data.company.id;
  const siteResponse = await api(harness.base, `/api/companies/${companyId}/sites`, {
    method: 'POST',
    token: session.token,
    body: {
      siteName: 'Marketplace Delivery Site',
      fullAddress: 'Plot 55, Test Industrial Estate',
      city: 'Pune',
      latitude: 18.5204,
      longitude: 73.8567,
      siteType: 'plant',
    },
  });
  assert.equal(siteResponse.status, 201, siteResponse.text);
  const siteId = siteResponse.payload.data.site.id;

  const fixture = await pool.query(
    `WITH category AS (
       INSERT INTO product_categories (slug, name)
       VALUES ($1, 'Integration Test Parts')
       RETURNING id
     )
     INSERT INTO products (category_id, sku, name, summary, price, stock_quantity)
     SELECT id, $2, 'Integration test cable', 'Test-only catalog fixture', 120.75, 4
     FROM category
     RETURNING id`,
    [`test-${session.user.id}`, `TEST-${session.user.id}`],
  );
  const productId = fixture.rows[0].id;
  let orderId;
  let capProductId;
  let mixedProductId;
  try {
    const capFixture = await pool.query(
      `INSERT INTO products (category_id, sku, name, summary, price, stock_quantity)
       SELECT id, $2, 'Cart quantity test item', 'Test-only quantity fixture', 1.00, 150
       FROM product_categories
       WHERE slug = $1
       RETURNING id`,
      [`test-${session.user.id}`, `CAP-${session.user.id}`],
    );
    capProductId = capFixture.rows[0].id;
    const mixedCurrencyFixture = await pool.query(
      `INSERT INTO products (category_id, sku, name, summary, price, currency, stock_quantity)
       SELECT id, $2, 'Cart currency test item', 'Test-only currency fixture', 2.00, 'USD', 10
       FROM product_categories
       WHERE slug = $1
       RETURNING id`,
      [`test-${session.user.id}`, `USD-${session.user.id}`],
    );
    mixedProductId = mixedCurrencyFixture.rows[0].id;

    const catalog = await api(harness.base, '/api/marketplace/products', { token: session.token });
    assert.equal(catalog.status, 200, catalog.text);
    assert.ok(catalog.payload.data.products.some((product) => product.id === productId));

    const addToLimit = await api(harness.base, '/api/marketplace/cart/items', {
      method: 'POST',
      token: session.token,
      body: { productId: capProductId, quantity: 89 },
    });
    assert.equal(addToLimit.status, 201, addToLimit.text);
    const reachLimit = await api(harness.base, '/api/marketplace/cart/items', {
      method: 'POST',
      token: session.token,
      body: { productId: capProductId, quantity: 10 },
    });
    assert.equal(reachLimit.status, 201, reachLimit.text);
    assert.equal(reachLimit.payload.data.items.find((item) => item.productId === capProductId).quantity, 99);
    const exceedLimit = await api(harness.base, '/api/marketplace/cart/items', {
      method: 'POST',
      token: session.token,
      body: { productId: capProductId, quantity: 1 },
    });
    assert.equal(exceedLimit.status, 409, exceedLimit.text);
    assert.equal(exceedLimit.payload.error.code, 'CART_QUANTITY_LIMIT');
    const cappedQuantity = await pool.query(
      'SELECT quantity FROM cart_items WHERE product_id = $1',
      [capProductId],
    );
    assert.equal(cappedQuantity.rows[0].quantity, 99);

    const removeCapProduct = await api(harness.base, `/api/marketplace/cart/items/${capProductId}`, {
      method: 'PUT',
      token: session.token,
      body: { quantity: 0 },
    });
    assert.equal(removeCapProduct.status, 200, removeCapProduct.text);

    const add = await api(harness.base, '/api/marketplace/cart/items', {
      method: 'POST',
      token: session.token,
      body: { productId, quantity: 3 },
    });
    assert.equal(add.status, 201, add.text);
    assert.equal(add.payload.data.itemCount, 3);
    assert.equal(add.payload.data.subtotal, 362.25);

    const mixedCurrencyAdd = await api(harness.base, '/api/marketplace/cart/items', {
      method: 'POST',
      token: session.token,
      body: { productId: mixedProductId, quantity: 1 },
    });
    assert.equal(mixedCurrencyAdd.status, 409, mixedCurrencyAdd.text);
    assert.equal(mixedCurrencyAdd.payload.error.code, 'MIXED_CURRENCY');

    const cartRow = await pool.query(
      'SELECT id FROM carts WHERE user_id = $1 AND company_id = $2',
      [session.user.id, companyId],
    );
    await pool.query(
      'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, 1)',
      [cartRow.rows[0].id, mixedProductId],
    );
    const legacyMixedCart = await api(harness.base, '/api/marketplace/cart', { token: session.token });
    assert.equal(legacyMixedCart.status, 200, legacyMixedCart.text);
    assert.equal(legacyMixedCart.payload.data.currencyConflict, true);
    assert.equal(legacyMixedCart.payload.data.subtotal, null);
    assert.equal(legacyMixedCart.payload.data.currency, null);
    const removeMixedProduct = await api(harness.base, `/api/marketplace/cart/items/${mixedProductId}`, {
      method: 'PUT',
      token: session.token,
      body: { quantity: 0 },
    });
    assert.equal(removeMixedProduct.status, 200, removeMixedProduct.text);
    assert.equal(removeMixedProduct.payload.data.currencyConflict, false);
    assert.equal(removeMixedProduct.payload.data.subtotal, 362.25);

    const providerCheckout = await api(harness.base, '/api/marketplace/checkout', {
      method: 'POST',
      token: session.token,
      body: { siteId, paymentMode: 'provider' },
    });
    assert.equal(providerCheckout.status, 501);
    assert.equal(providerCheckout.payload.error.code, 'PAYMENT_PROVIDER_NOT_CONFIGURED');

    const checkout = await api(harness.base, '/api/marketplace/checkout', {
      method: 'POST',
      token: session.token,
      body: { siteId, paymentMode: 'sandbox' },
    });
    assert.equal(checkout.status, 201, checkout.text);
    assert.equal(checkout.payload.data.sandbox, true);
    assert.equal(checkout.payload.data.payment.charged, false);
    assert.equal(checkout.payload.data.order.status, 'confirmed');
    orderId = checkout.payload.data.order.id;

    const stored = await pool.query(
      `SELECT o.status, o.total, p.provider, p.status AS payment_status,
              p.metadata, pr.stock_quantity
       FROM orders o
       JOIN payments p ON p.order_id = o.id
       JOIN products pr ON pr.id = $2
       WHERE o.id = $1`,
      [orderId, productId],
    );
    assert.equal(stored.rows[0].status, 'confirmed');
    assert.equal(Number(stored.rows[0].total), 362.25);
    assert.equal(stored.rows[0].provider, 'sandbox');
    assert.equal(stored.rows[0].payment_status, 'succeeded');
    assert.equal(stored.rows[0].metadata.charged, false);
    assert.equal(stored.rows[0].stock_quantity, 1);

    const insufficient = await api(harness.base, '/api/marketplace/cart/items', {
      method: 'POST',
      token: session.token,
      body: { productId, quantity: 2 },
    });
    assert.equal(insufficient.status, 409);

    for (const status of ['processing', 'dispatched', 'delivered']) {
      const changed = await api(harness.base, `/api/marketplace/orders/${orderId}/status`, {
        method: 'POST',
        token: session.token,
        body: { status },
      });
      assert.equal(changed.status, 200, changed.text);
    }
    const tracked = await api(harness.base, `/api/marketplace/orders/${orderId}`, {
      token: session.token,
    });
    assert.equal(tracked.status, 200, tracked.text);
    assert.equal(tracked.payload.data.status, 'delivered');
    assert.equal(tracked.payload.data.history.length, 5);
    assert.equal(tracked.payload.data.items[0].quantity, 3);
    const emptyCart = await api(harness.base, '/api/marketplace/cart', { token: session.token });
    assert.equal(emptyCart.payload.data.itemCount, 0);
  } finally {
    if (orderId) {
      await pool.query('DELETE FROM payments WHERE order_id = $1', [orderId]);
      await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);
    }
    await pool.query(
      'DELETE FROM cart_items WHERE product_id = ANY($1::uuid[])',
      [[productId, capProductId, mixedProductId].filter(Boolean)],
    );
    if (capProductId) await pool.query('DELETE FROM products WHERE id = $1', [capProductId]);
    if (mixedProductId) await pool.query('DELETE FROM products WHERE id = $1', [mixedProductId]);
    await pool.query('DELETE FROM products WHERE id = $1', [productId]);
    await pool.query('DELETE FROM product_categories WHERE slug = $1', [`test-${session.user.id}`]);
  }
});

test('AMC contract list returns the active count beyond the current page', async () => {
  const session = await onboardingUser();
  const companyResponse = await api(harness.base, '/api/companies', {
    method: 'POST',
    token: session.token,
    body: {
      companyName: 'AMC Count Test Co',
      gst: uniqueGstin(),
      industry: 'Manufacturing',
      city: 'Pune',
    },
  });
  assert.equal(companyResponse.status, 201, companyResponse.text);
  const companyId = companyResponse.payload.data.company.id;
  const siteResponse = await api(harness.base, `/api/companies/${companyId}/sites`, {
    method: 'POST',
    token: session.token,
    body: {
      siteName: 'AMC Count Test Site',
      fullAddress: 'Plot 64, Test Industrial Estate',
      city: 'Pune',
      latitude: 18.5204,
      longitude: 73.8567,
      siteType: 'plant',
    },
  });
  assert.equal(siteResponse.status, 201, siteResponse.text);
  const customer = await customerModel.insert({
    userId: session.user.id,
    companyId,
  });

  const inserted = await pool.query(
    `INSERT INTO amc_contracts (
       customer_id, company_id, site_id, contract_number, contract_type, coverage,
       start_date, end_date, visit_frequency, status
     )
     SELECT $1::uuid, $2::uuid, $3::uuid, 'AMC-TST-' || substring($1::text, 1, 8) || '-' || sequence::text,
            'comprehensive', 'Integration test coverage', '2026-01-01', '2027-01-01',
            'yearly', 'active'
     FROM generate_series(1, 51) AS sequence
     RETURNING id`,
    [customer.id, companyId, siteResponse.payload.data.site.id],
  );

  try {
    const contracts = await api(
      harness.base,
      '/api/customer/amc/contracts?limit=50',
      { token: session.token },
    );
    assert.equal(contracts.status, 200, contracts.text);
    assert.equal(contracts.payload.data.items.length, 50);
    assert.equal(contracts.payload.data.pagination.total, 51);
    assert.equal(contracts.payload.data.activeCount, 51);
  } finally {
    await pool.query('DELETE FROM amc_contracts WHERE id = ANY($1::uuid[])', [
      inserted.rows.map((row) => row.id),
    ]);
  }
});

test('repair attachments upload file bytes privately and link them to the repair record', async () => {
  const session = await onboardingUser();
  const companyResponse = await api(harness.base, '/api/companies', {
    method: 'POST',
    token: session.token,
    body: {
      companyName: 'Attachment Test Co',
      gst: uniqueGstin(),
      industry: 'Manufacturing',
      city: 'Pune',
    },
  });
  assert.equal(companyResponse.status, 201, companyResponse.text);
  const companyId = companyResponse.payload.data.company.id;
  const siteResponse = await api(harness.base, `/api/companies/${companyId}/sites`, {
    method: 'POST',
    token: session.token,
    body: {
      siteName: 'Attachment Test Site',
      fullAddress: 'Plot 20, Test Industrial Estate',
      city: 'Pune',
      latitude: 18.5204,
      longitude: 73.8567,
      siteType: 'plant',
    },
  });
  assert.equal(siteResponse.status, 201, siteResponse.text);
  const siteId = siteResponse.payload.data.site.id;
  const content = Buffer.alloc(64);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(content);
  let attachmentId;
  let filePath;
  try {
    const uploaded = await api(harness.base, '/api/customer/attachments', {
      method: 'POST',
      token: session.token,
      body: {
        fileName: 'machine panel.png',
        mimeType: 'image/png',
        contentBase64: content.toString('base64'),
      },
    });
    assert.equal(uploaded.status, 201, uploaded.text);
    attachmentId = uploaded.payload.data.attachment.id;
    assert.ok(uploaded.payload.data.attachment.contentUrl);
    const storageKey = uploaded.payload.data.attachment.storageKey.replace(/^local\//, '');
    filePath = path.join(__dirname, '..', '..', 'private-uploads', 'customer-attachments', storageKey);

    const device = await api(harness.base, '/api/customer/repairs/devices', {
      method: 'POST',
      token: session.token,
      body: {
        siteId,
        deviceType: 'panel',
        manufacturer: 'Test maker',
        model: 'Panel A',
        serialNumber: `ATT-${Date.now()}`,
        installationLocation: 'Test floor',
      },
    });
    assert.equal(device.status, 201, device.text);
    const ticket = await api(harness.base, '/api/customer/repairs/tickets', {
      method: 'POST',
      token: session.token,
      body: {
        siteId,
        deviceId: device.payload.data.device.id,
        repairScope: 'on_site',
        serviceType: 'inspection',
        priority: 'normal',
        issueDescription: 'Panel image upload integration check',
        symptoms: 'Test symptom',
        faultInformation: 'Test fault',
        attachmentIds: [attachmentId],
        submit: true,
      },
    });
    assert.equal(ticket.status, 201, ticket.text);
    const attachments = await api(
      harness.base,
      `/api/customer/attachments?entityType=repair_ticket&entityId=${ticket.payload.data.ticket.id}`,
      { token: session.token },
    );
    assert.equal(attachments.status, 200, attachments.text);
    assert.equal(attachments.payload.data.attachments[0].id, attachmentId);

    const response = await fetch(`${harness.base}${uploaded.payload.data.attachment.contentUrl}`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), content);
    const invalid = await api(harness.base, '/api/customer/attachments', {
      method: 'POST',
      token: session.token,
      body: {
        fileName: 'fake.png',
        mimeType: 'image/png',
        contentBase64: Buffer.alloc(64).toString('base64'),
      },
    });
    assert.equal(invalid.status, 422);
    assert.equal(invalid.payload.error.code, 'FILE_TYPE_MISMATCH');
  } finally {
    if (attachmentId) await pool.query('DELETE FROM attachments WHERE id = $1', [attachmentId]);
    if (filePath) await fs.unlink(filePath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
});

test('RBAC denies site deletion after the director owner is downgraded to site engineer', async () => {
  const session = await onboardingUser();
  const created = await api(harness.base, '/api/companies', {
    method: 'POST',
    token: session.token,
    body: {
      companyName: 'RBAC Steel',
      gst: uniqueGstin(),
      industry: 'Manufacturing',
      city: 'Nashik',
    },
  });
  const companyId = created.payload.data.company.id;
  const site = await api(harness.base, `/api/companies/${companyId}/sites`, {
    method: 'POST',
    token: session.token,
    body: {
      siteName: 'Plant A',
      fullAddress: 'Industrial area 1',
      city: 'Nashik',
      latitude: 19.99,
      longitude: 73.78,
      siteType: 'Plant',
    },
  });
  await pool.query(
    `UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'SITE_ENGINEER') WHERE id = $1`,
    [session.user.id],
  );
  const denied = await api(harness.base, `/api/sites/${site.payload.data.site.id}`, {
    method: 'DELETE',
    token: session.token,
  });
  assert.equal(denied.status, 403);
});

test('API keys are shown once, hashed at rest, and can be revoked', async () => {
  const session = await onboardingUser();
  await api(harness.base, '/api/companies', {
    method: 'POST',
    token: session.token,
    body: {
      companyName: 'Key Steel',
      gst: uniqueGstin(),
      industry: 'Manufacturing',
      city: 'Nagpur',
    },
  });
  const created = await api(harness.base, '/api/api-keys', {
    method: 'POST',
    token: session.token,
    body: { name: 'Mobile sync' },
  });
  assert.equal(created.status, 201, created.text);
  const fullKey = created.payload.data.apiKey.key;
  assert.ok(fullKey && fullKey.startsWith('zsa_'));
  const listed = await api(harness.base, '/api/api-keys', { token: session.token });
  assert.equal(listed.payload.data.apiKeys[0].key, undefined);
  const hashed = await pool.query('SELECT key_hash FROM api_keys WHERE id = $1', [created.payload.data.apiKey.id]);
  assert.equal(hashed.rows[0].key_hash.includes(fullKey), false);

  const me = await api(harness.base, '/api/auth/me', { apiKey: fullKey });
  assert.equal(me.status, 200);

  await api(harness.base, `/api/api-keys/${created.payload.data.apiKey.id}/revoke`, {
    method: 'POST',
    token: session.token,
  });
  const afterRevoke = await api(harness.base, '/api/auth/me', { apiKey: fullKey });
  assert.equal(afterRevoke.status, 401);
});

test('unauthorized and expired sessions are rejected', async () => {
  const denied = await api(harness.base, '/api/auth/me');
  assert.equal(denied.status, 401);

  const owner = await onboardingUser();
  const company = await api(harness.base, '/api/companies', {
    method: 'POST',
    token: owner.token,
    body: {
      companyName: 'Hidden Co',
      gst: uniqueGstin(),
      industry: 'Manufacturing',
      city: 'Delhi',
    },
  });
  assert.equal(company.status, 201, company.text);

  const other = await onboardingUser();
  const forbidden = await api(harness.base, `/api/companies/${company.payload.data.company.id}`, {
    token: other.token,
  });
  assert.equal(forbidden.status, 403);

  await pool.query(
    `UPDATE sessions SET expires_at = NOW() - INTERVAL '1 day' WHERE user_id = $1`,
    [owner.user.id],
  );
  const expired = await api(harness.base, '/api/auth/me', { token: owner.token });
  assert.equal(expired.status, 401);
});

test('set password, change password, and session listing work', async () => {
  const session = await onboardingUser();
  const set = await api(harness.base, '/api/auth/set-password', {
    method: 'POST',
    token: session.token,
    body: { password },
  });
  assert.equal(set.status, 200, set.text);

  const listed = await api(harness.base, '/api/auth/sessions', { token: session.token });
  assert.equal(listed.status, 200);
  assert.equal(listed.payload.data.sessions.some((item) => item.current), true);

  const changed = await api(harness.base, '/api/auth/change-password', {
    method: 'POST',
    token: session.token,
    body: { currentPassword: password, newPassword: 'An0ther-Strong-pass!' },
  });
  assert.equal(changed.status, 200);
});

test('dashboard aggregates company data and hides restricted sections by role', async () => {
  const anon = await api(harness.base, '/api/dashboard');
  assert.equal(anon.status, 401);

  const fresh = await onboardingUser();
  const empty = await api(harness.base, '/api/dashboard', { token: fresh.token });
  assert.equal(empty.status, 200, empty.text);
  assert.equal(empty.payload.data.company, null);
  assert.equal(empty.payload.data.people, null);
  assert.ok(empty.payload.data.notices.some((notice) => notice.id === 'company-missing'));

  const session = await onboardingUser();
  const created = await api(harness.base, '/api/companies', {
    method: 'POST',
    token: session.token,
    body: {
      companyName: 'Dashboard Steel',
      gst: uniqueGstin(),
      industry: 'Manufacturing',
      city: 'Pune',
    },
  });
  assert.equal(created.status, 201, created.text);
  const companyId = created.payload.data.company.id;
  const site = await api(harness.base, `/api/companies/${companyId}/sites`, {
    method: 'POST',
    token: session.token,
    body: {
      siteName: 'Pune Works',
      fullAddress: 'Plot 4, MIDC',
      city: 'Pune',
      latitude: 18.52,
      longitude: 73.85,
      siteType: 'Factory',
    },
  });
  assert.equal(site.status, 201, site.text);
  await api(harness.base, '/api/profile', {
    method: 'POST',
    token: session.token,
    body: { name: 'Amina Shah' },
  });

  const owner = await api(harness.base, '/api/dashboard', { token: session.token });
  assert.equal(owner.status, 200, owner.text);
  const board = owner.payload.data;
  assert.equal(board.access.readPeople, true);
  assert.equal(board.access.readApiKeys, true);
  assert.equal(board.access.updateCompany, true);
  assert.equal(board.summary.sites.total, 1);
  assert.equal(board.summary.sites.active, 1);
  assert.equal(board.summary.sites.primaryName, 'Pune Works');
  assert.equal(board.sites[0].siteName, 'Pune Works');
  assert.equal(board.people.length, 1);
  assert.equal(board.people[0].name, 'Amina Shah');
  assert.equal(board.people[0].email, undefined);
  assert.equal(board.people[0].phone, undefined);
  assert.ok(board.activity.some((item) => item.action === 'company.created'));
  assert.equal(board.activity[0].ipAddress, undefined);
  assert.equal(JSON.stringify(board).includes('key_hash'), false);
  assert.ok(board.summary.sessions.active >= 1);

  await pool.query(
    `UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'SITE_ENGINEER') WHERE id = $1`,
    [session.user.id],
  );
  const engineer = await api(harness.base, '/api/dashboard', { token: session.token });
  assert.equal(engineer.status, 200, engineer.text);
  assert.equal(engineer.payload.data.access.readPeople, false);
  assert.equal(engineer.payload.data.access.createSites, false);
  assert.equal(engineer.payload.data.access.readApiKeys, false);
  assert.equal(engineer.payload.data.people, null);
  assert.equal(engineer.payload.data.summary.apiKeys, null);
  assert.equal(engineer.payload.data.sites.length, 1);
  assert.equal(
    engineer.payload.data.activity.some((item) => String(item.action).startsWith('api_key.')),
    false,
  );

  await pool.query(
    `UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'PURCHASE_MGR') WHERE id = $1`,
    [session.user.id],
  );
  const manager = await api(harness.base, '/api/dashboard', { token: session.token });
  assert.equal(manager.status, 200, manager.text);
  assert.equal(manager.payload.data.access.readPeople, true);
  assert.equal(manager.payload.data.access.updateCompany, false);
  assert.equal(manager.payload.data.access.createSites, true);
  assert.equal(manager.payload.data.access.readApiKeys, false);
  assert.ok(Array.isArray(manager.payload.data.people));
});
