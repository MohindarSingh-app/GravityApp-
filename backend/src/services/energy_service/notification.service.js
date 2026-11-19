const AppError = require('../../utils/energy_service/AppError');
const notificationModel = require('../../models/energy_service/notification.model');

function present(row) {
  const action = String(row.action || 'update')
    .replace(/[._]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return {
    id: row.id,
    title: action,
    message: row.description || 'There is an update to your account.',
    entityType: row.entity_type || null,
    entityId: row.entity_id || null,
    createdAt: row.created_at,
    isRead: Boolean(row.read_at),
  };
}

async function list(user) {
  const rows = await notificationModel.listForUser(user.id, user.company_id);
  return { notifications: rows.map(present) };
}

async function markRead(user, notificationId) {
  const row = await notificationModel.markRead(
    user.id,
    notificationId,
    user.company_id,
  );
  if (!row) throw new AppError('Notification not found.', 404, 'NOT_FOUND');
  return { id: row.audit_log_id, isRead: true, readAt: row.read_at };
}

module.exports = { list, markRead };
