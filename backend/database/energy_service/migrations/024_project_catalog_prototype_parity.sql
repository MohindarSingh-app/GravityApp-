ALTER TABLE project_requests
  DROP CONSTRAINT IF EXISTS project_requests_type_category_fkey;

UPDATE project_types AS project_type
SET category_id = category.id,
    name = mapping.name,
    sort_order = mapping.sort_order,
    active = TRUE
FROM (
  VALUES
    ('mcc_panel', 'electrical', 'New MCC Panel', 1),
    ('control_panel', 'electrical', 'New Control Panel', 2),
    ('distribution_board', 'electrical', 'New Distribution Board', 3),
    ('apfc_capacitor_bank', 'electrical', 'New APFC / Capacitor Bank', 4),
    ('earthing', 'electrical', 'New Earthing System', 5),
    ('vfd_panel', 'automation', 'New VFD Panel', 1),
    ('plc', 'automation', 'New PLC System', 2),
    ('vfd_installation', 'automation', 'New VFD Installation', 3),
    ('hmi_scada', 'automation', 'New HMI / SCADA', 4),
    ('servo', 'automation', 'New Servo System', 5),
    ('power_cable_layout', 'cabling', 'New Power Cable Layout', 1),
    ('fiber_network', 'cabling', 'New Fiber Network', 2),
    ('lan_structured_cabling', 'cabling', 'New LAN / Structured Cabling', 3),
    ('machine_electrical_connection', 'plant_expansion', 'New Machine Connection', 1),
    ('complete_plant_electrical_setup', 'plant_expansion', 'Full Plant Electrical Setup', 2),
    ('factory_relocation_rewiring', 'plant_expansion', 'Factory Relocation / Rewiring', 3)
) AS mapping(type_code, category_code, name, sort_order)
JOIN project_categories AS category ON category.code = mapping.category_code
WHERE project_type.code = mapping.type_code;

UPDATE project_types
SET active = FALSE
WHERE code = 'plant_expansion';

UPDATE project_types
SET active = FALSE
WHERE code NOT IN (
  'mcc_panel', 'control_panel', 'distribution_board', 'apfc_capacitor_bank', 'earthing',
  'vfd_panel', 'plc', 'vfd_installation', 'hmi_scada', 'servo',
  'power_cable_layout', 'fiber_network', 'lan_structured_cabling',
  'machine_electrical_connection', 'complete_plant_electrical_setup',
  'factory_relocation_rewiring'
);

UPDATE project_requests AS request
SET category_id = project_type.category_id
FROM project_types AS project_type
WHERE request.project_type_id = project_type.id
  AND request.category_id IS DISTINCT FROM project_type.category_id;

UPDATE project_categories
SET name = CASE code
      WHEN 'electrical' THEN 'Electrical Projects'
      WHEN 'automation' THEN 'Automation Projects'
      WHEN 'cabling' THEN 'New Cable Installation'
      WHEN 'plant_expansion' THEN 'Plant Expansion'
      ELSE name
    END,
    sort_order = CASE code
      WHEN 'electrical' THEN 1
      WHEN 'automation' THEN 2
      WHEN 'cabling' THEN 3
      WHEN 'plant_expansion' THEN 4
      ELSE sort_order
    END,
    active = code IN ('electrical', 'automation', 'cabling', 'plant_expansion');

ALTER TABLE project_requests
  ADD CONSTRAINT project_requests_type_category_fkey
  FOREIGN KEY (project_type_id, category_id)
  REFERENCES project_types (id, category_id);
