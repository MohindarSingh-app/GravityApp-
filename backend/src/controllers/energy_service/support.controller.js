const supportService = require('../../services/energy_service/support.service');
const { sendSuccess } = require('../../utils/energy_service/response');

async function create(req, res) {
  const result = await supportService.submit(req.user, req.body);
  sendSuccess(res, result, 201, result.message);
}

async function assist(req, res) {
  const result = await supportService.assist(req.user, req.body);
  sendSuccess(res, result);
}

module.exports = { create, assist };
