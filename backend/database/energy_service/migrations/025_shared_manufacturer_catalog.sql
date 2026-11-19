INSERT INTO app_catalog_items (group_code, code, label, summary, sort_order)
VALUES
  ('manufacturer', 'abb', 'ABB', NULL, 1),
  ('manufacturer', 'allen_bradley_rockwell', 'Allen-Bradley (Rockwell Automation)', NULL, 2),
  ('manufacturer', 'danfoss', 'Danfoss', NULL, 3),
  ('manufacturer', 'delta_electronics', 'Delta Electronics', NULL, 4),
  ('manufacturer', 'fuji_electric', 'Fuji Electric', NULL, 5),
  ('manufacturer', 'innovative', 'Innovative', NULL, 6),
  ('manufacturer', 'lt_larsen_toubro', 'L&T (Larsen & Toubro)', NULL, 7),
  ('manufacturer', 'mitsubishi_electric', 'Mitsubishi Electric', NULL, 8),
  ('manufacturer', 'rishabh_instruments', 'Rishabh Instruments', NULL, 9),
  ('manufacturer', 'schneider_electric_modicon', 'Schneider Electric (Modicon)', NULL, 10),
  ('manufacturer', 'selec_controls', 'Selec Controls', NULL, 11),
  ('manufacturer', 'siemens', 'Siemens', NULL, 12)
ON CONFLICT (group_code, code) DO UPDATE
SET label = EXCLUDED.label, status = 'active', sort_order = EXCLUDED.sort_order;

INSERT INTO service_options (step_id, code, name, summary, sort_order, status)
SELECT step.id,
       'shared_' || brand.code,
       brand.label,
       NULL,
       100 + brand.sort_order,
       'active'
FROM service_steps step
JOIN app_catalog_items brand ON brand.group_code = 'manufacturer' AND brand.status = 'active'
WHERE step.status = 'active'
  AND step.step_kind = 'choice'
  AND (step.code ILIKE '%make%' OR step.code ILIKE '%brand%'
    OR step.title ILIKE '%make%' OR step.title ILIKE '%brand%')
  AND NOT EXISTS (
    SELECT 1
    FROM service_options existing
    WHERE existing.step_id = step.id AND lower(existing.name) = lower(brand.label)
  )
ON CONFLICT (step_id, code) DO NOTHING;

INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT field.id,
       'shared_' || brand.code,
       brand.label,
       NULL,
       100 + brand.sort_order,
       'active'
FROM service_form_fields field
JOIN service_steps step ON step.id = field.step_id
JOIN app_catalog_items brand ON brand.group_code = 'manufacturer' AND brand.status = 'active'
WHERE field.status = 'active'
  AND field.field_type = 'select'
  AND field.field_key IN ('make', 'brand', 'manufacturer')
  AND NOT EXISTS (
    SELECT 1
    FROM service_field_options existing
    WHERE existing.field_id = field.id AND lower(existing.label) = lower(brand.label)
  )
ON CONFLICT (field_id, value) DO NOTHING;
