const { z } = require('zod');
const { requestSchema, uuidParam } = require('./common');
const { emailSchema, passwordSchema, fullNameSchema, phoneSchema } = require('./auth.validator');

const createUserSchema = requestSchema(z.object({
  name: fullNameSchema,
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  password: passwordSchema,
  roleId: z.string().uuid('Select a valid role.'),
}).strict().refine((data) => data.email || data.phone, {
  message: 'Email or phone is required.',
  path: ['email'],
}));

const updateUserSchema = requestSchema(
  z.object({
    name: fullNameSchema.optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
  }).strict().refine((data) => data.name || data.email || data.phone, {
    message: 'Provide at least one field to update.',
  }),
  uuidParam('id'),
);

const userIdSchema = requestSchema(z.object({}).strict(), uuidParam('id'));

const userStatusSchema = requestSchema(
  z.object({
    status: z.enum(['active', 'inactive', 'suspended']),
  }).strict(),
  uuidParam('id'),
);

const userRoleSchema = requestSchema(
  z.object({
    roleId: z.string().uuid('Select a valid role.'),
  }).strict(),
  uuidParam('id'),
);

module.exports = {
  createUserSchema,
  updateUserSchema,
  userIdSchema,
  userStatusSchema,
  userRoleSchema,
};
