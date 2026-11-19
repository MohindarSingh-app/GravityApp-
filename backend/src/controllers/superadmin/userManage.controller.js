const AppUser = require('../../models/superadmin/appUser.model');
const { successResponse, errorResponse } = require('../../utils/response');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await AppUser.list(req.query.app);
    return successResponse(res, 200, 'Users fetched', users);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

exports.blockUser = async (req, res) => {
  try {
    const user = await AppUser.setBlocked(req.params.id, true);
    if (!user) return errorResponse(res, 404, 'User not found');
    return successResponse(res, 200, 'User blocked', user);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

exports.unblockUser = async (req, res) => {
  try {
    const user = await AppUser.setBlocked(req.params.id, false);
    if (!user) return errorResponse(res, 404, 'User not found');
    return successResponse(res, 200, 'User unblocked', user);
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await AppUser.remove(req.params.id);
    if (!user) return errorResponse(res, 404, 'User not found');
    return successResponse(res, 200, 'User deleted');
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};

exports.dashboard = async (req, res) => {
  try {
    const counts = await AppUser.counts();
    return successResponse(res, 200, 'Dashboard stats', {
      apps: ['energy_provider', 'energy_service', 'energy_website', 'superadmin'],
      energy_provider: { totalUsers: counts.energy_provider },
      energy_service: { totalUsers: counts.energy_service },
      energy_website: { totalContacts: counts.energy_website },
    });
  } catch (err) {
    return errorResponse(res, 500, err.message);
  }
};
