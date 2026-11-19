const companyService = require('../../services/energy_service/company.service');
const { sendSuccess } = require('../../utils/energy_service/response');

async function create(req, res) {
  const result = await companyService.createCompany(req.user, req.body, req);
  sendSuccess(res, result, 201, 'Company created.');
}

async function get(req, res) {
  const result = await companyService.getCompany(req.user, req.params.id);
  sendSuccess(res, result);
}

async function listMine(req, res) {
  const result = await companyService.listUserCompanies(req.user);
  sendSuccess(res, result);
}

async function select(req, res) {
  const result = await companyService.selectCompany(req.user, req.params.id, req);
  sendSuccess(res, result, 200, 'Active company changed.');
}

async function update(req, res) {
  const result = await companyService.updateCompany(req.user, req.params.id, req.body, req);
  sendSuccess(res, result, 200, 'Company updated.');
}

async function setStatus(req, res) {
  const result = await companyService.setCompanyStatus(req.user, req.params.id, req.body.status, req);
  sendSuccess(res, result, 200, 'Company status updated.');
}

async function listUsers(req, res) {
  const result = await companyService.listCompanyUsers(req.user, req.params.id);
  sendSuccess(res, result);
}

module.exports = { create, get, listMine, select, update, setStatus, listUsers };
