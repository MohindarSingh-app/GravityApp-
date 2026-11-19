const AppError = require('../../../utils/energy_service/AppError');
const { withTransaction } = require('../../../utils/energy_service/transaction');
const { assertStatusChange } = require('../../../domain/energy_service/customerStatus');
const projectModel = require('../../../models/energy_service/customer/project.model');
const attachmentModel = require('../../../models/energy_service/customer/attachment.model');
const historyModel = require('../../../models/energy_service/customer/history.model');
const presenters = require('./presenters');
const support = require('./support');

const MANAGE = 'customer.projects.manage';

async function resolveType(category, projectType, client) {
  const type = await projectModel.findType(category, projectType, client);
  if (!type) {
    throw new AppError('Choose a project category and project type.', 422, 'INVALID_PROJECT_TYPE');
  }
  return type;
}

function budgetOf(body) {
  const hasAmount = Object.prototype.hasOwnProperty.call(body, 'budgetAmount');
  const hasCurrency = Object.prototype.hasOwnProperty.call(body, 'budgetCurrency');
  if (!hasAmount && !hasCurrency) return { setBudget: false };
  if (body.budgetAmount === undefined || body.budgetAmount === null) {
    throw new AppError('Enter a budget amount with the currency.', 422, 'VALIDATION_ERROR');
  }
  return {
    setBudget: true,
    budgetAmount: body.budgetAmount,
    budgetCurrency: (body.budgetCurrency || 'INR').toUpperCase(),
  };
}

async function presentRequest(companyId, row, client, withHistory) {
  const [attachments, history, details] = await Promise.all([
    attachmentModel.listByEntity(companyId, 'project_request', row.id, client),
    withHistory ? historyModel.list(companyId, 'project_request', row.id, client) : Promise.resolve(null),
    projectModel.listDetails(row.id, client),
  ]);
  return presenters.projectRequest(row, { attachments, details, history: withHistory ? history : null });
}

async function listCategories(user) {
  support.companyIdOf(user);
  const rows = await projectModel.listCatalog();
  return { categories: presenters.categories(rows) };
}

async function listRequests(user, query) {
  const companyId = support.companyIdOf(user);
  const page = support.pageOf(query);
  const result = await projectModel.listRequests({
    companyId,
    status: query.status,
    siteId: query.siteId,
    category: query.category,
    projectType: query.projectType,
    q: query.q,
    limit: page.limit,
    offset: page.offset,
  });
  return support.paged(result, page.page, page.limit, (row) => presenters.projectRequest(row));
}

async function getRequest(user, id) {
  const companyId = support.companyIdOf(user);
  const row = await projectModel.findRequest(id, companyId);
  if (!row) support.notFound('Project request');
  return { projectRequest: await presentRequest(companyId, row, null, true) };
}

async function createRequest(user, body, req) {
  support.assertIdentity(user, body);
  const companyId = support.companyIdOf(user);
  const submit = body.submit === true;
  const budget = budgetOf(body);
  try {
    return await withTransaction(async (client) => {
      await support.assertSite(companyId, body.siteId, client);
      const customer = await support.ensureCustomer(user, client);
      const type = await resolveType(body.category, body.projectType, client);
      const status = submit ? 'submitted' : 'draft';
      const row = await projectModel.insertRequest({
        customerId: customer.id,
        companyId,
        siteId: body.siteId,
        categoryId: type.category_id,
        projectTypeId: type.type_id,
        title: body.title,
        description: body.description,
        requirements: body.requirements,
        estimatedScope: body.estimatedScope,
        preferredTimeline: body.preferredTimeline,
        budgetAmount: budget.setBudget ? budget.budgetAmount : null,
        budgetCurrency: budget.setBudget ? budget.budgetCurrency : null,
        status,
        submittedAt: submit ? new Date() : null,
      }, client);
      await support.recordStatus(client, {
        companyId,
        entityType: 'project_request',
        entityId: row.id,
        toStatus: status,
        user,
      });
      if (body.details) await projectModel.replaceDetails(row.id, body.details, client);
      await support.linkAttachments(client, {
        companyId,
        entityType: 'project_request',
        entityId: row.id,
        attachmentIds: body.attachmentIds,
      });
      await support.audit(
        req,
        user,
        submit ? 'customer.project.submit' : 'customer.project.save',
        'project_request',
        row.id,
        row.site_id,
        submit ? 'Project request submitted.' : 'Project request saved.',
        client,
      );
      const projectRequest = await presentRequest(companyId, row, client, true);
      if (!submit) return { projectRequest };
      return {
        projectRequest,
        confirmation: {
          projectRequestId: row.id,
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
  support.assertIdentity(user, body);
  const companyId = support.companyIdOf(user);
  try {
    return await withTransaction(async (client) => {
      const current = await projectModel.findRequest(id, companyId, client, true);
      if (!current) support.notFound('Project request');
      if (current.status !== 'draft' && current.status !== 'clarification_required') {
        throw new AppError('This project request can no longer be edited.', 409, 'NOT_EDITABLE');
      }
      if (body.siteId) await support.assertSite(companyId, body.siteId, client);
      let categoryId;
      let projectTypeId;
      if (body.category || body.projectType) {
        const type = await resolveType(
          body.category || current.category_code,
          body.projectType || current.project_type_code,
          client,
        );
        categoryId = type.category_id;
        projectTypeId = type.type_id;
      }
      const budget = budgetOf(body);
      const row = await projectModel.updateRequest(id, companyId, {
        siteId: body.siteId,
        categoryId,
        projectTypeId,
        title: body.title,
        description: body.description,
        setRequirements: Object.prototype.hasOwnProperty.call(body, 'requirements'),
        requirements: body.requirements,
        setScope: Object.prototype.hasOwnProperty.call(body, 'estimatedScope'),
        estimatedScope: body.estimatedScope,
        setTimeline: Object.prototype.hasOwnProperty.call(body, 'preferredTimeline'),
        preferredTimeline: body.preferredTimeline,
        ...budget,
      }, current.status === 'draft' ? ['draft'] : ['clarification_required'], client);
      if (!row) throw new AppError('This project request can no longer be edited.', 409, 'NOT_EDITABLE');
      if (body.details) await projectModel.replaceDetails(id, body.details, client);
      if (body.attachmentIds) {
        await support.linkAttachments(client, {
          companyId,
          entityType: 'project_request',
          entityId: id,
          attachmentIds: body.attachmentIds,
          replace: true,
        });
      }
      await support.audit(req, user, 'customer.project.update', 'project_request', id, row.site_id, 'Project request updated.', client);
      return { projectRequest: await presentRequest(companyId, row, client, true) };
    });
  } catch (err) {
    support.mapDbError(err);
  }
}

async function transitionRequest(user, id, toStatus, req, note) {
  const companyId = support.companyIdOf(user);
  const actor = support.actorKind(user, MANAGE);
  try {
    return await withTransaction(async (client) => {
      const current = await projectModel.findRequest(id, companyId, client, true);
      if (!current) support.notFound('Project request');
      const target = toStatus || (current.status === 'clarification_required' ? 'under_review' : 'submitted');
      assertStatusChange('project_request', current.status, target, actor);
      const row = await projectModel.setRequestStatus(id, companyId, {
        status: target,
        submittedAt: target === 'submitted' ? new Date() : null,
      }, client);
      await support.recordStatus(client, {
        companyId,
        entityType: 'project_request',
        entityId: id,
        fromStatus: current.status,
        toStatus: target,
        user,
        note,
      });
      await support.audit(req, user, 'customer.project.status', 'project_request', id, row.site_id, 'Project request status changed.', client);
      const projectRequest = await presentRequest(companyId, row, client, true);
      if (target !== 'submitted') return { projectRequest };
      return {
        projectRequest,
        confirmation: {
          projectRequestId: row.id,
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
  return transitionRequest(user, id, null, req);
}

function cancelRequest(user, id, body, req) {
  return transitionRequest(user, id, 'cancelled', req, body.note);
}

function changeRequestStatus(user, id, body, req) {
  return transitionRequest(user, id, body.status, req, body.note);
}

async function requestHistory(user, id) {
  const companyId = support.companyIdOf(user);
  const row = await projectModel.findRequest(id, companyId);
  if (!row) support.notFound('Project request');
  const history = await historyModel.list(companyId, 'project_request', id);
  return { statusHistory: history.map(presenters.statusEvent) };
}

module.exports = {
  listCategories,
  listRequests,
  getRequest,
  createRequest,
  updateRequest,
  submitRequest,
  cancelRequest,
  changeRequestStatus,
  requestHistory,
};
