/**
 * GET /api/v1/dashboard - dashboard data for the authenticated partner.
 */
const DashboardService = require('../../services/energy_provider/dashboardService');
const { asyncHandler, ok } = require('../../utils/energy_provider/apiError');

const getDashboard = asyncHandler(async (req, res) =>
  ok(res, 'Dashboard data fetched', await DashboardService.getDashboard(req.user))
);

module.exports = { getDashboard };
