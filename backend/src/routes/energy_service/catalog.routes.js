const { Router } = require('express');
const { z } = require('zod');
const catalogService = require('../../services/energy_service/catalog.service');
const { asyncHandler } = require('../../utils/energy_service/asyncHandler');
const { validate } = require('../../middleware/energy_service/validate.middleware');
const { requireAuth } = require('../../middleware/energy_service/auth.middleware');
const { sendSuccess } = require('../../utils/energy_service/response');
const { can } = require('../../services/energy_service/rbac.service');
const AppError = require('../../utils/energy_service/AppError');

const router = Router();

const listSchema = z.object({
  body: z.any().optional(),
  params: z.object({}).passthrough().optional(),
  query: z.object({
    groups: z.string().trim().regex(/^[a-z_]+(,[a-z_]+){0,19}$/, 'List catalog groups as comma-separated codes.'),
  }),
});

const addManufacturerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120),
  }).strict(),
  params: z.object({}).passthrough().optional(),
  query: z.object({}).passthrough().optional(),
});

function requireManufacturerWrite(req, _res, next) {
  if (
    can(req.auth && req.auth.role, 'customer.repairs.write')
    || can(req.auth && req.auth.role, 'customer.services.write')
  ) {
    return next();
  }
  return next(new AppError('You do not have access to add a make or brand.', 403, 'FORBIDDEN'));
}

router.get('/', requireAuth, validate(listSchema), asyncHandler(async (req, res) => {
  const groups = [...new Set(req.query.groups.split(','))];
  res.set('Cache-Control', 'private, max-age=300');
  sendSuccess(res, await catalogService.list(groups));
}));

router.post('/manufacturers', requireAuth, requireManufacturerWrite, validate(addManufacturerSchema), asyncHandler(async (req, res) => {
  sendSuccess(res, await catalogService.addManufacturer(req.body.name), 201);
}));

module.exports = router;
