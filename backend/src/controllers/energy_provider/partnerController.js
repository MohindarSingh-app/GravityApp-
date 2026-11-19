/**
 * Partner profile controller - the online / busy availability switch and the
 * partner's own profile record.
 */

const UserModel = require('../../models/energy_provider/UserModel');
const RegistrationModel = require('../../models/energy_provider/RegistrationModel');
const DocumentModel = require('../../models/energy_provider/DocumentModel');
const RegistrationService = require('../../services/energy_provider/registrationService');
const { asyncHandler, ok, ApiError } = require('../../utils/energy_provider/apiError');

/** GET /api/v1/partner/profile */
const getProfile = asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.user.id);
  if (!user) throw ApiError.notFound('Account not found');
  const roleAccounts = await UserModel.findRoleAccounts(user.mobile);
  const registrations = await RegistrationModel.findByMobile(user.mobile);
  const [roleApplication, legacyApplication, documents] = await Promise.all([
    RegistrationModel.findLatestByUserAndRole(user.id, user.role),
    RegistrationModel.findLatestByUser(user.id),
    DocumentModel.findByUser(user.id),
  ]);
  const application = roleApplication || legacyApplication;
  const applicationApi = application ? RegistrationModel.toApi(application) : null;
  const specializationStatus = [applicationApi?.specializations?.approvalStatus, applicationApi?.specializationStatus, user.specialization_status]
    .find((status) => status && status !== 'unsubmitted') || 'unsubmitted';
  const approvedRoleAccounts = roleAccounts.filter((account) => account.status === 'approved' && account.role !== 'admin');
  const availableRoles = [...new Map(approvedRoleAccounts.map((account) => [account.role, {
    role: account.role,
    status: account.status,
    userId: account.id,
    registrationId: registrations.find((registration) => String(registration.user_id) === String(account.id) && registration.partner_role === account.role)?.id || null,
  }])).values()];
  const bankAccount = String(user.bank_account_number || '');
  return ok(res, 'Profile fetched', {
    id: user.id,
    accountGroupId: user.account_group_id || user.id,
    mobile: user.mobile,
    email: user.email,
    role: user.role,
    roleAccounts: availableRoles,
    status: user.status,
    fullName: user.full_name,
    businessName: user.business_name,
    address: user.address,
    yearsExperience: user.years_experience,
    qualification: user.qualification,
    qualificationDetails: user.qualification_details || '',
    specializationDetails: user.specialization_details || {},
    profilePhoto: user.profile_photo || '',
    registrationId: application?.id || null,
    specializations: applicationApi?.specializations || {},
    specializationStatus,
    documents: documents.map((document) => ({
      type: document.doc_type,
      fileName: document.file_name,
      status: document.status,
      createdAt: document.created_at,
    })),
    bankDetails: {
      accountHolderName: user.bank_account_holder || '',
      accountNumberMasked: bankAccount ? `•••• ${bankAccount.slice(-4)}` : '',
      bankName: user.bank_name || '',
      ifscCode: user.bank_ifsc || '',
    },
    rating: user.rating,
    jobsCompleted: user.jobs_completed,
    isOnline: !!user.is_online,
    isBusy: !!user.is_busy,
    travelRadiusKm: user.travel_radius_km,
    serviceAreas: user.service_areas ? user.service_areas.split(',').map((area) => area.trim()).filter(Boolean) : [],
    serviceAreaDetails: user.service_area_details || [],
    partnerSince: user.partner_since,
  });
});

/**
 * POST /api/v1/partner/status - go online / offline.
 *
 * A busy partner cannot go offline, because that would strand the job they
 * are currently working on.
 */
const setOnlineStatus = asyncHandler(async (req, res) => {
  const online = !!(req.body || {}).online;

  if (!online && req.user.is_busy) {
    throw ApiError.conflict('Complete your active job before going offline');
  }

  const user = await UserModel.setOnline(req.user.id, online);
  return ok(res, online ? 'You are now online' : 'You are now offline', {
    isOnline: !!user.is_online,
    isBusy: !!user.is_busy,
  });
});

const switchRoleAccount = asyncHandler(async (req, res) => {
  const role = String((req.body || {}).role || '');
  if (!role) throw ApiError.badRequest('Partner role is required');
  const account = await RegistrationService.switchApprovedRole(req.user, role);
  return ok(res, 'Partner role switched', account);
});

const updateProfileDetails = asyncHandler(async (req, res) => {
  const updated = await RegistrationService.updateProfile(req.user, req.body || {});
  return ok(res, 'Profile details saved', updated);
});

/** GET /api/v1/partner/delivery-verification */
const getDeliveryVerification = asyncHandler(async (req, res) =>
  ok(res, 'Delivery verification fetched', await RegistrationService.getDeliveryVerification(req.user.id))
);

/** POST /api/v1/partner/delivery-verification */
const submitDeliveryVerification = asyncHandler(async (req, res) =>
  ok(
    res,
    'Delivery verification submitted',
    await RegistrationService.submitDeliveryVerification(req.user.id, req.body || {})
  )
);

module.exports = { getProfile, setOnlineStatus, switchRoleAccount, updateProfileDetails, getDeliveryVerification, submitDeliveryVerification };
