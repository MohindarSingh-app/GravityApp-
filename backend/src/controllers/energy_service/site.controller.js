const siteService = require('../../services/energy_service/site.service');
const { sendSuccess } = require('../../utils/energy_service/response');

async function create(req, res) {
  const result = await siteService.createSite(req.user, req.params.companyId, req.body, req);
  sendSuccess(res, result, 201, 'Site created.');
}

async function list(req, res) {
  const result = await siteService.listSites(req.user, req.params.companyId);
  sendSuccess(res, result);
}

async function get(req, res) {
  const result = await siteService.getSite(req.user, req.params.id);
  sendSuccess(res, result);
}

async function update(req, res) {
  const result = await siteService.updateSite(req.user, req.params.id, req.body, req);
  sendSuccess(res, result, 200, 'Site updated.');
}

async function remove(req, res) {
  const result = await siteService.deleteSite(req.user, req.params.id, req);
  sendSuccess(res, result, 200, 'Site deleted.');
}

async function setStatus(req, res) {
  const result = await siteService.setSiteStatus(req.user, req.params.id, req.body.status, req);
  sendSuccess(res, result, 200, 'Site status updated.');
}

async function setPrimary(req, res) {
  const result = await siteService.setPrimarySite(req.user, req.params.id, req);
  sendSuccess(res, result, 200, 'Primary site updated.');
}

module.exports = { create, list, get, update, remove, setStatus, setPrimary };
