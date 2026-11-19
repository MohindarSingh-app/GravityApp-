/**
 * Field workflow service - the five step on-site process:
 *   1. check-in at site
 *   2. diagnosis
 *   3. site replaceable parts
 *   4. before / after photos
 *   5. completion & customer sign-off
 *
 * Step ordering is enforced server side: a step can only be recorded once the
 * previous one is done.  Parts that belong to the workshop (IGBT / PCB /
 * driver boards) are rejected here so they can never be fitted on site.
 */

const { db, nowIso } = require('../../db/energy_provider/index');
const JobModel = require('../../models/energy_provider/JobModel');
const {
  WorkflowStepModel,
  PartModel,
  PhotoModel,
  StageHistoryModel,
  NotificationModel,
  AuditLogModel,
} = require('../../models/energy_provider/MarketplaceModels');
const { ApiError } = require('../../utils/energy_provider/apiError');
const {
  FIELD_WORKFLOW_STEPS,
  ISSUE_TAGS,
  SITE_REPLACEABLE_PARTS,
  SERVICE_CENTRE_PARTS,
  REPAIR_CENTRE_EQUIPMENT,
} = require('../../utils/energy_provider/constants');

/** Platform commission taken from every completed service job. */
const PLATFORM_COMMISSION_RATE = 0.1;

const WorkflowService = {
  PLATFORM_COMMISSION_RATE,

  /** The five step definitions, exposed so the app can render the checklist. */
  steps() {
    return FIELD_WORKFLOW_STEPS;
  },

  /** Load a job and make sure it belongs to this partner. */
  async assertAssigned(user, jobId) {
    const job = await JobModel.findById(jobId);
    if (!job) throw ApiError.notFound('Job not found');
    if (String(job.assigned_partner_id) !== String(user.id)) {
      throw ApiError.forbidden('You are not assigned to this job');
    }
    return job;
  },

  /** Only equipment in the repair-centre list may be recommended. */
  isRepairCentreEligible(job) {
    return REPAIR_CENTRE_EQUIPMENT.includes(String(job.equipment || '').toLowerCase());
  },

  /** Record a stage transition in the job history. */
  async advanceStage(job, toStage, actorId, note) {
    await StageHistoryModel.create({
      jobId: job.id,
      fromStage: job.stage || null,
      toStage,
      actorId,
      note: note || '',
    });
    await JobModel.updateById(job.id, {
      stage: toStage,
      status: toStage === 'completed' ? 'completed' : 'in_progress',
    });
    return toStage;
  },

  /** Update one workflow step row, creating it when missing. */
  async updateStep(jobId, stepNumber, updates) {
    const steps = await WorkflowStepModel.findByJob(jobId);
    const existing = steps.find((step) => step.step_number === stepNumber);
    if (existing) {
      return WorkflowStepModel.updateById(existing.id, updates);
    }
    const definition = FIELD_WORKFLOW_STEPS.find((step) => step.stepNumber === stepNumber);
    return WorkflowStepModel.create({
      jobId,
      stepNumber,
      stepKey: definition ? definition.stepKey : `step${stepNumber}`,
      ...updates,
    });
  },

  /** Step 1 - check-in at site. */
  async checkIn(user, jobId) {
    const job = await this.assertAssigned(user, jobId);
    if (job.stage !== 'accepted' && job.stage !== 'checked_in') {
      throw ApiError.conflict('This job cannot be checked in at its current stage');
    }

    const checkedInAt = nowIso();
    await this.updateStep(job.id, 1, {
      status: 'done',
      checkedInAt,
      completedAt: checkedInAt,
    });
    await this.advanceStage(job, 'checked_in', user.id, 'Checked in at site');

    return { stepNumber: 1, status: 'done', checkedInAt };
  },

  /** Step 2 - diagnosis with issue tags. */
  async saveDiagnosis(user, jobId, { findings, issueTags = [], diagnosis, recommendServiceCenter } = {}) {
    const job = await this.assertAssigned(user, jobId);
    if (job.stage !== 'checked_in' && job.stage !== 'diagnosed') {
      throw ApiError.conflict('Check in at the site before saving a diagnosis');
    }
    const trimmedFindings = String(findings || '').trim();
    if (!trimmedFindings) {
      throw ApiError.badRequest('Describe what you found on site');
    }

    const allowed = ISSUE_TAGS;
    const cleanedTags = issueTags.filter((tag) => allowed.includes(tag));
    const eligible = this.isRepairCentreEligible(job);

    const step = await this.updateStep(job.id, 2, {
      status: 'done',
      findings: trimmedFindings,
      issueTags: cleanedTags,
      diagnosis: diagnosis || '',
      recommendServiceCenter: !!recommendServiceCenter && eligible,
      completedAt: nowIso(),
    });
    await JobModel.updateById(job.id, {
      repair_center_recommended: !!recommendServiceCenter && eligible,
    });
    await this.advanceStage(job, 'diagnosed', user.id, 'Diagnosis saved');

    return {
      stepNumber: step.step_number,
      status: step.status,
      repairCentreEligible: eligible,
      recommendServiceCenter: !!recommendServiceCenter && eligible,
    };
  },

  /**
   * Step 3 - site replaceable parts.  Parts that must go to the workshop
   * (IGBT / PCB / driver board / capacitor board) are rejected server side.
   */
  async saveParts(user, jobId, { parts = [] } = {}) {
    const job = await this.assertAssigned(user, jobId);
    if (job.stage !== 'diagnosed' && job.stage !== 'parts_used') {
      throw ApiError.conflict('Save the diagnosis before recording parts');
    }
    if (!Array.isArray(parts) || !parts.length) {
      throw ApiError.badRequest('Add at least one part');
    }

    const cleaned = parts.map((part) => {
      const name = String(part.name || '').trim();
      if (!name) throw ApiError.badRequest('Every part needs a name');
      const lower = name.toLowerCase();
      if (SERVICE_CENTRE_PARTS.some((blocked) => lower.includes(blocked))) {
        throw ApiError.badRequest(
          `${name} cannot be replaced on site - it must go to the service centre`
        );
      }
      const quantity = Math.max(1, parseInt(part.quantity, 10) || 1);
      const unitCost = Math.max(0, Number(part.unitCost) || 0);
      return { name, quantity, unitCost, lineTotal: quantity * unitCost };
    });

    const existing = await PartModel.findByJob(job.id);
    for (const part of existing) {
      await PartModel.deleteById(part.id);
    }
    for (const part of cleaned) {
      await PartModel.create({
        jobId: job.id,
        partName: part.name,
        quantity: part.quantity,
        unitCost: part.unitCost,
        lineTotal: part.lineTotal,
      });
    }

    const partsTotal = cleaned.reduce((sum, part) => sum + part.lineTotal, 0);
    await this.updateStep(job.id, 3, { status: 'done', completedAt: nowIso() });
    await this.advanceStage(job, 'parts_used', user.id, 'Parts recorded');
    await JobModel.updateById(job.id, { parts_total: partsTotal });

    return { parts: cleaned, partsTotal };
  },

  /** Step 4 - before / after photos. */
  async savePhotos(user, jobId, { photos = [] } = {}) {
    const job = await this.assertAssigned(user, jobId);
    if (job.stage !== 'parts_used' && job.stage !== 'photos_done') {
      throw ApiError.conflict('Record site parts before saving completion photos');
    }
    if (!Array.isArray(photos) || !photos.length) {
      throw ApiError.badRequest('At least one photo is required');
    }

    const types = photos.map((photo) => String(photo.type || '').toLowerCase());
    if (!types.includes('before') || !types.includes('after')) {
      throw ApiError.badRequest('Both a before and an after photo are required');
    }

    const existing = await PhotoModel.findByJob(job.id);
    for (const photo of existing) {
      await PhotoModel.deleteById(photo.id);
    }
    for (const photo of photos) {
      await PhotoModel.create({
        jobId: job.id,
        photoType: String(photo.type || '').toLowerCase(),
        fileName: photo.fileName || photo.type,
        fileRef: photo.fileRef || '',
      });
    }

    await this.updateStep(job.id, 4, { status: 'done', completedAt: nowIso() });
    await this.advanceStage(job, 'photos_done', user.id, 'Photos uploaded');

    return { photoCount: photos.length };
  },


  /**
   * Step 5 - completion & sign-off.  Requires the checklist, a customer OTP
   * and a previously saved diagnosis.  Produces the bill and the earnings.
   */
  async completeJob(user, jobId, { customerOtp, checklist = [], partsTotal } = {}) {
    const job = await this.assertAssigned(user, jobId);

    if (job.status === 'completed') {
      throw ApiError.conflict('This job is already completed');
    }
    if (job.stage !== 'photos_done') {
      throw ApiError.conflict('Save both before and after photos before completing the job');
    }
    if (!customerOtp || String(customerOtp).length < 4) {
      throw ApiError.badRequest('A 4 digit customer OTP is required to complete the job');
    }

    const requiredChecks = ['work_completed', 'customer_satisfied', 'site_cleaned'];
    const missing = requiredChecks.filter(
      (check) => !checklist.some((item) => item.id === check && item.checked)
    );
    if (missing.length) {
      throw ApiError.badRequest(`Checklist incomplete: ${missing.join(', ')}`);
    }

    const steps = await WorkflowStepModel.findByJob(job.id);
    const diagnosisStep = steps.find((step) => step.step_number === 2);
    if (!diagnosisStep || diagnosisStep.status !== 'done') {
      throw ApiError.conflict('Save the diagnosis before completing the job');
    }
    const photos = await PhotoModel.findByJob(job.id);
    const photoTypes = photos.map((photo) => String(photo.photo_type || '').toLowerCase());
    if (!photoTypes.includes('before') || !photoTypes.includes('after')) {
      throw ApiError.badRequest('Both a before and an after photo are required');
    }

    const parts = await PartModel.findByJob(job.id);
    const computedPartsTotal = parts.reduce((sum, part) => sum + Number(part.line_total || 0), 0);
    const resolvedPartsTotal =
      partsTotal !== undefined ? Number(partsTotal) || 0 : computedPartsTotal;

    const serviceCharge = Number(job.service_charge || 0);
    const totalBill = serviceCharge + resolvedPartsTotal;
    const commission = Math.round(totalBill * PLATFORM_COMMISSION_RATE * 100) / 100;
    const payout = Math.round((totalBill - commission) * 100) / 100;

    await db.transaction(async (handle) => {
      const result = await handle.run(
        `UPDATE \`jobs\`
            SET \`status\` = 'completed',
                \`stage\` = 'completed',
                \`checklist\` = ?,
                \`total_bill\` = ?,
                \`parts_total\` = ?,
                \`payout_amount\` = ?,
                \`completed_at\` = ?,
                \`updated_at\` = ?
          WHERE \`id\` = ? AND \`assigned_partner_id\` = ?`,
        [
          JSON.stringify(checklist),
          totalBill,
          resolvedPartsTotal,
          payout,
          nowIso(),
          nowIso(),
          job.id,
          user.id,
        ]
      );
      if (!result.affectedRows) {
        throw ApiError.conflict('This job could not be completed');
      }

      await handle.run(
        `UPDATE \`users\`
            SET \`is_busy\` = 0,
                \`jobs_completed\` = \`jobs_completed\` + 1,
                \`updated_at\` = ?
          WHERE \`id\` = ?`,
        [nowIso(), user.id]
      );

      await handle.run(
        `INSERT INTO \`earnings\`
           (\`partner_id\`, \`job_id\`, \`source\`, \`gross_amount\`, \`commission\`,
            \`deductions\`, \`net_amount\`, \`status\`, \`created_at\`)
         VALUES (?, ?, 'service', ?, ?, 0, ?, 'pending', ?)`,
        [user.id, job.id, totalBill, commission, payout, nowIso()]
      );
    });

    await this.updateStep(job.id, 5, { status: 'done', completedAt: nowIso() });
    await StageHistoryModel.create({
      jobId: job.id,
      fromStage: job.stage,
      toStage: 'completed',
      actorId: user.id,
      note: 'Job completed and signed off',
    });

    await NotificationModel.create({
      partnerId: user.id,
      jobId: job.id,
      type: 'job_completed',
      title: `Job ${job.reference_id} completed`,
      body: `Payout ${payout.toFixed(2)} for ${job.title}`,
    });

    await AuditLogModel.create({
      actorId: user.id,
      entity: 'job',
      entityId: job.id,
      action: 'completed',
      beforeState: { status: job.status, stage: job.stage },
      afterState: { status: 'completed', totalBill, payout },
    });

    const updated = await JobModel.findById(job.id);
    return {
      jobId: job.id,
      referenceId: job.reference_id,
      status: 'completed',
      totalBill,
      partsTotal: resolvedPartsTotal,
      commission,
      payoutAmount: payout,
    };
  },
};

module.exports = WorkflowService;
