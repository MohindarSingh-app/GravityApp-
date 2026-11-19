-- Option lists the app used to hardcode (AMC catalog, emergency, compliance, FAQ, roles, industries).
CREATE TABLE IF NOT EXISTS app_catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_code VARCHAR(48) NOT NULL,
  code VARCHAR(64) NOT NULL,
  label TEXT NOT NULL,
  summary TEXT,
  glyph VARCHAR(32),
  tone VARCHAR(32),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_catalog_items_unique UNIQUE (group_code, code),
  CONSTRAINT app_catalog_items_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX IF NOT EXISTS app_catalog_items_group_idx
  ON app_catalog_items (group_code, status, sort_order);

DROP TRIGGER IF EXISTS app_catalog_items_set_updated_at ON app_catalog_items;
CREATE TRIGGER app_catalog_items_set_updated_at
  BEFORE UPDATE ON app_catalog_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO app_catalog_items (group_code, code, label, summary, glyph, tone, meta, sort_order)
VALUES
  ('amc_offer', 'complete', 'Complete AMC for Full Plant / Factory',
   'Covers EVERYTHING — Switchgear, Automation, Drives, Cables, Earthing, Transformers & more. Single contract, single price, full coverage.',
   'plant', NULL,
   '{"ribbon":"RECOMMENDED — ZERO TENSION","ribbonNote":"Full Coverage","tags":["All equipment","24x7 breakdown","Priority response"],"benefits":["Best value — up to 25% saving vs separate contracts","One single point of accountability","Dedicated account manager assigned"]}',
   1),

  ('amc_equipment', 'ht_lt_panel', 'HT/LT Panel', 'Main switchgear, MCC, PCC', 'device', NULL, '{}', 1),
  ('amc_equipment', 'plc_scada_hmi', 'PLC / SCADA / HMI', 'Automation systems', 'scada', NULL, '{}', 2),
  ('amc_equipment', 'vfd_servo', 'VFD / Servo Drives', 'All drives in plant', 'settings', NULL, '{}', 3),
  ('amc_equipment', 'earthing_safety', 'Earthing & Safety', 'Earth pits, lightning arresters', 'globe', NULL, '{}', 4),
  ('amc_equipment', 'transformer', 'Transformer', 'Oil filtration, testing', 'bolt', NULL, '{}', 5),
  ('amc_equipment', 'cable_network', 'Cable Network', 'HT/LT cables, fiber, LAN', 'cable', NULL, '{}', 6),

  ('amc_contract_type', 'annual', 'Annual — 12 visits', 'Monthly preventive maintenance', 'calendar', NULL, '{}', 1),
  ('amc_contract_type', 'quarterly', 'Quarterly — 4 visits', 'Every 3 months', 'sync', NULL, '{}', 2),
  ('amc_contract_type', 'half_yearly', 'Half-yearly — 2 visits', 'Every 6 months', 'cover', NULL, '{}', 3),
  ('amc_contract_type', 'comprehensive', 'Comprehensive 24x7', 'Visits + unlimited breakdown', 'rush', NULL, '{}', 4),

  ('amc_plant_field', 'plantArea', 'Plant Area (sq ft)', NULL, NULL, NULL, '{"placeholder":"e.g. 20,000 sqft","required":true}', 1),
  ('amc_plant_field', 'connectedLoad', 'Connected Load (kVA)', NULL, NULL, NULL, '{"placeholder":"e.g. 500 kVA","required":true}', 2),
  ('amc_plant_field', 'siteCount', 'Number of Sites', NULL, NULL, NULL, '{"placeholder":"e.g. 1 plant + 1 warehouse","required":true}', 3),
  ('amc_plant_field', 'specialRequirements', 'Special Requirements (optional)', NULL, NULL, NULL, '{"placeholder":"Specific equipment, response time, special compliance needs...","multiline":true}', 4),

  ('amc_next_step', 'review', 'Team Review', 'Zypli team reviews your request — within 4 hours', NULL, NULL, '{}', 1),
  ('amc_next_step', 'assessment', 'Site Assessment', 'Engineer visits your plant for equipment survey', NULL, NULL, '{"noteNew":"(if needed)","noteOther":"(not required)"}', 2),
  ('amc_next_step', 'quote', 'Custom Quote Prepared', 'Tailored quote based on your needs — within 48 hours', NULL, NULL, '{}', 3),
  ('amc_next_step', 'contact', 'Sales Team Contacts You', 'Via WhatsApp + Email + Call to discuss & finalise', NULL, NULL, '{}', 4),

  ('amc_reschedule_reason', 'shutdown', 'Plant shutdown / holiday', NULL, NULL, NULL, '{}', 1),
  ('amc_reschedule_reason', 'production', 'Production schedule conflict', NULL, NULL, NULL, '{}', 2),
  ('amc_reschedule_reason', 'engineer', 'Engineer unavailable', NULL, NULL, NULL, '{}', 3),
  ('amc_reschedule_reason', 'access', 'Site access issue', NULL, NULL, NULL, '{}', 4),
  ('amc_reschedule_reason', 'other', 'Other reason', NULL, NULL, NULL, '{}', 5),

  ('amc_visit_time', '0900', '09:00', NULL, NULL, NULL, '{}', 1),
  ('amc_visit_time', '1000', '10:00', NULL, NULL, NULL, '{}', 2),
  ('amc_visit_time', '1100', '11:00', NULL, NULL, NULL, '{}', 3),
  ('amc_visit_time', '1300', '13:00', NULL, NULL, NULL, '{}', 4),
  ('amc_visit_time', '1400', '14:00', NULL, NULL, NULL, '{}', 5),
  ('amc_visit_time', '1500', '15:00', NULL, NULL, NULL, '{}', 6),
  ('amc_visit_time', '1600', '16:00', NULL, NULL, NULL, '{}', 7),

  ('emergency_problem', 'mcc_panel_tripped', 'MCC / Panel Tripped', NULL, NULL, NULL, '{}', 1),
  ('emergency_problem', 'motor_failure', 'Motor / Machine Failure', NULL, NULL, NULL, '{}', 2),
  ('emergency_problem', 'plc_fault', 'PLC Fault', NULL, NULL, NULL, '{}', 3),
  ('emergency_problem', 'ht_lt_line', 'HT/LT Line Issue', NULL, NULL, NULL, '{}', 4),
  ('emergency_problem', 'power_failure', 'Complete Power Failure', NULL, NULL, NULL, '{}', 5),
  ('emergency_problem', 'vfd_fault', 'VFD/Drive Fault', NULL, NULL, NULL, '{}', 6),
  ('emergency_problem', 'transformer', 'Transformer Issue', NULL, NULL, NULL, '{}', 7),
  ('emergency_problem', 'other', 'Other', NULL, NULL, NULL, '{"custom":true}', 8),

  ('emergency_sla', 'critical', 'Critical +500', '30 min', NULL, 'emergency', '{"minutes":30}', 1),
  ('emergency_sla', 'urgent', 'Urgent +250', '60 min', NULL, 'pending', '{"minutes":60}', 2),
  ('emergency_sla', 'standard', 'Standard', '120 min', NULL, 'success', '{"minutes":120}', 3),

  ('compliance_audit', 'is5216', 'IS 5216 Electrical Safety', 'Full electrical safety audit & certificate', 'cert', NULL, '{"query":"Electrical Safety Audit"}', 1),
  ('compliance_audit', 'fire', 'Fire NOC Compliance', 'Electrical compliance for fire NOC', 'cert', NULL, '{"query":"Electrical Safety Audit"}', 2),
  ('compliance_audit', 'energy', 'Energy Audit', 'Load analysis, savings recommendation', 'cert', NULL, '{"query":"Electrical Safety Audit"}', 3),
  ('compliance_audit', 'arc', 'Arc Flash Study', 'NFPA 70E, PPE category recommendation', 'cert', NULL, '{"query":"Electrical Safety Audit"}', 4),
  ('compliance_audit', 'thermo', 'Thermography Audit', 'Hotspot detection in panels & cables', 'cert', NULL, '{"query":"Electrical Safety Audit"}', 5),

  ('hardware_type', 'vfd', 'VFD', NULL, NULL, NULL, '{}', 1),
  ('hardware_type', 'motor_dol', 'Motor (DOL)', NULL, NULL, NULL, '{}', 2),
  ('hardware_type', 'motor_star_delta', 'Motor (Star-Delta)', NULL, NULL, NULL, '{}', 3),
  ('hardware_type', 'soft_starter', 'Soft Starter', NULL, NULL, NULL, '{}', 4),
  ('hardware_type', 'servo_drive', 'Servo Drive', NULL, NULL, NULL, '{}', 5),
  ('hardware_type', 'dc_drive', 'DC Drive', NULL, NULL, NULL, '{}', 6),
  ('hardware_type', 'other', 'Other', NULL, NULL, NULL, '{}', 7),

  ('industry', 'manufacturing_textile', 'Manufacturing / Textile', NULL, NULL, NULL, '{}', 1),
  ('industry', 'textile_manufacturing', 'Textile Manufacturing', NULL, NULL, NULL, '{}', 2),
  ('industry', 'manufacturing', 'Manufacturing', NULL, NULL, NULL, '{}', 3),
  ('industry', 'facilities', 'Facilities management', NULL, NULL, NULL, '{}', 4),
  ('industry', 'healthcare', 'Healthcare', NULL, NULL, NULL, '{}', 5),
  ('industry', 'logistics', 'Logistics', NULL, NULL, NULL, '{}', 6),
  ('industry', 'construction', 'Construction', NULL, NULL, NULL, '{}', 7),
  ('industry', 'energy', 'Energy', NULL, NULL, NULL, '{}', 8),
  ('industry', 'hospitality', 'Hospitality', NULL, NULL, NULL, '{}', 9),
  ('industry', 'retail', 'Retail', NULL, NULL, NULL, '{}', 10),

  ('account_role', 'DIRECTOR_OWNER', 'Director / Owner', 'Approvals', 'briefcase', NULL, '{}', 1),
  ('account_role', 'MAINTENANCE_HEAD', 'Maintenance Head', 'Book & manage', 'wrench', NULL, '{}', 2),
  ('account_role', 'PURCHASE_MGR', 'Purchase Mgr', 'Hardware orders', 'cart', NULL, '{}', 3),
  ('account_role', 'SITE_ENGINEER', 'Site Engineer', 'Track & report', 'user', NULL, '{}', 4),

  ('faq_category', 'account', 'Account', NULL, 'user', 'info', '{}', 1),
  ('faq_category', 'billing', 'Billing', NULL, 'book', 'market', '{}', 2),
  ('faq_category', 'technical', 'Technical', NULL, 'wrench', 'repair', '{}', 3),
  ('faq_category', 'services', 'Services', NULL, 'calendar', 'amc', '{}', 4),
  ('faq_category', 'company', 'Company', NULL, 'pin', 'project', '{}', 5),

  ('faq', 'otp', 'I did not receive my OTP',
   'Confirm your phone or email is correct, wait for the resend timer, then request a fresh OTP. If it still fails, message support with your registered contact so we can check delivery.',
   NULL, NULL, '{"category":"account","keywords":["otp","login","verify","sms","email","code"]}', 1),
  ('faq', 'profile-role', 'How do I update my profile or role?',
   'Open Profile from the dashboard avatar. You can update your name, contact details, and avatar. Role changes may require your workspace admin — use Message support if your role looks wrong.',
   NULL, NULL, '{"category":"account","keywords":["profile","role","name","avatar","settings"]}', 2),
  ('faq', 'sessions', 'Sign out other devices',
   'Go to Security → Active sessions and revoke sessions you do not recognize. You stay signed in on this device until you sign out here.',
   NULL, NULL, '{"category":"account","keywords":["session","logout","device","security"]}', 3),
  ('faq', 'invoice', 'Where is my GST invoice?',
   'Completed jobs and marketplace orders include GST details when your company profile has a valid GSTIN. Check the job or order detail screen, or ask support to resend documents.',
   NULL, NULL, '{"category":"billing","keywords":["invoice","gst","bill","receipt","payment"]}', 4),
  ('faq', 'marketplace-pay', 'Marketplace checkout or payment issues',
   'Verify your cart items and company selection, then retry checkout. If payment succeeded but the order is missing, message support with the order reference or time of payment.',
   NULL, NULL, '{"category":"billing","keywords":["marketplace","cart","checkout","pay","order"]}', 5),
  ('faq', 'gst-company', 'Fix company or GST details',
   'Company and GST details belong to your selected workspace. GSTIN must be 15 characters. Edit from Company details in onboarding or profile, or contact support if the legal name must change.',
   NULL, NULL, '{"category":"company","keywords":["company","gst","gstin","workspace","firm"]}', 6),
  ('faq', 'sites-gps', 'Sites and GPS location',
   'Allow location permission when adding a site, or enter latitude and longitude manually. Edit saved sites from the Sites screen. Pin your primary site so the dashboard shows the correct plant.',
   NULL, NULL, '{"category":"company","keywords":["site","gps","location","latitude","longitude","plant"]}', 7),
  ('faq', 'service-status', 'Track a service request',
   'Open Jobs from the bottom navigation to see active and recent work. Quick Services and Emergency flows create jobs you can follow there. Share the job code with support if something is missing.',
   NULL, NULL, '{"category":"services","keywords":["job","status","track","engineer","request","service"]}', 8),
  ('faq', 'emergency', 'When to use Emergency',
   'Use Emergency when production is stopped or there is a safety risk. For planned work, use Quick Services or Projects. Emergency requests are prioritized and appear under Jobs.',
   NULL, NULL, '{"category":"services","keywords":["emergency","urgent","down","breakdown"]}', 9),
  ('faq', 'amc', 'AMC plans and visits',
   'Browse AMC from the bottom bar to view plans, request cover, or reschedule visits. Contract status and upcoming visits show on the AMC screens and dashboard metrics.',
   NULL, NULL, '{"category":"services","keywords":["amc","contract","maintenance","visit","cover"]}', 10),
  ('faq', 'attachments', 'Upload photos or documents',
   'Repair, project, and some service flows let you attach photos from the device gallery. If upload fails, check network connection and file size, then retry or send files via Message support.',
   NULL, NULL, '{"category":"technical","keywords":["photo","image","attachment","upload","file"]}', 11),
  ('faq', 'api-keys', 'API keys and integrations',
   'API keys are managed under API Keys in profile settings. Rotate or revoke keys you no longer use. For integration help, message support with your use case — do not share secret keys in chat.',
   NULL, NULL, '{"category":"technical","keywords":["api","key","integration","developer"]}', 12)
ON CONFLICT (group_code, code) DO UPDATE
SET label = EXCLUDED.label,
    summary = EXCLUDED.summary,
    glyph = EXCLUDED.glyph,
    tone = EXCLUDED.tone,
    meta = EXCLUDED.meta,
    sort_order = EXCLUDED.sort_order,
    status = 'active';

ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS intro TEXT;

UPDATE service_categories AS c
SET intro = v.intro
FROM (VALUES
  ('electrician', 'Select the type of electrical work needed. A certified electrician will be matched for your site.'),
  ('panel_mcc', 'Select panel type — a certified engineer will be matched for your specific panel.'),
  ('cabling', 'Repair, re-termination or rework of existing cabling. For new cable installation projects, use Projects → New Cable Installation.'),
  ('vfd_servo', 'Select the drive work needed. The engineer is matched from the make and model.'),
  ('plc', 'Select the control-system work. A certified specialist will be matched for your site.')
) AS v(code, intro)
WHERE c.code = v.code;
