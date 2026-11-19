const roleService = require('../../services/energy_service/role.service');
const { sendSuccess } = require('../../utils/energy_service/response');

async function list(req, res) {
  const result = await roleService.listRoles();
  sendSuccess(res, result);
}

async function get(req, res) {
  const result = await roleService.getRole(req.params.id);
  sendSuccess(res, result);
}

async function update(req, res) {
  const result = await roleService.updateRole(req.user, req.params.id, req.body, req);
  sendSuccess(res, result, 200, 'Role updated.');
}

module.exports = { list, get, update };
