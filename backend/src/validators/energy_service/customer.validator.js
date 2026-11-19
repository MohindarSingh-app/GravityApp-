const { z } = require('zod');
const { requestSchema, uuidParam } = require('./common');
const status = require('../../domain/energy_service/customerStatus');

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, 'Enter a valid date');

const dayTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a time as HH:MM');
const code = z.string().trim().regex(/^[a-z0-9_]+$/).max(64);
const note = z.string().trim().min(1).max(500).optional();
const attachmentIds = z.array(z.string().uuid()).max(10).optional();

const identity = {
  customerId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
};

function listQuery(shape) {
  return z.object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    q: z.string().trim().max(120).optional(),
    siteId: z.string().uuid().optional(),
    ...shape,
  });
}

function enumList(values) {
  return z.enum(values);
}

const amcStatusTarget = enumList(status.AMC_REQUEST_STATUSES.filter((item) => item !== 'draft' && item !== 'reschedule_requested'));
const repairStatusTarget = enumList(status.REPAIR_STATUSES.filter((item) => item !== 'draft'));
const projectStatusTarget = enumList(status.PROJECT_STATUSES.filter((item) => item !== 'draft'));

const visitSchedule = z.object({
  frequency: enumList(status.VISIT_FREQUENCIES),
  visitsPerYear: z.number().int().min(1).max(52).optional(),
  nextVisitDate: isoDate.optional(),
  preferredTime: dayTime.optional(),
}).strict();

const assignedService = z.object({
  engineerName: z.string().trim().min(1).max(120).optional(),
  serviceTeam: z.string().trim().min(1).max(120).optional(),
  contact: z.string().trim().min(1).max(160).optional(),
}).strict();

const createContractSchema = requestSchema(z.object({
  ...identity,
  siteId: z.string().uuid(),
  contractType: enumList(status.AMC_TYPES).optional(),
  amcType: enumList(status.AMC_TYPES).optional(),
  coverage: z.string().trim().min(2).max(2000),
  startDate: isoDate,
  endDate: isoDate,
  visitSchedule,
  assignedService: assignedService.optional(),
}).strict().superRefine((body, ctx) => {
  if (!body.contractType && !body.amcType) {
    ctx.addIssue({ code: 'custom', path: ['contractType'], message: 'Choose the contract type.' });
  }
}));

const updateContractSchema = requestSchema(z.object({
  ...identity,
  siteId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  contractType: enumList(status.AMC_TYPES).optional(),
  amcType: enumList(status.AMC_TYPES).optional(),
  coverage: z.string().trim().min(2).max(2000).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  visitSchedule: visitSchedule.partial().optional(),
  assignedService: assignedService.partial().optional(),
}).strict(), uuidParam('id'));

const contractListQuery = listQuery({ status: enumList(status.AMC_CONTRACT_STATUSES).optional() });
const requestListQuery = listQuery({
  status: enumList(status.AMC_REQUEST_STATUSES).optional(),
  contractId: z.string().uuid().optional(),
});
const rescheduleListQuery = listQuery({
  status: enumList(status.AMC_RESCHEDULE_STATUSES).optional(),
  requestId: z.string().uuid().optional(),
  contractId: z.string().uuid().optional(),
});

const amcRequestBody = z.object({
  ...identity,
  siteId: z.string().uuid(),
  existingContractId: z.string().uuid().nullable().optional(),
  contractId: z.string().uuid().nullable().optional(),
  requestType: enumList(status.AMC_REQUEST_TYPES),
  serviceRequirement: z.string().trim().min(2).max(2000).optional(),
  requestedService: z.string().trim().min(2).max(2000).optional(),
  preferredDate: isoDate.optional(),
  preferredTime: dayTime.optional(),
  description: z.string().trim().min(1).max(4000).optional(),
  attachmentIds,
  submit: z.boolean().optional(),
}).strict().superRefine((body, ctx) => {
  if (!body.requestedService && !body.serviceRequirement) {
    ctx.addIssue({ code: 'custom', path: ['serviceRequirement'], message: 'Describe the requested service.' });
  }
});

const createAmcRequestSchema = requestSchema(amcRequestBody);
const updateAmcRequestSchema = requestSchema(z.object({
  ...identity,
  siteId: z.string().uuid().optional(),
  existingContractId: z.string().uuid().nullable().optional(),
  contractId: z.string().uuid().nullable().optional(),
  requestType: enumList(status.AMC_REQUEST_TYPES).optional(),
  serviceRequirement: z.string().trim().min(2).max(2000).optional(),
  requestedService: z.string().trim().min(2).max(2000).optional(),
  preferredDate: isoDate.optional(),
  preferredTime: dayTime.optional(),
  description: z.string().trim().min(1).max(4000).optional(),
  attachmentIds,
}).strict(), uuidParam('id'));

const amcStatusSchema = requestSchema(z.object({
  status: amcStatusTarget,
  note,
  scheduledDate: isoDate.optional(),
  scheduledTime: dayTime.optional(),
}).strict(), uuidParam('id'));

const cancelSchema = requestSchema(z.object({ note }).strict(), uuidParam('id'));

const createRescheduleSchema = requestSchema(z.object({
  ...identity,
  requestId: z.string().uuid().optional(),
  contractId: z.string().uuid().optional(),
  previousSchedule: isoDate.optional(),
  requestedSchedule: isoDate.optional(),
  oldScheduledDate: isoDate.optional(),
  requestedNewDate: isoDate.optional(),
  requestedNewTime: dayTime.optional(),
  reason: z.string().trim().min(2).max(1000),
  notes: z.string().trim().min(2).max(1000).optional(),
}).strict().superRefine((body, ctx) => {
  if (!body.requestId && !body.contractId) {
    ctx.addIssue({ code: 'custom', path: ['requestId'], message: 'Choose the AMC contract or request to reschedule.' });
  }
  const previous = body.previousSchedule || body.oldScheduledDate;
  const requested = body.requestedSchedule || body.requestedNewDate;
  if (!previous) ctx.addIssue({ code: 'custom', path: ['previousSchedule'], message: 'Enter the current schedule.' });
  if (!requested) ctx.addIssue({ code: 'custom', path: ['requestedSchedule'], message: 'Enter the requested schedule.' });
  if (previous && requested && previous === requested) {
    ctx.addIssue({ code: 'custom', path: ['requestedNewDate'], message: 'Choose a different date.' });
  }
}));

const reviewRescheduleSchema = requestSchema(z.object({
  decision: z.enum(['approved', 'rejected']),
  note,
}).strict(), uuidParam('id'));

const deviceBody = {
  ...identity,
  siteId: z.string().uuid(),
  deviceType: enumList(status.DEVICE_TYPES),
  manufacturer: z.string().trim().min(1).max(120),
  model: z.string().trim().min(1).max(120).nullable().optional(),
  serialNumber: z.string().trim().min(1).max(120).nullable().optional(),
  assetNumber: z.string().trim().min(1).max(80).optional(),
  powerRating: z.string().trim().min(1).max(40).nullable().optional(),
  location: z.string().trim().min(1).max(160).optional(),
  installationLocation: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
};

const createDeviceSchema = requestSchema(z.object(deviceBody).strict().superRefine((body, ctx) => {
  if (!body.location && !body.installationLocation) {
    ctx.addIssue({ code: 'custom', path: ['location'], message: 'Enter the device location.' });
  }
}));
const updateDeviceSchema = requestSchema(z.object({
  ...identity,
  siteId: z.string().uuid().optional(),
  deviceType: enumList(status.DEVICE_TYPES).optional(),
  manufacturer: z.string().trim().min(1).max(120).optional(),
  model: z.string().trim().min(1).max(120).optional(),
  serialNumber: z.string().trim().min(1).max(120).optional(),
  assetNumber: z.string().trim().min(1).max(80).nullable().optional(),
  powerRating: z.string().trim().min(1).max(40).nullable().optional(),
  location: z.string().trim().min(1).max(160).optional(),
  installationLocation: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().min(1).max(2000).nullable().optional(),
}).strict(), uuidParam('id'));

const deviceListQuery = listQuery({ deviceType: enumList(status.DEVICE_TYPES).optional() });

const repairFields = {
  ...identity,
  siteId: z.string().uuid(),
  deviceId: z.string().uuid().nullable().optional(),
  repairScope: enumList(status.REPAIR_SCOPES).optional(),
  serviceType: enumList(status.REPAIR_SERVICE_TYPES).optional(),
  priority: enumList(status.REPAIR_PRIORITIES).optional(),
  requestedTurnaround: z.string().trim().min(1).max(80).optional(),
  additionalRequirements: z.string().trim().min(1).max(2000).optional(),
  issueDescription: z.string().trim().min(2).max(4000).optional(),
  symptoms: z.string().trim().min(1).max(2000).optional(),
  errorDetails: z.string().trim().min(1).max(2000).optional(),
  faultInformation: z.string().trim().min(1).max(2000).optional(),
  attachmentIds,
  submit: z.boolean().optional(),
};

const createTicketSchema = requestSchema(z.object(repairFields).strict().superRefine((body, ctx) => {
  if (body.submit) {
    ['deviceId', 'repairScope', 'serviceType', 'priority', 'issueDescription'].forEach((field) => {
      if (!body[field]) {
        ctx.addIssue({ code: 'custom', path: [field], message: 'This field is required to submit the repair.' });
      }
    });
    return;
  }
  if (!body.deviceId && !body.repairScope && !body.issueDescription) {
    ctx.addIssue({ code: 'custom', path: ['issueDescription'], message: 'Add the device, scope, or issue before saving.' });
  }
}));

const updateTicketSchema = requestSchema(z.object({
  siteId: z.string().uuid().optional(),
  deviceId: z.string().uuid().nullable().optional(),
  repairScope: enumList(status.REPAIR_SCOPES).optional(),
  serviceType: enumList(status.REPAIR_SERVICE_TYPES).optional(),
  priority: enumList(status.REPAIR_PRIORITIES).optional(),
  requestedTurnaround: z.string().trim().min(1).max(80).nullable().optional(),
  additionalRequirements: z.string().trim().min(1).max(2000).nullable().optional(),
  issueDescription: z.string().trim().min(2).max(4000).optional(),
  symptoms: z.string().trim().min(1).max(2000).nullable().optional(),
  errorDetails: z.string().trim().min(1).max(2000).nullable().optional(),
  faultInformation: z.string().trim().min(1).max(2000).nullable().optional(),
  attachmentIds,
  customerId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
}).strict(), uuidParam('id'));

const ticketListQuery = listQuery({
  status: enumList(status.REPAIR_STATUSES).optional(),
  deviceId: z.string().uuid().optional(),
  priority: enumList(status.REPAIR_PRIORITIES).optional(),
});

const repairStatusSchema = requestSchema(z.object({
  status: repairStatusTarget,
  note,
}).strict(), uuidParam('id'));

const detailField = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9_]{0,79}$/),
  value: z.string().trim().max(4000).nullable().optional(),
  dataType: z.enum(['text', 'number', 'date', 'boolean']).optional(),
}).strict();

const projectFields = {
  ...identity,
  siteId: z.string().uuid(),
  category: code,
  projectType: code,
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(4000),
  requirements: z.string().trim().min(1).max(4000).optional(),
  estimatedScope: z.string().trim().min(1).max(4000).optional(),
  preferredTimeline: z.string().trim().min(1).max(160).optional(),
  budgetAmount: z.number().min(0).max(999999999999.99).optional(),
  budgetCurrency: z.string().trim().regex(/^[A-Za-z]{3}$/).optional(),
  attachmentIds,
  details: z.array(detailField).max(40).optional(),
  submit: z.boolean().optional(),
};

function budgetRefine(body, ctx) {
  if (body.budgetCurrency && body.budgetAmount === undefined) {
    ctx.addIssue({ code: 'custom', path: ['budgetAmount'], message: 'Enter a budget amount with the currency.' });
  }
}

const createProjectSchema = requestSchema(z.object(projectFields).strict().superRefine(budgetRefine));
const updateProjectSchema = requestSchema(z.object({
  ...identity,
  siteId: z.string().uuid().optional(),
  category: code.optional(),
  projectType: code.optional(),
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().min(2).max(4000).optional(),
  requirements: z.string().trim().min(1).max(4000).nullable().optional(),
  estimatedScope: z.string().trim().min(1).max(4000).nullable().optional(),
  preferredTimeline: z.string().trim().min(1).max(160).nullable().optional(),
  budgetAmount: z.number().min(0).max(999999999999.99).optional(),
  budgetCurrency: z.string().trim().regex(/^[A-Za-z]{3}$/).optional(),
  attachmentIds,
  details: z.array(detailField).max(40).optional(),
}).strict().superRefine((body, ctx) => {
  if ((body.category && !body.projectType) || (!body.category && body.projectType)) {
    ctx.addIssue({ code: 'custom', path: ['projectType'], message: 'Send the category and project type together.' });
  }
  budgetRefine(body, ctx);
}), uuidParam('id'));

const projectListQuery = listQuery({
  status: enumList(status.PROJECT_STATUSES).optional(),
  category: code.optional(),
  projectType: code.optional(),
});

const projectStatusSchema = requestSchema(z.object({
  status: projectStatusTarget,
  note,
}).strict(), uuidParam('id'));

const storageKey = z.string().trim().min(1).max(512).refine((value) => {
  if (value.includes('..') || value.includes('\\') || /\s/.test(value)) return false;
  if (/^https:\/\//i.test(value)) {
    try {
      return new URL(value).protocol === 'https:';
    } catch (_err) {
      return false;
    }
  }
  return /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value);
}, 'Enter a storage key or https reference.');

const createAttachmentSchema = requestSchema(z.object({
  ...identity,
  fileName: z.string().trim().min(1).max(255).refine((value) => !/[\\/]/.test(value), 'Enter a file name without a path.'),
  mimeType: z.string().trim().min(3).max(120).optional(),
  contentType: z.string().trim().min(3).max(120).optional(),
  fileReference: storageKey.optional(),
  storageKey: storageKey.optional(),
  byteSize: z.number().int().min(0).max(26214400).optional(),
  contentBase64: z.string().min(1).max(5600000).optional(),
}).strict().superRefine((body, ctx) => {
  if (!body.mimeType && !body.contentType) {
    ctx.addIssue({ code: 'custom', path: ['mimeType'], message: 'Enter the file type.' });
  }
  if (!body.contentBase64 && !body.fileReference && !body.storageKey) {
    ctx.addIssue({ code: 'custom', path: ['fileReference'], message: 'Enter the file reference.' });
  }
  if (body.contentBase64 && (body.fileReference || body.storageKey)) {
    ctx.addIssue({ code: 'custom', path: ['fileReference'], message: 'Upload content or provide a storage reference, not both.' });
  }
}));

const attachmentListQuery = z.object({
  entityType: z.enum(['amc_request', 'repair_ticket', 'project_request', 'service_request', 'field_signal']),
  entityId: z.string().uuid(),
});

const answerValue = z.union([
  z.string().trim().max(4000),
  z.array(z.string().trim().min(1).max(200)).min(1).max(20),
]);

const createServiceRequestSchema = requestSchema(z.object({
  ...identity,
  categoryId: z.string().uuid(),
  siteId: z.string().uuid(),
  preferredDate: isoDate.optional(),
  preferredTime: dayTime.optional(),
  selections: z.array(z.object({
    stepId: z.string().uuid(),
    optionId: z.string().uuid(),
  }).strict()).min(1).max(20),
  answers: z.array(z.object({
    fieldId: z.string().uuid(),
    value: answerValue,
  }).strict()).max(40).optional(),
  attachmentIds,
}).strict());

const serviceListQuery = listQuery({
  status: enumList(status.SERVICE_REQUEST_STATUSES).optional(),
  categoryId: z.string().uuid().optional(),
});

const serviceStatusSchema = requestSchema(z.object({
  status: enumList(status.SERVICE_REQUEST_STATUSES),
  note,
  assignedEngineerName: z.string().trim().min(1).max(120).optional(),
}).strict(), uuidParam('id'));

const categoryParam = requestSchema(z.object({}).strict(), uuidParam('categoryId'));

const contractStatusBody = z.object({
  status: enumList(status.AMC_CONTRACT_STATUSES),
  note,
}).strict();

module.exports = {
  createContractSchema,
  updateContractSchema,
  contractStatusSchema: requestSchema(contractStatusBody, uuidParam('id')),
  contractListQuery: requestSchema(z.object({}).strict(), z.object({}).passthrough(), contractListQuery),
  requestListQuery: requestSchema(z.object({}).strict(), z.object({}).passthrough(), requestListQuery),
  rescheduleListQuery: requestSchema(z.object({}).strict(), z.object({}).passthrough(), rescheduleListQuery),
  createAmcRequestSchema,
  updateAmcRequestSchema,
  amcStatusSchema,
  cancelSchema,
  createRescheduleSchema,
  reviewRescheduleSchema,
  createDeviceSchema,
  updateDeviceSchema,
  deviceListQuery: requestSchema(z.object({}).strict(), z.object({}).passthrough(), deviceListQuery),
  createTicketSchema,
  updateTicketSchema,
  ticketListQuery: requestSchema(z.object({}).strict(), z.object({}).passthrough(), ticketListQuery),
  repairStatusSchema,
  createProjectSchema,
  updateProjectSchema,
  projectListQuery: requestSchema(z.object({}).strict(), z.object({}).passthrough(), projectListQuery),
  projectStatusSchema,
  createAttachmentSchema,
  attachmentListQuery: requestSchema(z.object({}).strict(), z.object({}).passthrough(), attachmentListQuery),
  createServiceRequestSchema,
  serviceListQuery: requestSchema(z.object({}).strict(), z.object({}).passthrough(), serviceListQuery),
  serviceStatusSchema,
  categoryParam,
  idParam: requestSchema(z.object({}).strict(), uuidParam('id')),
};
