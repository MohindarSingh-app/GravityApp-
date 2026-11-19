/**
 * Registration controller.
 *
 * Thin HTTP wrapper around `registrationService`, which owns the five step
 * onboarding rules and the application status machine.
 */

const RegistrationService = require('../../services/energy_provider/registrationService');
const { asyncHandler, ok, ApiError } = require('../../utils/energy_provider/apiError');

/** POST /api/v1/registration/start */
const startRegistration = asyncHandler(async (req, res) => {
  const { mobile, email, role } = req.body || {};
  if (!mobile || !email) {
    throw ApiError.badRequest('Mobile and email are required');
  }
  const registration = await RegistrationService.start({ mobile, email, role });
  return ok(res, 'Registration started', registration);
});

/** PUT /api/v1/registration/:id/personal-details */
const savePersonalDetails = asyncHandler(async (req, res) =>
  ok(
    res,
    'Personal details saved',
    await RegistrationService.savePersonalDetails(req.params.id, req.body || {})
  )
);

/** PUT /api/v1/registration/:id/professional-details */
const saveProfessionalDetails = asyncHandler(async (req, res) =>
  ok(
    res,
    'Professional details saved',
    await RegistrationService.saveProfessionalDetails(req.params.id, req.body || {})
  )
);

/** PUT /api/v1/registration/:id/bank-details */
const saveBankDetails = asyncHandler(async (req, res) =>
  ok(
    res,
    'Bank details saved',
    await RegistrationService.saveBankDetails(req.params.id, req.body || {})
  )
);

/** PUT /api/v1/registration/:id/service-area */
const saveServiceArea = asyncHandler(async (req, res) =>
  ok(
    res,
    'Service area saved',
    await RegistrationService.saveServiceArea(req.params.id, req.body || {})
  )
);

/** POST /api/v1/registration/:id/documents */
const uploadDocument = asyncHandler(async (req, res) =>
  ok(
    res,
    'Document uploaded',
    await RegistrationService.uploadDocument(req.params.id, req.body || {})
  )
);

/** GET /api/v1/registration/:id/documents */
const getDocuments = asyncHandler(async (req, res) =>
  ok(res, 'Documents fetched', await RegistrationService.listDocuments(req.params.id))
);

/** GET /api/v1/registration/:id/checklist */
const getChecklist = asyncHandler(async (req, res) =>
  ok(res, 'Checklist fetched', await RegistrationService.getChecklist(req.params.id))
);

/** DELETE /api/v1/registration/:id/documents/:docId */
const deleteDocument = asyncHandler(async (req, res) =>
  ok(
    res,
    'Document removed',
    await RegistrationService.deleteDocument(req.params.id, req.params.docId)
  )
);

/** POST /api/v1/registration/:id/submit */
const submitRegistration = asyncHandler(async (req, res) =>
  ok(
    res,
    'Application submitted',
    await RegistrationService.submit(req.params.id, req.body || {})
  )
);

/** GET /api/v1/registration/:id/status */
const getStatus = asyncHandler(async (req, res) =>
  ok(res, 'Status fetched', await RegistrationService.getStatus(req.params.id))
);

/** GET /api/v1/registration/:id */
const getRegistration = asyncHandler(async (req, res) =>
  ok(res, 'Registration fetched', await RegistrationService.getById(req.params.id))
);

const lookupPincode = asyncHandler(async (req, res) =>
  ok(res, 'PIN-code lookup fetched', RegistrationService.lookupPincode(String(req.params.pincode || '')))
);

/** PUT /api/v1/registration/:id/specializations */
const saveSpecializations = asyncHandler(async (req, res) =>
  ok(
    res,
    'Expertise submitted for admin review',
    await RegistrationService.saveSpecializations(req.params.id, req.body || {})
  )
);

module.exports = {
  startRegistration,
  savePersonalDetails,
  saveProfessionalDetails,
  saveBankDetails,
  saveServiceArea,
  uploadDocument,
  getDocuments,
  getChecklist,
  deleteDocument,
  submitRegistration,
  getStatus,
  getRegistration,
  lookupPincode,
  saveSpecializations,
};
