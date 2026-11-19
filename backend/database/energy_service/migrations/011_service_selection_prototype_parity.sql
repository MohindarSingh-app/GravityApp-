-- Align the four Quick Service flows with the supplied customer-panel prototype.
-- Existing selections remain inactive so historical requests keep their labels.

UPDATE service_categories
SET name = CASE code
      WHEN 'cabling' THEN 'Cable Repair / Fix'
      WHEN 'vfd_servo' THEN 'VFD / Servo Drive'
      ELSE name
    END,
    updated_at = NOW()
WHERE code IN ('electrician', 'panel_mcc', 'cabling', 'vfd_servo');

UPDATE service_steps step
SET title = root.title,
    summary = root.summary,
    updated_at = NOW()
FROM service_categories category
JOIN (VALUES
  ('electrician', 'work_type', 'Select Work Type', 'Select the type of electrical work needed. A certified electrician will be matched for your site.'),
  ('panel_mcc', 'panel_type', 'Select Panel Type', 'Select panel type — a certified engineer will be matched for your specific panel.'),
  ('cabling', 'cable_type', 'Select Cable Type', 'Repair, re-termination or rework of existing cabling. For new cable installation projects, use Projects → New Cable Installation.'),
  ('vfd_servo', 'work_type', 'Select Drive Type', 'Select drive type — engineer will be matched based on your make and model.')
) AS root(category_code, step_code, title, summary)
  ON root.category_code = category.code
WHERE step.category_id = category.id
  AND step.code = root.step_code;

UPDATE service_steps step
SET status = 'inactive',
    updated_at = NOW()
FROM service_categories category
WHERE step.category_id = category.id
  AND category.code IN ('electrician', 'vfd_servo')
  AND step.code <> CASE category.code
    WHEN 'electrician' THEN 'work_type'
    ELSE 'work_type'
  END;

UPDATE service_options svc_option
SET status = 'inactive',
    updated_at = NOW()
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
WHERE svc_option.step_id = step.id
  AND category.code IN ('electrician', 'panel_mcc', 'cabling', 'vfd_servo')
  AND step.code IN ('work_type', 'panel_type', 'cable_type');

INSERT INTO service_options (step_id, code, name, summary, icon_key, sort_order, status, next_action, next_action_label)
SELECT step.id, choice.code, choice.name, choice.summary, choice.icon_key, choice.sort_order, 'active',
       choice.next_action, choice.next_action_label
FROM service_categories category
JOIN service_steps step ON step.category_id = category.id
JOIN (VALUES
  ('electrician', 'work_type', 'wiring', 'General Wiring & Repair', 'Fan, light, socket, switch fault', 'bulb', 1, NULL, NULL),
  ('electrician', 'work_type', 'panel', 'HT / LT Panel Work', 'Panel fault, upgrade, installation', 'device', 2, NULL, NULL),
  ('electrician', 'work_type', 'mcb', 'MCB / MCCB / RCCB Fault', 'Tripping, replacement, testing', 'bolt', 3, NULL, NULL),
  ('electrician', 'work_type', 'earthing', 'Earthing & Lightning Protection', 'Earth pit, testing, lightning arrester', 'globe', 4, NULL, NULL),
  ('electrician', 'work_type', 'cable', 'Cable Laying & Termination', 'New cable, re-routing, termination', 'cable', 5, NULL, NULL),
  ('electrician', 'work_type', 'transformer', 'Transformer Maintenance', 'Oil testing, winding check, repair', 'settings', 6, NULL, NULL),
  ('electrician', 'work_type', 'meter', 'Energy Meter / Billing Issue', 'Meter check, CT/PT, APFC', 'pulse', 7, NULL, NULL),
  ('panel_mcc', 'panel_type', 'mcc', 'MCC — Motor Control Centre', 'Motor feeder fault, contactor, overload relay', 'device', 1, NULL, NULL),
  ('panel_mcc', 'panel_type', 'vfd_panel', 'VFD Panel / Control Panel', 'Panel wiring, control circuit fault', 'bolt', 2, NULL, NULL),
  ('panel_mcc', 'panel_type', 'busbar', 'Busbar / ACB / VCB', 'Air/vacuum circuit breaker, busbar fault', 'bolt', 3, NULL, NULL),
  ('panel_mcc', 'panel_type', 'capacitor', 'Capacitor Bank / APFC', 'Power factor correction, capacitor fault', 'battery', 4, NULL, NULL),
  ('panel_mcc', 'panel_type', 'control_wiring', 'Control Panel Wiring', 'New build, rewiring, modification', 'cable', 5, NULL, NULL),
  ('cabling', 'cable_type', 'power_ht_lt', 'Power Cable — HT / LT', 'Existing cable fault, re-jointing, re-termination', 'cable', 1, NULL, NULL),
  ('cabling', 'cable_type', 'instrumentation', 'Instrumentation Cabling', 'Control, signal, sensor cables — fault / rework', 'cable', 2, NULL, NULL),
  ('cabling', 'cable_type', 'fiber', 'Fiber Optic', 'Splicing, link fault, OTDR testing', 'globe', 3, NULL, NULL),
  ('cabling', 'cable_type', 'lan', 'Structured LAN / Network', 'CAT6 fault, patch panel re-termination, port issue', 'grid', 4, NULL, NULL),
  ('vfd_servo', 'work_type', 'vfd', 'VFD — Variable Frequency Drive', 'ABB, Siemens, Danfoss, Schneider, Delta, Yaskawa', 'settings', 1, NULL, NULL),
  ('vfd_servo', 'work_type', 'servo', 'Servo Drive & Motor', 'Siemens, Yaskawa, Mitsubishi, Fanuc, Delta', 'settings', 2, NULL, NULL),
  ('vfd_servo', 'work_type', 'dc', 'DC Drive', 'ABB DCS, Eurotherm, Siemens SIMOREG', 'bolt', 3, NULL, NULL),
  ('vfd_servo', 'work_type', 'motor', 'Motor', 'AC, DC, Servo, Submersible, Brake motor', 'settings', 4, NULL, NULL)
) AS choice(category_code, step_code, code, name, summary, icon_key, sort_order, next_action, next_action_label)
  ON category.code = choice.category_code
 AND step.code = choice.step_code
ON CONFLICT (step_id, code) DO UPDATE
SET name = EXCLUDED.name,
    summary = EXCLUDED.summary,
    icon_key = EXCLUDED.icon_key,
    sort_order = EXCLUDED.sort_order,
    status = 'active',
    next_action = EXCLUDED.next_action,
    next_action_label = EXCLUDED.next_action_label,
    updated_at = NOW();

UPDATE service_steps step
SET status = 'inactive',

    updated_at = NOW()
FROM service_categories category
WHERE step.category_id = category.id
  AND category.code = 'electrician'
  AND step.code LIKE 'issue_%';

INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT category.id, root_option.id, 'details_electrician_' || root_option.code, 'Describe the Problem',
       'Select symptoms and add any details about the fault or work needed.', 'form', 2, 'active'
FROM service_categories category
JOIN service_steps root_step ON root_step.category_id = category.id AND root_step.code = 'work_type'
JOIN service_options root_option ON root_option.step_id = root_step.id
WHERE category.code = 'electrician'
  AND root_option.code IN ('wiring', 'panel', 'mcb', 'earthing', 'cable', 'transformer', 'meter')
ON CONFLICT (category_id, code) DO UPDATE
SET parent_option_id = EXCLUDED.parent_option_id,
    follows_step_id = NULL,
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    step_kind = EXCLUDED.step_kind,
    sort_order = EXCLUDED.sort_order,
    status = 'active',
    updated_at = NOW();

INSERT INTO service_form_fields (step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status)
SELECT step.id, field.field_key, field.label, field.field_type, field.required, field.placeholder, field.help_text, field.sort_order, 'active'
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('symptoms', 'Symptoms', 'multiselect', FALSE, NULL, NULL, 1),
  ('description', 'Description', 'textarea', FALSE, 'Any additional details about the fault or work needed...', NULL, 2)
) AS field(field_key, label, field_type, required, placeholder, help_text, sort_order)
WHERE category.code = 'electrician'
  AND step.code LIKE 'details_electrician_%'
ON CONFLICT (step_id, field_key) DO UPDATE
SET label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    required = EXCLUDED.required,
    placeholder = EXCLUDED.placeholder,
    help_text = EXCLUDED.help_text,
    sort_order = EXCLUDED.sort_order,
    status = 'active',
    updated_at = NOW();

UPDATE service_form_fields field
SET status = 'inactive',
    updated_at = NOW()
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
WHERE field.step_id = step.id
  AND category.code = 'electrician'
  AND step.code LIKE 'details_electrician_%'
  AND field.field_key = 'fault_tags';

UPDATE service_field_options choice
SET status = 'inactive'
FROM service_form_fields field
JOIN service_steps step ON step.id = field.step_id
JOIN service_categories category ON category.id = step.category_id
WHERE choice.field_id = field.id
  AND category.code = 'electrician'
  AND step.code LIKE 'details_electrician_%'
  AND field.field_key IN ('symptoms', 'fault_tags');

INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT field.id, symptom.value, symptom.label, NULL, symptom.sort_order, 'active'
FROM service_form_fields field
JOIN service_steps step ON step.id = field.step_id
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('wiring', 'no_power_socket', 'No power at socket / switch', 1),
  ('wiring', 'sparking', 'Sparking from wire or fitting', 2),
  ('wiring', 'wire_broken', 'Wire broken / cut', 3),
  ('wiring', 'short_circuit', 'Short circuit', 4),
  ('wiring', 'burning_smell', 'Burning smell from wiring', 5),
  ('wiring', 'switch_not_working', 'Switch not working', 6),
  ('wiring', 'light_fan_not_working', 'Light / fan not working', 7),
  ('wiring', 'new_wiring', 'New wiring required', 8),
  ('panel', 'phase_fault', 'Phase fault / phase loss', 1),
  ('panel', 'overload_trip', 'Overload trip', 2),
  ('panel', 'busbar_fault', 'Busbar loose / overheating', 3),
  ('panel', 'metering_fault', 'Indicator / metering not working', 4),
  ('panel', 'panel_overheating', 'Panel overheating', 5),
  ('panel', 'breaker_fault', 'ACB / VCB not closing', 6),
  ('panel', 'contactor_fault', 'Contactor fault', 7),
  ('panel', 'new_panel', 'New panel installation', 8),
  ('mcb', 'tripping_load', 'Tripping on load', 1),
  ('mcb', 'nuisance_tripping', 'Nuisance tripping (no overload)', 2),
  ('mcb', 'cannot_reset', 'Cannot reset / re-close', 3),
  ('mcb', 'leakage_current', 'Leakage current detected', 4),
  ('mcb', 'breaker_damaged', 'Breaker physically damaged', 5),
  ('mcb', 'replacement_upgrade', 'Replacement / upgrade needed', 6),
  ('mcb', 'breaker_overheating', 'Overheating at breaker', 7),
  ('earthing', 'equipment_shock', 'Shock feeling on equipment body', 1),
  ('earthing', 'high_resistance', 'Earth resistance too high', 2),
  ('earthing', 'pit_damaged', 'Earthing pit damaged / dry', 3),
  ('earthing', 'arrester_fault', 'Lightning arrester faulty', 4),
  ('earthing', 'rccb_tripping', 'RCCB tripping due to earth fault', 5),
  ('earthing', 'compliance_certificate', 'Compliance certificate required', 6),
  ('earthing', 'new_installation', 'New installation needed', 7),
  ('cable', 'new_cable_laying', 'New cable laying required', 1),
  ('cable', 'cable_damaged', 'Cable damaged / cut', 2),
  ('cable', 'termination_fault', 'Termination loose / faulty', 3),
  ('cable', 'insulation_fault', 'Insulation fault / breakdown', 4),
  ('cable', 'tray_conduit', 'Cable tray / conduit work', 5),
  ('cable', 'ht_jointing', 'HT cable jointing needed', 6),
  ('cable', 'megger_testing', 'Megger testing required', 7),
  ('transformer', 'oil_leakage', 'Oil leakage', 1),
  ('transformer', 'overheating', 'Overheating / high temperature', 2),
  ('transformer', 'noise_vibration', 'Humming / vibration noise', 3),
  ('transformer', 'voltage_fluctuation', 'Voltage fluctuation on output', 4),
  ('transformer', 'winding_fault', 'Winding fault / burning smell', 5),
  ('transformer', 'buchholz_trip', 'Buchholz relay tripped', 6),
  ('transformer', 'oil_service', 'Oil filtration / replacement needed', 7),
  ('transformer', 'routine_maintenance', 'Routine maintenance / testing', 8),
  ('meter', 'high_consumption', 'High consumption / high bill', 1),
  ('meter', 'meter_inaccurate', 'Meter not reading correctly', 2),
  ('meter', 'ct_pt_fault', 'CT / PT fault or mismatch', 3),
  ('meter', 'apfc_fault', 'APFC panel not working', 4),
  ('meter', 'power_factor_penalty', 'Power factor penalty on bill', 5),
  ('meter', 'display_fault', 'Meter display blank / faulty', 6),
  ('meter', 'new_meter', 'New meter installation needed', 7),
  ('meter', 'energy_audit', 'Energy audit required', 8)
) AS symptom(work_code, value, label, sort_order)
WHERE category.code = 'electrician'
  AND step.code = 'details_electrician_' || symptom.work_code
  AND field.step_id = step.id
  AND field.field_key = 'symptoms'
ON CONFLICT (field_id, value) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    status = 'active';

INSERT INTO service_steps (category_id, follows_step_id, code, title, summary, step_kind, sort_order, status)
SELECT category.id, root_step.id, 'electrician_urgency', 'Urgency', 'How soon do you need the electrician?', 'form', 3, 'active'
FROM service_categories category
JOIN service_steps root_step ON root_step.category_id = category.id AND root_step.code = 'work_type'
WHERE category.code = 'electrician'
ON CONFLICT (category_id, code) DO UPDATE
SET parent_option_id = NULL,
    follows_step_id = EXCLUDED.follows_step_id,
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    step_kind = EXCLUDED.step_kind,
    sort_order = EXCLUDED.sort_order,
    status = 'active',
    updated_at = NOW();

INSERT INTO service_form_fields (step_id, field_key, label, field_type, required, sort_order, status)
SELECT step.id, 'urgency', 'Urgency', 'select', TRUE, 1, 'active'
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
WHERE category.code = 'electrician' AND step.code = 'electrician_urgency'
ON CONFLICT (step_id, field_key) DO UPDATE
SET label = EXCLUDED.label, field_type = EXCLUDED.field_type, required = EXCLUDED.required, status = 'active';

INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT field.id, urgency.value, urgency.label, urgency.summary, urgency.sort_order, 'active'
FROM service_form_fields field
JOIN service_steps step ON step.id = field.step_id
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('planned', 'Planned', 'Schedule it', 1),
  ('urgent', 'Urgent', 'Need today', 2),
  ('emergency', 'Emergency', 'Production down', 3)
) AS urgency(value, label, summary, sort_order)
WHERE category.code = 'electrician'
  AND step.code = 'electrician_urgency'
  AND field.field_key = 'urgency'
ON CONFLICT (field_id, value) DO UPDATE
SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, status = 'active';

-- VFD / Servo: root drive selection -> make -> work type -> details.
INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT category.id, drive.id, 'drive_make_' || drive.code,
       CASE drive.code
         WHEN 'vfd' THEN 'Select VFD Brand'
         WHEN 'servo' THEN 'Select Servo Brand'
         ELSE 'Select DC Drive Brand'
       END,
       'Choose the drive make or brand.', 'choice', 2, 'active'
FROM service_categories category
JOIN service_steps root_step ON root_step.category_id = category.id AND root_step.code = 'work_type'
JOIN service_options drive ON drive.step_id = root_step.id
WHERE category.code = 'vfd_servo'
  AND drive.code IN ('vfd', 'servo', 'dc')
ON CONFLICT (category_id, code) DO UPDATE
SET parent_option_id = EXCLUDED.parent_option_id,
    follows_step_id = NULL,
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    step_kind = EXCLUDED.step_kind,
    sort_order = EXCLUDED.sort_order,
    status = 'active',
    updated_at = NOW();

INSERT INTO service_options (step_id, code, name, summary, icon_key, sort_order, status)
SELECT make_step.id, brand.code, brand.name, brand.summary, 'settings', brand.sort_order, 'active'
FROM service_categories category
JOIN service_steps make_step ON make_step.category_id = category.id
CROSS JOIN (VALUES
  ('vfd', 'abb', 'ABB', 'ACS310 / ACS355 / ACS550 / ACS880', 1),
  ('vfd', 'siemens', 'Siemens SINAMICS', 'G120 / G120C / G150 / S120 / V20', 2),
  ('vfd', 'danfoss', 'Danfoss', 'FC51 / FC102 / FC202 / FC302 / VLT', 3),
  ('vfd', 'schneider', 'Schneider Altivar', 'ATV12 / ATV31 / ATV71 / ATV320 / ATV630', 4),
  ('vfd', 'delta', 'Delta', 'VFD-E / VFD-M / VFD-C / VFD-EL', 5),
  ('vfd', 'yaskawa', 'Yaskawa', 'V1000 / A1000 / J1000 / GA700', 6),
  ('vfd', 'lt', 'L&T', 'VFD series', 7),
  ('vfd', 'other', 'Other Make', 'Hitachi, Mitsubishi, Fuji, Emerson etc.', 8),
  ('servo', 'siemens', 'Siemens SINAMICS', 'S210 / S120 / V90 / 1FK / 1FT motors', 1),
  ('servo', 'yaskawa', 'Yaskawa Sigma', 'Sigma-7 / Sigma-5 / GP series', 2),
  ('servo', 'mitsubishi', 'Mitsubishi MELSERVO', 'MR-J4 / MR-J3 / MR-JE series', 3),
  ('servo', 'fanuc', 'Fanuc', 'Alpha-i / Beta-i series', 4),
  ('servo', 'delta', 'Delta ASDA', 'ASDA-A2 / ASDA-B2 / ASDA-A3', 5),
  ('servo', 'other', 'Other Make', 'Panasonic, Omron, Lenze, Bosch etc.', 6),
  ('dc', 'abb', 'ABB DCS', 'DCS550 / DCS800 series', 1),
  ('dc', 'eurotherm', 'Eurotherm', '590P / 590+ / 690+ series', 2),
  ('dc', 'siemens', 'Siemens SIMOREG', 'DC Master 6RA70 / 6RA80', 3),
  ('dc', 'gefran', 'Gefran', 'SIEIDrive series', 4),
  ('dc', 'other', 'Other Make', 'Meiden, Control Techniques etc.', 5)
) AS brand(drive_code, code, name, summary, sort_order)
WHERE category.code = 'vfd_servo'
  AND make_step.code = 'drive_make_' || brand.drive_code
ON CONFLICT (step_id, code) DO UPDATE
SET name = EXCLUDED.name,
    summary = EXCLUDED.summary,
    icon_key = EXCLUDED.icon_key,
    sort_order = EXCLUDED.sort_order,
    status = 'active',
    updated_at = NOW();

INSERT INTO service_steps (category_id, follows_step_id, code, title, summary, step_kind, sort_order, status)
SELECT category.id, make_step.id, 'drive_work_' || drive.code, 'What do you need?',
       'Select installation or fault repair.', 'choice', 3, 'active'
FROM service_categories category
JOIN service_steps root_step ON root_step.category_id = category.id AND root_step.code = 'work_type'
JOIN service_options drive ON drive.step_id = root_step.id
JOIN service_steps make_step ON make_step.category_id = category.id AND make_step.code = 'drive_make_' || drive.code
WHERE category.code = 'vfd_servo'
  AND drive.code IN ('vfd', 'servo', 'dc')
ON CONFLICT (category_id, code) DO UPDATE
SET parent_option_id = NULL,
    follows_step_id = EXCLUDED.follows_step_id,
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    step_kind = EXCLUDED.step_kind,
    sort_order = EXCLUDED.sort_order,
    status = 'active',
    updated_at = NOW();

INSERT INTO service_options (step_id, code, name, summary, icon_key, sort_order, status)
SELECT work_step.id, work.code, work.name, work.summary, work.icon_key, work.sort_order, 'active'
FROM service_categories category
JOIN service_steps work_step ON work_step.category_id = category.id
CROSS JOIN (VALUES
  ('install', 'New Installation', 'Hardware available — need installation & commissioning', 'settings', 1),
  ('fault', 'Existing — Fault / Repair', 'Not working, error showing, tripping', 'alert', 2)
) AS work(code, name, summary, icon_key, sort_order)
WHERE category.code = 'vfd_servo'
  AND work_step.code IN ('drive_work_vfd', 'drive_work_servo', 'drive_work_dc')
ON CONFLICT (step_id, code) DO UPDATE
SET name = EXCLUDED.name, summary = EXCLUDED.summary, icon_key = EXCLUDED.icon_key,
    sort_order = EXCLUDED.sort_order, status = 'active', updated_at = NOW();

INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT category.id, drive.id, 'motor_work_type', 'What do you need?',
       'Select the motor service required.', 'choice', 2, 'active'
FROM service_categories category
JOIN service_steps root_step ON root_step.category_id = category.id AND root_step.code = 'work_type'
JOIN service_options drive ON drive.step_id = root_step.id AND drive.code = 'motor'
WHERE category.code = 'vfd_servo'
ON CONFLICT (category_id, code) DO UPDATE
SET parent_option_id = EXCLUDED.parent_option_id,
    follows_step_id = NULL,
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    step_kind = EXCLUDED.step_kind,
    sort_order = EXCLUDED.sort_order,
    status = 'active',
    updated_at = NOW();

INSERT INTO service_options (step_id, code, name, summary, icon_key, sort_order, status)
SELECT work_step.id, work.code, work.name, work.summary, work.icon_key, work.sort_order, 'active'
FROM service_categories category
JOIN service_steps work_step ON work_step.category_id = category.id AND work_step.code = 'motor_work_type'
CROSS JOIN (VALUES
  ('install', 'New Motor Installation', 'New motor — need installation, alignment & wiring', 'settings', 1),
  ('fault', 'Existing Motor — Fault / Repair', 'Not starting, overheating, noise, winding fault', 'alert', 2),
  ('rewind', 'Motor Rewinding', 'Burnt winding — needs rewinding service', 'sync', 3)
) AS work(code, name, summary, icon_key, sort_order)
WHERE category.code = 'vfd_servo'
ON CONFLICT (step_id, code) DO UPDATE
SET name = EXCLUDED.name, summary = EXCLUDED.summary, icon_key = EXCLUDED.icon_key,
    sort_order = EXCLUDED.sort_order, status = 'active', updated_at = NOW();

INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT category.id, work.id, 'motor_type_' || work.code, 'Motor Type',
       'Select the motor type.', 'choice', 4, 'active'
FROM service_categories category
JOIN service_steps work_step ON work_step.category_id = category.id AND work_step.code = 'motor_work_type'
JOIN service_options work ON work.step_id = work_step.id AND work.code IN ('install', 'fault')
WHERE category.code = 'vfd_servo'
ON CONFLICT (category_id, code) DO UPDATE
SET parent_option_id = EXCLUDED.parent_option_id,
    follows_step_id = NULL,
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    step_kind = EXCLUDED.step_kind,
    sort_order = EXCLUDED.sort_order,
    status = 'active',
    updated_at = NOW();

INSERT INTO service_options (step_id, code, name, summary, icon_key, sort_order, status)
SELECT type_step.id, motor_type.code, motor_type.name, motor_type.summary, motor_type.icon_key, motor_type.sort_order, 'active'
FROM service_categories category
JOIN service_steps type_step ON type_step.category_id = category.id
CROSS JOIN (VALUES
  ('ac_induction', 'AC Induction Motor', '3-phase / single phase squirrel cage', 'settings', 1),
  ('dc_motor', 'DC Motor', 'Separately excited / permanent magnet', 'bolt', 2),
  ('submersible', 'Submersible Pump Motor', NULL, 'plant', 3),
  ('brake_motor', 'Brake Motor', NULL, 'settings', 4)
) AS motor_type(code, name, summary, icon_key, sort_order)
WHERE category.code = 'vfd_servo'
  AND type_step.code IN ('motor_type_install', 'motor_type_fault')
ON CONFLICT (step_id, code) DO UPDATE
SET name = EXCLUDED.name, summary = EXCLUDED.summary, icon_key = EXCLUDED.icon_key,
    sort_order = EXCLUDED.sort_order, status = 'active', updated_at = NOW();

INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT category.id, work.id, 'vfd_detail_' || drive.code || '_' || work.code,
       CASE work.code WHEN 'install' THEN 'Rating & Installation' ELSE 'Rating & Fault Details' END,
       'Add the drive rating and service details.', 'form', 4, 'active'
FROM service_categories category
JOIN service_steps root_step ON root_step.category_id = category.id AND root_step.code = 'work_type'
JOIN service_options drive ON drive.step_id = root_step.id AND drive.code IN ('vfd', 'servo', 'dc')
JOIN service_steps work_step ON work_step.category_id = category.id AND work_step.code = 'drive_work_' || drive.code
JOIN service_options work ON work.step_id = work_step.id AND work.code IN ('install', 'fault')
WHERE category.code = 'vfd_servo'
ON CONFLICT (category_id, code) DO UPDATE
SET parent_option_id = EXCLUDED.parent_option_id,
    follows_step_id = NULL,
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    step_kind = EXCLUDED.step_kind,
    sort_order = EXCLUDED.sort_order,
    status = 'active',
    updated_at = NOW();

INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT category.id, motor_type.id, 'motor_detail_' || work.code || '_' || motor_type.code,
       CASE work.code WHEN 'install' THEN 'Rating & Application' ELSE 'Rating & Problem' END,
       'Add the motor rating and service details.', 'form', 5, 'active'
FROM service_categories category
JOIN service_steps work_step ON work_step.category_id = category.id AND work_step.code = 'motor_work_type'
JOIN service_options work ON work.step_id = work_step.id AND work.code IN ('install', 'fault')
JOIN service_steps type_step ON type_step.category_id = category.id AND type_step.code = 'motor_type_' || work.code
JOIN service_options motor_type ON motor_type.step_id = type_step.id
WHERE category.code = 'vfd_servo'
ON CONFLICT (category_id, code) DO UPDATE
SET parent_option_id = EXCLUDED.parent_option_id,
    follows_step_id = NULL,
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    step_kind = EXCLUDED.step_kind,
    sort_order = EXCLUDED.sort_order,
    status = 'active',
    updated_at = NOW();

INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT category.id, work.id, 'motor_rewind_details', 'Motor Rewinding',
       'Motor rewinding is done at our workshop. Our team will pick up the motor, rewind it with correct gauge wire, test, and return.',
       'form', 4, 'active'
FROM service_categories category
JOIN service_steps work_step ON work_step.category_id = category.id AND work_step.code = 'motor_work_type'
JOIN service_options work ON work.step_id = work_step.id AND work.code = 'rewind'
WHERE category.code = 'vfd_servo'
ON CONFLICT (category_id, code) DO UPDATE
SET parent_option_id = EXCLUDED.parent_option_id,
    follows_step_id = NULL,
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    step_kind = EXCLUDED.step_kind,
    sort_order = EXCLUDED.sort_order,
    status = 'active',
    updated_at = NOW();

INSERT INTO service_form_fields (step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status)
SELECT step.id, field.field_key, field.label, field.field_type, field.required, field.placeholder, field.help_text, field.sort_order, 'active'
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('rating_kw', 'Motor Rating (kW)', 'select', FALSE, NULL, NULL, 1),
  ('hardware_list', 'Hardware / Equipment List', 'textarea', FALSE, 'List each drive, rating (kW), make / brand, and application.', 'For additional items, add one item per line.', 2),
  ('problem_type', 'What is the problem?', 'select', FALSE, NULL, NULL, 3),
  ('error_code', 'Error Code shown on display', 'text', FALSE, 'e.g. F0001, OC, OV, E005...', 'Enter exactly as shown — helps engineer bring right spare parts.', 4),
  ('application', 'Application', 'select', FALSE, NULL, NULL, 5),
  ('description', 'Description', 'textarea', FALSE, 'Add any additional details...', NULL, 6),
  ('rewind_details', 'Motor details', 'textarea', FALSE, 'Motor rating, make / brand, and pickup details...', NULL, 1)
) AS field(field_key, label, field_type, required, placeholder, help_text, sort_order)
WHERE category.code = 'vfd_servo'
  AND (
    (step.code LIKE 'vfd_detail_%' AND field.field_key IN ('rating_kw', 'hardware_list', 'problem_type', 'error_code', 'description'))
    OR (step.code LIKE 'motor_detail_%' AND field.field_key IN ('rating_kw', 'problem_type', 'error_code', 'application', 'description'))
    OR (step.code = 'motor_rewind_details' AND field.field_key = 'rewind_details')
  )
ON CONFLICT (step_id, field_key) DO UPDATE
SET label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    required = EXCLUDED.required,
    placeholder = EXCLUDED.placeholder,
    help_text = EXCLUDED.help_text,
    sort_order = EXCLUDED.sort_order,
    status = 'active',
    updated_at = NOW();

INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT field.id, field_option.value, field_option.label, field_option.summary, field_option.sort_order, 'active'
FROM service_form_fields field
JOIN service_steps step ON step.id = field.step_id
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('rating_kw', '0.37', '0.37', NULL, 1),
  ('rating_kw', '0.75', '0.75', NULL, 2),
  ('rating_kw', '1.5', '1.5', NULL, 3),
  ('rating_kw', '2.2', '2.2', NULL, 4),
  ('rating_kw', '4', '4', NULL, 5),
  ('rating_kw', '5.5', '5.5', NULL, 6),
  ('rating_kw', '7.5', '7.5', NULL, 7),
  ('rating_kw', '11', '11', NULL, 8),
  ('rating_kw', '15', '15', NULL, 9),
  ('rating_kw', '22', '22', NULL, 10),
  ('rating_kw', '37', '37', NULL, 11),
  ('rating_kw', '55', '55', NULL, 12),
  ('rating_kw', '75', '75', NULL, 13),
  ('rating_kw', '90', '90', NULL, 14),
  ('rating_kw', '110', '110', NULL, 15),
  ('rating_kw', '132_plus', '132+', NULL, 16),
  ('problem_type', 'dead', 'Dead — no display, no response', NULL, 1),
  ('problem_type', 'display', 'Display not coming', NULL, 2),
  ('problem_type', 'error_code', 'Error code showing', 'Fault code on display', 3),
  ('problem_type', 'trip', 'Tripping on load', NULL, 4),
  ('problem_type', 'fire', 'Burnt / fire from cable', NULL, 5),
  ('problem_type', 'speed', 'Wrong speed / not controlling', NULL, 6),
  ('problem_type', 'communication', 'Communication fault', NULL, 7),
  ('application', 'pump', 'Pump', NULL, 1),
  ('application', 'fan_blower', 'Fan / Blower', NULL, 2),
  ('application', 'conveyor', 'Conveyor', NULL, 3),
  ('application', 'compressor', 'Compressor', NULL, 4),
  ('application', 'other', 'Other', NULL, 5)
) AS field_option(field_key, value, label, summary, sort_order)
WHERE category.code = 'vfd_servo'
  AND field.field_key = field_option.field_key
  AND (
    (step.code LIKE 'vfd_detail_%' AND field.field_key IN ('rating_kw', 'problem_type'))
    OR (step.code LIKE 'motor_detail_%' AND field.field_key IN ('rating_kw', 'problem_type', 'application'))
  )
ON CONFLICT (field_id, value) DO UPDATE
SET label = EXCLUDED.label,
    summary = EXCLUDED.summary,
    sort_order = EXCLUDED.sort_order,
    status = 'active';

-- Restore the cable form layer order after older migrations that added legacy forms.
UPDATE service_steps step
SET title = CASE
      WHEN step.code LIKE 'scope_%' THEN 'Step 2 — Scope of Work'
      WHEN step.code LIKE 'urgency_%' THEN 'Step 3 — Urgency'
      ELSE step.title
    END,
    updated_at = NOW()
FROM service_categories category
WHERE step.category_id = category.id
  AND category.code = 'cabling'
  AND (step.code LIKE 'scope_%' OR step.code LIKE 'urgency_%');

UPDATE service_steps step
SET title = 'What do you need?',
    summary = 'Choose the service needed for this panel type.',
    updated_at = NOW()
FROM service_categories category
WHERE step.category_id = category.id
  AND category.code = 'panel_mcc'
  AND step.code IN ('mcc_work_type', 'busbar_work_type', 'capacitor_work_type', 'control_work_type', 'vfd_panel_work_type');

UPDATE service_options svc_option
SET name = CASE svc_option.code
      WHEN 'fault_repair' THEN 'Fault / Repair'
      WHEN 'new_mcc_panel' THEN 'New MCC Panel'
      WHEN 'new_vfd_panel' THEN 'New VFD Panel'
      WHEN 'annual_maintenance' THEN 'Annual Maintenance'
      WHEN 'power_factor_assessment' THEN 'Power Factor Assessment'
      WHEN 'new_wiring' THEN 'New Wiring / Build'
      WHEN 'fault_troubleshoot' THEN 'Fault / Troubleshoot'
      ELSE svc_option.name
    END,
    updated_at = NOW()
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
WHERE svc_option.step_id = step.id
  AND category.code = 'panel_mcc'
  AND step.code IN ('mcc_work_type', 'busbar_work_type', 'capacitor_work_type', 'control_work_type', 'vfd_panel_work_type');

UPDATE service_steps step
SET title = 'Step 2 — Describe the Problem',
    updated_at = NOW()
FROM service_categories category
WHERE step.category_id = category.id
  AND category.code = 'electrician'
  AND step.code LIKE 'details_electrician_%';

UPDATE service_steps step
SET title = 'Step 2 — Scope of Work',
    updated_at = NOW()
FROM service_categories category
WHERE step.category_id = category.id
  AND category.code = 'cabling'
  AND step.code LIKE 'scope_%';

UPDATE service_steps step
SET title = 'Step 3 — Urgency',
    updated_at = NOW()
FROM service_categories category
WHERE step.category_id = category.id
  AND category.code = 'cabling'
  AND step.code LIKE 'urgency_%';

UPDATE service_steps step
SET title = 'Step 3 — Fault Details',
    updated_at = NOW()
FROM service_categories category
WHERE step.category_id = category.id
  AND category.code = 'panel_mcc'
  AND step.code IN ('mcc_details', 'vfd_panel_details', 'busbar_details', 'capacitor_details', 'control_details');

INSERT INTO service_form_fields (step_id, field_key, label, field_type, required, sort_order, status)
SELECT step.id, 'urgency', 'Urgency', 'select', TRUE, 99, 'active'
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
WHERE category.code = 'panel_mcc'
  AND step.code IN ('mcc_details', 'vfd_panel_details', 'busbar_details', 'capacitor_details', 'control_details')
ON CONFLICT (step_id, field_key) DO UPDATE
SET label = EXCLUDED.label, field_type = EXCLUDED.field_type, required = EXCLUDED.required,
    sort_order = EXCLUDED.sort_order, status = 'active';

INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT field.id, urgency.value, urgency.label, urgency.summary, urgency.sort_order, 'active'
FROM service_form_fields field
JOIN service_steps step ON step.id = field.step_id
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('planned', 'Planned', 'Schedule it', 1),
  ('urgent', 'Urgent', 'Need today', 2),
  ('emergency', 'Emergency', 'Production down', 3)
) AS urgency(value, label, summary, sort_order)
WHERE category.code = 'panel_mcc'
  AND step.code IN ('mcc_details', 'vfd_panel_details', 'busbar_details', 'capacitor_details', 'control_details')
  AND field.field_key = 'urgency'
ON CONFLICT (field_id, value) DO UPDATE
SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, status = 'active';

INSERT INTO service_form_fields (step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status)
SELECT step.id, 'urgency', 'Urgency', 'select', TRUE, NULL, NULL, 99, 'active'
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
WHERE category.code = 'vfd_servo'
  AND (step.code LIKE 'vfd_detail_%' OR step.code LIKE 'motor_detail_%')
ON CONFLICT (step_id, field_key) DO UPDATE
SET label = EXCLUDED.label, field_type = EXCLUDED.field_type, required = EXCLUDED.required,
    sort_order = EXCLUDED.sort_order, status = 'active';

INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT field.id, urgency.value, urgency.label, urgency.summary, urgency.sort_order, 'active'
FROM service_form_fields field
JOIN service_steps step ON step.id = field.step_id
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('planned', 'Planned', 'Schedule it', 1),
  ('urgent', 'Urgent', 'Need today', 2),
  ('emergency', 'Emergency', 'Production down', 3)
) AS urgency(value, label, summary, sort_order)
WHERE category.code = 'vfd_servo'
  AND (step.code LIKE 'vfd_detail_%' OR step.code LIKE 'motor_detail_%')
  AND field.field_key = 'urgency'
ON CONFLICT (field_id, value) DO UPDATE
SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, status = 'active';

UPDATE service_form_fields field
SET status = 'inactive',
    updated_at = NOW()
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
WHERE field.step_id = step.id
  AND category.code = 'vfd_servo'
  AND (
    (step.code LIKE 'vfd_detail_%_install' AND field.field_key IN ('problem_type', 'error_code'))
    OR (step.code LIKE 'motor_detail_install_%' AND field.field_key IN ('problem_type', 'error_code'))
  );

UPDATE service_field_options field_option
SET status = 'inactive'
FROM service_form_fields field
JOIN service_steps step ON step.id = field.step_id
JOIN service_categories category ON category.id = step.category_id
WHERE field_option.field_id = field.id
  AND category.code = 'vfd_servo'
  AND step.code LIKE 'motor_detail_fault_%'
  AND field.field_key = 'problem_type';

INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT field.id, problem.value, problem.label, problem.summary, problem.sort_order, 'active'
FROM service_form_fields field
JOIN service_steps step ON step.id = field.step_id
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('motor_not_starting', 'Motor not starting', 'No rotation on start command', 1),
  ('motor_overheating', 'Motor overheating', 'Gets very hot, thermal trip', 2),
  ('noise_vibration', 'Abnormal noise / vibration', 'Grinding, rattling, unbalanced', 3),
  ('winding_fault', 'Winding fault / earth fault', 'Short circuit, low insulation', 4),
  ('running_slow', 'Running slow / under speed', 'Below rated RPM', 5),
  ('bearing_fault', 'Bearing noise / seized', 'Bearing worn out', 6)
) AS problem(value, label, summary, sort_order)
WHERE category.code = 'vfd_servo'
  AND step.code LIKE 'motor_detail_fault_%'
  AND field.field_key = 'problem_type'
ON CONFLICT (field_id, value) DO UPDATE
SET label = EXCLUDED.label, summary = EXCLUDED.summary, sort_order = EXCLUDED.sort_order, status = 'active';

INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT field.id, 'machine', 'Machine', NULL, 5, 'active'
FROM service_form_fields field
JOIN service_steps step ON step.id = field.step_id
JOIN service_categories category ON category.id = step.category_id
WHERE category.code = 'vfd_servo'
  AND step.code LIKE 'motor_detail_install_%'
  AND field.field_key = 'application'
ON CONFLICT (field_id, value) DO UPDATE
SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, status = 'active';

UPDATE service_options svc_option
SET next_action = 'repair_center',
    next_action_label = 'Go to Repair / Rewind Center',
    updated_at = NOW()
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
WHERE svc_option.step_id = step.id
  AND category.code = 'vfd_servo'
  AND step.code = 'motor_work_type'
  AND svc_option.code = 'rewind';

INSERT INTO service_form_fields (step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status)
SELECT step.id, 'hardware_list', 'Hardware / Equipment List', 'textarea', FALSE,
       'List each motor / drive with its type, rating, make / brand, and application.', NULL, 0, 'active'
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
WHERE category.code = 'panel_mcc' AND step.code = 'mcc_details'
ON CONFLICT (step_id, field_key) DO UPDATE
SET label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    required = EXCLUDED.required,
    placeholder = EXCLUDED.placeholder,
    sort_order = EXCLUDED.sort_order,
    status = 'active';

UPDATE service_form_fields field
SET status = 'inactive',
    updated_at = NOW()
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
WHERE field.step_id = step.id
  AND category.code = 'panel_mcc'
  AND step.code = 'mcc_details'
  AND field.field_key IN ('description', 'notes');

UPDATE service_field_options choice
SET label = 'Other',
    sort_order = 6,
    status = 'active'
FROM service_form_fields field
JOIN service_steps step ON step.id = field.step_id
JOIN service_categories category ON category.id = step.category_id
WHERE choice.field_id = field.id
  AND category.code = 'vfd_servo'
  AND step.code LIKE 'motor_detail_install_%'
  AND field.field_key = 'application'
  AND choice.value = 'other';
