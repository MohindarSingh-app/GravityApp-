const dashboardService = require('../../services/energy_service/dashboard.service');
const { sendSuccess } = require('../../utils/energy_service/response');

async function get(req, res) {
  const result = await dashboardService.getDashboard(req.user, req.auth.sessionId);
  sendSuccess(res, result);
}

module.exports = { get };
