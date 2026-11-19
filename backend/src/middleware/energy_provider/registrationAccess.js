const RegistrationModel = require('../../models/energy_provider/RegistrationModel');
const { ApiError, asyncHandler } = require('../../utils/energy_provider/apiError');

const requireRegistrationOwner = asyncHandler(async (req, _res, next) => {
  const application = await RegistrationModel.findById(req.params.id);
  if (!application) throw ApiError.notFound('Registration not found');
  const sameAccountGroup = application.account_group_id != null
    && req.user.account_group_id != null
    && String(application.account_group_id) === String(req.user.account_group_id);
  if (String(application.user_id || '') !== String(req.user.id) && !sameAccountGroup) {
    throw ApiError.forbidden('You do not have access to this registration');
  }

  req.registration = application;
  next();
});

module.exports = { requireRegistrationOwner };
