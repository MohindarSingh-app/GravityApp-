/**
 * Partner onboarding service.
 *
 * Owns the 5 step registration flow (personal -> professional -> documents ->
 * service area -> review/submit) and the application status machine.
 */

const UserModel = require('../../models/energy_provider/UserModel');
const RegistrationModel = require('../../models/energy_provider/RegistrationModel');
const DocumentModel = require('../../models/energy_provider/DocumentModel');
const AuthService = require('./authService');
const { DeliveryVerificationModel, AuditLogModel } = require('../../models/energy_provider/MarketplaceModels');
const { ApiError, isValidEmail, isValidIfsc, isValidMobile } = require('../../utils/energy_provider/apiError');
const {
  REQUIRED_DOCUMENTS,
  VALID_ROLES,
  EXPERIENCE_OPTIONS,
  QUALIFICATION_OPTIONS,
  ROLE_CATEGORIES,
  TRAVEL_RADII,
} = require('../../utils/energy_provider/constants');

const MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024;
const INITIAL_REVIEW_REQUIRED = 'Your registration request must be approved before completing the partner profile.';

function assertInitialApproval(application) {
  if (application.initial_review_status !== 'approved') {
    throw ApiError.forbidden(INITIAL_REVIEW_REQUIRED);
  }
}

const validateProfilePhoto = (dataUrl) => {
  if (typeof dataUrl !== 'string') {
    throw ApiError.badRequest('Profile photo must be an image data URL');
  }

  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) {
    throw ApiError.badRequest('Profile photo must be a JPEG, PNG, or WebP image');
  }

  const image = Buffer.from(match[2], 'base64');
  if (!image.length || image.length > MAX_PROFILE_PHOTO_BYTES || image.toString('base64') !== match[2]) {
    throw ApiError.badRequest('Profile photo must be smaller than 2 MB');
  }

  const validSignature = match[1] === 'jpeg'
    ? image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff
    : match[1] === 'png'
      ? image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : image.subarray(0, 4).toString() === 'RIFF' && image.subarray(8, 12).toString() === 'WEBP';
  if (!validSignature) {
    throw ApiError.badRequest('Profile photo content does not match its image type');
  }

  return { dataUrl, mimeType: `image/${match[1]}` };
};

const RegistrationService = {
  REQUIRED_DOCUMENTS,
  VALID_ROLES,

  /** Start (or resume) a registration for a mobile number. */
  async start({ mobile, email, role }) {
    if (!isValidMobile(mobile)) throw ApiError.badRequest('Please enter a valid 10 digit mobile number');
    if (email && !isValidEmail(email)) {
      throw ApiError.badRequest('Please enter a valid email address');
    }
    if (role && !VALID_ROLES.includes(role)) {
      throw ApiError.badRequest('Invalid partner role');
    }

    let application = await RegistrationModel.findUnsubmittedByMobile(mobile, role);
    const existingUser = await UserModel.findByMobile(mobile);
    const roleAccounts = existingUser ? await UserModel.findRoleAccounts(mobile) : [];
    let accountGroupId = existingUser?.account_group_id || existingUser?.id || null;
    if (!accountGroupId && existingUser) {
      accountGroupId = existingUser.id;
      await UserModel.updateById(existingUser.id, { account_group_id: accountGroupId });
    }

    const roleApplications = role ? await RegistrationModel.findByMobile(mobile) : [];
    const existingRoleApplication = roleApplications.find(
      (item) => item.partner_role === role && item.status !== 'rejected'
    );
    if (
      existingRoleApplication
      && (existingRoleApplication.status !== 'draft' || existingRoleApplication.initial_review_status === 'approved')
    ) {
      throw ApiError.conflict('This partner role is already registered for this mobile number. Please log in instead.');
    }

    if (role && existingRoleApplication) {
      application = existingRoleApplication;
    } else if (!role) {
      application = await RegistrationModel.findUnsubmittedByMobile(mobile);
    }

    if (!application) {
      const existingRoleAccount = roleAccounts.find((account) => account.role === role);
      const userId = existingUser?.role && role && !existingRoleAccount
        ? await UserModel.nextAccountId()
        : existingUser?.id || null;
      application = await RegistrationModel.create({
        userId,
        accountGroupId,
        mobile,
        email: email || (existingUser ? existingUser.email : ''),
        role: role || null,
        status: 'draft',
      });
    } else if (email && application.email !== email) {
      application = await RegistrationModel.updateById(application.id, { email });
    }
    if (accountGroupId && application.account_group_id !== accountGroupId) {
      application = await RegistrationModel.updateById(application.id, { account_group_id: accountGroupId });
    }

    const otp = await AuthService.requestOtp({ mobile, email, purpose: 'registration' });
    return {
      id: application.id,
      mobile,
      email: email || '',
      role: application.partner_role,
      status: application.status,
      currentStep: application.current_step,
      otpSent: otp.otpSent,
      ...(otp.devOtp ? { devOtp: otp.devOtp } : {}),
    };
  },

  async getById(id) {
    const application = await RegistrationModel.findById(id);
    if (!application) throw ApiError.notFound('Registration not found');
    return RegistrationModel.toApi(application);
  },

  /** Personal details - step 1. */
  async savePersonalDetails(id, details) {
    const application = await RegistrationModel.findById(id);
    if (!application) throw ApiError.notFound('Registration not found');
    assertInitialApproval(application);
    if (application.status !== 'draft') throw ApiError.conflict('Submitted role registrations cannot be changed');

    const emergencyContact = String(details.emergencyContact || details.emergencyContactPhone || '').trim();
    const emergencyContactName = String(details.emergencyContactName || '').trim();
    if (!details.fullName || !details.dateOfBirth || !details.address || !emergencyContact) {
      throw ApiError.badRequest('Full name, date of birth, address and emergency contact are required');
    }

    const profilePhoto = details.profilePhotoBase64
      ? validateProfilePhoto(details.profilePhotoBase64)
      : null;
    const personalDetails = {
      fullName: String(details.fullName).trim(),
      dateOfBirth: String(details.dateOfBirth).trim(),
      address: String(details.address).trim(),
      emergencyContactName,
      emergencyContact,
    };
    const updated = await RegistrationModel.updateById(id, {
      personal_details: personalDetails,
      current_step: Math.max(application.current_step, 1),
    });

    if (application.user_id) {
      const userUpdates = {
        full_name: personalDetails.fullName,
        date_of_birth: personalDetails.dateOfBirth,
        address: personalDetails.address,
        emergency_contact_name: personalDetails.emergencyContactName,
        emergency_contact_phone: emergencyContact,
      };
      if (profilePhoto) userUpdates.profile_photo = profilePhoto.dataUrl;
      await UserModel.updateById(application.user_id, userUpdates);
    }

    return RegistrationModel.toApi(updated);
  },

  /** Professional details - step 2. */
  async saveProfessionalDetails(id, details) {
    const application = await RegistrationModel.findById(id);
    if (!application) throw ApiError.notFound('Registration not found');
    assertInitialApproval(application);

    const role = details.partnerType || details.partnerRole;
    if (!VALID_ROLES.includes(role)) {
      throw ApiError.badRequest('Please select a valid partner type');
    }
    if (!EXPERIENCE_OPTIONS.includes(details.experience)) {
      throw ApiError.badRequest('Select a valid experience range');
    }
    if (!QUALIFICATION_OPTIONS.includes(details.qualification)) {
      throw ApiError.badRequest('Select a valid qualification');
    }
    if (!Array.isArray(details.categories) || !details.categories.length) {
      throw ApiError.badRequest('Select at least one service category');
    }
    if (
      details.categories.some(
        (category) => typeof category !== 'string' || !ROLE_CATEGORIES[role].includes(category)
      )
    ) {
      throw ApiError.badRequest('One or more categories are invalid for the selected partner type');
    }

    if (application.partner_role && application.partner_role !== role) {
      throw ApiError.badRequest('The selected partner type must match this role-specific registration');
    }
    if (application.status !== 'draft') {
      throw ApiError.conflict('Submitted role registrations cannot be changed; start a separate role application');
    }
    const updated = await RegistrationModel.updateById(id, {
      professional_details: details,
      role,
      categories: details.categories,
      current_step: Math.max(application.current_step, 2),
    });

    if (application.user_id) {
      const professionalUser = await UserModel.findById(application.user_id);
      if (professionalUser) {
        await UserModel.updateById(application.user_id, {
          role,
          years_experience: details.experience,
          qualification: details.qualification,
          business_name: details.businessName || '',
        });
      }
    }

    return RegistrationModel.toApi(updated);
  },

  /** Bank details - collected together with the documents step. */
  async saveBankDetails(id, details) {
    const application = await RegistrationModel.findById(id);
    if (!application) throw ApiError.notFound('Registration not found');
    assertInitialApproval(application);
    if (application.status !== 'draft') throw ApiError.conflict('Submitted role registrations cannot be changed');

    if (!details.accountNumber || !details.ifscCode) {
      throw ApiError.badRequest('Account number and IFSC code are required');
    }
    if (!isValidIfsc(details.ifscCode)) {
      throw ApiError.badRequest('Please enter a valid IFSC code');
    }
    if (!details.accountHolderName) {
      throw ApiError.badRequest('Account holder name is required');
    }

    const updated = await RegistrationModel.updateById(id, {
      bank_details: details,
      current_step: Math.max(application.current_step, 3),
    });

    if (application.user_id) {
      await UserModel.updateById(application.user_id, {
        bank_account_holder: details.accountHolderName,
        bank_account_number: details.accountNumber,
        bank_ifsc: String(details.ifscCode).toUpperCase(),
        bank_name: details.bankName || '',
      });
    }

    return RegistrationModel.toApi(updated);
  },

  /** Service areas + travel radius - step 4. */
  async saveServiceArea(id, { serviceAreas, serviceArea, travelRadiusKm }) {
    const application = await RegistrationModel.findById(id);
    if (!application) throw ApiError.notFound('Registration not found');
    assertInitialApproval(application);
    if (application.status !== 'draft') throw ApiError.conflict('Submitted role registrations cannot be changed');

    const areas = Array.isArray(serviceAreas)
      ? serviceAreas
      : String(serviceArea || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);

    if (!areas.length) {
      throw ApiError.badRequest('Please select at least one service area');
    }

    const radius = Number(travelRadiusKm || 0);
    if (!TRAVEL_RADII.includes(radius)) {
      throw ApiError.badRequest('Invalid maximum travel radius');
    }

    const updated = await RegistrationModel.updateById(id, {
      service_areas: areas.join(', '),
      travel_radius_km: radius,
      current_step: Math.max(application.current_step, 4),
    });

    if (application.user_id) {
      await UserModel.updateById(application.user_id, {
        service_areas: areas.join(', '),
        travel_radius_km: radius,
      });
    }

    return RegistrationModel.toApi(updated);
  },

  /** Upload a document for the application. */
  async uploadDocument(id, { type, name, file, mimeType, sizeBytes }) {
    const application = await RegistrationModel.findById(id);
    if (!application) throw ApiError.notFound('Registration not found');
    assertInitialApproval(application);
    if (application.status !== 'draft') throw ApiError.conflict('Submitted role registrations cannot be changed');
    if (!type || !file) {
      throw ApiError.badRequest('Document type and file are required');
    }

    const existing = await DocumentModel.findByTypeAndApplication(id, type);
    if (existing) {
      await DocumentModel.deleteById(existing.id);
    }

    const document = await DocumentModel.create({
      applicationId: id,
      userId: application.user_id,
      docType: type,
      fileName: name || type,
      fileRef: file,
      mimeType: mimeType || '',
      sizeBytes: sizeBytes || 0,
      status: 'pending',
    });

    await RegistrationModel.updateById(id, {
      current_step: Math.max(application.current_step, 3),
    });

    return DocumentModel.toApi(document);
  },

  async listDocuments(id) {
    const application = await RegistrationModel.findById(id);
    if (!application) throw ApiError.notFound('Registration not found');
    const documents = await DocumentModel.findByApplication(id);
    return documents.map(DocumentModel.toApi);
  },

  async deleteDocument(id, docId) {
    const application = await RegistrationModel.findById(id);
    if (!application) throw ApiError.notFound('Registration not found');
    assertInitialApproval(application);
    if (application.status !== 'draft') throw ApiError.conflict('Submitted role registrations cannot be changed');
    const documents = await DocumentModel.findByApplication(id);
    const found = documents.find((doc) => String(doc.id) === String(docId));
    if (!found) throw ApiError.notFound('Document not found');
    await DocumentModel.deleteById(found.id);
    return DocumentModel.toApi(found);
  },

  /** Required document checklist for the application's role. */
  async getChecklist(id) {
    const application = await RegistrationModel.findById(id);
    if (!application) throw ApiError.notFound('Registration not found');
    const required = REQUIRED_DOCUMENTS[application.partner_role] || REQUIRED_DOCUMENTS.service_partner;
    const documents = await DocumentModel.findByApplication(id);

    return required.map((item) => {
      const uploaded = documents.find((doc) => doc.doc_type === item.type);
      return {
        type: item.type,
        label: item.label,
        required: item.required,
        uploaded: !!uploaded,
        status: uploaded ? uploaded.status : 'missing',
      };
    });
  },

  /** Submit the application - step 5. */
  async submit(id, { consent }) {
    const application = await RegistrationModel.findById(id);
    if (!application) throw ApiError.notFound('Registration not found');
    assertInitialApproval(application);
    if (!consent) throw ApiError.badRequest('Consent is required to submit the application');
    if (application.status === 'under_review' || application.status === 'approved') {
      throw ApiError.conflict('Application has already been submitted');
    }
    if (!application.professional_details) {
      throw ApiError.badRequest('Professional details are required before submitting');
    }
    if (!application.bank_details) {
      throw ApiError.badRequest('Bank details are required before submitting');
    }
    const requiredDocuments = REQUIRED_DOCUMENTS[application.partner_role] || [];
    const uploadedDocuments = await DocumentModel.findByApplication(id);
    const missingDocuments = requiredDocuments
      .filter((document) => document.required)
      .filter((document) => !uploadedDocuments.some((uploaded) => uploaded.doc_type === document.type));
    if (missingDocuments.length) {
      throw ApiError.badRequest(`Upload required documents: ${missingDocuments.map((document) => document.label).join(', ')}`);
    }
    if (
      ['service_partner', 'repairing_partner'].includes(application.partner_role) &&
      !application.service_areas
    ) {
      throw ApiError.badRequest('Service area is required before submitting');
    }

    const referenceId = application.reference_id || `EN-PARTNER-${10000 + Number(id)}`;

    const updated = await RegistrationModel.updateById(id, {
      status: 'under_review',
      consent: true,
      reference_id: referenceId,
      submitted_at: new Date().toISOString(),
    });

    if (application.user_id) {
      await UserModel.updateById(application.user_id, {
        status: 'under_review',
        role: application.partner_role,
        partner_since: new Date().toISOString(),
        reference_id: referenceId,
      });
    }

    await AuditLogModel.create({
      actorId: application.user_id,
      entity: 'partner_application',
      entityId: Number(id),
      action: 'submitted',
      afterState: { status: 'under_review', referenceId },
    });

    return RegistrationModel.toApi(updated);
  },

  /** Application status with a human readable message. */
  async getStatus(id) {
    const application = await RegistrationModel.findById(id);
    if (!application) throw ApiError.notFound('Registration not found');

    const status = application.initial_review_status === 'pending'
      ? 'pending_initial_review'
      : application.status || 'under_review';
    const messages = {
      draft: 'Your application is not submitted yet.',
      pending_initial_review: 'Your request is waiting for Superadmin approval.',
      under_review: 'Your application is under review. Review usually takes 24-48 hours.',
      needs_information: 'Additional information is required to continue the review.',
      approved: 'Your application has been approved.',
      rejected: 'Your application was rejected.',
      suspended: 'Your account has been suspended.',
    };

    return {
      status,
      message: messages[status] || messages.under_review,
      reason: application.rejection_reason || null,
      referenceId: application.reference_id || null,
      specializationStatus: application.specialization_status || 'unsubmitted',
    };
  },

  /** Save expertise as a pending admin review; only approved skills match jobs. */
  async saveSpecializations(id, specializations) {
    const application = await RegistrationModel.findById(id);
    if (!application) throw ApiError.notFound('Registration not found');
    if (!specializations || typeof specializations !== 'object' || Array.isArray(specializations)) {
      throw ApiError.badRequest('Specializations must be submitted as a category selection');
    }
    // Older app builds wrapped the request as { specializations: { categories: ... } }.
    // Accept that shape while storing the same canonical structure as current clients.
    if (
      Object.keys(specializations).length === 1
      && specializations.specializations
      && typeof specializations.specializations === 'object'
      && !Array.isArray(specializations.specializations)
    ) {
      specializations = specializations.specializations;
    }
    const owner = application.user_id ? await UserModel.findById(application.user_id) : null;
    if (application.status !== 'approved' && owner?.status !== 'approved') {
      throw ApiError.forbidden('Partner registration must be approved before submitting expertise for review');
    }
    if (application.specialization_status === 'pending' || owner?.specialization_status === 'pending') {
      throw ApiError.conflict('Expertise is already waiting for administrator approval');
    }
    const current = RegistrationModel.toApi(application).specializations || {};
    const hasNestedCategories = !!specializations.categories;
    const currentCategories = specializations.categories || specializations;
    const previousCategories = current.approvedCategories || current.categories || current;
    const previousCategoriesApproved = current.approvalStatus === 'approved';
    const normalized = {
      ...current,
      ...(hasNestedCategories ? { categories: currentCategories } : currentCategories),
      profileCategories: application.categories,
      approvedCategories: previousCategoriesApproved ? previousCategories : null,
      approvedProfileCategories: previousCategoriesApproved ? (current.approvedProfileCategories || application.categories) : application.categories,
      approvedSkillsExplicit: previousCategoriesApproved ? current.approvedSkillsExplicit || false : false,
      approvalStatus: 'pending',
      submittedAt: new Date().toISOString(),
    };
    if (!Object.entries(currentCategories).some(([key, value]) => !['approvalStatus', 'submittedAt', 'reviewedAt', 'reviewedBy', 'reviewReason'].includes(key) && value && typeof value === 'object')) {
      throw ApiError.badRequest('Select at least one expertise category or skill');
    }
    const updated = await RegistrationModel.updateById(id, {
      specializations: normalized,
      specialization_status: 'pending',
    });
    await AuditLogModel.create({
      actorId: application.user_id,
      entity: 'partner_application',
      entityId: Number(id),
      action: 'specializations_submitted',
      beforeState: { specializationStatus: current.approvalStatus || 'unsubmitted' },
      afterState: { specializationStatus: 'pending' },
    });
    return RegistrationModel.toApi(updated);
  },

  async reviewSpecializations(admin, id, { decision, reason = '' } = {}) {
    const application = await RegistrationModel.findById(id);
    if (!application) throw ApiError.notFound('Registration not found');
    if (!['approved', 'rejected'].includes(decision)) {
      throw ApiError.badRequest('Review decision must be approved or rejected');
    }
    if (application.specialization_status !== 'pending') {
      throw ApiError.conflict('This expertise submission is not awaiting review');
    }
    const current = RegistrationModel.toApi(application).specializations || {};
    if (!current || !Object.keys(current).length) {
      throw ApiError.conflict('No expertise selection is awaiting review');
    }
    const hasNestedCategories = !!current.categories;
    const currentCategories = current.categories || current;
    const previousCategories = current.approvedCategories || null;
    const reviewCategories = current.categories || current;
    const savedExplicitSkillSnapshot = Object.entries(reviewCategories).some(([key, value]) =>
      !['approvedCategories', 'approvedProfileCategories', 'approvedSkillsExplicit', 'approvalStatus', 'submittedAt', 'reviewedAt', 'reviewedBy', 'reviewReason'].includes(key)
      && value && typeof value === 'object' && ((Array.isArray(value.skills) && value.skills.length > 0) || value.groups && Object.values(value.groups).some((skills) => Array.isArray(skills) && skills.length > 0))
    );
    const updatedSpecializations = {
      ...(hasNestedCategories ? { ...current, categories: currentCategories } : currentCategories),
      approvedCategories: decision === 'approved' ? currentCategories : previousCategories,
      approvedProfileCategories: decision === 'approved'
        ? (current.approvalStatus === 'approved' ? current.approvedProfileCategories || application.categories : application.categories)
        : current.approvedProfileCategories || [],
      approvedSkillsExplicit: decision === 'approved' ? !!savedExplicitSkillSnapshot : current.approvedSkillsExplicit || false,
      approvalStatus: decision,
      reviewedAt: new Date().toISOString(),
      reviewedBy: admin.id,
      reviewReason: String(reason || '').trim(),
    };
    const updated = await RegistrationModel.updateById(id, {
      specializations: updatedSpecializations,
      specialization_status: decision,
    });
    await AuditLogModel.create({
      actorId: admin.id,
      entity: 'partner_application',
      entityId: Number(id),
      action: `specializations_${decision}`,
      beforeState: { specializationStatus: current.approvalStatus || 'pending' },
      afterState: { specializationStatus: decision, reason: String(reason || '').trim() },
    });
    return RegistrationModel.toApi(updated);
  },

  async listSpecializationReviews() {
    const rows = await RegistrationModel.findPendingSpecializationReviews();
    return rows
      .map((row) => RegistrationModel.toApi(row))
      .filter((application) => application.specializations?.approvalStatus === 'pending');
  },

  async switchApprovedRole(currentUser, role) {
    if (!VALID_ROLES.includes(role)) throw ApiError.badRequest('Choose a valid partner role');
    if (currentUser.is_busy) throw ApiError.conflict('Complete the current job before switching partner role');
    const accountGroupId = currentUser.account_group_id || currentUser.id;
    const registrations = await RegistrationModel.findByMobile(currentUser.mobile);
    const application = registrations.find((record) => String(record.account_group_id || record.user_id) === String(accountGroupId) && record.partner_role === role && record.status === 'approved');
    if (!application) throw ApiError.forbidden('No approved account exists for this partner role on your mobile number');
    let nextUser = await UserModel.findById(application.user_id);
    if (!nextUser || nextUser.status !== 'approved' || nextUser.role !== role) {
      const existingAccount = (await UserModel.findRoleAccounts(currentUser.mobile)).find((account) => account.role === role && account.status === 'approved');
      if (existingAccount) nextUser = existingAccount;
      else {
        nextUser = await UserModel.create({
          mobile: currentUser.mobile,
          email: application.email || currentUser.email,
          role,
          status: 'approved',
          accountGroupId,
          fullName: application.personal_details?.fullName || currentUser.full_name,
          businessName: application.professional_details?.businessName || '',
        });
        await UserModel.updateById(nextUser.id, {
          account_group_id: accountGroupId,
          years_experience: application.professional_details?.experience || '',
          qualification: application.professional_details?.qualification || '',
          qualification_details: application.professional_details?.qualificationDetails || '',
          service_areas: application.service_areas || '',
          service_area_details: application.service_area_details || [],
          partner_since: application.submitted_at || new Date().toISOString(),
        });
        await RegistrationModel.updateById(application.id, { user_id: nextUser.id, account_group_id: accountGroupId });
        nextUser = await UserModel.findById(nextUser.id);
      }
    }
    if (currentUser.id !== nextUser.id) await UserModel.setOnline(currentUser.id, false);
    await UserModel.setOnline(nextUser.id, true);
    nextUser = await UserModel.findById(nextUser.id);
    const token = require('../../utils/energy_provider/jwt').signAccessToken(
      { userId: nextUser.id, mobile: nextUser.mobile, role: nextUser.role },
      require('../../config/energy_provider/env').JWT_SECRET,
      require('../../config/energy_provider/env').JWT_EXPIRES_IN
    );
    return {
      token,
      user: { id: nextUser.id, mobile: nextUser.mobile, email: nextUser.email, role: nextUser.role, status: nextUser.status },
      registrationId: application?.id || null,
      isOnline: !!nextUser.is_online,
    };
  },

  async updateProfile(user, updates) {
    const editableKeys = ['fullName', 'dateOfBirth', 'address', 'emergencyContact', 'qualificationDetails', 'specializationDetails', 'serviceAreaDetails'];
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) throw ApiError.badRequest('Profile updates are required');
    if (Object.keys(updates).some((key) => !editableKeys.includes(key))) throw ApiError.badRequest('Mobile, role and protected fields cannot be changed here');
    const dbUpdates = {};
    if (updates.fullName !== undefined) dbUpdates.full_name = String(updates.fullName).trim();
    if (updates.dateOfBirth !== undefined) dbUpdates.date_of_birth = String(updates.dateOfBirth).trim();
    if (updates.address !== undefined) dbUpdates.address = String(updates.address).trim();
    if (updates.emergencyContact !== undefined) dbUpdates.emergency_contact_phone = String(updates.emergencyContact).trim();
    if (updates.qualificationDetails !== undefined) dbUpdates.qualification_details = String(updates.qualificationDetails).trim();
    if (updates.specializationDetails !== undefined) {
      if (!updates.specializationDetails || typeof updates.specializationDetails !== 'object' || Array.isArray(updates.specializationDetails)) throw ApiError.badRequest('Expertise selections must be a category map');
      const selected = Object.values(updates.specializationDetails).some((value) => value && typeof value === 'object' && value.enabled && ((Array.isArray(value.skills) && value.skills.length) || Object.values(value.groups || {}).some((skills) => Array.isArray(skills) && skills.length)));
      if (!selected) throw ApiError.badRequest('Select at least one expertise skill before saving');
      dbUpdates.specialization_details = updates.specializationDetails;
    }
    let serviceAreaDetails;
    if (updates.serviceAreaDetails !== undefined) {
      serviceAreaDetails = updates.serviceAreaDetails;
      if (!Array.isArray(serviceAreaDetails) || serviceAreaDetails.length < 1 || serviceAreaDetails.length > 50) throw ApiError.badRequest('Select between 1 and 50 service areas');
      for (const area of serviceAreaDetails) {
        if (!area || typeof area.name !== 'string' || !area.name.trim() || !/^\d{6}$/.test(String(area.pincode || ''))) throw ApiError.badRequest('Every service area needs a name and a valid 6-digit PIN code');
      }
      dbUpdates.service_area_details = serviceAreaDetails;
      dbUpdates.service_areas = serviceAreaDetails.map((area) => `${area.name.trim()} (${area.pincode})`).join(', ');
    }
    const updated = await UserModel.updateById(user.id, dbUpdates);
    const registrations = await RegistrationModel.findByMobile(user.mobile);
    const registration = registrations.find((entry) => entry.partner_role === user.role && String(entry.account_group_id || entry.user_id) === String(user.account_group_id || user.id));
    if (registration && ['draft', 'approved'].includes(registration.status)) {
      const registrationUpdates = {};
      if (updates.qualificationDetails !== undefined) {
        registrationUpdates.professional_details = { ...(registration.professional_details || {}), qualificationDetails: dbUpdates.qualification_details };
      }
      if (updates.fullName !== undefined) registrationUpdates.personal_details = { ...(registration.personal_details || {}), fullName: dbUpdates.full_name };
      if (updates.dateOfBirth !== undefined) registrationUpdates.personal_details = { ...(registration.personal_details || {}), ...(registrationUpdates.personal_details || {}), dateOfBirth: dbUpdates.date_of_birth };
      if (updates.address !== undefined) registrationUpdates.personal_details = { ...(registration.personal_details || {}), ...(registrationUpdates.personal_details || {}), address: dbUpdates.address };
      if (updates.emergencyContact !== undefined) registrationUpdates.personal_details = { ...(registration.personal_details || {}), ...(registrationUpdates.personal_details || {}), emergencyContact: dbUpdates.emergency_contact_phone };
      if (serviceAreaDetails) {
        registrationUpdates.service_area_details = serviceAreaDetails;
        registrationUpdates.service_areas = dbUpdates.service_areas;
      }
      if (Object.keys(registrationUpdates).length) await RegistrationModel.updateById(registration.id, registrationUpdates);
    }
    return {
      id: updated.id,
      fullName: updated.full_name,
      dateOfBirth: updated.date_of_birth,
      address: updated.address,
      emergencyContact: updated.emergency_contact_phone,
      qualificationDetails: updated.qualification_details,
      specializationDetails: updated.specialization_details || {},
      serviceAreas: updated.service_area_details || [],
    };
  },

  /** Delivery partner opt-in verification. */
  async getDeliveryVerification(userId) {
    const user = await UserModel.findById(userId);
    if (!user) throw ApiError.notFound('Account not found');
    if (user.role !== 'service_partner') {
      throw ApiError.forbidden('Only service partners can apply for delivery work');
    }
    return DeliveryVerificationModel.toApi(await DeliveryVerificationModel.findByUser(userId));
  },

  async submitDeliveryVerification(userId, { vehicleType, vehicleNumber, licenseDocumentId }) {
    const user = await UserModel.findById(userId);
    if (!user) throw ApiError.notFound('Account not found');
    if (user.role !== 'service_partner') {
      throw ApiError.forbidden('Only service partners can apply for delivery work');
    }
    const allowedVehicleTypes = ['Bike / Scooter', 'Car', 'Van / Tempo'];
    const normalizedVehicleNumber = String(vehicleNumber || '').trim().toUpperCase();
    if (!allowedVehicleTypes.includes(vehicleType) || !normalizedVehicleNumber) {
      throw ApiError.badRequest('Select a vehicle type and enter the vehicle number');
    }
    if (!licenseDocumentId) {
      throw ApiError.badRequest('Upload a driving license photo before submitting');
    }
    const licenseDocument = await DocumentModel.findById(licenseDocumentId);
    if (
      !licenseDocument
      || String(licenseDocument.user_id) !== String(userId)
      || licenseDocument.doc_type !== 'driving_license_photo'
    ) {
      throw ApiError.badRequest('The uploaded driving license could not be verified');
    }
    const existing = await DeliveryVerificationModel.findByUser(userId);
    if (existing && existing.status === 'approved') {
      throw ApiError.conflict('Delivery partner verification already approved');
    }
    if (existing && existing.status === 'pending') {
      throw ApiError.conflict('Delivery partner verification is already pending');
    }
    const verification = await DeliveryVerificationModel.create({
      userId,
      vehicleType,
      vehicleNumber: normalizedVehicleNumber,
      licenseDocumentId,
    });
    return DeliveryVerificationModel.toApi(verification);
  },
};

module.exports = RegistrationService;
