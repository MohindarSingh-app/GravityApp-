const AppError = require('../../../utils/energy_service/AppError');
const { withTransaction } = require('../../../utils/energy_service/transaction');
const { assertStatusChange, canTransition, AMC_REQUEST_TRANSITIONS } = require('../../../domain/energy_service/customerStatus');
const amcModel = require('../../../models/energy_service/customer/amc.model');
const attachmentModel = require('../../../models/energy_service/customer/attachment.model');
const historyModel = require('../../../models/energy_service/customer/history.model');
const presenters = require('./presenters');
const support = require('./support');

const MANAGE = 'customer.amc.manage';
const CONTRACT_REQUIRED = new Set(['renewal', 'visit', 'coverage_change']);
const RESCHEDULE_FROM = new Set(['scheduled', 'confirmed', 'rescheduled']);

function useAmcAliases(body) {
  if (!body.amcType && body.contractType) body.amcType = body.contractType;
  if (body.existingContractId === undefined && body.contractId !== undefined) body.existingContractId = body.contractId;
  if (!body.requestedService && body.serviceRequirement) body.requestedService = body.serviceRequirement;
  if (!body.oldScheduledDate && body.previousSchedule) body.oldScheduledDate = body.previousSchedule;
  if (!body.requestedNewDate && body.requestedSchedule) body.requestedNewDate = body.requestedSchedule;
}

function assertRequestContract(requestType, contractId) {
  if (requestType === 'new_amc' && contractId) {
    throw new AppError('A new AMC request does not use an existing contract.', 422, 'CONTRACT_NOT_ALLOWED');
  }
  if (CONTRACT_REQUIRED.has(requestType) && !contractId) {
    throw new AppError('Choose the AMC contract for this request.', 422, 'CONTRACT_REQUIRED');
  }
}

async function loadContract(companyId, contractId, siteId, client, forUpdate = false) {
  if (!contractId) return null;
  const contract = await amcModel.findContract(contractId, companyId, client, forUpdate);
  if (!contract) {
    throw new AppError('That AMC contract was not found.', 422, 'INVALID_CONTRACT');
  }
  if (siteId && contract.site_id !== siteId) {
    throw new AppError('The request site must match the AMC contract site.', 422, 'CONTRACT_SITE_MISMATCH');
  }
  return contract;
}

function assertVisitWindow(start, end, nextVisit) {
  support.assertDateOrder(start, end);
  if (nextVisit && (nextVisit < start || nextVisit > end)) {
    throw new AppError('The next visit must fall within the contract dates.', 422, 'VALIDATION_ERROR');
  }
}

async function presentRequest(companyId, row, client, withHistory) {
  const [attachments, history] = await Promise.all([
    attachmentModel.listByEntity(companyId, 'amc_request', row.id, client),
    withHistory ? historyModel.list(companyId, 'amc_request', row.id, client) : Promise.resolve(null),
  ]);
  return presenters.amcRequest(row, {
    attachments,
    history: withHistory ? history : null,
  });
}

async function listContracts(user, query) {
  const companyId = support.companyIdOf(user);
  const page = support.pageOf(query);
  const result = await amcModel.listContracts({
    companyId,
    status: query.status,
    siteId: query.siteId,
    q: query.q,
    limit: page.limit,
    offset: page.offset,
  });
  const activeCount = await amcModel.countActiveContracts(companyId);
  return {
    ...support.paged(result, page.page, page.limit, (row) => presenters.contract(row)),
    activeCount,
  };
}

async function getContract(user, id) {
  const companyId = support.companyIdOf(user);
  const row = await amcModel.findContract(id, companyId);
  if (!row) support.notFound('AMC contract');
  const openRequestCount = await amcModel.countOpenRequests(id, companyId);
  return { contract: presenters.contract(row, { openRequestCount }) };
}

async function createContract(user, body, req) {
  useAmcAliases(body);
  support.assertIdentity(user, body);
  const companyId = support.companyIdOf(user);
  try {
    return await withTransaction(async (client) => {
      await support.assertSite(companyId, body.siteId, client);
      const customer = await support.resolveCustomer(companyId, user, body.customerId, client);
      const startDate = body.startDate;
      const endDate = body.endDate;
      const nextVisitDate = body.visitSchedule.nextVisitDate || null;
      assertVisitWindow(startDate, endDate, nextVisitDate);
      const contractNumber = await amcModel.nextContractNumber(client);
      const row = await amcModel.insertContract({
        customerId: customer.id,
        companyId,
        siteId: body.siteId,
        contractNumber,
        amcType: body.amcType,
        coverage: body.coverage,
        startDate,
        endDate,
        visitFrequency: body.visitSchedule.frequency,
        visitsPerYear: body.visitSchedule.visitsPerYear,
        nextVisitDate,
        preferredVisitTime: body.visitSchedule.preferredTime,
        status: 'active',
        assignedEngineerName: body.assignedService && body.assignedService.engineerName,
        assignedServiceTeam: body.assignedService && body.assignedService.serviceTeam,
        serviceContact: body.assignedService && body.assignedService.contact,
      }, client);
      await support.recordStatus(client, {
        companyId,
        entityType: 'amc_contract',
        entityId: row.id,
        toStatus: 'active',
        user,
      });
      await support.audit(req, user, 'customer.amc.contract.create', 'amc_contract', row.id, row.site_id, 'AMC contract created.', client);
      return { contract: presenters.contract(row, { openRequestCount: 0 }) };
    });
  } catch (err) {
    support.mapDbError(err);
  }
}

async function updateContract(user, id, body, req) {
  useAmcAliases(body);
  support.assertIdentity(user, body);
  const companyId = support.companyIdOf(user);
  try {
    return await withTransaction(async (client) => {
      const current = await amcModel.findContract(id, companyId, client, true);
      if (!current) support.notFound('AMC contract');
      if (body.siteId) await support.assertSite(companyId, body.siteId, client);
      const resolvedCustomer = body.customerId
        ? await support.resolveCustomer(companyId, user, body.customerId, client)
        : null;
      const start = body.startDate || support.asDateString(current.start_date);
      const end = body.endDate || support.asDateString(current.end_date);
      const next = body.visitSchedule && body.visitSchedule.nextVisitDate
        ? body.visitSchedule.nextVisitDate
        : support.asDateString(current.next_visit_date);
      assertVisitWindow(start, end, next);
      const schedule = body.visitSchedule || {};
      const assigned = body.assignedService || {};
      const row = await amcModel.updateContract(id, companyId, {
        amcType: body.amcType,
        coverage: body.coverage,
        startDate: body.startDate,
        endDate: body.endDate,
        visitFrequency: schedule.frequency,
        visitsPerYear: schedule.visitsPerYear,
        nextVisitDate: schedule.nextVisitDate,
        setPreferredVisitTime: Object.prototype.hasOwnProperty.call(schedule, 'preferredTime'),
        preferredVisitTime: schedule.preferredTime,
        setEngineer: Object.prototype.hasOwnProperty.call(assigned, 'engineerName'),
        assignedEngineerName: assigned.engineerName,
        setTeam: Object.prototype.hasOwnProperty.call(assigned, 'serviceTeam'),
        assignedServiceTeam: assigned.serviceTeam,
        setContact: Object.prototype.hasOwnProperty.call(assigned, 'contact'),
        serviceContact: assigned.contact,
        siteId: body.siteId,
        customerId: resolvedCustomer && resolvedCustomer.id,
      }, client);
      await support.audit(req, user, 'customer.amc.contract.update', 'amc_contract', row.id, row.site_id, 'AMC contract updated.', client);
      const openRequestCount = await amcModel.countOpenRequests(id, companyId, client);
      return { contract: presenters.contract(row, { openRequestCount }) };
    });
  } catch (err) {
    support.mapDbError(err);
  }
}

async function changeContractStatus(user, id, body, req) {
  const companyId = support.companyIdOf(user);
  return withTransaction(async (client) => {
    const current = await amcModel.findContract(id, companyId, client, true);
    if (!current) support.notFound('AMC contract');
    assertStatusChange('amc_contract', current.status, body.status, support.actorKind(user, MANAGE));
    const row = await amcModel.setContractStatus(id, companyId, body.status, client);
    await support.recordStatus(client, {
      companyId,
      entityType: 'amc_contract',
      entityId: row.id,
      fromStatus: current.status,
      toStatus: body.status,
      user,
      note: body.note,
    });
    await support.audit(req, user, 'customer.amc.contract.status', 'amc_contract', row.id, row.site_id, 'AMC contract status changed.', client);
    return { contract: presenters.contract(row) };
  });
}

async function listRequests(user, query) {
  const companyId = support.companyIdOf(user);
  const page = support.pageOf(query);
  const result = await amcModel.listRequests({
    companyId,
    status: query.status,
    siteId: query.siteId,
    contractId: query.contractId,
    q: query.q,
    limit: page.limit,
    offset: page.offset,
  });
  return support.paged(result, page.page, page.limit, (row) => presenters.amcRequest(row));
}

async function getRequest(user, id) {
  const companyId = support.companyIdOf(user);
  const row = await amcModel.findRequest(id, companyId);
  if (!row) support.notFound('AMC request');
  return { request: await presentRequest(companyId, row, null, true) };
}

async function createRequest(user, body, req) {
  useAmcAliases(body);
  support.assertIdentity(user, body);
  const companyId = support.companyIdOf(user);
  const submit = body.submit === true;
  if (submit && body.preferredDate) support.assertNotPast(body.preferredDate, 'Preferred date');
  try {
    return await withTransaction(async (client) => {
      await support.assertSite(companyId, body.siteId, client);
      assertRequestContract(body.requestType, body.existingContractId);
      const customer = await support.ensureCustomer(user, client);
      await loadContract(companyId, body.existingContractId, body.siteId, client);
      const status = submit ? 'submitted' : 'draft';
      const row = await amcModel.insertRequest({
        customerId: customer.id,
        companyId,
        siteId: body.siteId,
        existingContractId: body.existingContractId,
        requestType: body.requestType,
        requestedService: body.requestedService,
        preferredDate: body.preferredDate,
        preferredTime: body.preferredTime,
        description: body.description,
        status,
        submittedAt: submit ? new Date() : null,
      }, client);
      await support.recordStatus(client, {
        companyId,
        entityType: 'amc_request',
        entityId: row.id,
        toStatus: status,
        user,
      });
      await support.linkAttachments(client, {
        companyId,
        entityType: 'amc_request',
        entityId: row.id,
        attachmentIds: body.attachmentIds,
      });
      await support.audit(
        req,
        user,
        submit ? 'customer.amc.request.submit' : 'customer.amc.request.save',
        'amc_request',
        row.id,
        row.site_id,
        submit ? 'AMC request submitted.' : 'AMC request saved.',
        client,
      );
      const request = await presentRequest(companyId, row, client, true);
      if (!submit) return { request };
      return {
        request,
        confirmation: {
          referenceId: row.id,
          status: 'submitted',
          submittedAt: row.submitted_at,
        },
      };
    });
  } catch (err) {
    support.mapDbError(err);
  }
}

async function updateRequest(user, id, body, req) {
  useAmcAliases(body);
  support.assertIdentity(user, body);
  const companyId = support.companyIdOf(user);
  try {
    return await withTransaction(async (client) => {
      const current = await amcModel.findRequest(id, companyId, client, true);
      if (!current) support.notFound('AMC request');
      if (current.status !== 'draft') {
        throw new AppError('Only a draft AMC request can be edited.', 409, 'NOT_EDITABLE');
      }
      const siteId = body.siteId || current.site_id;
      if (body.siteId) await support.assertSite(companyId, body.siteId, client);
      const setContract = Object.prototype.hasOwnProperty.call(body, 'existingContractId');
      const contractId = setContract ? body.existingContractId : current.contract_id;
      const requestType = body.requestType || current.request_type;
      assertRequestContract(requestType, contractId);
      await loadContract(companyId, contractId, siteId, client);
      const row = await amcModel.updateRequest(id, companyId, {
        siteId: body.siteId,
        setContract,
        existingContractId: contractId,
        requestType: body.requestType,
        requestedService: body.requestedService,
        preferredDate: body.preferredDate,
        setPreferredTime: Object.prototype.hasOwnProperty.call(body, 'preferredTime'),
        preferredTime: body.preferredTime,
        setDescription: Object.prototype.hasOwnProperty.call(body, 'description'),
        description: body.description,
      }, client);
      if (body.attachmentIds) {
        await support.linkAttachments(client, {
          companyId,
          entityType: 'amc_request',
          entityId: id,
          attachmentIds: body.attachmentIds,
          replace: true,
        });
      }
      await support.audit(req, user, 'customer.amc.request.update', 'amc_request', id, row.site_id, 'AMC request updated.', client);
      return { request: await presentRequest(companyId, row, client, true) };
    });
  } catch (err) {
    support.mapDbError(err);
  }
}

async function transitionRequest(user, id, toStatus, req, { note, scheduledDate, scheduledTime, submittedAt } = {}) {
  const companyId = support.companyIdOf(user);
  const actor = support.actorKind(user, MANAGE);
  if (toStatus === 'reschedule_requested') {
    throw new AppError('Request a reschedule with the reschedule endpoint.', 409, 'USE_RESCHEDULE');
  }
  try {
    return await withTransaction(async (client) => {
    const current = await amcModel.findRequest(id, companyId, client, true);
    if (!current) support.notFound('AMC request');
    if (current.status === 'reschedule_requested' && toStatus !== 'cancelled') {
      throw new AppError('Approve or reject the pending reschedule first.', 409, 'RESCHEDULE_PENDING');
    }
    if (toStatus === 'submitted' && current.preferred_date) {
      support.assertNotPast(support.asDateString(current.preferred_date), 'Preferred date');
    }
    if (toStatus === 'scheduled') {
      if (!scheduledDate) {
        throw new AppError('Choose the scheduled visit date.', 422, 'VALIDATION_ERROR');
      }
      support.assertNotPast(scheduledDate, 'Scheduled date');
    }
    assertStatusChange('amc_request', current.status, toStatus, actor);
    if (toStatus === 'cancelled') {
      const closed = await amcModel.cancelPendingForRequest(id, companyId, user.id, client);
      for (const item of closed) {
        await support.recordStatus(client, {
          companyId,
          entityType: 'amc_reschedule',
          entityId: item.id,
          fromStatus: 'pending',
          toStatus: 'cancelled',
          user,
          note: 'Request cancelled.',
        });
      }
    }
    const row = await amcModel.setRequestStatus(id, companyId, {
      status: toStatus,
      scheduledDate: toStatus === 'scheduled' ? scheduledDate : null,
      setScheduledTime: toStatus === 'scheduled' && scheduledTime !== undefined,
      scheduledTime,
      submittedAt: toStatus === 'submitted' ? (submittedAt || new Date()) : null,
    }, client);
    await support.recordStatus(client, {
      companyId,
      entityType: 'amc_request',
      entityId: id,
      fromStatus: current.status,
      toStatus,
      user,
      note,
    });
    await support.audit(req, user, 'customer.amc.request.status', 'amc_request', id, row.site_id, 'AMC request status changed.', client);
    const request = await presentRequest(companyId, row, client, true);
    if (toStatus !== 'submitted') return { request };
    return {
      request,
      confirmation: {
        referenceId: row.id,
        status: 'submitted',
        submittedAt: row.submitted_at,
      },
    };
    });
  } catch (err) {
    support.mapDbError(err);
  }
}

function submitRequest(user, id, req) {
  return transitionRequest(user, id, 'submitted', req);
}

function cancelRequest(user, id, body, req) {
  return transitionRequest(user, id, 'cancelled', req, { note: body.note });
}

function changeRequestStatus(user, id, body, req) {
  return transitionRequest(user, id, body.status, req, {
    note: body.note,
    scheduledDate: body.scheduledDate,
    scheduledTime: body.scheduledTime,
  });
}

async function requestHistory(user, id) {
  const companyId = support.companyIdOf(user);
  const row = await amcModel.findRequest(id, companyId);
  if (!row) support.notFound('AMC request');
  const history = await historyModel.list(companyId, 'amc_request', id);
  return { statusHistory: history.map(presenters.statusEvent) };
}

async function listReschedules(user, query) {
  const companyId = support.companyIdOf(user);
  const page = support.pageOf(query);
  const result = await amcModel.listReschedules({
    companyId,
    status: query.status,
    requestId: query.requestId,
    contractId: query.contractId,
    limit: page.limit,
    offset: page.offset,
  });
  return support.paged(result, page.page, page.limit, presenters.reschedule);
}

async function getReschedule(user, id) {
  const companyId = support.companyIdOf(user);
  const row = await amcModel.findReschedule(id, companyId);
  if (!row) support.notFound('AMC reschedule');
  const history = await historyModel.list(companyId, 'amc_reschedule', id);
  return {
    reschedule: presenters.reschedule(row),
    statusHistory: history.map(presenters.statusEvent),
  };
}

async function createReschedule(user, body, req) {
  useAmcAliases(body);
  support.assertIdentity(user, body);
  const companyId = support.companyIdOf(user);
  if (!body.requestId && !body.contractId) {
    throw new AppError('Choose the AMC contract or request to reschedule.', 422, 'VALIDATION_ERROR');
  }
  support.assertNotPast(body.requestedNewDate, 'Requested date');
  try {
    return await withTransaction(async (client) => {
      let request = null;
      let contract = null;
      if (body.requestId) {
        request = await amcModel.findRequest(body.requestId, companyId, client, true);
        if (!request) support.notFound('AMC request');
        if (!RESCHEDULE_FROM.has(request.status)) {
          throw new AppError('This visit is not scheduled yet.', 409, 'NOT_SCHEDULED');
        }
        if (support.asDateString(request.scheduled_date) !== body.oldScheduledDate) {
          throw new AppError('The current scheduled date does not match.', 422, 'SCHEDULE_MISMATCH');
        }
      }
      const customer = await support.ensureCustomer(user, client);
      const contractId = body.contractId || (request && request.contract_id) || null;
      if (body.contractId && request && request.contract_id && request.contract_id !== body.contractId) {
        throw new AppError('That contract is not linked to this AMC request.', 422, 'CONTRACT_MISMATCH');
      }
      if (contractId) {
        contract = await amcModel.findContract(contractId, companyId, client, true);
        if (!contract) support.notFound('AMC contract');
      }
      if (!request) {
        if (!contract || contract.status !== 'active') {
          throw new AppError('Only an active AMC contract can be rescheduled.', 409, 'NOT_SCHEDULED');
        }
        if (support.asDateString(contract.next_visit_date) !== body.oldScheduledDate) {
          throw new AppError('The current scheduled date does not match.', 422, 'SCHEDULE_MISMATCH');
        }
      }
      if (contract) {
        const start = support.asDateString(contract.start_date);
        const end = support.asDateString(contract.end_date);
        if (body.requestedNewDate < start || body.requestedNewDate > end) {
          throw new AppError('The requested date must fall within the contract dates.', 422, 'VALIDATION_ERROR');
        }
      }
      const pending = await amcModel.hasPendingVisit({
        companyId,
        requestId: request && request.id,
        contractId: contract && contract.id,
      }, client);
      if (pending) {
        throw new AppError('A reschedule is already pending for this visit.', 409, 'RESCHEDULE_PENDING');
      }
      const created = await amcModel.insertReschedule({
        amcRequestId: request && request.id,
        amcContractId: contract && contract.id,
        customerId: customer.id,
        companyId,
        oldScheduledDate: body.oldScheduledDate,
        requestedNewDate: body.requestedNewDate,
        requestedNewTime: body.requestedNewTime,
        reason: body.reason,
        notes: body.notes,
        previousRequestStatus: request && request.status,
      }, client);
      await support.recordStatus(client, {
        companyId,
        entityType: 'amc_reschedule',
        entityId: created.id,
        toStatus: 'pending',
        user,
        note: body.reason,
      });
      if (request) {
        assertStatusChange('amc_request', request.status, 'reschedule_requested', support.actorKind(user, MANAGE));
        await amcModel.setRequestStatus(request.id, companyId, { status: 'reschedule_requested' }, client);
        await support.recordStatus(client, {
          companyId,
          entityType: 'amc_request',
          entityId: request.id,
          fromStatus: request.status,
          toStatus: 'reschedule_requested',
          user,
          note: body.reason,
        });
      }
      await support.audit(req, user, 'customer.amc.reschedule.create', 'amc_reschedule', created.id, contract && contract.site_id, 'AMC visit reschedule requested.', client);
      return { reschedule: presenters.reschedule(created) };
    });
  } catch (err) {
    support.mapDbError(err);
  }
}

async function reviewReschedule(user, id, body, req) {
  const companyId = support.companyIdOf(user);
  const actor = support.actorKind(user, MANAGE);
  return withTransaction(async (client) => {
    const current = await amcModel.findReschedule(id, companyId, client, true);
    if (!current) support.notFound('AMC reschedule');
    if (current.status !== 'pending') {
      throw new AppError('This reschedule has already been reviewed.', 409, 'NOT_PENDING');
    }
    let request = null;
    if (current.amc_request_id) {
      request = await amcModel.findRequest(current.amc_request_id, companyId, client, true);
      if (!request) support.notFound('AMC request');
    }
    const decision = body.decision;
    const rescheduleStatus = decision === 'approved' ? 'approved' : 'rejected';
    const closed = await amcModel.closeReschedule(id, companyId, {
      status: rescheduleStatus,
      reviewedBy: user.id,
      reviewNote: body.note,
    }, client);
    await support.recordStatus(client, {
      companyId,
      entityType: 'amc_reschedule',
      entityId: id,
      fromStatus: 'pending',
      toStatus: rescheduleStatus,
      user,
      note: body.note,
    });
    if (request) {
      const nextStatus = decision === 'approved' ? 'rescheduled' : current.previous_request_status;
      assertStatusChange('amc_request', request.status, nextStatus, actor);
      const row = await amcModel.setRequestStatus(request.id, companyId, {
        status: nextStatus,
        scheduledDate: decision === 'approved' ? support.asDateString(current.requested_new_date) : null,
        setScheduledTime: decision === 'approved' && Boolean(current.requested_time),
        scheduledTime: current.requested_time,
      }, client);
      await support.recordStatus(client, {
        companyId,
        entityType: 'amc_request',
        entityId: request.id,
        fromStatus: request.status,
        toStatus: nextStatus,
        user,
        note: body.note,
      });
      if (decision === 'approved' && current.amc_contract_id) {
        await amcModel.setContractNextVisit(
          current.amc_contract_id,
          companyId,
          support.asDateString(current.requested_new_date),
          current.requested_time,
          client,
          client,
        );
      }
      await support.audit(req, user, 'customer.amc.reschedule.review', 'amc_reschedule', id, row.site_id, 'AMC reschedule reviewed.', client);
    } else if (decision === 'approved' && current.amc_contract_id) {
      await amcModel.setContractNextVisit(
        current.amc_contract_id,
        companyId,
        support.asDateString(current.requested_new_date),
        current.requested_time,
        client,
        client,
      );
      await support.audit(req, user, 'customer.amc.reschedule.review', 'amc_reschedule', id, null, 'AMC reschedule reviewed.', client);
    } else {
      await support.audit(req, user, 'customer.amc.reschedule.review', 'amc_reschedule', id, null, 'AMC reschedule reviewed.', client);
    }
    return { reschedule: presenters.reschedule(closed) };
  });
}

async function cancelReschedule(user, id, body, req) {
  const companyId = support.companyIdOf(user);
  return withTransaction(async (client) => {
    const current = await amcModel.findReschedule(id, companyId, client, true);
    if (!current) support.notFound('AMC reschedule');
    if (current.status !== 'pending') {
      throw new AppError('This reschedule has already been reviewed.', 409, 'NOT_PENDING');
    }
    const closed = await amcModel.closeReschedule(id, companyId, {
      status: 'cancelled',
      reviewedBy: user.id,
      reviewNote: body.note,
    }, client);
    await support.recordStatus(client, {
      companyId,
      entityType: 'amc_reschedule',
      entityId: id,
      fromStatus: 'pending',
      toStatus: 'cancelled',
      user,
      note: body.note,
    });
    if (current.amc_request_id && current.previous_request_status) {
      const request = await amcModel.findRequest(current.amc_request_id, companyId, client, true);
      if (!request || !canTransition(AMC_REQUEST_TRANSITIONS, request.status, current.previous_request_status)) {
        throw new AppError('That status change is not allowed.', 409, 'INVALID_STATUS_TRANSITION');
      }
      await amcModel.setRequestStatus(request.id, companyId, { status: current.previous_request_status }, client);
      await support.recordStatus(client, {
        companyId,
        entityType: 'amc_request',
        entityId: request.id,
        fromStatus: request.status,
        toStatus: current.previous_request_status,
        user,
        note: body.note || 'Reschedule cancelled.',
      });
    }
    await support.audit(req, user, 'customer.amc.reschedule.cancel', 'amc_reschedule', id, null, 'AMC reschedule cancelled.', client);
    return { reschedule: presenters.reschedule(closed) };
  });
}

module.exports = {
  listContracts,
  getContract,
  createContract,
  updateContract,
  changeContractStatus,
  listRequests,
  getRequest,
  createRequest,
  updateRequest,
  submitRequest,
  cancelRequest,
  changeRequestStatus,
  requestHistory,
  listReschedules,
  getReschedule,
  createReschedule,
  reviewReschedule,
  cancelReschedule,
};
