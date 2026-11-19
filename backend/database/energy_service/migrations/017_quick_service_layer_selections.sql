-- Restore Quick Service layer-by-layer selections from the marketplace prototype.
-- Each work type keeps its own next select. Older rows stay inactive so past bookings keep their labels.

UPDATE service_categories
SET name = CASE code
      WHEN 'plc' THEN 'PLC / HMI / SCADA'
      WHEN 'vfd_servo' THEN 'VFD / Servo Drive'
      WHEN 'cabling' THEN 'Cable Repair / Fix'
      ELSE name
    END,
    summary = CASE code
      WHEN 'electrician' THEN 'Wiring • panel fault • earthing'
      WHEN 'plc' THEN 'Error • fault • programming'
      WHEN 'vfd_servo' THEN 'Drive fault or error — engineer visits'
      WHEN 'panel_mcc' THEN 'Panel fault • wiring • busbar'
      WHEN 'cabling' THEN 'Existing HT/LT • fiber • LAN — fault or rework'
      ELSE summary
    END,
    sort_order = CASE code
      WHEN 'electrician' THEN 1
      WHEN 'plc' THEN 2
      WHEN 'vfd_servo' THEN 3
      WHEN 'panel_mcc' THEN 4
      WHEN 'cabling' THEN 5
      ELSE sort_order
    END,
    updated_at = NOW()
WHERE code IN ('electrician', 'plc', 'vfd_servo', 'panel_mcc', 'cabling');

-- Electrician: the seven work types, each with its own fault-tag select.
UPDATE service_options svc_option
SET status = 'inactive',
    updated_at = NOW()
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
WHERE svc_option.step_id = step.id
  AND category.code = 'electrician'
  AND step.code = 'work_type';

UPDATE service_options svc_option
SET name = choice.name,
    summary = choice.summary,
    icon_key = choice.icon_key,
    sort_order = choice.sort_order,
    status = 'active',
    next_action = NULL,
    next_action_label = NULL,
    updated_at = NOW()
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('power_distribution', 'Power Distribution / DB Panel', 'MCB tripping, phase fault, no supply, DB issue', 'bolt', 1),
  ('industrial_wiring', 'Industrial Wiring / Cabling', 'Loose connection, wire cut, short circuit, rewiring', 'cable', 2),
  ('motor_wiring', 'Motor / Machine Wiring', 'Motor not starting, burnt wiring, control circuit fault', 'settings', 3),
  ('industrial_lighting', 'Industrial Lighting', 'Lights not working, flickering, fixture/driver damaged', 'bulb', 4),
  ('earthing', 'Earthing / Earth Fault', 'Shock from equipment, earth leakage, RCD tripping', 'globe', 5),
  ('generator', 'Generator / DG Set', 'DG not starting, ATS fault, changeover issue, low voltage', 'battery', 6),
  ('breakdown', 'Breakdown / Emergency', 'Complete power failure, sparking/fire, burning smell', 'alert', 7)
) AS choice(code, name, summary, icon_key, sort_order)
WHERE svc_option.step_id = step.id
  AND category.code = 'electrician'
  AND step.code = 'work_type'
  AND choice.code = svc_option.code;

UPDATE service_steps step
SET status = 'inactive',
    updated_at = NOW()
FROM service_categories category
WHERE step.category_id = category.id
  AND category.code = 'electrician'
  AND step.code <> 'work_type'
  AND step.code NOT LIKE 'issue_%';

UPDATE service_steps step
SET title = 'Describe the issue',
    summary = 'Select the fault tags and add any details about the fault or work needed.',
    status = 'active',
    updated_at = NOW()
FROM service_categories category
WHERE step.category_id = category.id
  AND category.code = 'electrician'
  AND step.code LIKE 'issue_%';

UPDATE service_form_fields field
SET label = 'Fault Tags',
    status = 'active',
    updated_at = NOW()
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
WHERE field.step_id = step.id
  AND category.code = 'electrician'
  AND step.code LIKE 'issue_%'
  AND field.field_key = 'fault_tags';

UPDATE service_form_fields field
SET label = 'Additional details (optional)',
    placeholder = 'Describe the issue in more detail...',
    status = 'active',
    updated_at = NOW()
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
WHERE field.step_id = step.id
  AND category.code = 'electrician'
  AND step.code LIKE 'issue_%'
  AND field.field_key = 'additional_details';

-- VFD / Servo: work type first, then that type's own fault tags and make select.
UPDATE service_options svc_option
SET status = 'inactive',
    updated_at = NOW()
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
WHERE svc_option.step_id = step.id
  AND category.code = 'vfd_servo'
  AND step.code = 'work_type';

UPDATE service_options svc_option
SET name = choice.name,
    summary = choice.summary,
    icon_key = choice.icon_key,
    sort_order = choice.sort_order,
    status = 'active',
    next_action = NULL,
    next_action_label = NULL,
    updated_at = NOW()
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('vfd_fault', 'VFD Fault / Not Running', 'Fault code on display, trip, no output, drive not starting', 'alert', 1),
  ('servo_fault', 'Servo Drive / Amplifier Fault', 'Servo alarm, position error, encoder fault, axis not moving', 'settings', 2),
  ('speed_control', 'Motor Speed / Control Issue', 'Wrong speed, not accelerating, hunting, unstable output', 'speed', 3),
  ('parameters', 'Parameter / Programming Issue', 'Parameters lost, wrong settings, need commissioning', 'save', 4),
  ('dc_drive', 'DC Drive / Thyristor Fault', 'DC drive tripping, thyristor fault, armature issue', 'bolt', 5),
  ('communication', 'Communication Fault', 'Fieldbus error, no response from PLC, Modbus/Profibus issue', 'sync', 6),
  ('breakdown', 'Breakdown / Production Stopped', 'Complete failure, machine down, urgent fault', 'alert', 7)
) AS choice(code, name, summary, icon_key, sort_order)
WHERE svc_option.step_id = step.id
  AND category.code = 'vfd_servo'
  AND step.code = 'work_type'
  AND choice.code = svc_option.code;

UPDATE service_steps step
SET status = 'inactive',
    updated_at = NOW()
FROM service_categories category
WHERE step.category_id = category.id
  AND category.code = 'vfd_servo'
  AND step.code <> 'work_type'
  AND step.code NOT IN (
    'details_vfd_fault', 'details_servo_fault', 'details_speed_control',
    'details_parameters', 'details_dc_drive', 'details_communication', 'details_breakdown'
  );

UPDATE service_steps step
SET title = 'Describe the issue',
    summary = 'Select the fault tags for this drive work, then choose the make and model.',
    status = 'active',
    updated_at = NOW()
FROM service_categories category
WHERE step.category_id = category.id
  AND category.code = 'vfd_servo'
  AND step.code IN (
    'details_vfd_fault', 'details_servo_fault', 'details_speed_control',
    'details_parameters', 'details_dc_drive', 'details_communication', 'details_breakdown'
  );

UPDATE service_form_fields field
SET label = CASE field.field_key
      WHEN 'fault_tags' THEN 'Fault Tags'
      WHEN 'fault_code' THEN 'Fault Code on display (if any)'
      WHEN 'make' THEN 'Make'
      WHEN 'specify_make' THEN 'Specify Make'
      WHEN 'drive_model' THEN 'Model (if known)'
      ELSE field.label
    END,
    placeholder = CASE field.field_key
      WHEN 'fault_code' THEN 'e.g. OC1, OV, F0001, AL-11'
      WHEN 'specify_make' THEN 'Enter the drive brand'
      WHEN 'drive_model' THEN 'e.g. ACS550, G120, J1000, MR-J4'
      ELSE field.placeholder
    END,
    help_text = CASE field.field_key
      WHEN 'drive_model' THEN 'Find model on drive nameplate • Optional field'
      ELSE field.help_text
    END,
    status = 'active',
    updated_at = NOW()
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
WHERE field.step_id = step.id
  AND category.code = 'vfd_servo'
  AND step.code LIKE 'details_%'
  AND field.field_key IN ('fault_tags', 'fault_code', 'make', 'specify_make', 'drive_model');

UPDATE service_field_options choice
SET summary = hint.summary,
    status = 'active'
FROM service_form_fields field
JOIN service_steps step ON step.id = field.step_id
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('abb', 'e.g. ACS550, ACS580, ACS880, ACH580'),
  ('allen_bradley_rockwell', 'e.g. PowerFlex 525, PowerFlex 755, Kinetix'),
  ('danfoss', 'e.g. VLT FC 302, VLT AQUA, FC 102'),
  ('delta_electronics', 'e.g. MS300, CP2000, C2000, ASD-A2'),
  ('fuji_electric', 'e.g. FRENIC-MEGA, FRENIC-Ace, FRENIC-Mini'),
  ('innovative', 'e.g. iDrive series, iServo'),
  ('l_t_l_k', 'e.g. SX2000, SX4000, AURA-E'),
  ('mitsubishi_electric', 'e.g. FR-A800, FR-D700, MR-J4, MR-J5'),
  ('schneider_electric', 'e.g. ATV320, ATV630, ATV930, Lexium'),
  ('siemens', 'e.g. SINAMICS G120, V20, S210, MM440'),
  ('other', 'e.g. Enter model number')
) AS hint(value, summary)
WHERE choice.field_id = field.id
  AND category.code = 'vfd_servo'
  AND step.code LIKE 'details_%'
  AND field.field_key = 'make'
  AND hint.value = choice.value;

-- PLC / HMI / SCADA: work type, then that type's own make select, then its own fault tags.
UPDATE service_steps step
SET status = 'inactive',
    updated_at = NOW()
FROM service_categories category
WHERE step.category_id = category.id
  AND category.code = 'plc'
  AND step.code NOT IN ('work_type')
  AND step.code NOT LIKE 'plc_make_%'
  AND step.code NOT LIKE 'plc_issue_%';

INSERT INTO service_steps (category_id, code, title, summary, step_kind, sort_order, status)
SELECT category.id, 'work_type', 'What work is needed?',
       'Select the PLC, HMI, or SCADA work. A certified specialist will be matched for your site.',
       'choice', 1, 'active'
FROM service_categories category
WHERE category.code = 'plc'
ON CONFLICT (category_id, code) DO UPDATE
SET title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    step_kind = EXCLUDED.step_kind,
    parent_option_id = NULL,
    follows_step_id = NULL,
    sort_order = EXCLUDED.sort_order,
    status = 'active',
    updated_at = NOW();

INSERT INTO service_options (step_id, code, name, summary, icon_key, sort_order, status)
SELECT step.id, choice.code, choice.name, choice.summary, choice.icon_key, choice.sort_order, 'active'
FROM service_categories category
JOIN service_steps step ON step.category_id = category.id AND step.code = 'work_type'
JOIN (VALUES
  ('fault', 'PLC Fault / Not Running', 'CPU fault, I/O error, program stop, communication loss', 'alert', 1),
  ('hmi', 'HMI / Touchscreen Issue', 'Screen blank, touch not working, display error, no communication', 'hmi', 2),
  ('program', 'Program / Logic Issue', 'Wrong output, sequence fault, logic error, parameter reset', 'save', 3),
  ('comm', 'Communication / Network Fault', 'Profibus/Profinet error, Modbus fault, network down, device offline', 'sync', 4),
  ('scada', 'SCADA / Industrial PC Issue', 'Software crash, data loss, screen freeze, OPC error', 'scada', 5),
  ('io', 'I/O Module / Card Fault', 'Input/output not reading, card error, analog fault, sensor issue', 'cable', 6),
  ('breakdown', 'Breakdown / Production Stopped', 'Complete line down, machine not responding, urgent fault', 'rush', 7)
) AS choice(code, name, summary, icon_key, sort_order) ON TRUE
WHERE category.code = 'plc'
ON CONFLICT (step_id, code) DO UPDATE
SET name = EXCLUDED.name,
    summary = EXCLUDED.summary,
    icon_key = EXCLUDED.icon_key,
    sort_order = EXCLUDED.sort_order,
    status = 'active',
    updated_at = NOW();

INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT category.id, root_option.id, 'plc_make_' || root_option.code, 'What make/brand?',
       'Choose the make. The model field follows the brand you select.',
       'form', 2, 'active'
FROM service_categories category
JOIN service_steps root_step ON root_step.category_id = category.id AND root_step.code = 'work_type'
JOIN service_options root_option ON root_option.step_id = root_step.id AND root_option.status = 'active'
WHERE category.code = 'plc'
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
  ('make', 'Make/Brand', 'select', FALSE, NULL, NULL, 1),
  ('specify_make', 'Specify Make', 'text', FALSE, 'e.g., Your PLC brand name', NULL, 2),
  ('model', 'Model (if known)', 'text', FALSE, 'e.g. S7-1200, ControlLogix, FX5U', 'Find model on device nameplate • Optional field', 3)
) AS field(field_key, label, field_type, required, placeholder, help_text, sort_order)
WHERE category.code = 'plc'
  AND step.code LIKE 'plc_make_%'
ON CONFLICT (step_id, field_key) DO UPDATE
SET label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    required = EXCLUDED.required,
    placeholder = EXCLUDED.placeholder,
    help_text = EXCLUDED.help_text,
    sort_order = EXCLUDED.sort_order,
    status = 'active',
    updated_at = NOW();

INSERT INTO service_form_fields (step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status)
SELECT step.id, 'screen_size', 'Screen Size', 'select', TRUE, NULL, NULL, 4, 'active'
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
WHERE category.code = 'plc'
  AND step.code = 'plc_make_hmi'
ON CONFLICT (step_id, field_key) DO UPDATE
SET label = EXCLUDED.label,
    field_type = EXCLUDED.field_type,
    required = EXCLUDED.required,
    sort_order = EXCLUDED.sort_order,
    status = 'active',
    updated_at = NOW();

INSERT INTO service_form_fields (step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status)
SELECT step.id, 'screen_size_other', 'Screen Size', 'text', FALSE, 'Enter screen size (e.g. 8", 21")', NULL, 5, 'active'
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
WHERE category.code = 'plc'
  AND step.code = 'plc_make_hmi'
ON CONFLICT (step_id, field_key) DO UPDATE
SET label = EXCLUDED.label,
    placeholder = EXCLUDED.placeholder,
    required = EXCLUDED.required,
    sort_order = EXCLUDED.sort_order,
    status = 'active',
    updated_at = NOW();

INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT field.id, make.value, make.label, make.summary, make.sort_order, 'active'
FROM service_form_fields field
JOIN service_steps step ON step.id = field.step_id
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('abb', 'ABB', 'e.g. AC500, AC800M, Freelance, 800xA HMI', 1),
  ('allen_bradley', 'Allen-Bradley (Rockwell Automation)', 'e.g. ControlLogix, CompactLogix, PanelView', 2),
  ('delta', 'Delta Electronics', 'e.g. DVP-SS2, AS300, DOP-H series', 3),
  ('fuji', 'Fuji Electric', 'e.g. SPF, SPH series, Monitouch HMI', 4),
  ('innovative', 'Innovative', 'e.g. iPLC, iHMI series', 5),
  ('lt', 'L&T (Larsen & Toubro)', 'e.g. LK series, Selecta PLC', 6),
  ('messung', 'Messung', 'e.g. Nexgen 5000, XM series, MX HMI', 7),
  ('mitsubishi', 'Mitsubishi Electric', 'e.g. FX5U, Q series, iQ-R, GOT2000', 8),
  ('rishabh', 'Rishabh Instruments', 'e.g. Rish-PLC, Conzerv HMI', 9),
  ('schneider', 'Schneider Electric (Modicon)', 'e.g. M221, M340, Quantum, Magelis HMI', 10),
  ('selec', 'Selec Controls', 'e.g. MFM, PIC, XM series PLC', 11),
  ('siemens', 'Siemens', 'e.g. S7-1200, S7-1500, KTP HMI, WinCC', 12),
  ('other', 'Other Make', 'e.g. Enter model number', 13)
) AS make(value, label, summary, sort_order)
WHERE category.code = 'plc'
  AND step.code LIKE 'plc_make_%'
  AND field.field_key = 'make'
ON CONFLICT (field_id, value) DO UPDATE
SET label = EXCLUDED.label,
    summary = EXCLUDED.summary,
    sort_order = EXCLUDED.sort_order,
    status = 'active';

INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT field.id, size.value, size.label, NULL, size.sort_order, 'active'
FROM service_form_fields field
JOIN service_steps step ON step.id = field.step_id
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('3_5', '3.5"', 1),
  ('4_3', '4.3"', 2),
  ('5_7', '5.7"', 3),
  ('7', '7"', 4),
  ('10_1', '10.1"', 5),
  ('12', '12"', 6),
  ('15', '15"', 7),
  ('other', 'Other', 8)
) AS size(value, label, sort_order)
WHERE category.code = 'plc'
  AND step.code = 'plc_make_hmi'
  AND field.field_key = 'screen_size'
ON CONFLICT (field_id, value) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    status = 'active';

INSERT INTO service_steps (category_id, follows_step_id, code, title, summary, step_kind, sort_order, status)
SELECT category.id, make_step.id, 'plc_issue_' || root_option.code, 'Describe the issue',
       'Fault tags for this work type only.',
       'form', 3, 'active'
FROM service_categories category
JOIN service_steps root_step ON root_step.category_id = category.id AND root_step.code = 'work_type'
JOIN service_options root_option ON root_option.step_id = root_step.id AND root_option.status = 'active'
JOIN service_steps make_step ON make_step.category_id = category.id AND make_step.code = 'plc_make_' || root_option.code
WHERE category.code = 'plc'
ON CONFLICT (category_id, code) DO UPDATE
SET parent_option_id = NULL,
    follows_step_id = EXCLUDED.follows_step_id,
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
  ('fault_tags', 'Fault Tags', 'multiselect', FALSE, NULL, NULL, 1),
  ('error_code', 'Error Code (if shown on screen)', 'text', FALSE, 'e.g. OB1, F0001, Communication Error 80A2', NULL, 2),
  ('additional_details', 'Additional details (optional)', 'textarea', FALSE, 'What was happening before the fault? Any recent changes?', NULL, 3)
) AS field(field_key, label, field_type, required, placeholder, help_text, sort_order)
WHERE category.code = 'plc'
  AND step.code LIKE 'plc_issue_%'
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
SELECT field.id, tag.value, tag.label, NULL, tag.sort_order, 'active'
FROM service_form_fields field
JOIN service_steps step ON step.id = field.step_id
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('plc_issue_fault', 'cpu_fault_light', 'CPU fault light on', 1),
  ('plc_issue_fault', 'program_stopped', 'Program stopped', 2),
  ('plc_issue_fault', 'io_error_display', 'I/O error on display', 3),
  ('plc_issue_fault', 'power_supply_fault', 'Power supply fault', 4),
  ('plc_issue_fault', 'battery_low', 'Battery low / dead', 5),
  ('plc_issue_fault', 'module_error', 'Module error', 6),
  ('plc_issue_fault', 'watchdog_timeout', 'Watchdog timeout', 7),
  ('plc_issue_hmi', 'screen_blank', 'Screen completely blank', 1),
  ('plc_issue_hmi', 'touch_not_responding', 'Touch not responding', 2),
  ('plc_issue_hmi', 'display_garbage', 'Display showing garbage', 3),
  ('plc_issue_hmi', 'no_plc_communication', 'No communication with PLC', 4),
  ('plc_issue_hmi', 'hmi_restarting', 'HMI restarting itself', 5),
  ('plc_issue_hmi', 'partial_screen_damage', 'Partial screen damage', 6),
  ('plc_issue_hmi', 'password_lost', 'Password/access lost', 7),
  ('plc_issue_program', 'wrong_machine_output', 'Wrong machine output', 1),
  ('plc_issue_program', 'sequence_not_running', 'Sequence not running', 2),
  ('plc_issue_program', 'output_not_on', 'Output not turning on', 3),
  ('plc_issue_program', 'incorrect_analog', 'Incorrect analog value', 4),
  ('plc_issue_program', 'program_corrupted', 'Program corrupted', 5),
  ('plc_issue_program', 'parameters_reset', 'Parameters reset to default', 6),
  ('plc_issue_program', 'logic_mismatch', 'Logic not matching', 7),
  ('plc_issue_comm', 'profibus_profinet', 'Profibus/Profinet error', 1),
  ('plc_issue_comm', 'modbus_lost', 'Modbus communication lost', 2),
  ('plc_issue_comm', 'device_offline', 'Device showing offline', 3),
  ('plc_issue_comm', 'network_timeout', 'Network timeout', 4),
  ('plc_issue_comm', 'multiple_nodes', 'Multiple nodes failing', 5),
  ('plc_issue_comm', 'gateway_fault', 'Gateway fault', 6),
  ('plc_issue_comm', 'bus_error', 'Bus error', 7),
  ('plc_issue_scada', 'software_crashed', 'SCADA software crashed', 1),
  ('plc_issue_scada', 'data_not_logging', 'Data not logging', 2),
  ('plc_issue_scada', 'screen_frozen', 'Screen frozen', 3),
  ('plc_issue_scada', 'opc_server_error', 'OPC server error', 4),
  ('plc_issue_scada', 'tags_not_updating', 'Tags not updating', 5),
  ('plc_issue_scada', 'historian_fault', 'Historian fault', 6),
  ('plc_issue_scada', 'remote_access_down', 'Remote access down', 7),
  ('plc_issue_io', 'digital_input', 'Digital input not reading', 1),
  ('plc_issue_io', 'digital_output_stuck', 'Digital output stuck', 2),
  ('plc_issue_io', 'analog_fault', 'Analog 4-20mA fault', 3),
  ('plc_issue_io', 'encoder_error', 'Encoder/counter error', 4),
  ('plc_issue_io', 'card_led_fault', 'Card LED showing fault', 5),
  ('plc_issue_io', 'module_not_detected', 'Module not detected', 6),
  ('plc_issue_io', 'sensor_not_communicating', 'Sensor not communicating', 7),
  ('plc_issue_breakdown', 'production_stopped', 'Complete production stopped', 1),
  ('plc_issue_breakdown', 'machine_not_responding', 'Machine not responding to any input', 2),
  ('plc_issue_breakdown', 'all_outputs_off', 'All outputs off', 3),
  ('plc_issue_breakdown', 'multiple_alarms', 'Multiple alarms active', 4),
  ('plc_issue_breakdown', 'emergency_stop', 'Line emergency stop active', 5),
  ('plc_issue_breakdown', 'cannot_reset', 'Cannot reset fault', 6),
  ('plc_issue_breakdown', 'urgent_help', 'Urgent — immediate help needed', 7)
) AS tag(step_code, value, label, sort_order)
WHERE category.code = 'plc'
  AND step.code = tag.step_code
  AND field.field_key = 'fault_tags'
ON CONFLICT (field_id, value) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    status = 'active';
