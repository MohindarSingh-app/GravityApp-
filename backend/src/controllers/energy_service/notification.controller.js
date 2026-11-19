const notificationService = require('../../services/energy_service/notification.service');
const { sendSuccess } = require('../../utils/energy_service/response');

async function list(req, res) {
  sendSuccess(res, await notificationService.list(req.user));
}

async function markRead(req, res) {
  sendSuccess(res, await notificationService.markRead(req.user, req.params.id));
}

module.exports = { list, markRead };
