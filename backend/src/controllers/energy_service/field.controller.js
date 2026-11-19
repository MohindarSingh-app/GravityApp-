const fieldService = require('../../services/energy_service/field.service');
const { sendSuccess } = require('../../utils/energy_service/response');

async function jobs(req, res) {
  sendSuccess(res, await fieldService.listJobs(req.user));
}

async function createJob(req, res) {
  sendSuccess(res, await fieldService.createJob(req.user, req.body, req), 201, 'Job created.');
}

async function setStatus(req, res) {
  sendSuccess(res, await fieldService.setJobStatus(req.user, req.params.id, req.body, req));
}

async function signals(req, res) {
  sendSuccess(res, await fieldService.listSignals(req.user, req.query.kind));
}

async function createSignal(req, res) {
  sendSuccess(res, await fieldService.createSignal(req.user, req.body, req), 201);
}

async function amc(req, res) {
  sendSuccess(res, await fieldService.listAmc(req.user));
}

async function createAmc(req, res) {
  sendSuccess(res, await fieldService.createAmc(req.user, req.body, req), 201, 'Quote requested.');
}

async function certs(req, res) {
  sendSuccess(res, await fieldService.listCerts(req.user));
}

async function createCert(req, res) {
  sendSuccess(res, await fieldService.createCert(req.user, req.body, req), 201);
}

async function catalog(req, res) {
  sendSuccess(res, await fieldService.listCatalog());
}

async function products(req, res) {
  sendSuccess(res, await fieldService.listProducts(req.user));
}

module.exports = {
  jobs,
  createJob,
  setStatus,
  signals,
  createSignal,
  amc,
  createAmc,
  certs,
  createCert,
  catalog,
  products,
};
