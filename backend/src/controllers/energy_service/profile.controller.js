const profileService = require('../../services/energy_service/profile.service');
const { sendSuccess } = require('../../utils/energy_service/response');

async function create(req, res) {
  const result = await profileService.upsertProfile(req.auth.userId, {
    fullName: req.body.fullName || req.body.name,
    email: req.body.email,
    secondaryPhone: req.body.secondaryPhone,
    role: req.body.role,
  }, req);
  sendSuccess(res, result, 200, result.message);
}

async function get(req, res) {
  const result = await profileService.loadProfile(req.auth.userId);
  sendSuccess(res, result);
}

async function update(req, res) {
  const result = await profileService.upsertProfile(req.auth.userId, {
    fullName: req.body.fullName || req.body.name,
    email: req.body.email,
    secondaryPhone: req.body.secondaryPhone,
    role: req.body.role,
  }, req);
  sendSuccess(res, result, 200, result.message);
}

async function avatar(req, res) {
  const result = await profileService.setAvatar(req.auth.userId, req.body.image, req);
  sendSuccess(res, result, 200, result.message);
}

module.exports = { create, get, update, avatar };
