const amc = require('../../services/energy_service/customer/amc.service');
const repair = require('../../services/energy_service/customer/repair.service');
const project = require('../../services/energy_service/customer/project.service');
const services = require('../../services/energy_service/customer/service.service');
const attachments = require('../../services/energy_service/customer/attachment.service');
const { sendSuccess } = require('../../utils/energy_service/response');

async function listAmcContracts(req, res) {
  sendSuccess(res, await amc.listContracts(req.user, req.query));
}

async function getAmcContract(req, res) {
  sendSuccess(res, await amc.getContract(req.user, req.params.id));
}

async function createAmcContract(req, res) {
  sendSuccess(res, await amc.createContract(req.user, req.body, req), 201, 'AMC contract created.');
}

async function updateAmcContract(req, res) {
  sendSuccess(res, await amc.updateContract(req.user, req.params.id, req.body, req));
}

async function setAmcContractStatus(req, res) {
  sendSuccess(res, await amc.changeContractStatus(req.user, req.params.id, req.body, req));
}

async function listAmcRequests(req, res) {
  sendSuccess(res, await amc.listRequests(req.user, req.query));
}

async function getAmcRequest(req, res) {
  sendSuccess(res, await amc.getRequest(req.user, req.params.id));
}

async function createAmcRequest(req, res) {
  const result = await amc.createRequest(req.user, req.body, req);
  sendSuccess(res, result, 201, result.confirmation ? 'AMC request submitted.' : 'AMC request saved.');
}

async function updateAmcRequest(req, res) {
  sendSuccess(res, await amc.updateRequest(req.user, req.params.id, req.body, req));
}

async function submitAmcRequest(req, res) {
  sendSuccess(res, await amc.submitRequest(req.user, req.params.id, req), 200, 'AMC request submitted.');
}

async function cancelAmcRequest(req, res) {
  sendSuccess(res, await amc.cancelRequest(req.user, req.params.id, req.body, req));
}

async function setAmcRequestStatus(req, res) {
  sendSuccess(res, await amc.changeRequestStatus(req.user, req.params.id, req.body, req));
}

async function amcRequestHistory(req, res) {
  sendSuccess(res, await amc.requestHistory(req.user, req.params.id));
}

async function listReschedules(req, res) {
  sendSuccess(res, await amc.listReschedules(req.user, req.query));
}

async function getReschedule(req, res) {
  sendSuccess(res, await amc.getReschedule(req.user, req.params.id));
}

async function createReschedule(req, res) {
  sendSuccess(res, await amc.createReschedule(req.user, req.body, req), 201, 'Reschedule requested.');
}

async function reviewReschedule(req, res) {
  sendSuccess(res, await amc.reviewReschedule(req.user, req.params.id, req.body, req));
}

async function cancelReschedule(req, res) {
  sendSuccess(res, await amc.cancelReschedule(req.user, req.params.id, req.body, req));
}

async function listDevices(req, res) {
  sendSuccess(res, await repair.listDevices(req.user, req.query));
}

async function getDevice(req, res) {
  sendSuccess(res, await repair.getDevice(req.user, req.params.id));
}

async function createDevice(req, res) {
  sendSuccess(res, await repair.createDevice(req.user, req.body, req), 201, 'Device registered.');
}

async function updateDevice(req, res) {
  sendSuccess(res, await repair.updateDevice(req.user, req.params.id, req.body, req));
}

async function listTickets(req, res) {
  sendSuccess(res, await repair.listTickets(req.user, req.query));
}

async function getTicket(req, res) {
  sendSuccess(res, await repair.getTicket(req.user, req.params.id));
}

async function createTicket(req, res) {
  const result = await repair.createTicket(req.user, req.body, req);
  sendSuccess(res, result, 201, result.confirmation ? 'Repair ticket submitted.' : 'Repair ticket saved.');
}

async function updateTicket(req, res) {
  sendSuccess(res, await repair.updateTicket(req.user, req.params.id, req.body, req));
}

async function submitTicket(req, res) {
  sendSuccess(res, await repair.submitTicket(req.user, req.params.id, req), 200, 'Repair ticket submitted.');
}

async function cancelTicket(req, res) {
  sendSuccess(res, await repair.cancelTicket(req.user, req.params.id, req.body, req));
}

async function setTicketStatus(req, res) {
  sendSuccess(res, await repair.changeTicketStatus(req.user, req.params.id, req.body, req));
}

async function ticketHistory(req, res) {
  sendSuccess(res, await repair.ticketHistory(req.user, req.params.id));
}

async function listProjectCategories(req, res) {
  sendSuccess(res, await project.listCategories(req.user));
}

async function listProjectRequests(req, res) {
  sendSuccess(res, await project.listRequests(req.user, req.query));
}

async function getProjectRequest(req, res) {
  sendSuccess(res, await project.getRequest(req.user, req.params.id));
}

async function createProjectRequest(req, res) {
  const result = await project.createRequest(req.user, req.body, req);
  sendSuccess(res, result, 201, result.confirmation ? 'Project request submitted.' : 'Project request saved.');
}

async function updateProjectRequest(req, res) {
  sendSuccess(res, await project.updateRequest(req.user, req.params.id, req.body, req));
}

async function submitProjectRequest(req, res) {
  sendSuccess(res, await project.submitRequest(req.user, req.params.id, req), 200, 'Project request submitted.');
}

async function cancelProjectRequest(req, res) {
  sendSuccess(res, await project.cancelRequest(req.user, req.params.id, req.body, req));
}

async function setProjectStatus(req, res) {
  sendSuccess(res, await project.changeRequestStatus(req.user, req.params.id, req.body, req));
}

async function projectHistory(req, res) {
  sendSuccess(res, await project.requestHistory(req.user, req.params.id));
}

async function listServiceCategories(req, res) {
  sendSuccess(res, await services.listCategories(req.user));
}

async function categoryServices(req, res) {
  sendSuccess(res, await services.categoryServices(req.user, req.params.categoryId));
}

async function listServiceRequests(req, res) {
  sendSuccess(res, await services.listRequests(req.user, req.query));
}

async function getServiceRequest(req, res) {
  sendSuccess(res, await services.getRequest(req.user, req.params.id));
}

async function createServiceRequest(req, res) {
  const result = await services.createRequest(req.user, req.body, req);
  sendSuccess(res, result, 201, 'Service request submitted.');
}

async function cancelServiceRequest(req, res) {
  sendSuccess(res, await services.cancelRequest(req.user, req.params.id, req.body, req));
}

async function setServiceStatus(req, res) {
  sendSuccess(res, await services.changeStatus(req.user, req.params.id, req.body, req));
}

async function serviceRequestHistory(req, res) {
  sendSuccess(res, await services.requestHistory(req.user, req.params.id));
}

async function createAttachment(req, res) {
  const result = await attachments.register(req.user, req.body, req);
  sendSuccess(res, result, 201, result.attachment.contentUrl ? 'Attachment uploaded and saved.' : 'Attachment reference saved.');
}

async function listAttachments(req, res) {
  sendSuccess(res, await attachments.list(req.user, req.query));
}

async function getAttachmentContent(req, res) {
  const file = await attachments.openContent(req.user, req.params.id);
  res.set({
    'Cache-Control': 'private, no-store',
    'Content-Disposition': `attachment; filename="${file.downloadName}"`,
    'Content-Length': file.byteSize,
    'Content-Type': file.mimeType,
    'X-Content-Type-Options': 'nosniff',
  });
  file.stream.pipe(res);
}

module.exports = {
  listAmcContracts,
  getAmcContract,
  createAmcContract,
  updateAmcContract,
  setAmcContractStatus,
  listAmcRequests,
  getAmcRequest,
  createAmcRequest,
  updateAmcRequest,
  submitAmcRequest,
  cancelAmcRequest,
  setAmcRequestStatus,
  amcRequestHistory,
  listReschedules,
  getReschedule,
  createReschedule,
  reviewReschedule,
  cancelReschedule,
  listDevices,
  getDevice,
  createDevice,
  updateDevice,
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  submitTicket,
  cancelTicket,
  setTicketStatus,
  ticketHistory,
  listProjectCategories,
  listProjectRequests,
  getProjectRequest,
  createProjectRequest,
  updateProjectRequest,
  submitProjectRequest,
  cancelProjectRequest,
  setProjectStatus,
  projectHistory,
  listServiceCategories,
  categoryServices,
  listServiceRequests,
  getServiceRequest,
  createServiceRequest,
  cancelServiceRequest,
  setServiceStatus,
  serviceRequestHistory,
  createAttachment,
  listAttachments,
  getAttachmentContent,
};
