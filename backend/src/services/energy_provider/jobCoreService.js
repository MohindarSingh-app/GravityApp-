/**
 * Job marketplace service.
 *
 * Every acceptance is a transaction: the row is claimed with a conditional
 * UPDATE (`status = 'open'`) so exactly one partner can win a job even when
 * two partners tap "Accept" at the same moment.
 */

const { db, nowIso } = require('../../db/energy_provider/index');
const config = require('../../config/energy_provider/env');
const UserModel = require('../../models/energy_provider/UserModel');
const JobModel = require('../../models/energy_provider/JobModel');
const {
  WorkflowStepModel,
  PartModel,
  PhotoModel,
  StageHistoryModel,
  PartnerResponseModel,
  NotificationModel,
  AuditLogModel,
} = require('../../models/energy_provider/MarketplaceModels');
const { ApiError, maskPhone } = require('../../utils/energy_provider/apiError');
const RegistrationModel = require('../../models/energy_provider/RegistrationModel');
const { FIELD_WORKFLOW_STEPS, ISSUE_TAGS } = require('../../utils/energy_provider/constants');

const JobService = {
  /** Open requests filtered by role and approved expertise, if configured. */
  async listOpenJobs(user) {
    const registrations = await RegistrationModel.findByMobile(user.mobile);
    const application = registrations.find((record) => record.partner_role === user.role && record.status !== 'draft')
      || await RegistrationModel.findLatestByUserAndRole(user.id, user.role);
    if (!application && user.role === 'service_partner' && user.status === 'approved') {
      const [jobs, responses] = await Promise.all([
        JobModel.findOpenForRole(user.role),
        PartnerResponseModel.findByPartner(user.id),
      ]);
      const declined = new Set(responses.filter((response) => response.response === 'declined').map((response) => String(response.job_id)));
      return jobs.filter((job) => !declined.has(String(job.id))).map((job) => {
        const api = JobModel.toApi(job, { includePii: this.canSeePii(user) });
        api.customerPhoneMasked = maskPhone(job.customer_phone);
        return api;
      });
    }
    const legacyApplication = application ? null : await RegistrationModel.findLatestByUser(user.id);
    if (legacyApplication && legacyApplication.partner_role && legacyApplication.partner_role !== user.role) return [];
    const activeApplicationRow = application || legacyApplication;
    const activeApplication = activeApplicationRow ? RegistrationModel.toApi(activeApplicationRow) : null;
    const rawSpecializations = activeApplication?.specializations || {};
    const decodedSpecializations = typeof rawSpecializations === 'string' ? JSON.parse(rawSpecializations) : rawSpecializations;

    const nestedSpecializations = decodedSpecializations.specializations && typeof decodedSpecializations.specializations === 'object'
      ? decodedSpecializations.specializations
      : decodedSpecializations;
    const specializations = nestedSpecializations;
    const decodeJsonField = (value, fallback) => {
      if (typeof value !== 'string') return value ?? fallback;
      try { return JSON.parse(value); } catch { return fallback; }
    };
    const decodedApprovedCategories = specializations.approvedCategories;
    const approvedProfileCategories = specializations.approvedProfileCategories || [];
    const profileCategories = specializations.profileCategories || [];
    const approvedSkillsExplicit = specializations.approvedSkillsExplicit === true || specializations.approvedSkillsExplicit === 'true';
    const usingApprovedSnapshot = !!decodedApprovedCategories;
    const currentSelectionCategories = specializations.categories || specializations;
    const hasPendingExpertiseChanges = usingApprovedSnapshot
      && JSON.stringify(currentSelectionCategories) !== JSON.stringify(decodedApprovedCategories);
    const activeCategories = usingApprovedSnapshot
      ? decodeJsonField(approvedProfileCategories, [])
      : activeApplication?.categories || [];
    const submittedCategories = usingApprovedSnapshot
      ? decodedApprovedCategories
      : (specializations.categories || specializations);
    const currentApplicationCategories = hasPendingExpertiseChanges
      ? decodeJsonField(profileCategories, activeApplication?.categories || [])
      : activeApplication?.categories || [];
    const hasSelection = Object.entries(submittedCategories).some(([key, value]) => !['approvalStatus', 'submittedAt', 'reviewedAt', 'reviewedBy', 'reviewReason'].includes(key) && value && typeof value === 'object');
    const approvalStatus = usingApprovedSnapshot && user.specialization_status !== 'pending' && user.specialization_status !== 'rejected'
      ? 'approved'
      : user.specialization_status || nestedSpecializations.approvalStatus || (activeApplication?.specialization_status === 'approved' ? 'approved' : 'unsubmitted');
    if (approvalStatus === 'pending' || approvalStatus === 'rejected') return [];
    if (hasSelection && approvalStatus !== 'approved') return [];
    if (!hasSelection && user.status !== 'approved' && activeApplication && activeApplication.status !== 'approved') return [];
    const jobs = await JobModel.findOpenForRole(user.role);
    const declinedResponses = await PartnerResponseModel.findByPartner(user.id);
    const declinedJobIds = new Set(
      declinedResponses
        .filter((response) => response.response === 'declined')
        .map((response) => String(response.job_id))
    );
    const visibleJobs = jobs.filter((job) => !declinedJobIds.has(String(job.id)));

    const selectedTerms = hasSelection
      ? Object.entries(submittedCategories)
        .filter(([key, value]) => !['approvedCategories', 'approvedProfileCategories', 'approvedSkillsExplicit', 'approvalStatus', 'submittedAt', 'reviewedAt', 'reviewedBy', 'reviewReason', 'profileCategories'].includes(key) && value && typeof value === 'object' && value.enabled !== false)
        .flatMap(([category, value]) => [
          category,
          ...((value.skills || []).filter((skill) => typeof skill === 'string')),
          ...Object.entries(value.groups || {}).flatMap(([group, skills]) => [group, ...(Array.isArray(skills) ? skills : [])]),
        ])
        .map((term) => String(term).trim().toLowerCase())
        .filter(Boolean)
      : [];
    const matchedJobs = hasSelection
      ? visibleJobs.filter((job) => {
        const categoryMatch = selectedTerms.includes(String(job.category || '').toLowerCase());
        const detailText = [job.title, job.equipment, job.brand, job.equipment_model]
          .filter(Boolean).join(' ').toLowerCase();
        const rawIssueTags = job.issue_tags;
        const issueTags = Array.isArray(rawIssueTags)
          ? rawIssueTags
          : typeof rawIssueTags === 'string'
            ? (() => { try { return JSON.parse(rawIssueTags || '[]'); } catch { return [rawIssueTags]; } })()
            : [];
        const issueText = issueTags.join(' ').toLowerCase();
        const selectionItems = Object.entries(submittedCategories)
          .filter(([key, value]) => !['approvedCategories', 'approvedProfileCategories', 'approvedSkillsExplicit', 'approvalStatus', 'submittedAt', 'reviewedAt', 'reviewedBy', 'reviewReason', 'profileCategories'].includes(key) && value && typeof value === 'object' && value.enabled !== false);
        const configuredSkillGroups = selectionItems.flatMap(([, value]) => Object.values(value.groups || {}).filter((skills) => Array.isArray(skills) && skills.length > 0));
        const configuredSkills = selectionItems.flatMap(([, value]) => (Array.isArray(value.skills) ? value.skills : []).filter((skill) => typeof skill === 'string'));
        const hasExplicitSkills = configuredSkills.length > 0 || configuredSkillGroups.length > 0;
        const selectedSkillTerms = configuredSkillGroups.length
          ? configuredSkillGroups.flat()
          : configuredSkills.length ? configuredSkills : selectedTerms;
        const categoryOnlyMatch = !hasExplicitSkills && selectedTerms.includes(String(job.category || '').toLowerCase());
        const selectedSkillsMatch = selectedSkillTerms.some((skill) => {
          const term = String(skill).toLowerCase();
          const brands = ['abb', 'siemens', 'schneider', 'danfoss', 'delta', 'mitsubishi', 'yaskawa', 'rockwell', 'omron', 'panasonic', 'fanuc'];
          const brandTerm = brands.find((brand) => term.includes(brand));
          const jobBrand = String(job.brand || '').toLowerCase().trim();
          const brandMatches = !brandTerm || jobBrand === brandTerm;
          const exactSelectedHardwareMatch = detailText.includes(term)
            && (!brandTerm || jobBrand === brandTerm);
          return term.length > 3 && (exactSelectedHardwareMatch || issueText.includes(term)) && brandMatches;
        });

        const profileCategories = Array.isArray(activeCategories) ? activeCategories : [];
        const profileCategoryMatch = profileCategories.some((category) => String(category).toLowerCase() === String(job.category || '').toLowerCase());
        const activeProfileCategories = Array.isArray(currentApplicationCategories) ? currentApplicationCategories : [];
        const activeProfileCategoryMatch = activeProfileCategories.some((category) => String(category).toLowerCase() === String(job.category || '').toLowerCase());
        const categoryFallback = !configuredSkills.length && !configuredSkillGroups.length && profileCategoryMatch;
        const explicitSelection = configuredSkills.length > 0 || configuredSkillGroups.length > 0;
        const newSubmissionWithApprovedSnapshot = hasPendingExpertiseChanges;
        const approvedExplicitSkills = usingApprovedSnapshot && approvedSkillsExplicit;
        return newSubmissionWithApprovedSnapshot
          ? (approvedExplicitSkills ? selectedSkillsMatch : activeProfileCategoryMatch || categoryMatch)
          : usingApprovedSnapshot && approvedExplicitSkills
            ? selectedSkillsMatch
            : (categoryMatch || categoryFallback);
      })
      : visibleJobs;

    const alreadyMatched = new Set(matchedJobs.map((job) => String(job.id)));
    const serviceAdminJobs = user.role === 'service_partner'
      && (user.status === 'approved' || activeApplication?.status === 'approved')
      ? visibleJobs.filter((job) => job.reference_id && job.reference_id.startsWith('SA-'))
        .filter((job) => !alreadyMatched.has(String(job.id)))
      : [];
    return [...matchedJobs, ...serviceAdminJobs].map((job) => {
      const api = JobModel.toApi(job, { includePii: this.canSeePii(user) });
      // Even when the raw number is hidden, a masked form is useful for the
      // partner to identify the right customer.
      api.customerPhoneMasked = maskPhone(job.customer_phone);
      return api;
    });
  },

  /** Panel makers and workshop partners must not see customer contact data. */
  canSeePii(user) {
    return !['panel_maker', 'repairing_partner'].includes(user.role);
  },

  /** Partner job rows include the persisted check-in time when available. */
  async toPartnerJobApi(job) {
    const api = JobModel.toApi(job, { includePii: true });
    api.customerPhoneMasked = maskPhone(job.customer_phone);
    if (job.job_type === 'service') {
      const steps = await WorkflowStepModel.findByJob(job.id);
      api.startedAt = steps.find((step) => step.step_number === 1)?.checked_in_at || null;
    }
    return api;
  },

  /** Full job detail for the assigned partner. */
  async getJobDetail(user, jobId) {
    const job = await JobModel.findById(jobId);
    if (!job) throw ApiError.notFound('Job not found');

    const isAssigned = String(job.assigned_partner_id) === String(user.id);
    if (!isAssigned) {
      if (job.status !== 'open') {
        throw ApiError.forbidden('You are not assigned to this job');
      }
      const visibleOpenJobs = await this.listOpenJobs(user);
      if (!visibleOpenJobs.some((visible) => String(visible.id) === String(job.id))) {
        throw ApiError.forbidden('This job is not available for your role and approved expertise');
      }
    }

    const steps = await WorkflowStepModel.findByJob(job.id);
    const parts = await PartModel.findByJob(job.id);
    const photos = await PhotoModel.findByJob(job.id);
    const history = await StageHistoryModel.findByJob(job.id);

    const api = JobModel.toApi(job, { includePii: this.canSeePii(user) });
    api.workflow = FIELD_WORKFLOW_STEPS.map((definition) => {
      const record = steps.find((step) => step.step_number === definition.stepNumber);
      return {
        ...definition,
        status: record ? record.status : 'pending',
        findings: record ? record.findings : null,
        issueTags: record && record.issue_tags ? JSON.parse(record.issue_tags) : [],
        diagnosis: record ? record.diagnosis : null,
        recommendServiceCenter: record ? !!record.recommend_service_center : false,
        checkedInAt: record ? record.checked_in_at : null,
        completedAt: record ? record.completed_at : null,
      };
    });
    api.parts = parts.map((part) => ({
      id: part.id,
      name: part.part_name,
      quantity: part.quantity,
      unitCost: part.unit_cost,
      lineTotal: part.line_total,
    }));
    api.photos = photos.map((photo) => ({
      id: photo.id,
      type: photo.photo_type,
      fileName: photo.file_name,
    }));
    api.stageHistory = history.map((entry) => ({
      fromStage: entry.from_stage,
      toStage: entry.to_stage,
      note: entry.note,
      createdAt: entry.created_at,
    }));
    api.customerPhoneMasked = maskPhone(job.customer_phone);
    api.issueTagOptions = ISSUE_TAGS;

    return api;
  },

  /**
   * Masked calling session (GAP-01).
   *
   * Only the ASSIGNED partner (or, while the job is still open, a partner who
   * can legitimately see the job) may open a call session. The real customer
   * number never leaves the server: the dialer number is a masked routing
   * alias derived from the stored phone, so neither side sees the other's
   * real number.
   */
  async requestMaskedCall(user, jobId) {
    const job = await JobModel.findById(jobId);
    if (!job) throw ApiError.notFound('Job not found');
    const isAssigned = String(job.assigned_partner_id) === String(user.id);
    if (!isAssigned) {
      if (job.status !== 'open') {
        throw ApiError.forbidden('You are not assigned to this job');
      }
      const visibleOpenJobs = await this.listOpenJobs(user);
      if (!visibleOpenJobs.some((visible) => String(visible.id) === String(job.id))) {
        throw ApiError.forbidden('This job is not available for your role and approved expertise');
      }
    }
    if (!job.customer_phone) {
      throw ApiError.badRequest('No customer contact number is stored for this job');
    }
    await AuditLogModel.create({
      actorId: user.id,
      action: 'masked_call_requested',
      entity: 'job',
      entityId: String(job.id),
      afterState: JSON.stringify({ sessionId: 'mc_' + job.id + '_' + Date.now() }),
    });
    return {
      jobId: job.id,
      // The dialer must receive a callable number. In production this is a\r
      // masked-routing number from the call provider (e.g. Twilio proxy); in\r
      // development we return the stored number so the session is testable.\r
      dialNumber: config.NODE_ENV === 'production'
        ? (process.env.MASKED_CALL_PROXY || (() => {
            throw ApiError.serviceUnavailable('Masked calling requires a call-bridge provider (set MASKED_CALL_PROXY)');
          })())
        : job.customer_phone, // dev: dial the stored number so sessions are testable
      customerPhoneMasked: maskPhone(job.customer_phone),
customerName: this.canSeePii(user) ? job.customer_name : undefined,
expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
};
},
/** Jobs currently assigned to the partner (active first, then history). */
  async listMyJobs(user) {
    const active = await JobModel.findActiveForPartner(user.id);
    const completed = await JobModel.findCompletedForPartner(user.id);
    return Promise.all([...active, ...completed].map((job) => this.toPartnerJobApi(job)));
  },
};

module.exports = JobService;
