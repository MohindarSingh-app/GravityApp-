const { z } = require('zod');
const { requestSchema, uuidParam } = require('./common');

const keyNameSchema = z.string().trim().min(2).max(80);

const createApiKeySchema = requestSchema(z.object({
  name: keyNameSchema.optional(),
  keyName: keyNameSchema.optional(),
  expiresAt: z.string().datetime().optional(),
}).strict().refine((data) => data.name || data.keyName, {
  message: 'Key name is required.',
  path: ['name'],
}));

const apiKeyIdSchema = requestSchema(z.object({}).strict(), uuidParam('id'));

module.exports = {
  createApiKeySchema,
  apiKeyIdSchema,
};
