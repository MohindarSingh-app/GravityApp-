const { z } = require('zod');
const { requestSchema, uuidParam } = require('./common');
const { citySchema } = require('./company.validator');

const siteTypeSchema = z.string().trim().transform((value, ctx) => {
  const normalized = value.toLowerCase();
  if (!['factory', 'plant', 'warehouse', 'office', 'other'].includes(normalized)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Site type must be Factory, Plant, Warehouse, Office, or Other.' });
    return z.NEVER;
  }
  return normalized;
});

const latitudeSchema = z.coerce.number().gte(-90, 'Latitude must be between -90 and 90.')
  .lte(90, 'Latitude must be between -90 and 90.');
const longitudeSchema = z.coerce.number().gte(-180, 'Longitude must be between -180 and 180.')
  .lte(180, 'Longitude must be between -180 and 180.');

const addressSchema = z.string().trim().min(5).max(500);
const pincodeSchema = z.string().trim().regex(/^[A-Za-z0-9 -]{4,12}$/, 'Enter a valid pincode.').optional();

const createSiteSchema = requestSchema(
  z.object({
    siteName: z.string().trim().min(2).max(160),
    address: addressSchema.optional(),
    fullAddress: addressSchema.optional(),
    city: citySchema,
    state: z.string().trim().min(2).max(80).optional(),
    country: z.string().trim().min(2).max(80).optional(),
    pincode: pincodeSchema,
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    siteType: siteTypeSchema,
    isPrimary: z.boolean().optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }).strict().refine((data) => data.address || data.fullAddress, {
    message: 'Address is required.',
    path: ['address'],
  }),
  uuidParam('companyId'),
);

const listSitesSchema = requestSchema(z.object({}).strict(), uuidParam('companyId'));

const siteIdSchema = requestSchema(z.object({}).strict(), uuidParam('id'));

const updateSiteSchema = requestSchema(
  z.object({
    siteName: z.string().trim().min(2).max(160).optional(),
    address: addressSchema.optional(),
    fullAddress: addressSchema.optional(),
    city: citySchema.optional(),
    state: z.string().trim().min(2).max(80).optional(),
    country: z.string().trim().min(2).max(80).optional(),
    pincode: pincodeSchema,
    latitude: latitudeSchema.optional(),
    longitude: longitudeSchema.optional(),
    siteType: siteTypeSchema.optional(),
    isPrimary: z.boolean().optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }).strict(),
  uuidParam('id'),
);

const siteStatusSchema = requestSchema(
  z.object({
    status: z.enum(['active', 'inactive']),
  }).strict(),
  uuidParam('id'),
);

module.exports = {
  createSiteSchema,
  listSitesSchema,
  siteIdSchema,
  updateSiteSchema,
  siteStatusSchema,
};
