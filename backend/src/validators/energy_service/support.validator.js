const { z } = require('zod');
const { requestSchema } = require('./common');

const createSupportRequestSchema = requestSchema(z.object({
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(4000),
}).strict());

const assistSupportSchema = requestSchema(z.object({
  message: z.string().trim().min(2).max(2000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    text: z.string().trim().min(1).max(2000),
  })).max(12).optional(),
}).strict());

module.exports = { createSupportRequestSchema, assistSupportSchema };
