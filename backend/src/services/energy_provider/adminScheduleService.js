const { db, nowIso } = require('../../db/energy_provider/index');
const JobModel = require('../../models/energy_provider/JobModel');
const { AuditLogModel, NotificationModel } = require('../../models/energy_provider/MarketplaceModels');
const { ApiError } = require('../../utils/energy_provider/apiError');

const isValidZonedDateTime = (value) => {
  if (typeof value !== 'string') return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts || !Number.isFinite(Date.parse(value))) return false;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '0'] = parts;
  const date = new Date(Date.UTC(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText),
    Number(hourText),
    Number(minuteText),
    Number(secondText)
  ));
  return date.getUTCFullYear() === Number(yearText)
    && date.getUTCMonth() === Number(monthText) - 1
    && date.getUTCDate() === Number(dayText)
    && date.getUTCHours() === Number(hourText)
    && date.getUTCMinutes() === Number(minuteText)
    && date.getUTCSeconds() === Number(secondText);
};

const AdminScheduleService = {
  async list() {
    const rows = await db.query(
      `SELECT jobs.*, users.full_name AS assigned_partner_name,
              users.business_name AS assigned_partner_business_name
         FROM jobs
         LEFT JOIN users ON users.id = jobs.assigned_partner_id
        WHERE jobs.assigned_partner_id IS NOT NULL
          AND jobs.status IN ('accepted', 'in_progress')
        ORDER BY CASE WHEN jobs.scheduled_at IS NULL THEN 0 ELSE 1 END,
                 jobs.scheduled_at, jobs.id DESC`
    );
    return rows.map((row) => ({
      ...JobModel.toApi(row, { includePii: false }),
      assignedPartnerName: row.assigned_partner_name || '',
      assignedPartnerBusinessName: row.assigned_partner_business_name || '',
    }));
  },

  async setJobSchedule(admin, jobId, scheduledAt) {
    if (!/^[1-9]\d*$/.test(String(jobId))) {
      throw ApiError.badRequest('A valid job ID is required');
    }
    if (scheduledAt !== null && !isValidZonedDateTime(scheduledAt)) {
      throw ApiError.badRequest('Appointment time must be an ISO 8601 date-time with a timezone');
    }

    const job = await JobModel.findById(jobId);
    if (!job) throw ApiError.notFound('Job not found');
    if (!job.assigned_partner_id || !['accepted', 'in_progress'].includes(job.status)) {
      throw ApiError.conflict('Only assigned, active jobs can be scheduled');
    }

    const previousValue = job.scheduled_at || null;
    const updatedAt = nowIso();
    await db.transaction(async (handle) => {
      if (scheduledAt) {
        const conflicts = await handle.query(
          `SELECT \`id\`, \`reference_id\`, \`scheduled_at\` FROM \`jobs\`
            WHERE \`assigned_partner_id\` = ? AND \`id\` <> ?
              AND \`status\` IN ('accepted', 'in_progress') AND \`scheduled_at\` IS NOT NULL`,
          [job.assigned_partner_id, job.id]
        );
        const requestedStart = Date.parse(scheduledAt);
        const requestedEnd = requestedStart + Number(job.estimated_duration_hours || 1) * 60 * 60 * 1000;
        const overlap = conflicts.find((candidate) => {
          const start = Date.parse(candidate.scheduled_at);
          const durationHours = Number(candidate.estimated_duration_hours || 1);
          const end = start + durationHours * 60 * 60 * 1000;
          return Number.isFinite(start) && requestedStart < end && start < requestedEnd;
        });
        if (overlap) {
          throw ApiError.conflict('Schedule overlaps with ' + (overlap.reference_id || `job ${overlap.id}`));
        }
      }
      await JobModel.updateById(job.id, { scheduled_at: scheduledAt }, handle);
      await AuditLogModel.create({
        actorId: admin.id,
        entity: 'job',
        entityId: job.id,
        action: scheduledAt === null ? 'schedule_cleared' : 'schedule_updated',
        beforeState: { scheduledAt: previousValue },
        afterState: { scheduledAt, updatedAt },
      }, handle);
      await NotificationModel.create({
        partnerId: job.assigned_partner_id,
        jobId: job.id,
        type: 'schedule',
        title: scheduledAt === null ? 'Appointment cleared' : 'Appointment updated',
        body: scheduledAt === null
          ? `The appointment for ${job.reference_id} was cleared.`
          : `The appointment for ${job.reference_id} is ${new Date(scheduledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.`,
      }, handle);
    });

    return JobModel.toApi(await JobModel.findById(job.id), { includePii: false });
  },
};

module.exports = AdminScheduleService;
