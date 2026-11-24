const { z } = require('zod');
const { requestSchema, uuidParam } = require('./common');

const title = z.string().trim().min(2).max(160);
const detail = z.string().trim().min(2).max(400);
const scopeCosts = z.record(
  z.enum(['repair_only', 'repair_install', 'full_service', 'replacement']),
  z.string().trim().min(1).max(80),
);
const foundIssue = z.object({
  description: z.string().trim().min(2).max(240),
  status: z.enum(['open', 'resolved']).default('open'),
  errorCode: z.string().trim().min(1).max(80).optional(),
}).strict();

const createJobSchema = requestSchema(z.object({
  title,
  category: z.enum(['job', 'quick', 'project']).default('job'),
  priority: z.enum(['emergency', 'scheduled']).default('scheduled'),
  siteId: z.string().uuid().optional(),
  notes: z.string().trim().max(500).optional(),
  catalogCode: z.string().trim().max(40).optional(),
}).strict());

const jobStatusSchema = requestSchema(z.object({
  status: z.enum(['accepted', 'on_the_way', 'in_progress', 'completed', 'cancelled']),
  etaMinutes: z.number().int().min(1).max(240).optional(),
}).strict(), uuidParam('id'));

const createSignalSchema = requestSchema(z.object({
  kind: z.enum(['emergency', 'recommendation', 'repair_send_in', 'expert']),
  title,
  detail,
  siteId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
  deviceId: z.string().uuid().optional(),
  issuesFound: z.array(foundIssue).max(20).optional(),
  errorCode: z.string().trim().min(1).max(80).optional(),
  riskNote: z.string().trim().min(2).max(400).optional(),
  scopeCosts: scopeCosts.optional(),
  etaMinutes: z.number().int().min(1).max(240).optional(),
  attachmentIds: z.array(z.string().uuid()).max(5).optional(),
  attachments: z.array(z.string().uuid()).max(5).optional(),
}).strict().superRefine((body, ctx) => {
  if (body.attachmentIds && body.attachments) {
    ctx.addIssue({
      code: 'custom',
      path: ['attachments'],
      message: 'Use either attachments or attachmentIds, not both.',
    });
  }
  if ((body.attachmentIds || body.attachments) && !['emergency', 'recommendation'].includes(body.kind)) {
    ctx.addIssue({
      code: 'custom',
      path: [body.attachments ? 'attachments' : 'attachmentIds'],
      message: 'Photos can only be attached to emergencies and repair recommendations.',
    });
  }
  if (body.kind === 'recommendation') {
    if (!body.siteId) {
      ctx.addIssue({ code: 'custom', path: ['siteId'], message: 'Choose the recommendation site.' });
    }
    if (!body.jobId) {
      ctx.addIssue({ code: 'custom', path: ['jobId'], message: 'Link the recent job.' });
    }
    if (!body.deviceId) {
      ctx.addIssue({ code: 'custom', path: ['deviceId'], message: 'Link the registered device.' });
    }
  } else if (
    body.jobId
    || body.deviceId
    || body.issuesFound
    || body.errorCode
    || body.riskNote
    || body.scopeCosts
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['kind'],
      message: 'Repair recommendation details can only be set on a recommendation.',
    });
  }
}).transform(({ attachments, ...body }) => ({
  ...body,
  ...(attachments ? { attachmentIds: attachments } : {}),
})));

const createAmcSchema = requestSchema(z.object({
  title,
  coverage: z.string().trim().min(2).max(240),
  discountPercent: z.number().int().min(0).max(80).optional(),
  siteId: z.string().uuid().optional(),
}).strict());

const createCertSchema = requestSchema(z.object({
  name: title,
  expiresAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid expiry date'),
  siteId: z.string().uuid().optional(),
}).strict());

module.exports = {
  createJobSchema,
  jobStatusSchema,
  createSignalSchema,
  createAmcSchema,
  createCertSchema,
};
