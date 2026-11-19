const auditModel = require('../../models/energy_service/audit.model');
const { normalizeIp } = require('../../utils/energy_service/crypto');

function requestMeta(req) {
  if (!req) return { ip: null, userAgent: null, requestId: null };
  const userAgent = req.get ? (req.get('user-agent') || '') : '';
  return {
    ip: normalizeIp(req.ip),
    userAgent: userAgent ? userAgent.slice(0, 255) : null,
    requestId: req.requestId || null,
  };
}

async function createAuditLog({
  userId,
  companyId,
  siteId,
  action,
  entityType,
  entityId,
  description,
  req,
  metadata,
  client,
}) {
  const meta = requestMeta(req);
  const details = { ...(metadata || {}) };
  if (meta.requestId) details.requestId = meta.requestId;
  try {
    await auditModel.create({
      userId,
      companyId,
      siteId,
      action,
      entityType,
      entityId,
      description,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: details,
    }, client);
  } catch (_err) {
    // Audit failures must not break the primary action.
  }
}

module.exports = {
  createAuditLog,
  log: createAuditLog,
  requestMeta,
};
