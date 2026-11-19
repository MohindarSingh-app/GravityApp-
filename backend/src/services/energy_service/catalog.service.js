const crypto = require('crypto');
const catalogModel = require('../../models/energy_service/catalog.model');
const { withTransaction } = require('../../utils/energy_service/transaction');
const AppError = require('../../utils/energy_service/AppError');

function itemJson(row) {
  return {
    code: row.code,
    label: row.label,
    summary: row.summary || '',
    glyph: row.glyph || null,
    tone: row.tone || null,
    meta: row.meta || {},
    sortOrder: row.sort_order,
  };
}

async function list(groups) {
  const rows = await catalogModel.listGroups(groups);
  const result = {};
  groups.forEach((group) => { result[group] = []; });
  rows.forEach((row) => { result[row.group_code].push(itemJson(row)); });
  return { groups: result };
}

async function addManufacturer(rawName) {
  const label = String(rawName || '').trim().replace(/\s+/g, ' ');
  if (!label) throw new AppError('Enter a make or brand name.', 422, 'VALIDATION_ERROR');
  const normalized = label.toLowerCase();
  const slug = normalized
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 44) || 'brand';
  const digest = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 10);
  const code = `${slug}_${digest}`;
  const manufacturer = await withTransaction((client) => (
    catalogModel.insertManufacturer({ code, label }, client)
  ));
  return {
    manufacturer: {
      code: manufacturer.code,
      label: manufacturer.label,
      value: `shared_${manufacturer.code}`,
    },
    options: manufacturer.options.map((option) => ({
      id: option.id,
      stepId: option.step_id,
      code: option.code,
      name: option.name,
      summary: option.summary || '',
      iconKey: option.icon_key || null,
      sortOrder: option.sort_order,
      status: option.status,
      nextAction: option.next_action || null,
      nextActionLabel: option.next_action_label || null,
    })),
  };
}

module.exports = { list, itemJson, addManufacturer };
