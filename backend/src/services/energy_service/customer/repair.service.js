const AppError = require('../../../utils/energy_service/AppError');
const { withTransaction } = require('../../../utils/energy_service/transaction');
const { assertStatusChange } = require('../../../domain/energy_service/customerStatus');
const repairModel = require('../../../models/energy_service/customer/repair.model');
const attachmentModel = require('../../../models/energy_service/customer/attachment.model');
const historyModel = require('../../../models/energy_service/customer/history.model');
const presenters = require('./presenters');
const support = require('./support');

const MANAGE = 'customer.repairs.manage';

function missingTicketFields(row) {
  const missing = [];
  if (!row.device_id) missing.push({ path: 'deviceId', message: 'Choose the device.' });
  if (!row.repair_scope) missing.push({ path: 'repairScope', message: 'Choose the repair scope.' });
  if (!row.service_type) missing.push({ path: 'serviceType', message: 'Choose the service type.' });
  if (!row.priority) missing.push({ path: 'priority', message: 'Choose the priority.' });
  if (!row.issue_description || row.issue_description.trim().length < 2) {
    missing.push({ path: 'issueDescription', message: 'Describe the issue.' });
  }
  return missing;
}

async function assertDevice(companyId, deviceId, siteId, client, forUpdate = false) {
  if (!deviceId) return null;
  const device = await repairModel.findDevice(deviceId, companyId, client, forUpdate);
  if (!device) throw new AppError('That device was not found.', 422, 'INVALID_DEVICE');
  if (siteId && device.site_id !== siteId) {
    throw new AppError('The repair site must match the device site.', 422, 'DEVICE_SITE_MISMATCH');
  }
  return device;
}

async function presentTicket(companyId, row, client, withHistory) {
  const [attachments, history] = await Promise.all([
    attachmentModel.listByEntity(companyId, 'repair_ticket', row.id, client),
    withHistory ? historyModel.list(companyId, 'repair_ticket', row.id, client) : Promise.resolve(null),
  ]);
  return presenters.ticket(row, { attachments, history: withHistory ? history : null });
}

async function listDevices(user, query) {
  const companyId = support.companyIdOf(user);
  const page = support.pageOf(query);
  const result = await repairModel.listDevices({
    companyId,
    siteId: query.siteId,
    deviceType: query.deviceType,
    q: query.q,
    limit: page.limit,
    offset: page.offset,
  });
  return support.paged(result, page.page, page.limit, presenters.device);
}

async function getDevice(user, id) {
  const companyId = support.companyIdOf(user);
  const row = await repairModel.findDevice(id, companyId);
  if (!row) support.notFound('Device');
  return { device: presenters.device(row) };
}

async function createDevice(user, body, req) {
  if (!body.installationLocation && body.location) body.installationLocation = body.location;
  support.assertIdentity(user, body);
  const companyId = support.companyIdOf(user);
  try {
    return await withTransaction(async (client) => {
      await support.assertSite(companyId, body.siteId, client);
      const customer = await support.ensureCustomer(user, client);
      const row = await repairModel.insertDevice({
        customerId: customer.id,
        companyId,
        siteId: body.siteId,
        deviceType: body.deviceType,
        manufacturer: body.manufacturer,
        model: body.model || null,
        serialNumber: body.serialNumber || null,
        assetNumber: body.assetNumber,
        installationLocation: body.installationLocation,
        powerRating: body.powerRating || null,
        description: body.description,
      }, client);
      await support.audit(req, user, 'customer.repair.device.create', 'device', row.id, row.site_id, 'Device registered.', client);
      return { device: presenters.device(row) };
    });
  } catch (err) {
    support.mapDbError(err);
  }
}

async function updateDevice(user, id, body, req) {
  if (!body.installationLocation && body.location) body.installationLocation = body.location;
  support.assertIdentity(user, body);
  const companyId = support.companyIdOf(user);
  try {
    return await withTransaction(async (client) => {
      const current = await repairModel.findDevice(id, companyId, client, true);
      if (!current) support.notFound('Device');
      if (body.siteId) await support.assertSite(companyId, body.siteId, client);
      const row = await repairModel.updateDevice(id, companyId, {
        siteId: body.siteId,
        deviceType: body.deviceType,
        manufacturer: body.manufacturer,
        model: body.model,
        serialNumber: body.serialNumber,
        setAssetNumber: Object.prototype.hasOwnProperty.call(body, 'assetNumber'),
        assetNumber: body.assetNumber,
        installationLocation: body.installationLocation,
        powerRating: body.powerRating,
        setDescription: Object.prototype.hasOwnProperty.call(body, 'description'),
        description: body.description,
      }, client);
      await support.audit(req, user, 'customer.repair.device.update', 'device', id, row.site_id, 'Device updated.', client);
      return { device: presenters.device(row) };
    });
  } catch (err) {
    support.mapDbError(err);
  }
}

async function listTickets(user, query) {
  const companyId = support.companyIdOf(user);
  const page = support.pageOf(query);
  const result = await repairModel.listTickets({
    companyId,
    status: query.status,
    siteId: query.siteId,
    deviceId: query.deviceId,
    priority: query.priority,
    q: query.q,
    limit: page.limit,
    offset: page.offset,
  });
  return support.paged(result, page.page, page.limit, (row) => presenters.ticket(row));
}

async function getTicket(user, id) {
  const companyId = support.companyIdOf(user);
  const row = await repairModel.findTicket(id, companyId);
  if (!row) support.notFound('Repair ticket');
  return { ticket: await presentTicket(companyId, row, null, true) };
}

async function createTicket(user, body, req) {
  if (!body.faultInformation && body.errorDetails) body.faultInformation = body.errorDetails;
  support.assertIdentity(user, body);
  const companyId = support.companyIdOf(user);
  const submit = body.submit === true;
  try {
    return await withTransaction(async (client) => {
      await support.assertSite(companyId, body.siteId, client);
      const customer = await support.ensureCustomer(user, client);
      await assertDevice(companyId, body.deviceId, body.siteId, client);
      const status = submit ? 'submitted' : 'draft';
      const draft = {
        device_id: body.deviceId || null,
        repair_scope: body.repairScope || null,
        service_type: body.serviceType || null,
        priority: body.priority || null,
        issue_description: body.issueDescription || null,
      };
      if (submit) {
        const missing = missingTicketFields(draft);
        if (missing.length) {
          throw new AppError('Add the device, scope, and issue details before submitting.', 422, 'VALIDATION_ERROR', missing);
        }
      } else if (!draft.device_id && !draft.repair_scope && !draft.issue_description) {
        throw new AppError('Add the device, scope, or issue before saving.', 422, 'VALIDATION_ERROR');
      }
      const ticketNumber = await repairModel.nextTicketNumber(client);
      const row = await repairModel.insertTicket({
        ticketNumber,
        customerId: customer.id,
        companyId,
        siteId: body.siteId,
        deviceId: body.deviceId,
        repairScope: body.repairScope,
        serviceType: body.serviceType,
        priority: body.priority,
        requestedTurnaround: body.requestedTurnaround,
        additionalRequirements: body.additionalRequirements,
        issueDescription: body.issueDescription,
        symptoms: body.symptoms,
        faultInformation: body.faultInformation,
        status,
        submittedAt: submit ? new Date() : null,
      }, client);
      await support.recordStatus(client, {
        companyId,
        entityType: 'repair_ticket',
        entityId: row.id,
        toStatus: status,
        user,
      });
      await support.linkAttachments(client, {
        companyId,
        entityType: 'repair_ticket',
        entityId: row.id,
        attachmentIds: body.attachmentIds,
      });
      await support.audit(
        req,
        user,
        submit ? 'customer.repair.ticket.submit' : 'customer.repair.ticket.save',
        'repair_ticket',
        row.id,
        row.site_id,
        submit ? 'Repair ticket submitted.' : 'Repair ticket saved.',
        client,
      );
      const ticket = await presentTicket(companyId, row, client, true);
      if (!submit) return { ticket };
      return {
        ticket,
        confirmation: {
          referenceId: row.id,
          ticketNumber: row.ticket_number,
          status: 'submitted',
          submittedAt: row.submitted_at,
        },
      };
    });
  } catch (err) {
    support.mapDbError(err);
  }
}

async function updateTicket(user, id, body, req) {
  if (!body.faultInformation && body.errorDetails) body.faultInformation = body.errorDetails;
  support.assertIdentity(user, body);
  const companyId = support.companyIdOf(user);
  try {
    return await withTransaction(async (client) => {
      const current = await repairModel.findTicket(id, companyId, client, true);
      if (!current) support.notFound('Repair ticket');
      if (current.status !== 'draft') {
        throw new AppError('Only a draft repair ticket can be edited.', 409, 'NOT_EDITABLE');
      }
      const siteId = body.siteId || current.site_id;
      if (body.siteId) await support.assertSite(companyId, siteId, client);
      const setDevice = Object.prototype.hasOwnProperty.call(body, 'deviceId');
      const deviceId = setDevice ? body.deviceId : current.device_id;
      await assertDevice(companyId, deviceId, siteId, client);
      const row = await repairModel.updateTicket(id, companyId, {
        siteId: body.siteId,
        setDevice,
        deviceId,
        repairScope: body.repairScope,
        serviceType: body.serviceType,
        priority: body.priority,
        setTurnaround: Object.prototype.hasOwnProperty.call(body, 'requestedTurnaround'),
        requestedTurnaround: body.requestedTurnaround,
        setRequirements: Object.prototype.hasOwnProperty.call(body, 'additionalRequirements'),
        additionalRequirements: body.additionalRequirements,
        issueDescription: body.issueDescription,
        setSymptoms: Object.prototype.hasOwnProperty.call(body, 'symptoms'),
        symptoms: body.symptoms,
        setFault: Object.prototype.hasOwnProperty.call(body, 'faultInformation'),
        faultInformation: body.faultInformation,
      }, client);
      if (body.attachmentIds) {
        await support.linkAttachments(client, {
          companyId,
          entityType: 'repair_ticket',
          entityId: id,
          attachmentIds: body.attachmentIds,
          replace: true,
        });
      }
      await support.audit(req, user, 'customer.repair.ticket.update', 'repair_ticket', id, row.site_id, 'Repair ticket updated.', client);
      return { ticket: await presentTicket(companyId, row, client, true) };
    });
  } catch (err) {
    support.mapDbError(err);
  }
}

async function transitionTicket(user, id, toStatus, req, note) {
  const companyId = support.companyIdOf(user);
  const actor = support.actorKind(user, MANAGE);
  try {
    return await withTransaction(async (client) => {
      const current = await repairModel.findTicket(id, companyId, client, true);
      if (!current) support.notFound('Repair ticket');
      if (toStatus === 'submitted') {
        const missing = missingTicketFields(current);
        if (missing.length) {
          throw new AppError('Add the device, scope, and issue details before submitting.', 422, 'VALIDATION_ERROR', missing);
        }
      }
      assertStatusChange('repair_ticket', current.status, toStatus, actor);
      const row = await repairModel.setTicketStatus(id, companyId, {
        status: toStatus,
        submittedAt: toStatus === 'submitted' ? new Date() : null,
      }, client);
      await support.recordStatus(client, {
        companyId,
        entityType: 'repair_ticket',
        entityId: id,
        fromStatus: current.status,
        toStatus,
        user,
        note,
      });
      await support.audit(req, user, 'customer.repair.ticket.status', 'repair_ticket', id, row.site_id, 'Repair ticket status changed.', client);
      const ticket = await presentTicket(companyId, row, client, true);
      if (toStatus !== 'submitted') return { ticket };
      return {
        ticket,
        confirmation: {
          referenceId: row.id,
          ticketNumber: row.ticket_number,
          status: 'submitted',
          submittedAt: row.submitted_at,
        },
      };
    });
  } catch (err) {
    support.mapDbError(err);
  }
}

function submitTicket(user, id, req) {
  return transitionTicket(user, id, 'submitted', req);
}

function cancelTicket(user, id, body, req) {
  return transitionTicket(user, id, 'cancelled', req, body.note);
}

function changeTicketStatus(user, id, body, req) {
  return transitionTicket(user, id, body.status, req, body.note);
}

async function ticketHistory(user, id) {
  const companyId = support.companyIdOf(user);
  const row = await repairModel.findTicket(id, companyId);
  if (!row) support.notFound('Repair ticket');
  const history = await historyModel.list(companyId, 'repair_ticket', id);
  return { statusHistory: history.map(presenters.statusEvent) };
}

module.exports = {
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
  changeTicketStatus,
  ticketHistory,
};
