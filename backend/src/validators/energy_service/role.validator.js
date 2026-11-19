const { z } = require('zod');
const { requestSchema, uuidParam } = require('./common');

const roleIdSchema = requestSchema(z.object({}).strict(), uuidParam('id'));

const updateRoleSchema = requestSchema(
  z.object({
    description: z.string().trim().min(2).max(160).optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }).strict().refine((data) => data.description || data.status, {
    message: 'Provide a description or status.',
  }),
  uuidParam('id'),
);

module.exports = {
  roleIdSchema,
  updateRoleSchema,
};
