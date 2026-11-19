const AdminScheduleService = require('../../services/energy_provider/adminScheduleService');
const RegistrationService = require('../../services/energy_provider/registrationService');
const RegistrationModel = require('../../models/energy_provider/RegistrationModel');
const { asyncHandler, ok, ApiError } = require('../../utils/energy_provider/apiError');

const requireAdmin = asyncHandler(async (req, _res, next) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Administrator access is required');
  }
  next();
});

const listSchedule = asyncHandler(async (_req, res) =>
  ok(res, 'Schedule fetched', await AdminScheduleService.list())
);

const listSpecializationReviews = asyncHandler(async (_req, res) =>
  ok(res, 'Expertise reviews fetched', await RegistrationService.listSpecializationReviews())
);

const reviewSpecializations = asyncHandler(async (req, res) =>
  ok(
    res,
    'Expertise review saved',
    await RegistrationService.reviewSpecializations(req.user, req.params.id, req.body || {})
  )
);

const listApplications = asyncHandler(async (_req, res) => {
  const applications = await RegistrationModel.findAll();
  return ok(res, 'Partner applications fetched', applications.map(RegistrationModel.toApi));
});

const setJobSchedule = asyncHandler(async (req, res) => {
  if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'scheduledAt')) {
    throw ApiError.badRequest('scheduledAt is required; use null to clear the appointment');
  }
  return ok(
    res,
    'Schedule updated',
    await AdminScheduleService.setJobSchedule(req.user, req.params.id, req.body.scheduledAt)
  );
});

module.exports = {
  requireAdmin,
  listSchedule,
  setJobSchedule,
  listApplications,
  listSpecializationReviews,
  reviewSpecializations,
};
