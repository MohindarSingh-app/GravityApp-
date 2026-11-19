const apiKeyService = require('../../services/energy_service/apiKey.service');
const { sendSuccess } = require('../../utils/energy_service/response');

async function create(req, res) {
  const result = await apiKeyService.createKey(req.user, req.body, req);
  sendSuccess(res, result, 201, result.message);
}

async function list(req, res) {
  const result = await apiKeyService.listKeys(req.user);
  sendSuccess(res, result);
}

async function revoke(req, res) {
  const result = await apiKeyService.revokeKey(req.user, req.params.id, req);
  sendSuccess(res, result, 200, result.message);
}

async function rotate(req, res) {
  const result = await apiKeyService.rotateKey(req.user, req.params.id, req);
  sendSuccess(res, result, 200, result.message);
}

module.exports = { create, list, revoke, rotate };
