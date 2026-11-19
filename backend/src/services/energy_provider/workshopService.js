/**
 * Workshop service - the repair and panel stage machines.
 *
 * repair : received -> diagnosing -> repairing -> ready -> dispatched
 * panel  : received -> design_quote -> fabricating -> qc -> dispatched
 *
 * Both machines advance one stage at a time and record every transition in
 * the job stage history so the customer timeline is auditable.
 */

const { db, nowIso } = require('../../db/energy_provider/index');
const JobModel = require('../../models/energy_provider/JobModel');
const { StageHistoryModel, NotificationModel, AuditLogModel } =
  require('../../models/energy_provider/MarketplaceModels');
const { ApiError } = require('../../utils/energy_provider/apiError');

/** The stage machine per job type. */
const WORKSHOP_FLOWS = {
  repair: ['received', 'diagnosing', 'repairing', 'ready', 'dispatched'],
  panel: ['received', 'design_quote', 'fabricating', 'qc', 'dispatched'],
};

const WorkshopService = {
  WORKSHOP_FLOWS,

  /** The stage machine for a job type. */
  flowFor(jobType) {
    return WORKSHOP_FLOWS[jobType] || null;
  },

  /**
   * Advance a workshop job to the next stage.  Optionally records the repair
   * cost so the earnings can be calculated on dispatch.
   */
  async advanceStage(user, jobId, { note, repairCost } = {}) {
    const job = await JobModel.findById(jobId);
    if (!job) throw ApiError.notFound('Job not found');
    if (String(job.assigned_partner_id) !== String(user.id)) {
      throw ApiError.forbidden('You are not assigned to this job');
    }

    const flow = this.flowFor(job.job_type);
    if (!flow) {
      throw ApiError.badRequest('This job does not use the workshop workflow');
    }
    if (job.status === 'completed') {
      throw ApiError.conflict('This job is already completed');
    }

    const currentIndex = flow.indexOf(job.stage);
    if (currentIndex === -1) {
      throw ApiError.conflict('The job is not at a workshop stage yet');
    }
    if (currentIndex === flow.length - 1) {
      throw ApiError.conflict('The job is already at its final workshop stage');
    }

    const nextStage = flow[currentIndex + 1];

    await JobModel.updateById(job.id, {
      stage: nextStage,
      status: 'in_progress',
      ...(repairCost !== undefined ? { service_charge: Number(repairCost) || 0 } : {}),
    });

    await StageHistoryModel.create({
      jobId: job.id,
      fromStage: job.stage,
      toStage: nextStage,
      actorId: user.id,
      note: note || `Moved to ${nextStage}`,
    });

    await AuditLogModel.create({
      actorId: user.id,
      entity: 'job',
      entityId: job.id,
      action: 'stage_advanced',
      beforeState: { stage: job.stage },
      afterState: { stage: nextStage },
    });

    if (nextStage === 'dispatched') {
      await NotificationModel.create({
        partnerId: user.id,
        jobId: job.id,
        type: 'job_dispatched',
        title: `Job ${job.reference_id} dispatched`,
        body: job.title,
      });
    }

    return { jobId: job.id, stage: nextStage, status: 'in_progress' };
  },

  /**
   * Mark a workshop job as completed (the workshop handed it back).
   * Creates the earnings entry and releases the partner's busy flag.
   */
  async completeJob(user, jobId, { repairCost } = {}) {
    const job = await JobModel.findById(jobId);
    if (!job) throw ApiError.notFound('Job not found');
    if (String(job.assigned_partner_id) !== String(user.id)) {
      throw ApiError.forbidden('You are not assigned to this job');
    }
    if (job.status === 'completed') {
      throw ApiError.conflict('This job is already completed');
    }

    const flow = this.flowFor(job.job_type);
    if (!flow) {
      throw ApiError.badRequest('This job does not use the workshop workflow');
    }
    if (job.stage !== flow[flow.length - 1]) {
      throw ApiError.conflict('Move the job to its final stage before completing it');
    }

    const totalBill = repairCost !== undefined
      ? Number(repairCost) || 0
      : Number(job.service_charge || 0);
    const commission = Math.round(totalBill * 0.1 * 100) / 100;
    const payout = Math.round((totalBill - commission) * 100) / 100;

    await JobModel.updateById(job.id, {
      status: 'completed',
      total_bill: totalBill,
      payout_amount: payout,
      completed_at: nowIso(),
    });

    await db.transaction(async (handle) => {
      await handle.run(
        `INSERT INTO \`earnings\`
           (\`partner_id\`, \`job_id\`, \`source\`, \`gross_amount\`, \`commission\`,
            \`deductions\`, \`net_amount\`, \`status\`, \`created_at\`)
         VALUES (?, ?, ?, ?, ?, 0, ?, 'pending', ?)`,
        [user.id, job.id, job.job_type, totalBill, commission, payout, nowIso()]
      );

      await handle.run(
        `UPDATE \`users\`
            SET \`is_busy\` = 0,
                \`jobs_completed\` = \`jobs_completed\` + 1,
                \`updated_at\` = ?
          WHERE \`id\` = ?`,
        [nowIso(), user.id]
      );
    });

    await StageHistoryModel.create({
      jobId: job.id,
      fromStage: job.stage,
      toStage: 'completed',
      actorId: user.id,
      note: 'Workshop job completed',
    });

    await NotificationModel.create({
      partnerId: user.id,
      jobId: job.id,
      type: 'job_completed',
      title: `Job ${job.reference_id} completed`,
      body: `Payout ${payout.toFixed(2)}`,
    });

    await AuditLogModel.create({
      actorId: user.id,
      entity: 'job',
      entityId: job.id,
      action: 'completed',
      afterState: { status: 'completed', totalBill, payout },
    });

    return {
      jobId: job.id,
      referenceId: job.reference_id,
      status: 'completed',
      totalBill,
      commission,
      payoutAmount: payout,
    };
  },
};

module.exports = WorkshopService;
