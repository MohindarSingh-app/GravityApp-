const AppError = require('../../../utils/energy_service/AppError');
const { withTransaction } = require('../../../utils/energy_service/transaction');
const { assertStatusChange } = require('../../../domain/energy_service/customerStatus');
const { resolveSubmission, validateAnswers } = require('../../../domain/energy_service/serviceFlow');
const serviceModel = require('../../../models/energy_service/customer/service.model');
const attachmentModel = require('../../../models/energy_service/customer/attachment.model');
const historyModel = require('../../../models/energy_service/customer/history.model');
const presenters = require('./presenters');
const support = require('./support');

const MANAGE = 'customer.services.manage';

function categoryJson(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    summary: row.summary,
    intro: row.intro || '',
    iconKey: row.icon_key,
    sortOrder: row.sort_order,
  };
}

function assembleSteps(stepRows, optionRows, fieldRows, choiceRows) {
  const optionsByStep = new Map();
  optionRows.forEach((row) => {
    const list = optionsByStep.get(row.step_id) || [];
    list.push({
      id: row.id,
      code: row.code,
      name: row.name,
      summary: row.summary,
      iconKey: row.icon_key,
      sortOrder: row.sort_order,
      status: row.status,
      nextAction: row.next_action,
      nextActionLabel: row.next_action_label,
    });
    optionsByStep.set(row.step_id, list);
  });
  const choicesByField = new Map();
  choiceRows.forEach((row) => {
    const list = choicesByField.get(row.field_id) || [];
    list.push({
      id: row.id,
      value: row.value,
      label: row.label,
      summary: row.summary,
      sortOrder: row.sort_order,
      status: row.status,
    });
    choicesByField.set(row.field_id, list);
  });
  const fieldsByStep = new Map();
  fieldRows.forEach((row) => {
    const list = fieldsByStep.get(row.step_id) || [];
    list.push({
      id: row.id,
      key: row.field_key,
      label: row.label,
      type: row.field_type,
      required: row.required,
      placeholder: row.placeholder,
      helpText: row.help_text,
      sortOrder: row.sort_order,
      status: row.status,
      options: choicesByField.get(row.id) || [],
    });
    fieldsByStep.set(row.step_id, list);
  });
  return stepRows.map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    summary: row.summary,
    kind: row.step_kind,
    sortOrder: row.sort_order,
    status: row.status,
    parentOptionId: row.parent_option_id,
    followsStepId: row.follows_step_id,
    options: optionsByStep.get(row.id) || [],
    fields: fieldsByStep.get(row.id) || [],
  }));
}

async function loadFlow(categoryId, client) {
  const category = await serviceModel.findCategory(categoryId, client);
  if (!category) return null;
  const stepRows = await serviceModel.listSteps(categoryId, client);
  const stepIds = stepRows.map((row) => row.id);
  const optionRows = await serviceModel.listOptions(stepIds, client);
  const fieldRows = await serviceModel.listFields(stepIds, client);
  const choiceRows = await serviceModel.listFieldOptions(fieldRows.map((row) => row.id), client);
  return {
    category: categoryJson(category),
    steps: assembleSteps(stepRows, optionRows, fieldRows, choiceRows),
  };
}

function parseStored(fieldType, valueText) {
  if (fieldType !== 'multiselect') return valueText;
  try {
    const parsed = JSON.parse(valueText);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

async function shapeAnswers(rows, client) {
  const fieldIds = rows.map((row) => row.field_id);
  const choices = await serviceModel.listFieldOptions(fieldIds, client);
  const labels = new Map();
  choices.forEach((choice) => {
    labels.set(`${choice.field_id}:${choice.value}`, choice.label);
  });
  return rows.map((row) => {
    const value = parseStored(row.field_type, row.value_text);
    let displayValue = row.value_text;
    if (row.field_type === 'select') {
      displayValue = labels.get(`${row.field_id}:${row.value_text}`) || row.value_text;
    } else if (row.field_type === 'multiselect') {
      displayValue = value.map((item) => labels.get(`${row.field_id}:${item}`) || item).join(', ');
    }
    return {
      fieldId: row.field_id,
      fieldKey: row.field_key,
      label: row.label,
      fieldType: row.field_type,
      value,
      displayValue,
    };
  });
}

function shapeSelections(rows) {
  let nextAction = null;
  let nextActionLabel = null;
  const selections = rows.map((row) => {
    if (row.next_action) {
      nextAction = row.next_action;
      nextActionLabel = row.next_action_label;
    }
    return {
      stepId: row.step_id,
      stepCode: row.step_code,
      stepTitle: row.step_title,
      optionId: row.option_id,
      optionCode: row.option_code,
      optionName: row.option_name,
      optionSummary: row.option_summary,
      nextAction: row.next_action,
      nextActionLabel: row.next_action_label,
      sortOrder: row.sort_order,
    };
  });
  return { selections, nextAction, nextActionLabel };
}

async function presentRequest(companyId, row, client, withHistory) {
  const [attachments, history, selectionRows, answerRows, statuses] = await Promise.all([
    attachmentModel.listByEntity(companyId, 'service_request', row.id, client),
    withHistory ? historyModel.list(companyId, 'service_request', row.id, client) : Promise.resolve(null),
    serviceModel.listSelections(row.id, client),
    serviceModel.listAnswers(row.id, client),
    withHistory ? serviceModel.listStatuses(client) : Promise.resolve([]),
  ]);
  const shaped = shapeSelections(selectionRows);
  const answers = await shapeAnswers(answerRows, client);
  const statusLabels = {};
  statuses.forEach((status) => {
    statusLabels[status.code] = status.name;
  });
  return presenters.serviceRequest(row, {
    ...shaped,
    answers,
    attachments,
    history: withHistory ? history : null,
    statusLabels,
  });
}

async function listCategories(user) {
  support.companyIdOf(user);
  const rows = await serviceModel.listCategories();
  return { categories: rows.map(categoryJson) };
}

async function categoryServices(user, categoryId) {
  support.companyIdOf(user);
  const flow = await loadFlow(categoryId);
  if (!flow) support.notFound('Service category');
  return flow;
}

async function listRequests(user, query) {
  const companyId = support.companyIdOf(user);
  const page = support.pageOf(query);
  const result = await serviceModel.listRequests({
    companyId,
    status: query.status,
    siteId: query.siteId,
    categoryId: query.categoryId,
    q: query.q,
    limit: page.limit,
    offset: page.offset,
  });
  return support.paged(result, page.page, page.limit, (row) => presenters.serviceRequest(row));
}

async function getRequest(user, id) {
  const companyId = support.companyIdOf(user);
  const row = await serviceModel.findRequest(id, companyId);
  if (!row) support.notFound('Service request');
  return { serviceRequest: await presentRequest(companyId, row, null, true) };
}

async function createRequest(user, body, req) {
  support.assertIdentity(user, body);
  const companyId = support.companyIdOf(user);
  support.assertNotPast(body.preferredDate, 'Preferred date');
  const flow = await loadFlow(body.categoryId);
  if (!flow) support.notFound('Service category');
  const resolved = resolveSubmission(flow.steps, body.selections);
  const details = validateAnswers(resolved.forms, body.answers);
  const actor = support.actorKind(user, MANAGE);
  assertStatusChange('service_request', 'submitted', 'searching', actor);
  try {
    return await withTransaction(async (client) => {
      await support.assertSite(companyId, body.siteId, client);
      const customer = await support.ensureCustomer(user, client);
      const row = await serviceModel.insertRequest({
        customerId: customer.id,
        companyId,
        siteId: body.siteId,
        categoryId: flow.category.id,
        status: 'searching',
        priority: details.priority,
        preferredDate: body.preferredDate || null,
        preferredTime: body.preferredTime || null,
      }, client);
      await serviceModel.insertSelections(row.id, resolved.choices, client);
      await serviceModel.insertAnswers(row.id, details.answers, client);
      await support.recordStatus(client, {
        companyId,
        entityType: 'service_request',
        entityId: row.id,
        toStatus: 'submitted',
        user,
        note: 'Request submitted.',
      });
      await support.recordStatus(client, {
        companyId,
        entityType: 'service_request',
        entityId: row.id,
        fromStatus: 'submitted',
        toStatus: 'searching',
        user,
        note: 'Searching for a specialist.',
      });
      await support.linkAttachments(client, {
        companyId,
        entityType: 'service_request',
        entityId: row.id,
        attachmentIds: body.attachmentIds,
      });
      await support.audit(
        req,
        user,
        'customer.service.submit',
        'service_request',
        row.id,
        row.site_id,
        'Service request submitted.',
        client,
      );
      const serviceRequest = await presentRequest(companyId, row, client, true);
      return {
        serviceRequest,
        confirmation: {
          serviceRequestId: row.id,
          requestNumber: row.request_number,
          status: row.status,
          statusLabel: row.status_label,
          submittedAt: row.submitted_at,
        },
      };
    });
  } catch (err) {
    support.mapDbError(err);
  }
}

async function transitionRequest(user, id, toStatus, req, body) {
  const companyId = support.companyIdOf(user);
  const actor = support.actorKind(user, MANAGE);
  const note = body && body.note;
  try {
    return await withTransaction(async (client) => {
      const current = await serviceModel.findRequest(id, companyId, client, true);
      if (!current) support.notFound('Service request');
      assertStatusChange('service_request', current.status, toStatus, actor);
      if (toStatus === 'assigned' && !(body && body.assignedEngineerName)) {
        throw new AppError('Enter the assigned specialist name.', 422, 'VALIDATION_ERROR', [{
          path: 'assignedEngineerName',
          message: 'Enter the assigned specialist name.',
        }]);
      }
      const row = await serviceModel.setStatus(id, companyId, {
        status: toStatus,
        setEngineer: toStatus === 'assigned',
        assignedEngineerName: body && body.assignedEngineerName,
      }, client);
      await support.recordStatus(client, {
        companyId,
        entityType: 'service_request',
        entityId: id,
        fromStatus: current.status,
        toStatus,
        user,
        note,
      });
      await support.audit(
        req,
        user,
        'customer.service.status',
        'service_request',
        id,
        row.site_id,
        'Service request status changed.',
        client,
      );
      return { serviceRequest: await presentRequest(companyId, row, client, true) };
    });
  } catch (err) {
    support.mapDbError(err);
  }
}

function cancelRequest(user, id, body, req) {
  return transitionRequest(user, id, 'cancelled', req, body);
}

function changeStatus(user, id, body, req) {
  return transitionRequest(user, id, body.status, req, body);
}

async function requestHistory(user, id) {
  const companyId = support.companyIdOf(user);
  const row = await serviceModel.findRequest(id, companyId);
  if (!row) support.notFound('Service request');
  const [history, statuses] = await Promise.all([
    historyModel.list(companyId, 'service_request', id),
    serviceModel.listStatuses(),
  ]);
  const labels = {};
  statuses.forEach((status) => {
    labels[status.code] = status.name;
  });
  return {
    statusHistory: history.map((event) => ({
      ...presenters.statusEvent(event),
      fromLabel: event.old_status ? (labels[event.old_status] || event.old_status) : null,
      toLabel: labels[event.new_status] || event.new_status,
    })),
  };
}

module.exports = {
  listCategories,
  categoryServices,
  listRequests,
  getRequest,
  createRequest,
  cancelRequest,
  changeStatus,
  requestHistory,
};
