const { pool } = require('../../config/energy_service/db');

function db(client) {
  return client || pool;
}

async function listGroups(groups, client) {
  const result = await db(client).query(
    `SELECT group_code, code, label, summary, glyph, tone, meta, sort_order
     FROM app_catalog_items
     WHERE group_code = ANY($1::text[]) AND status = 'active'
     ORDER BY group_code ASC, sort_order ASC, label ASC`,
    [groups],
  );
  return result.rows;
}

async function insertManufacturer({ code, label }, client) {
  await db(client).query(
    `INSERT INTO app_catalog_items (group_code, code, label, sort_order)
     VALUES ('manufacturer', $1, $2, 1000)
     ON CONFLICT (group_code, code) DO UPDATE
     SET label = EXCLUDED.label, status = 'active'`,
    [code, label],
  );
  const result = await db(client).query(
    `SELECT code, label
     FROM app_catalog_items
     WHERE group_code = 'manufacturer' AND code = $1 AND status = 'active'`,
    [code],
  );
  const manufacturer = result.rows[0];
  if (!manufacturer) throw new Error('Manufacturer catalog save did not return an active record.');

  await db(client).query(
    `INSERT INTO service_options (step_id, code, name, sort_order, status)
     SELECT step.id, 'brand_' || $1, $2,
            COALESCE((SELECT MAX(existing.sort_order) + 1
                      FROM service_options existing WHERE existing.step_id = step.id), 1),
            'active'
     FROM service_steps step
     WHERE step.status = 'active' AND step.step_kind = 'choice'
       AND (step.code ILIKE '%make%' OR step.code ILIKE '%brand%'
         OR step.title ILIKE '%make%' OR step.title ILIKE '%brand%')
       AND NOT EXISTS (
         SELECT 1 FROM service_options existing
         WHERE existing.step_id = step.id AND lower(existing.name) = lower($2)
       )
     ON CONFLICT (step_id, code) DO UPDATE
     SET name = EXCLUDED.name, status = 'active'`,
    [manufacturer.code, manufacturer.label],
  );
  await db(client).query(
    `INSERT INTO service_field_options (field_id, value, label, sort_order, status)
     SELECT field.id, 'shared_' || $1, $2,
            COALESCE((SELECT MAX(existing.sort_order) + 1
                      FROM service_field_options existing WHERE existing.field_id = field.id), 1),
            'active'
     FROM service_form_fields field
     JOIN service_steps step ON step.id = field.step_id
     WHERE field.status = 'active' AND field.field_type = 'select'
       AND field.field_key IN ('make', 'brand', 'manufacturer')
       AND step.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM service_field_options existing
         WHERE existing.field_id = field.id AND lower(existing.label) = lower($2)
       )
     ON CONFLICT (field_id, value) DO UPDATE
     SET label = EXCLUDED.label, status = 'active'`,
    [manufacturer.code, manufacturer.label],
  );
  const optionsResult = await db(client).query(
    `SELECT opt.id, opt.step_id, opt.code, opt.name, opt.summary,
            opt.icon_key, opt.sort_order, opt.status, opt.next_action,
            opt.next_action_label
     FROM service_options opt
     JOIN service_steps step ON step.id = opt.step_id
     WHERE lower(opt.name) = lower($1)
       AND step.status = 'active' AND step.step_kind = 'choice'
       AND (step.code ILIKE '%make%' OR step.code ILIKE '%brand%'
         OR step.title ILIKE '%make%' OR step.title ILIKE '%brand%')
     ORDER BY step.id`,
    [manufacturer.label],
  );
  return { ...manufacturer, options: optionsResult.rows };
}

module.exports = { listGroups, insertManufacturer };
