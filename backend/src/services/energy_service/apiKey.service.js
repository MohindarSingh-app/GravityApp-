const crypto = require('crypto');
const { sha256 } = require('../../utils/energy_service/crypto');
const AppError = require('../../utils/energy_service/AppError');
const { withTransaction } = require('../../utils/energy_service/transaction');
const apiKeyModel = require('../../models/energy_service/apiKey.model');
const auditService = require('./audit.service');

function generateKey() {
  const secret = crypto.randomBytes(32).toString('base64url');
  const key = `zsa_${secret}`;
  return {
    key,
    keyPrefix: key.slice(0, 12),
    keyHash: sha256(key),
  };
}

function toPublicApiKey(row, plaintext) {
  const data = {
    id: row.id,
    name: row.key_name,
    keyName: row.key_name,
    keyPrefix: row.key_prefix,
    companyId: row.company_id || null,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
  if (plaintext) data.key = plaintext;
  return data;
}

async function createKey(user, input, req) {
  const generated = generateKey();
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new AppError('Enter a valid expiration date.', 422, 'VALIDATION_ERROR');
  }
  const record = await apiKeyModel.create({
    userId: user.id,
    companyId: user.company_id,
    keyName: input.keyName || input.name,
    keyPrefix: generated.keyPrefix,
    keyHash: generated.keyHash,
    expiresAt,
  });
  await auditService.createAuditLog({
    userId: user.id,
    companyId: user.company_id,
    action: 'api_key.created',
    entityType: 'api_key',
    entityId: record.id,
    description: 'API key created',
    req,
  });
  return {
    apiKey: toPublicApiKey(record, generated.key),
    message: 'Store this API key now. It will not be shown again.',
  };
}

async function listKeys(user) {
  const rows = await apiKeyModel.listByUser(user.id, user.company_id);
  return { apiKeys: rows.map((row) => toPublicApiKey(row)) };
}

async function revokeKey(user, id, req) {
  const existing = await apiKeyModel.findByIdForUser(id, user.id);
  if (!existing || (existing.company_id && existing.company_id !== user.company_id)) {
    throw new AppError('API key not found.', 404, 'NOT_FOUND');
  }
  const record = await apiKeyModel.revoke(id, user.id);
  if (!record) throw new AppError('API key not found.', 404, 'NOT_FOUND');
  await auditService.createAuditLog({
    userId: user.id,
    companyId: user.company_id,
    action: 'api_key.revoked',
    entityType: 'api_key',
    entityId: record.id,
    description: 'API key revoked',
    req,
  });
  return { apiKey: toPublicApiKey(record), message: 'API key revoked.' };
}

async function rotateKey(user, id, req) {
  return withTransaction(async (client) => {
    const existing = await apiKeyModel.findByIdForUser(id, user.id, client);
    if (!existing || existing.revoked_at || (existing.company_id && existing.company_id !== user.company_id)) {
      throw new AppError('API key not found.', 404, 'NOT_FOUND');
    }
    await apiKeyModel.revoke(id, user.id, client);
    const generated = generateKey();
    const record = await apiKeyModel.create({
      userId: user.id,
      companyId: existing.company_id,
      keyName: existing.key_name,
      keyPrefix: generated.keyPrefix,
      keyHash: generated.keyHash,
      expiresAt: existing.expires_at,
    }, client);
    await auditService.createAuditLog({
      userId: user.id,
      companyId: user.company_id,
      action: 'api_key.rotated',
      entityType: 'api_key',
      entityId: record.id,
      description: 'API key rotated',
      req,
      metadata: { replacedId: existing.id },
      client,
    });
    return {
      apiKey: toPublicApiKey(record, generated.key),
      message: 'Store this API key now. It will not be shown again.',
    };
  });
}

module.exports = {
  createKey,
  listKeys,
  revokeKey,
  rotateKey,
  toPublicApiKey,
};
