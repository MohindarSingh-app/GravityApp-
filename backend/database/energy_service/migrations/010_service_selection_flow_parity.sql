UPDATE service_steps step
SET status = 'inactive',
    updated_at = NOW()
FROM service_categories category
WHERE category.id = step.category_id
  AND (
    (category.code = 'electrician' AND step.code = 'problem')
    OR (category.code = 'vfd_servo' AND step.code = 'equipment')
    OR (category.code = 'cabling' AND step.code = 'cable_details')
  );

UPDATE service_categories
SET name = CASE code
      WHEN 'cabling' THEN 'Cable Repair / Fix'
      WHEN 'vfd_servo' THEN 'VFD / Servo Drive'
      ELSE name
    END,
    updated_at = NOW()
WHERE code IN ('cabling', 'vfd_servo');

UPDATE service_options svc_option
SET name = choice.name,
    summary = choice.summary,
    updated_at = NOW()
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('cabling', 'power_ht_lt', 'Power Cable — HT / LT', 'Existing cable fault, re-jointing, re-termination'),
  ('cabling', 'instrumentation', 'Instrumentation Cabling', 'Control, signal, sensor cables — fault / rework'),
  ('cabling', 'lan', 'Structured LAN / Network', 'CAT6 fault, patch panel re-termination, port issue'),
  ('vfd_servo', 'vfd_fault', 'VFD Fault / Not Running', 'Fault code on display, trip, no output, drive not starting'),
  ('vfd_servo', 'parameters', 'Parameter / Programming Issue', 'Parameters lost, wrong settings, need commissioning'),
  ('vfd_servo', 'communication', 'Communication Fault', 'Fieldbus error, no response from PLC, Modbus/Profibus issue')
) AS choice(category_code, option_code, name, summary)
WHERE svc_option.step_id = step.id
  AND category.code = choice.category_code
  AND step.code = CASE
    WHEN category.code = 'cabling' THEN 'cable_type'
    ELSE 'work_type'
  END
  AND svc_option.code = choice.option_code;

INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT category.id, svc_option.id, 'issue_' || svc_option.code, 'Describe the issue',
       'Select the fault tags and add any details for the specialist.', 'form', 2, 'active'
FROM service_categories category
JOIN service_steps parent_step ON parent_step.category_id = category.id AND parent_step.code = 'work_type'
JOIN service_options svc_option ON svc_option.step_id = parent_step.id
WHERE category.code = 'electrician'
  AND svc_option.code IN (
    'power_distribution', 'industrial_wiring', 'motor_wiring', 'industrial_lighting',
    'earthing', 'generator', 'breakdown'
  )
  AND NOT EXISTS (
    SELECT 1 FROM service_steps existing
    WHERE existing.category_id = category.id AND existing.code = 'issue_' || svc_option.code
  );

INSERT INTO service_form_fields (step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status)
SELECT step.id, 'fault_tags', 'Fault tags', 'multiselect', FALSE, NULL, NULL, 1, 'active'
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
WHERE category.code = 'electrician'
  AND step.code LIKE 'issue_%'
  AND NOT EXISTS (
    SELECT 1 FROM service_form_fields existing
    WHERE existing.step_id = step.id AND existing.field_key = 'fault_tags'
  );

INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT field.id, tag.value, tag.label, NULL, tag.sort_order, 'active'
FROM service_form_fields field
JOIN service_steps step ON step.id = field.step_id
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('power_distribution', 'mcb_rccb_tripping', 'MCB / RCCB tripping', 1),
  ('power_distribution', 'phase_missing', 'Phase missing', 2),
  ('power_distribution', 'no_power_output', 'No power output', 3),
  ('power_distribution', 'overloading', 'Overloading', 4),
  ('power_distribution', 'burnt_components', 'Burnt components in DB', 5),
  ('power_distribution', 'main_switch_fault', 'Main switch not working', 6),
  ('power_distribution', 'voltage_fluctuation', 'Voltage fluctuation', 7),
  ('industrial_wiring', 'wire_cut', 'Wire cut / broken', 1),
  ('industrial_wiring', 'loose_connection', 'Loose connection', 2),
  ('industrial_wiring', 'short_circuit', 'Short circuit', 3),
  ('industrial_wiring', 'overheating_wire', 'Overheating wire', 4),
  ('industrial_wiring', 'spark_from_joint', 'Spark from joint', 5),
  ('industrial_wiring', 'rewiring_needed', 'Rewiring needed', 6),
  ('industrial_wiring', 'cable_damaged', 'Cable damaged', 7),
  ('motor_wiring', 'motor_not_starting', 'Motor not starting', 1),
  ('motor_wiring', 'overload_trip', 'Overload trip', 2),
  ('motor_wiring', 'burnt_winding', 'Burnt winding', 3),
  ('motor_wiring', 'star_delta_fault', 'Star-delta fault', 4),
  ('motor_wiring', 'control_circuit_issue', 'Control circuit issue', 5),
  ('motor_wiring', 'contactor_not_picking', 'Contactor not picking', 6),
  ('motor_wiring', 'motor_vibration', 'Motor humming / vibrating', 7),
  ('industrial_lighting', 'light_not_working', 'Light not working', 1),
  ('industrial_lighting', 'flickering', 'Flickering / blinking', 2),
  ('industrial_lighting', 'starter_ballast_fault', 'Starter / ballast fault', 3),
  ('industrial_lighting', 'led_driver_burnt', 'LED driver burnt', 4),
  ('industrial_lighting', 'fixture_damaged', 'Fixture damaged', 5),
  ('industrial_lighting', 'partial_area_dark', 'Partial area dark', 6),
  ('industrial_lighting', 'all_lights_off', 'All lights off', 7),
  ('earthing', 'equipment_shock', 'Shock from equipment', 1),
  ('earthing', 'earth_leakage', 'Earth leakage', 2),
  ('earthing', 'rcd_elcb_tripping', 'RCD / ELCB tripping', 3),
  ('earthing', 'earth_wire_broken', 'Earth wire broken', 4),
  ('earthing', 'no_earthing_connection', 'No earthing connection', 5),
  ('earthing', 'multiple_equipment_shock', 'Multiple equipment shock', 6),
  ('generator', 'dg_not_starting', 'DG not starting', 1),
  ('generator', 'ats_not_switching', 'ATS not switching', 2),
  ('generator', 'low_voltage_output', 'Low voltage output', 3),
  ('generator', 'governor_fault', 'Governor fault', 4),
  ('generator', 'dg_shutting_down', 'DG shutting down', 5),
  ('generator', 'changeover_problem', 'Changeover problem', 6),
  ('generator', 'battery_dead', 'Battery dead', 7),
  ('breakdown', 'complete_power_failure', 'Complete power failure', 1),
  ('breakdown', 'sparking_arcing', 'Sparking / arcing', 2),
  ('breakdown', 'burning_smell', 'Burning smell', 3),
  ('breakdown', 'fire_smoke', 'Fire / smoke', 4),
  ('breakdown', 'multiple_faults', 'Multiple faults', 5),
  ('breakdown', 'production_stopped', 'Production stopped', 6),
  ('breakdown', 'urgent_line_down', 'Urgent — line down', 7)
) AS tag(work_code, value, label, sort_order)
WHERE category.code = 'electrician'
  AND step.code = 'issue_' || tag.work_code
  AND field.field_key = 'fault_tags'
  AND NOT EXISTS (
    SELECT 1 FROM service_field_options existing
    WHERE existing.field_id = field.id AND existing.value = tag.value
  );

INSERT INTO service_form_fields (step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status)
SELECT step.id, 'additional_details', 'Additional details', 'textarea', FALSE,
       'Describe the issue in more detail...', NULL, 2, 'active'
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
WHERE category.code = 'electrician'
  AND step.code LIKE 'issue_%'
  AND NOT EXISTS (
    SELECT 1 FROM service_form_fields existing
    WHERE existing.step_id = step.id AND existing.field_key = 'additional_details'
  );

INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT category.id, svc_option.id, 'details_' || svc_option.code, 'Describe the issue',
       'Select fault tags and identify the drive for the specialist.', 'form', 2, 'active'
FROM service_categories category
JOIN service_steps parent_step ON parent_step.category_id = category.id AND parent_step.code = 'work_type'
JOIN service_options svc_option ON svc_option.step_id = parent_step.id
WHERE category.code = 'vfd_servo'
  AND svc_option.code IN (
    'vfd_fault', 'servo_fault', 'speed_control', 'parameters', 'dc_drive', 'communication', 'breakdown'
  )
  AND NOT EXISTS (
    SELECT 1 FROM service_steps existing
    WHERE existing.category_id = category.id AND existing.code = 'details_' || svc_option.code
  );

INSERT INTO service_form_fields (step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status)
SELECT step.id, field.field_key, field.label, field.field_type, field.required,
       field.placeholder, field.help_text, field.sort_order, 'active'
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('fault_tags', 'Fault tags', 'multiselect', FALSE, NULL, NULL, 1),
  ('fault_code', 'Fault code on display (if any)', 'text', FALSE, 'e.g. OC1, OV, F0001, AL-11', NULL, 2),
  ('make', 'Make', 'select', FALSE, NULL, NULL, 3),
  ('specify_make', 'Specify make', 'text', FALSE, 'Enter the drive brand', NULL, 4),
  ('drive_model', 'Model (if known)', 'text', FALSE, 'e.g. ACS550, G120, J1000, MR-J4', 'Find model on drive nameplate. Optional.', 5)
) AS field(field_key, label, field_type, required, placeholder, help_text, sort_order)
WHERE category.code = 'vfd_servo'
  AND step.code IN (
    'details_vfd_fault', 'details_servo_fault', 'details_speed_control',
    'details_parameters', 'details_dc_drive', 'details_communication', 'details_breakdown'
  )
  AND NOT EXISTS (
    SELECT 1 FROM service_form_fields existing
    WHERE existing.step_id = step.id AND existing.field_key = field.field_key
  );

INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT field.id, tag.value, tag.label, NULL, tag.sort_order, 'active'
FROM service_form_fields field
JOIN service_steps step ON step.id = field.step_id
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('details_vfd_fault', 'overcurrent_trip', 'OC — Overcurrent trip', 1),
  ('details_vfd_fault', 'overvoltage_fault', 'OV — Overvoltage fault', 2),
  ('details_vfd_fault', 'undervoltage', 'UV — Undervoltage', 3),
  ('details_vfd_fault', 'overheating', 'OH — Overheating', 4),
  ('details_vfd_fault', 'ground_fault', 'GF — Ground fault', 5),
  ('details_vfd_fault', 'no_display', 'No display / dead', 6),
  ('details_vfd_fault', 'run_command_not_accepted', 'Drive not accepting run command', 7),
  ('details_servo_fault', 'servo_alarm', 'Servo alarm active', 1),
  ('details_servo_fault', 'position_deviation', 'Position deviation error', 2),
  ('details_servo_fault', 'encoder_feedback_fault', 'Encoder feedback fault', 3),
  ('details_servo_fault', 'axis_not_moving', 'Axis not moving', 4),
  ('details_servo_fault', 'servo_hunting', 'Servo hunting / oscillating', 5),
  ('details_servo_fault', 'brake_not_releasing', 'Brake not releasing', 6),
  ('details_servo_fault', 'driver_overcurrent', 'Driver overcurrent', 7),
  ('details_speed_control', 'motor_too_slow', 'Motor running too slow', 1),
  ('details_speed_control', 'motor_too_fast', 'Motor running too fast', 2),
  ('details_speed_control', 'speed_not_stable', 'Speed not stable', 3),
  ('details_speed_control', 'not_reaching_set_speed', 'Not reaching set speed', 4),
  ('details_speed_control', 'motor_vibrating', 'Motor vibrating', 5),
  ('details_speed_control', 'direction_wrong', 'Direction wrong', 6),
  ('details_speed_control', 'motor_not_stopping', 'Motor not stopping', 7),
  ('details_parameters', 'parameters_reset', 'All parameters reset', 1),
  ('details_parameters', 'wrong_acceleration', 'Wrong acceleration/deceleration', 2),
  ('details_parameters', 'frequency_limit_wrong', 'Frequency limit wrong', 3),
  ('details_parameters', 'pid_not_working', 'PID not working', 4),
  ('details_parameters', 'factory_reset_needed', 'Need factory reset', 5),
  ('details_parameters', 'commissioning_needed', 'Commissioning needed', 6),
  ('details_parameters', 'backup_parameters_lost', 'Backup parameters lost', 7),
  ('details_dc_drive', 'thyristor_fault', 'Thyristor fault', 1),
  ('details_dc_drive', 'armature_overcurrent', 'Armature overcurrent', 2),
  ('details_dc_drive', 'field_weakening_fault', 'Field weakening fault', 3),
  ('details_dc_drive', 'scr_firing_issue', 'SCR firing issue', 4),
  ('details_dc_drive', 'speed_feedback_lost', 'Speed feedback lost', 5),
  ('details_dc_drive', 'dc_bus_fault', 'DC bus fault', 6),
  ('details_dc_drive', 'regenerative_fault', 'Regenerative fault', 7),
  ('details_communication', 'profibus_slave_error', 'Profibus slave error', 1),
  ('details_communication', 'modbus_no_response', 'Modbus no response', 2),
  ('details_communication', 'drive_not_visible', 'Drive not visible on network', 3),
  ('details_communication', 'fieldbus_timeout', 'Fieldbus timeout', 4),
  ('details_communication', 'control_word_missing', 'Control word not reaching', 5),
  ('details_communication', 'speed_reference_lost', 'Speed reference lost', 6),
  ('details_communication', 'remote_control_not_working', 'Remote control not working', 7),
  ('details_breakdown', 'line_down', 'Complete stop — line down', 1),
  ('details_breakdown', 'no_response', 'No response to any command', 2),
  ('details_breakdown', 'multiple_faults', 'Multiple faults active', 3),
  ('details_breakdown', 'burnt_smell', 'Burnt smell from drive', 4),
  ('details_breakdown', 'capacitor_blown', 'Capacitor blown', 5),
  ('details_breakdown', 'igbt_fault', 'IGBT fault', 6),
  ('details_breakdown', 'urgent_production_critical', 'Urgent — production critical', 7)
) AS tag(step_code, value, label, sort_order)
WHERE category.code = 'vfd_servo'
  AND step.code = tag.step_code
  AND field.step_id = step.id
  AND field.field_key = 'fault_tags'
  AND NOT EXISTS (
    SELECT 1 FROM service_field_options existing
    WHERE existing.field_id = field.id AND existing.value = tag.value
  );

INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT field.id, make.value, make.label, NULL, make.sort_order, 'active'
FROM service_form_fields field
JOIN service_steps step ON step.id = field.step_id
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('abb', 'ABB', 1),
  ('allen_bradley_rockwell', 'Allen-Bradley (Rockwell Automation)', 2),
  ('danfoss', 'Danfoss', 3),
  ('delta_electronics', 'Delta Electronics', 4),
  ('fuji_electric', 'Fuji Electric', 5),
  ('innovative', 'Innovative', 6),
  ('l_t_l_k', 'L&T / L&K', 7),
  ('mitsubishi_electric', 'Mitsubishi Electric', 8),
  ('schneider_electric', 'Schneider Electric', 9),
  ('siemens', 'Siemens', 10),
  ('other', 'Other Make', 11)
) AS make(value, label, sort_order)
WHERE category.code = 'vfd_servo'
  AND step.code IN (
    'details_vfd_fault', 'details_servo_fault', 'details_speed_control',
    'details_parameters', 'details_dc_drive', 'details_communication', 'details_breakdown'
  )
  AND field.step_id = step.id
  AND field.field_key = 'make'
  AND NOT EXISTS (
    SELECT 1 FROM service_field_options existing
    WHERE existing.field_id = field.id AND existing.value = make.value
  );

INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT category.id, svc_option.id, 'scope_' || svc_option.code, 'Scope of work',
       'Select the cable issue and provide the length and cable details.', 'form', 2, 'active'
FROM service_categories category
JOIN service_steps parent_step ON parent_step.category_id = category.id AND parent_step.code = 'cable_type'
JOIN service_options svc_option ON svc_option.step_id = parent_step.id
WHERE category.code = 'cabling'
  AND svc_option.code IN ('power_ht_lt', 'instrumentation', 'fiber', 'lan')
  AND NOT EXISTS (
    SELECT 1 FROM service_steps existing
    WHERE existing.category_id = category.id AND existing.code = 'scope_' || svc_option.code
  );

INSERT INTO service_form_fields (step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status)
SELECT step.id, field.field_key, field.label, field.field_type, field.required,
       field.placeholder, field.help_text, field.sort_order, 'active'
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('scope', 'Scope of work', 'multiselect', FALSE, NULL, NULL, 1),
  ('approx_length', 'Approx. length (meters)', 'text', FALSE, 'e.g. 200 m', NULL, 2),
  ('cable_spec', 'Cable details', 'text', FALSE, 'Cable cores, size, pairs, or type', NULL, 3),
  ('description', 'Description', 'textarea', FALSE, 'Route details, from-to locations, special requirements...', NULL, 4)
) AS field(field_key, label, field_type, required, placeholder, help_text, sort_order)
WHERE category.code = 'cabling'
  AND step.code IN ('scope_power_ht_lt', 'scope_instrumentation', 'scope_fiber', 'scope_lan')
  AND NOT EXISTS (
    SELECT 1 FROM service_form_fields existing
    WHERE existing.step_id = step.id AND existing.field_key = field.field_key
  );

UPDATE service_form_fields field
SET label = details.label,
    placeholder = details.placeholder
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('scope_power_ht_lt', 'Cores & size', 'e.g. 3.5C x 95 sq.mm'),
  ('scope_instrumentation', 'No. of pairs / cores', 'e.g. 6 pairs / 12 cores'),
  ('scope_fiber', 'Fiber count / type', 'e.g. 6F Single-Mode, 12F Multi-Mode'),
  ('scope_lan', 'No. of points / drops', 'e.g. 30 points'),
  ('scope_lan', 'Cable category', 'e.g. CAT6, CAT6A, CAT5e')
) AS details(step_code, label, placeholder)
WHERE category.code = 'cabling'
  AND step.code = details.step_code
  AND field.step_id = step.id
  AND field.field_key = CASE
    WHEN details.label = 'Cable category' THEN 'cable_spec'
    WHEN step.code = 'scope_lan' THEN 'approx_length'
    ELSE 'cable_spec'
  END;

INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT field.id, scope.value, scope.label, NULL, scope.sort_order, 'active'
FROM service_form_fields field
JOIN service_steps step ON step.id = field.step_id
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('scope_power_ht_lt', 'cable_fault', 'Cable fault / breakdown', 1),
  ('scope_power_ht_lt', 'ht_cable_jointing', 'HT cable jointing needed', 2),
  ('scope_power_ht_lt', 'termination_gland_work', 'Cable termination / gland work', 3),
  ('scope_power_ht_lt', 'megger_hipot_testing', 'Megger / hi-pot testing', 4),
  ('scope_power_ht_lt', 'insulation_failure', 'Insulation failure', 5),
  ('scope_power_ht_lt', 'cable_damaged', 'Cable damaged / cut', 6),
  ('scope_power_ht_lt', 'rerouting_required', 'Re-routing required', 7),
  ('scope_instrumentation', 'signal_noise', 'Signal noise / fluctuation', 1),
  ('scope_instrumentation', 'signal_loss', 'Signal loss / open circuit', 2),
  ('scope_instrumentation', 'shield_earthing', 'Shield earthing issue', 3),
  ('scope_instrumentation', 'cable_damaged', 'Cable damaged / rodent cut', 4),
  ('scope_instrumentation', 'junction_box_retermination', 'Junction box re-termination', 5),
  ('scope_instrumentation', 'loop_check', 'Loop check / continuity test', 6),
  ('scope_instrumentation', 'cable_identification', 'Cable identification / tagging', 7),
  ('scope_fiber', 'link_down', 'Link down / no light', 1),
  ('scope_fiber', 'high_signal_loss', 'High signal loss / attenuation', 2),
  ('scope_fiber', 'fiber_break', 'Fiber break / cut', 3),
  ('scope_fiber', 'otdr_testing', 'OTDR testing needed', 4),
  ('scope_fiber', 'fusion_splicing', 'Fusion splicing required', 5),
  ('scope_fiber', 'patch_cord_fault', 'Patch cord / connector fault', 6),
  ('scope_fiber', 'retermination_needed', 'Re-termination needed', 7),
  ('scope_lan', 'existing_cable_fault', 'Existing cable fault / no link', 1),
  ('scope_lan', 'patch_panel_retermination', 'Patch panel re-termination', 2),
  ('scope_lan', 'port_not_working', 'Port not working', 3),
  ('scope_lan', 'cable_testing', 'Cable testing / certification', 4),
  ('scope_lan', 'network_rack_rework', 'Network rack rework', 5),
  ('scope_lan', 'profinet_fault', 'Industrial network (PROFINET) fault', 6),
  ('scope_lan', 'slow_connection', 'Slow / intermittent connection', 7)
) AS scope(step_code, value, label, sort_order)
WHERE category.code = 'cabling'
  AND step.code = scope.step_code
  AND field.step_id = step.id
  AND field.field_key = 'scope'
  AND NOT EXISTS (
    SELECT 1 FROM service_field_options existing
    WHERE existing.field_id = field.id AND existing.value = scope.value
  );

INSERT INTO service_steps (category_id, follows_step_id, code, title, summary, step_kind, sort_order, status)
SELECT category.id, scope_step.id, 'urgency_' || svc_option.code, 'Urgency',
       'Choose how soon the cable repair is needed.', 'form', 3, 'active'
FROM service_categories category
JOIN service_steps parent_step ON parent_step.category_id = category.id AND parent_step.code = 'cable_type'
JOIN service_options svc_option ON svc_option.step_id = parent_step.id
JOIN service_steps scope_step ON scope_step.category_id = category.id AND scope_step.code = 'scope_' || svc_option.code
WHERE category.code = 'cabling'
  AND svc_option.code IN ('power_ht_lt', 'instrumentation', 'fiber', 'lan')
  AND NOT EXISTS (
    SELECT 1 FROM service_steps existing
    WHERE existing.category_id = category.id AND existing.code = 'urgency_' || svc_option.code
  );

INSERT INTO service_form_fields (step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status)
SELECT step.id, 'urgency', 'Urgency', 'select', TRUE, NULL, NULL, 1, 'active'
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
WHERE category.code = 'cabling'
  AND step.code IN ('urgency_power_ht_lt', 'urgency_instrumentation', 'urgency_fiber', 'urgency_lan')
  AND NOT EXISTS (
    SELECT 1 FROM service_form_fields existing
    WHERE existing.step_id = step.id AND existing.field_key = 'urgency'
  );

INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT field.id, choice.value, choice.label, choice.summary, choice.sort_order, 'active'
FROM service_form_fields field
JOIN service_steps step ON step.id = field.step_id
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('planned', 'Planned', 'Schedule it', 1),
  ('urgent', 'Urgent', 'Need today', 2),
  ('emergency', 'Emergency', 'Production down', 3)
) AS choice(value, label, summary, sort_order)
WHERE category.code = 'cabling'
  AND step.code IN ('urgency_power_ht_lt', 'urgency_instrumentation', 'urgency_fiber', 'urgency_lan')
  AND field.step_id = step.id
  AND field.field_key = 'urgency'
  AND NOT EXISTS (
    SELECT 1 FROM service_field_options existing
    WHERE existing.field_id = field.id AND existing.value = choice.value
  );

INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT category.id, svc_option.id, choice.step_code, choice.title, choice.summary, 'choice', 2, 'active'
FROM service_categories category
JOIN service_steps root_step ON root_step.category_id = category.id AND root_step.code = 'panel_type'
JOIN service_options svc_option ON svc_option.step_id = root_step.id
CROSS JOIN (VALUES
  ('mcc', 'mcc_work_type', 'What do you need?', 'Choose fault repair or new panel fabrication.'),
  ('busbar', 'busbar_work_type', 'What do you need?', 'Choose repair or annual maintenance.'),
  ('capacitor', 'capacitor_work_type', 'What do you need?', 'Choose repair or power factor assessment.'),
  ('control_wiring', 'control_work_type', 'What do you need?', 'Choose new wiring or fault troubleshooting.')
) AS choice(option_code, step_code, title, summary)
WHERE category.code = 'panel_mcc'
  AND svc_option.code = choice.option_code
  AND NOT EXISTS (
    SELECT 1 FROM service_steps existing
    WHERE existing.category_id = category.id AND existing.code = choice.step_code
  );

INSERT INTO service_steps (category_id, follows_step_id, code, title, summary, step_kind, sort_order, status)
SELECT category.id, make_step.id, 'vfd_panel_work_type', 'What do you need?',
       'Choose fault repair or new panel fabrication.', 'choice', 3, 'active'
FROM service_categories category
JOIN service_steps make_step ON make_step.category_id = category.id AND make_step.code = 'vfd_panel_make'
WHERE category.code = 'panel_mcc'
  AND NOT EXISTS (
    SELECT 1 FROM service_steps existing
    WHERE existing.category_id = category.id AND existing.code = 'vfd_panel_work_type'
  );

INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT step.id, work_option.code, work_option.name, work_option.summary, work_option.sort_order, 'active',
       work_option.next_action, work_option.next_action_label
FROM service_steps step
JOIN service_categories category ON category.id = step.category_id
CROSS JOIN (VALUES
  ('mcc_work_type', 'fault_repair', 'Fault / Repair', 'Feeder tripping, contactor fault, relay issue', 1, NULL, NULL),
  ('mcc_work_type', 'new_mcc_panel', 'New MCC Panel', 'New panel fabrication — go to Projects', 2, 'projects', 'Open Projects'),
  ('vfd_panel_work_type', 'fault_repair', 'Fault / Repair', 'Panel wiring, control circuit fault', 1, NULL, NULL),
  ('vfd_panel_work_type', 'new_vfd_panel', 'New VFD Panel', 'New panel fabrication — go to Projects', 2, 'projects', 'Open Projects'),
  ('busbar_work_type', 'fault_repair', 'Fault / Repair', 'ACB/VCB not closing, busbar hotspot', 1, NULL, NULL),
  ('busbar_work_type', 'annual_maintenance', 'Annual Maintenance', 'Routine servicing and testing', 2, NULL, NULL),
  ('capacitor_work_type', 'fault_repair', 'Fault / Repair', 'Capacitor blown, controller fault', 1, NULL, NULL),
  ('capacitor_work_type', 'power_factor_assessment', 'Power Factor Assessment', 'Check and recommendation', 2, NULL, NULL),
  ('control_work_type', 'new_wiring', 'New Wiring / Build', 'New panel or rewiring existing', 1, NULL, NULL),
  ('control_work_type', 'fault_troubleshoot', 'Fault / Troubleshoot', 'Intermittent fault, wrong operation', 2, NULL, NULL)
) AS work_option(step_code, code, name, summary, sort_order, next_action, next_action_label)
WHERE category.code = 'panel_mcc'
  AND step.code = work_option.step_code
  AND NOT EXISTS (
    SELECT 1 FROM service_options existing
    WHERE existing.step_id = step.id AND existing.code = work_option.code
  );

UPDATE service_steps detail
SET parent_option_id = work_option.id,
    follows_step_id = NULL,
    updated_at = NOW()
FROM service_categories category
JOIN service_steps root_step ON root_step.category_id = category.id AND root_step.code = 'panel_type'
JOIN service_options root_option ON root_option.step_id = root_step.id
JOIN service_steps work_step ON work_step.category_id = category.id
JOIN service_options work_option ON work_option.step_id = work_step.id AND work_option.code = 'fault_repair'
WHERE category.code = 'panel_mcc'
  AND (
    (detail.code = 'mcc_details' AND root_option.code = 'mcc' AND work_step.code = 'mcc_work_type')
    OR (detail.code = 'busbar_details' AND root_option.code = 'busbar' AND work_step.code = 'busbar_work_type')
    OR (detail.code = 'capacitor_details' AND root_option.code = 'capacitor' AND work_step.code = 'capacitor_work_type')
    OR (detail.code = 'control_details' AND root_option.code = 'control_wiring' AND work_step.code = 'control_work_type')
  )
  AND work_step.parent_option_id = root_option.id
  AND detail.category_id = category.id;

UPDATE service_steps detail
SET follows_step_id = work_step.id,
    updated_at = NOW()
FROM service_categories category
JOIN service_steps work_step ON work_step.category_id = category.id AND work_step.code = 'vfd_panel_work_type'
WHERE category.code = 'panel_mcc'
  AND detail.category_id = category.id
  AND detail.code = 'vfd_panel_details';
