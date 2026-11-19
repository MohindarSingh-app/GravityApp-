const userService = require('../../services/energy_service/user.service');
const { sendSuccess } = require('../../utils/energy_service/response');

async function list(req, res) {
  const result = await userService.listUsers(req.user);
  sendSuccess(res, result);
}

async function get(req, res) {
  const result = await userService.getUser(req.user, req.params.id);
  sendSuccess(res, result);
}

async function create(req, res) {
  const result = await userService.createUser(req.user, req.body, req);
  sendSuccess(res, result, 201, 'User created.');
}

async function update(req, res) {
  const result = await userService.updateUser(req.user, req.params.id, req.body, req);
  sendSuccess(res, result, 200, 'User updated.');
}

async function setStatus(req, res) {
  const result = await userService.setUserStatus(req.user, req.params.id, req.body.status, req);
  sendSuccess(res, result, 200, 'User status updated.');
}

async function setRole(req, res) {
  const result = await userService.setUserRole(req.user, req.params.id, req.body.roleId, req);
  sendSuccess(res, result, 200, 'User role updated.');
}

module.exports = { list, get, create, update, setStatus, setRole };
