const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const { Pool } = require('pg');

const DEMO = {
  gstNumber: '27AAACC0000A1Z5',
  companyName: 'Demo Gravity Industries',
  ownerPhone: '+919876543210',
  ownerEmail: 'owner@demo.gravity.local',
};

async function ensureSeedEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo data seeding is disabled in production.');
  }
  if (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER) {
    throw new Error('Database environment variables are missing.');
  }
}

async function seedDemoData() {
  await ensureSeedEnvironment();
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const roles = await client.query(
      `SELECT id, name FROM roles
       WHERE name IN ('DIRECTOR_OWNER', 'MAINTENANCE_HEAD', 'PURCHASE_MGR', 'SITE_ENGINEER')`,
    );
    const roleByName = Object.fromEntries(roles.rows.map((role) => [role.name, role.id]));
    for (const name of ['DIRECTOR_OWNER', 'MAINTENANCE_HEAD', 'PURCHASE_MGR', 'SITE_ENGINEER']) {
      if (!roleByName[name]) throw new Error(`Missing required role: ${name}`);
    }

    const existingOwner = await client.query(
      `SELECT id FROM users WHERE phone = $1 OR email = $2 LIMIT 1`,
      [DEMO.ownerPhone, DEMO.ownerEmail],
    );
    let ownerId;
    if (existingOwner.rows.length) {
      ownerId = existingOwner.rows[0].id;
      await client.query(
        `UPDATE users
         SET name = $2, email = $3, phone = $4, role_id = $5,
             email_verified = TRUE, phone_verified = TRUE, status = 'active',
             updated_at = NOW()
         WHERE id = $1`,
        [ownerId, 'Demo Director', DEMO.ownerEmail, DEMO.ownerPhone, roleByName.DIRECTOR_OWNER],
      );
    } else {
      const ownerResult = await client.query(
        `INSERT INTO users (
           name, email, phone, role_id, email_verified, phone_verified, status
         )
         VALUES ($1, $2, $3, $4, TRUE, TRUE, 'active')
         RETURNING id`,
        ['Demo Director', DEMO.ownerEmail, DEMO.ownerPhone, roleByName.DIRECTOR_OWNER],
      );
      ownerId = ownerResult.rows[0].id;
    }

    const existingCompany = await client.query(
      `SELECT id FROM companies WHERE gst_number = $1 LIMIT 1`,
      [DEMO.gstNumber],
    );
    let companyId;
    if (existingCompany.rows.length) {
      companyId = existingCompany.rows[0].id;
      await client.query(
        `UPDATE companies
         SET company_name = $2, legal_name = $2, industry = 'Manufacturing',
             city = 'Jaipur', state = 'Rajasthan', country = 'India',
             pincode = '302022', address = 'Sitapura Industrial Area, Jaipur',
             status = 'active', updated_at = NOW()
         WHERE id = $1`,
        [companyId, DEMO.companyName],
      );
    } else {
      const companyResult = await client.query(
        `INSERT INTO companies (
           company_name, legal_name, gst_number, industry, city, state, country,
           pincode, address, status, owner_user_id
         )
         VALUES ($1, $2, $3, 'Manufacturing', 'Jaipur', 'Rajasthan', 'India',
                 '302022', 'Sitapura Industrial Area, Jaipur', 'active', $4)
         RETURNING id`,
        [DEMO.companyName, DEMO.companyName, DEMO.gstNumber, ownerId],
      );
      companyId = companyResult.rows[0].id;
    }

    await client.query(
      `INSERT INTO company_members (company_id, user_id)
       VALUES ($1, $2) ON CONFLICT (company_id, user_id) DO NOTHING`,
      [companyId, ownerId],
    );
    await client.query(`UPDATE users SET company_id = $2 WHERE id = $1`, [ownerId, companyId]);

    const demoUsers = [
      ['Demo Maintenance Head', 'maintenance@demo.gravity.local', '+919876543211', 'MAINTENANCE_HEAD'],
      ['Demo Purchase Manager', 'purchase@demo.gravity.local', '+919876543212', 'PURCHASE_MGR'],
      ['Demo Site Engineer', 'engineer@demo.gravity.local', '+919876543213', 'SITE_ENGINEER'],
    ];
    for (const [name, email, phone, roleName] of demoUsers) {
      const existing = await client.query(
        `SELECT id FROM users WHERE phone = $1 OR email = $2 LIMIT 1`,
        [phone, email],
      );
      let userId;
      if (existing.rows.length) {
        userId = existing.rows[0].id;
        await client.query(
          `UPDATE users
           SET name = $2, email = $3, phone = $4, role_id = $5, company_id = $6,
               email_verified = TRUE, phone_verified = TRUE, status = 'active',
               updated_at = NOW()
           WHERE id = $1`,
          [userId, name, email, phone, roleByName[roleName], companyId],
        );
      } else {
        const result = await client.query(
          `INSERT INTO users (
             name, email, phone, role_id, company_id, email_verified, phone_verified, status
           )
           VALUES ($1, $2, $3, $4, $5, TRUE, TRUE, 'active')
           RETURNING id`,
          [name, email, phone, roleByName[roleName], companyId],
        );
        userId = result.rows[0].id;
      }
      await client.query(
        `INSERT INTO company_members (company_id, user_id)
         VALUES ($1, $2) ON CONFLICT (company_id, user_id) DO NOTHING`,
        [companyId, userId],
      );
    }

    const demoSites = [
      [
        'Main Manufacturing Plant', 'plant',
        'Plot 12, Sitapura Industrial Area, Jaipur',
        '302022', 26.763000, 75.827000, true,
      ],
      [
        'Warehouse & Logistics', 'warehouse',
        'Warehouse 8, Vishwakarma Industrial Area, Jaipur',
        '302013', 26.982000, 75.794000, false,
      ],
    ];
    for (const [siteName, siteType, address, pincode, latitude, longitude, isPrimary] of demoSites) {
      const existingSite = await client.query(
        `SELECT id FROM sites WHERE company_id = $1 AND site_name = $2 LIMIT 1`,
        [companyId, siteName],
      );
      if (existingSite.rows.length) {
        await client.query(
          `UPDATE sites
           SET site_type = $3, address = $4, city = 'Jaipur', state = 'Rajasthan',
               country = 'India', pincode = $5, latitude = $6, longitude = $7,
               is_primary = $8, status = 'active', updated_at = NOW()
           WHERE id = $1
             AND site_name = $2`,
          [existingSite.rows[0].id, siteName, siteType, address, pincode, latitude, longitude, isPrimary],
        );
      } else {
        await client.query(
          `INSERT INTO sites (
             company_id, site_name, site_type, address, city, state, country,
             pincode, latitude, longitude, is_primary, status
           )
           VALUES ($1, $2, $3, $4, 'Jaipur', 'Rajasthan', 'India',
                   $5, $6, $7, $8, 'active')`,
          [companyId, siteName, siteType, address, pincode, latitude, longitude, isPrimary],
        );
      }
    }

    const primarySite = await client.query(
      `SELECT id FROM sites WHERE company_id = $1 AND is_primary = TRUE LIMIT 1`,
      [companyId],
    );
    if (!primarySite.rows.length) throw new Error('Primary demo site was not created.');
    const primarySiteId = primarySite.rows[0].id;
    await client.query(
      `UPDATE sites SET is_primary = FALSE
       WHERE company_id = $1 AND id <> $2`,
      [companyId, primarySiteId],
    );
    await client.query(
      `UPDATE sites SET is_primary = TRUE
       WHERE id = $1`,
      [primarySiteId],
    );

    const customerResult = await client.query(
      `INSERT INTO customers (company_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (company_id, user_id) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [companyId, ownerId],
    );
    const customerId = customerResult.rows[0].id;

    await client.query(
      `INSERT INTO field_jobs (
         company_id, site_id, code, title, category, priority, status,
         location_label, engineer_name, engineer_trade, rating, estimate_amount,
         sla_due_at, eta_minutes, notes
       )
       VALUES
         ($1, $2, 'DEMO-JOB-001', 'VFD drive overheating', 'job', 'emergency',
          'on_the_way', 'Main Manufacturing Plant', 'Demo Engineer', 'VFD / Drives',
          4.8, 12500, NOW() + INTERVAL '2 hours', 18, 'Demo emergency job'),
         ($1, $2, 'DEMO-JOB-002', 'PLC control panel fault', 'quick', 'scheduled',
          'in_progress', 'Main Manufacturing Plant', 'Demo Engineer', 'PLC / Automation',
          4.7, 8500, NOW() + INTERVAL '1 day', 45, 'Demo quick-service job'),
         ($1, $2, 'DEMO-JOB-003', 'Preventive panel maintenance', 'job', 'scheduled',
          'completed', 'Main Manufacturing Plant', 'Demo Engineer', 'Electrical',
          4.9, 6500, NOW() - INTERVAL '1 day', 30, 'Demo completed job')
       ON CONFLICT (code) DO NOTHING`,
      [companyId, primarySiteId],
    );

    const demoSignals = [
      ['emergency', 'Emergency VFD breakdown', 'Demo plant reports repeated VFD tripping.', 'open', 18, 'Demo Engineer'],
      ['recommendation', 'Panel thermal inspection', 'Recommended before the next production shift.', 'closed', null, 'Maintenance Head'],
    ];
    for (const [kind, title, detail, status, eta, actor] of demoSignals) {
      const existingSignal = await client.query(
        `SELECT id FROM field_signals WHERE company_id = $1 AND title = $2 LIMIT 1`,
        [companyId, title],
      );
      if (!existingSignal.rows.length) {
        await client.query(
          `INSERT INTO field_signals (
             company_id, site_id, kind, title, detail, status, eta_minutes, actor_name
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [companyId, primarySiteId, kind, title, detail, status, eta, actor],
        );
      }
    }

    const demoPlans = [
      ['Annual Comprehensive AMC', 'active', 10, 'VFD, PLC, MCC and HMI preventive coverage'],
      ['Panel Preventive Visit', 'quoted', 5, 'Thermal inspection and panel cleaning'],
    ];
    for (const [title, status, discount, coverage] of demoPlans) {
      const existingPlan = await client.query(
        `SELECT id FROM amc_plans WHERE company_id = $1 AND title = $2 LIMIT 1`,
        [companyId, title],
      );
      if (!existingPlan.rows.length) {
        await client.query(
          `INSERT INTO amc_plans (
             company_id, site_id, title, status, discount_percent, quote_hours,
             coverage, priority_response
           )
           VALUES ($1, $2, $3, $4, $5, 48, $6, TRUE)`,
          [companyId, primarySiteId, title, status, discount, coverage],
        );
      }
    }

    const demoCerts = [
      ['Electrical Safety Audit', 28],
      ['Fire and Emergency Compliance', 75],
    ];
    for (const [name, days] of demoCerts) {
      const existingCert = await client.query(
        `SELECT id FROM compliance_certs WHERE company_id = $1 AND name = $2 LIMIT 1`,
        [companyId, name],
      );
      if (!existingCert.rows.length) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        await client.query(
          `INSERT INTO compliance_certs (company_id, site_id, name, expires_at)
           VALUES ($1, $2, $3, $4)`,
          [companyId, primarySiteId, name, expiresAt],
        );
      }
    }

    await client.query(
      `INSERT INTO devices (
         customer_id, company_id, site_id, device_type, manufacturer, model,
         serial_number, asset_number, location, description
       )
       VALUES ($1, $2, $3, 'vfd', 'ABB', 'ACS580', 'DEMO-VFD-ACS580-001',
               'AST-001', 'VFD Control Room', 'Demo 55 kW variable frequency drive')
       ON CONFLICT (company_id, serial_number) DO NOTHING`,
      [customerId, companyId, primarySiteId],
    );

    await client.query(
      `INSERT INTO amc_contracts (
         customer_id, company_id, site_id, contract_number, contract_type, coverage,
         start_date, end_date, visit_frequency, visits_per_year, next_visit_date,
         preferred_visit_time, status, assigned_engineer_name, service_contact
       )
       VALUES ($1, $2, $3, 'DEMO-AMC-2026-001', 'comprehensive',
               'Complete electrical panel and VFD preventive maintenance',
               CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '335 days',
               'quarterly', 4, CURRENT_DATE + INTERVAL '60 days',
               '11:00', 'active', 'Demo Engineer', 'maintenance@demo.gravity.local')
       ON CONFLICT (contract_number) DO NOTHING`,
      [customerId, companyId, primarySiteId],
    );

    await client.query(
      `INSERT INTO amc_requests (
         customer_id, company_id, site_id, request_type, service_requirement,
         preferred_date, preferred_time, description, status, request_number, submitted_at
       )
       VALUES ($1, $2, $3, 'visit', 'Quarterly preventive visit',
               CURRENT_DATE + INTERVAL '14 days', '11:00',
               'Demo AMC quarterly inspection', 'submitted', 'DEMO-AMR-2026-001', NOW())
       ON CONFLICT (request_number) DO NOTHING`,
      [customerId, companyId, primarySiteId],
    );

    const deviceResult = await client.query(
      `SELECT id FROM devices WHERE company_id = $1 AND serial_number = 'DEMO-VFD-ACS580-001'`,
      [companyId],
    );
    if (deviceResult.rows.length) {
      await client.query(
        `INSERT INTO repair_tickets (
           ticket_number, customer_id, company_id, site_id, device_id, repair_scope,
           service_type, priority, requested_turnaround, issue_description,
           status, submitted_at
         )
         VALUES ('DEMO-RPR-2026-001', $1, $2, $3, $4, 'workshop',
                 'component_repair', 'high', '3 working days',
                 'Repeated overcurrent alarm from the main VFD',
                 'submitted', NOW())
         ON CONFLICT (ticket_number) DO NOTHING`,
        [customerId, companyId, primarySiteId, deviceResult.rows[0].id],
      );
    }

    const projectCategory = await client.query(
      `INSERT INTO project_categories (code, name, sort_order)
       VALUES ('demo-installation', 'Demo Installation', 99)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, active = TRUE
       RETURNING id`,
    );
    const projectType = await client.query(
      `INSERT INTO project_types (category_id, code, name, sort_order)
       VALUES ($1, 'demo-vfd-panel', 'VFD Panel Installation', 99)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, active = TRUE
       RETURNING id`,
      [projectCategory.rows[0].id],
    );
    await client.query(
      `INSERT INTO project_requests (
         customer_id, company_id, site_id, category_id, project_type_id,
         title, description, requirements, estimated_scope, preferred_timeline,
         budget_amount, budget_currency, status, request_number, submitted_at
       )
       VALUES ($1, $2, $3, $4, $5,
               'Demo VFD control panel upgrade',
               'Replace the existing DOL panel with a VFD-based control system.',
               'Include drawings, testing, commissioning and training.',
               'One MCC panel and one 55 kW VFD',
               'Within 30 days', 350000, 'INR',
               'submitted', 'DEMO-PRJ-2026-001', NOW())
       ON CONFLICT (request_number) DO NOTHING`,
      [
        customerId,
        companyId,
        primarySiteId,
        projectCategory.rows[0].id,
        projectType.rows[0].id,
      ],
    );

    await client.query(
      `INSERT INTO product_categories (slug, name, description, sort_order)
       VALUES ('demo-electrical', 'Demo Electrical', 'Sample industrial electrical catalogue', 99)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, active = TRUE
       RETURNING id`,
    );
    const supplierResult = await client.query(
      `INSERT INTO suppliers (name, code, email, phone, active)
       VALUES ('Demo Electrical Supply', 'DEMO-SUPPLY', 'supply@demo.gravity.local',
               '9876543214', TRUE)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, active = TRUE
       RETURNING id`,
    );
    const categoryResult = await client.query(
      `SELECT id FROM product_categories WHERE slug = 'demo-electrical'`,
    );
    const supplierId = supplierResult.rows[0].id;
    const categoryId = categoryResult.rows[0].id;
    const products = [
      ['DEMO-MCB-32A', '32A MCB', 'Schneider', 'Switchgear', 1450, 28],
      ['DEMO-VFD-55KW', 'Industrial VFD 5.5 kW', 'ABB', 'VFD / Drives', 28500, 6],
      ['DEMO-CABLE-4SQ', 'XLPE Copper Cable 4 sq mm', 'Polycab', 'Cables & Wires', 92, 0],
    ];
    for (const [sku, name, brand, summary, price, stock] of products) {
      await client.query(
        `INSERT INTO products (
           category_id, supplier_id, sku, name, brand, summary, unit, price,
           currency, stock_quantity, active
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'piece', $7, 'INR', $8, TRUE)
         ON CONFLICT (sku) DO UPDATE
         SET category_id = EXCLUDED.category_id,
             supplier_id = EXCLUDED.supplier_id,
             name = EXCLUDED.name,
             brand = EXCLUDED.brand,
             summary = EXCLUDED.summary,
             price = EXCLUDED.price,
             stock_quantity = EXCLUDED.stock_quantity,
             active = TRUE,
             updated_at = NOW()`,
        [categoryId, supplierId, sku, name, brand, summary, price, stock],
      );
    }

    await client.query('COMMIT');
    console.log(`Demo data seeded: ${DEMO.companyName}`);
    return {
      companyId,
      ownerPhone: DEMO.ownerPhone,
      otp: process.env.DEV_FIXED_OTP || null,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedDemoData().catch((error) => {
    console.error(`Demo data seeding failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { seedDemoData };
