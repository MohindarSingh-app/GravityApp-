const { Router } = require('express');
const express = require('express');
const customer = require('../../controllers/energy_service/customer.controller');
const { asyncHandler } = require('../../utils/energy_service/asyncHandler');
const { validate } = require('../../middleware/energy_service/validate.middleware');
const { requireAuth } = require('../../middleware/energy_service/auth.middleware');
const { requireAccess } = require('../../middleware/energy_service/role.middleware');
const schemas = require('../../validators/energy_service/customer.validator');
const attachmentJson = express.json({ limit: '6mb' });

const router = Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.use(requireAuth);

router.post('/attachments', requireAccess('customer.amc.write'), attachmentJson, validate(schemas.createAttachmentSchema), asyncHandler(customer.createAttachment));
router.get('/attachments', requireAccess('customer.amc.read'), validate(schemas.attachmentListQuery), asyncHandler(customer.listAttachments));
router.get('/attachments/:id/content', requireAccess('customer.amc.read'), validate(schemas.idParam), asyncHandler(customer.getAttachmentContent));

router.get('/amc/contracts', requireAccess('customer.amc.read'), validate(schemas.contractListQuery), asyncHandler(customer.listAmcContracts));
router.post('/amc/contracts', requireAccess('customer.amc.manage'), validate(schemas.createContractSchema), asyncHandler(customer.createAmcContract));
router.get('/amc/contracts/:id', requireAccess('customer.amc.read'), validate(schemas.idParam), asyncHandler(customer.getAmcContract));
router.patch('/amc/contracts/:id', requireAccess('customer.amc.manage'), validate(schemas.updateContractSchema), asyncHandler(customer.updateAmcContract));
router.post('/amc/contracts/:id/status', requireAccess('customer.amc.manage'), validate(schemas.contractStatusSchema), asyncHandler(customer.setAmcContractStatus));

router.get('/amc/requests', requireAccess('customer.amc.read'), validate(schemas.requestListQuery), asyncHandler(customer.listAmcRequests));
router.post('/amc/requests', requireAccess('customer.amc.write'), validate(schemas.createAmcRequestSchema), asyncHandler(customer.createAmcRequest));
router.get('/amc/requests/:id', requireAccess('customer.amc.read'), validate(schemas.idParam), asyncHandler(customer.getAmcRequest));
router.patch('/amc/requests/:id', requireAccess('customer.amc.write'), validate(schemas.updateAmcRequestSchema), asyncHandler(customer.updateAmcRequest));
router.post('/amc/requests/:id/submit', requireAccess('customer.amc.write'), validate(schemas.idParam), asyncHandler(customer.submitAmcRequest));
router.post('/amc/requests/:id/cancel', requireAccess('customer.amc.write'), validate(schemas.cancelSchema), asyncHandler(customer.cancelAmcRequest));
router.post('/amc/requests/:id/status', requireAccess('customer.amc.write'), validate(schemas.amcStatusSchema), asyncHandler(customer.setAmcRequestStatus));
router.get('/amc/requests/:id/history', requireAccess('customer.amc.read'), validate(schemas.idParam), asyncHandler(customer.amcRequestHistory));

router.get('/amc/reschedules', requireAccess('customer.amc.read'), validate(schemas.rescheduleListQuery), asyncHandler(customer.listReschedules));
router.post('/amc/reschedules', requireAccess('customer.amc.write'), validate(schemas.createRescheduleSchema), asyncHandler(customer.createReschedule));
router.get('/amc/reschedules/:id', requireAccess('customer.amc.read'), validate(schemas.idParam), asyncHandler(customer.getReschedule));
router.post('/amc/reschedules/:id/review', requireAccess('customer.amc.manage'), validate(schemas.reviewRescheduleSchema), asyncHandler(customer.reviewReschedule));
router.post('/amc/reschedules/:id/cancel', requireAccess('customer.amc.write'), validate(schemas.cancelSchema), asyncHandler(customer.cancelReschedule));

router.get('/repairs/devices', requireAccess('customer.repairs.read'), validate(schemas.deviceListQuery), asyncHandler(customer.listDevices));
router.post('/repairs/devices', requireAccess('customer.repairs.write'), validate(schemas.createDeviceSchema), asyncHandler(customer.createDevice));
router.get('/repairs/devices/:id', requireAccess('customer.repairs.read'), validate(schemas.idParam), asyncHandler(customer.getDevice));
router.patch('/repairs/devices/:id', requireAccess('customer.repairs.write'), validate(schemas.updateDeviceSchema), asyncHandler(customer.updateDevice));

router.get('/repairs/tickets', requireAccess('customer.repairs.read'), validate(schemas.ticketListQuery), asyncHandler(customer.listTickets));
router.post('/repairs/tickets', requireAccess('customer.repairs.write'), validate(schemas.createTicketSchema), asyncHandler(customer.createTicket));
router.get('/repairs/tickets/:id', requireAccess('customer.repairs.read'), validate(schemas.idParam), asyncHandler(customer.getTicket));
router.patch('/repairs/tickets/:id', requireAccess('customer.repairs.write'), validate(schemas.updateTicketSchema), asyncHandler(customer.updateTicket));
router.post('/repairs/tickets/:id/submit', requireAccess('customer.repairs.write'), validate(schemas.idParam), asyncHandler(customer.submitTicket));
router.post('/repairs/tickets/:id/cancel', requireAccess('customer.repairs.write'), validate(schemas.cancelSchema), asyncHandler(customer.cancelTicket));
router.post('/repairs/tickets/:id/status', requireAccess('customer.repairs.write'), validate(schemas.repairStatusSchema), asyncHandler(customer.setTicketStatus));
router.get('/repairs/tickets/:id/history', requireAccess('customer.repairs.read'), validate(schemas.idParam), asyncHandler(customer.ticketHistory));

router.get('/projects/categories', requireAccess('customer.projects.read'), asyncHandler(customer.listProjectCategories));
router.get('/projects/requests', requireAccess('customer.projects.read'), validate(schemas.projectListQuery), asyncHandler(customer.listProjectRequests));
router.post('/projects/requests', requireAccess('customer.projects.write'), validate(schemas.createProjectSchema), asyncHandler(customer.createProjectRequest));
router.get('/projects/requests/:id', requireAccess('customer.projects.read'), validate(schemas.idParam), asyncHandler(customer.getProjectRequest));
router.patch('/projects/requests/:id', requireAccess('customer.projects.write'), validate(schemas.updateProjectSchema), asyncHandler(customer.updateProjectRequest));
router.post('/projects/requests/:id/submit', requireAccess('customer.projects.write'), validate(schemas.idParam), asyncHandler(customer.submitProjectRequest));
router.post('/projects/requests/:id/cancel', requireAccess('customer.projects.write'), validate(schemas.cancelSchema), asyncHandler(customer.cancelProjectRequest));
router.post('/projects/requests/:id/status', requireAccess('customer.projects.write'), validate(schemas.projectStatusSchema), asyncHandler(customer.setProjectStatus));
router.get('/projects/requests/:id/history', requireAccess('customer.projects.read'), validate(schemas.idParam), asyncHandler(customer.projectHistory));

router.get('/service-categories', requireAccess('customer.services.read'), asyncHandler(customer.listServiceCategories));
router.get('/service-categories/:categoryId/services', requireAccess('customer.services.read'), validate(schemas.categoryParam), asyncHandler(customer.categoryServices));
router.get('/service-requests', requireAccess('customer.services.read'), validate(schemas.serviceListQuery), asyncHandler(customer.listServiceRequests));
router.post('/service-requests', requireAccess('customer.services.write'), validate(schemas.createServiceRequestSchema), asyncHandler(customer.createServiceRequest));
router.get('/service-requests/:id', requireAccess('customer.services.read'), validate(schemas.idParam), asyncHandler(customer.getServiceRequest));
router.post('/service-requests/:id/cancel', requireAccess('customer.services.write'), validate(schemas.cancelSchema), asyncHandler(customer.cancelServiceRequest));
router.post('/service-requests/:id/status', requireAccess('customer.services.write'), validate(schemas.serviceStatusSchema), asyncHandler(customer.setServiceStatus));
router.get('/service-requests/:id/history', requireAccess('customer.services.read'), validate(schemas.idParam), asyncHandler(customer.serviceRequestHistory));

module.exports = router;
