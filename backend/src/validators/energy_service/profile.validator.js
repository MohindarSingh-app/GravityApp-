const { z } = require('zod');
const { requestSchema } = require('./common');
const { fullNameSchema, emailSchema, phoneSchema } = require('./auth.validator');
const { ROLE_NAMES } = require('../../constants/energy_service/roles');

const createProfileSchema = requestSchema(z.object({
  name: fullNameSchema.optional(),
  fullName: fullNameSchema.optional(),
  email: emailSchema.optional(),
  secondaryPhone: phoneSchema.nullable().optional(),
  role: z.enum(ROLE_NAMES).optional(),
}).strict().refine((data) => data.name || data.fullName, {
  message: 'Name is required.',
  path: ['name'],
}));

const patchProfileSchema = requestSchema(z.object({
  name: fullNameSchema.optional(),
  fullName: fullNameSchema.optional(),
  email: emailSchema.optional(),
  secondaryPhone: phoneSchema.nullable().optional(),
  role: z.enum(ROLE_NAMES).optional(),
}).strict().refine((data) => data.name || data.fullName || data.email || data.secondaryPhone !== undefined || data.role, {
  message: 'Provide at least one field to update.',
}));

const avatarSchema = requestSchema(z.object({
  image: z.string().min(80, 'Choose a photo first.').max(1_200_000, 'Photo must be under 700 KB.'),
}).strict());

module.exports = {
  createProfileSchema,
  patchProfileSchema,
  avatarSchema,
};
