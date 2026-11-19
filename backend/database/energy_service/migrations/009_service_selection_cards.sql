UPDATE service_steps s
SET summary = 'Select the type of electrical work. A certified electrician will be matched for the site.'
FROM service_categories c
WHERE c.id = s.category_id
  AND c.code = 'electrician'
  AND s.code = 'work_type';

UPDATE service_options opt
SET status = 'inactive',
    updated_at = NOW()
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE opt.step_id = s.id
  AND c.code = 'electrician'
  AND s.code = 'work_type'
  AND opt.status = 'active';

INSERT INTO service_options (step_id, code, name, summary, icon_key, sort_order, status)
SELECT s.id, choice.code, choice.name, choice.summary, choice.icon_key, choice.sort_order, 'active'
FROM service_categories c
JOIN service_steps s ON s.category_id = c.id AND s.code = 'work_type'
CROSS JOIN (VALUES
  ('power_distribution', 'Power Distribution / DB Panel', 'MCB tripping, phase fault, no supply, DB issue', 'bolt', 1),
  ('industrial_wiring', 'Industrial Wiring / Cabling', 'Loose connection, wire cut, short circuit, rewiring', 'cable', 2),
  ('motor_wiring', 'Motor / Machine Wiring', 'Motor not starting, burnt wiring, control circuit fault', 'settings', 3),
  ('industrial_lighting', 'Industrial Lighting', 'Lights not working, flickering, fixture/driver damaged', 'bulb', 4),
  ('earthing', 'Earthing / Earth Fault', 'Shock from equipment, earth leakage, RCD tripping', 'globe', 5),
  ('generator', 'Generator / DG Set', 'DG not starting, ATS fault, changeover issue, low voltage', 'battery', 6),
  ('breakdown', 'Breakdown / Emergency', 'Complete power failure, sparking/fire, burning smell', 'alert', 7)
) AS choice(code, name, summary, icon_key, sort_order)
WHERE c.code = 'electrician'
  AND NOT EXISTS (
    SELECT 1
    FROM service_options existing
    WHERE existing.step_id = s.id
      AND existing.code = choice.code
  );

UPDATE service_options opt
SET name = choice.name,
    summary = choice.summary,
    icon_key = choice.icon_key,
    sort_order = choice.sort_order,
    status = 'active',
    updated_at = NOW()
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
CROSS JOIN (VALUES
  ('mcc', 'MCC — Motor Control Centre', 'Motor feeder fault, contactor, overload relay', 'device', 1),
  ('vfd_panel', 'VFD Panel / Control Panel', 'Panel wiring, control circuit fault', 'bolt', 2),
  ('busbar', 'Busbar / ACB / VCB', 'Air/vacuum circuit breaker, busbar fault', 'bolt', 3),
  ('capacitor', 'Capacitor Bank / APFC', 'Power factor correction, capacitor fault', 'battery', 4),
  ('control_wiring', 'Control Panel Wiring', 'New build, rewiring, modification', 'cable', 5)
) AS choice(code, name, summary, icon_key, sort_order)
WHERE opt.step_id = s.id
  AND c.code = 'panel_mcc'
  AND s.code = 'panel_type'
  AND choice.code = opt.code;

UPDATE service_options opt
SET icon_key = choice.icon_key,
    updated_at = NOW()
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
CROSS JOIN (VALUES
  ('power_ht_lt', 'cable'),
  ('instrumentation', 'cable'),
  ('fiber', 'globe'),
  ('lan', 'grid')
) AS choice(code, icon_key)
WHERE opt.step_id = s.id
  AND c.code = 'cabling'
  AND s.code = 'cable_type'
  AND choice.code = opt.code;

UPDATE service_steps s
SET title = 'Cable type',
    summary = 'Choose the existing cable type that needs repair, re-termination, or rework.'
FROM service_categories c
WHERE c.id = s.category_id
  AND c.code = 'cabling'
  AND s.code = 'cable_type';

UPDATE service_options opt
SET icon_key = choice.icon_key,
    updated_at = NOW()
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
CROSS JOIN (VALUES
  ('vfd_fault', 'alert'),
  ('servo_fault', 'settings'),
  ('speed_control', 'speed'),
  ('parameters', 'save'),
  ('dc_drive', 'bolt'),
  ('communication', 'sync'),
  ('breakdown', 'alert')
) AS choice(code, icon_key)
WHERE opt.step_id = s.id
  AND c.code = 'vfd_servo'
  AND s.code = 'work_type'
  AND choice.code = opt.code;
