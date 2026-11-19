const { z } = require('zod');
const { requestSchema, uuidParam } = require('./common');
const { isValidGstin, normalizeGstin } = require('../../utils/energy_service/gst');

const citySchema = z.string()
  .trim()
  .min(2, 'City must be at least 2 characters.')
  .max(80, 'City must be at most 80 characters.')
  .regex(/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u, 'City contains unsupported characters.');

const industrySchema = z.string()
  .trim()
  .min(2, 'Industry must be at least 2 characters.')
  .max(80, 'Industry must be at most 80 characters.');

const companyNameSchema = z.string()
  .trim()
  .min(2, 'Company name must be at least 2 characters.')
  .max(200, 'Company name must be at most 200 characters.');

const gstSchema = z.string().trim().transform((value, ctx) => {
  const gstin = normalizeGstin(value);
  if (!isValidGstin(gstin)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid GSTIN.' });
    return z.NEVER;
  }
  return gstin;
});

const optionalText = (min, max) => z.string().trim().min(min).max(max).optional();

const companyFields = {
  companyName: companyNameSchema,
  legalName: optionalText(2, 200),
  gst: gstSchema.optional(),
  gstin: gstSchema.optional(),
  gstNumber: gstSchema.optional(),
  industry: industrySchema,
  city: citySchema,
  state: optionalText(2, 80),
  country: optionalText(2, 80),
  pincode: z.string().trim().regex(/^[A-Za-z0-9 -]{4,12}$/, 'Enter a valid pincode.').optional(),
  address: optionalText(5, 500),
};

const createCompanySchema = requestSchema(z.object({
  ...companyFields,
  copyFromCompanyId: z.string().uuid().optional(),
}).strict().refine(
  (data) => data.gst || data.gstin || data.gstNumber,
  { message: 'GSTIN is required.', path: ['gst'] },
));

const updateCompanySchema = requestSchema(
  z.object({
    ...companyFields,
    companyName: companyNameSchema.optional(),
    industry: industrySchema.optional(),
    city: citySchema.optional(),
    status: z.enum(['active', 'inactive', 'suspended']).optional(),
  }).strict(),
  uuidParam('id'),
);

const companyStatusSchema = requestSchema(
  z.object({
    status: z.enum(['active', 'inactive', 'suspended']),
  }).strict(),
  uuidParam('id'),
);

const companyIdSchema = requestSchema(z.object({}).strict(), uuidParam('id'));

module.exports = {
  createCompanySchema,
  updateCompanySchema,
  companyStatusSchema,
  companyIdSchema,
  citySchema,
};
