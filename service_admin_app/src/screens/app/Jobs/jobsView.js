import { fieldApi } from '../../../api/resources';
import { jobStatusLabel } from '../Dashboard/dashboardView';

export const ACTIVE_JOB_STATUSES = ['open', 'pending', 'in_progress', 'on_the_way'];
export const DONE_JOB_STATUSES = ['completed', 'done'];

export function isActiveJob(job) {
  return ACTIVE_JOB_STATUSES.includes(job && job.status);
}

export function isDoneJob(job) {
  return DONE_JOB_STATUSES.includes(job && job.status);
}

export function specialistLine(job) {
  return [job.engineerName, job.engineerTrade || job.specialist, job.rating ? `★ ${job.rating}` : '']
    .filter(Boolean)
    .join(' · ');
}

export function jobCost(job) {
  const amount = Number(job.estimateAmount || job.amount || job.total || 0);
  if (!amount) return '';
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function jobWhen(job) {
  return job.when || job.completedAt || job.updatedAt || job.createdAt || '';
}

export function jobTimeline(job) {
  const status = job && job.status;
  const code = job && (job.code || job.id);
  const name = (job && job.engineerName) || 'Specialist';
  const eta = job && job.etaMinutes ? `ETA ~${job.etaMinutes} min` : 'Travel update pending';
  const distance = job && job.distanceKm ? `${job.distanceKm} km away` : '';

  const sentAt = clockTime(job && job.createdAt);
  const steps = [
    { title: 'Request sent', detail: [sentAt, code ? `#${code}` : ''].filter(Boolean).join(' • ') },
    { title: 'Specialist assigned', detail: job && job.engineerName ? `${name} accepted` : 'Pending' },
    { title: 'On the way', detail: [eta, distance].filter(Boolean).join(' • ') || 'Pending' },
    { title: 'Work in progress', detail: 'Pending' },
    { title: 'Job completed', detail: 'Pending' },
  ];

  let activeIndex = 0;
  if (status === 'cancelled' || status === 'canceled') {
    return steps.map((step, index) => ({
      ...step,
      state: index === 0 ? 'complete' : 'pending',
    }));
  }
  if (status === 'on_the_way') activeIndex = 2;
  else if (status === 'in_progress') activeIndex = 3;
  else if (status === 'completed' || status === 'done') activeIndex = 4;
  else if (job && job.engineerName) activeIndex = 1;
  else activeIndex = 0;

  return steps.map((step, index) => ({
    ...step,
    state: index < activeIndex ? 'complete' : index === activeIndex ? 'active' : 'pending',
    detail: (status === 'completed' || status === 'done') && index === 4
      ? 'Work closed'
      : step.detail,
  }));
}

function clockTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
}

export function minutesLeft(job) {
  if (!job || !job.slaDueAt || !isActiveJob(job)) return null;
  const left = Math.ceil((new Date(job.slaDueAt).getTime() - Date.now()) / 60000);
  return Number.isFinite(left) && left > 0 ? left : null;
}

export function jobTrackMeta(job) {
  return {
    etaLabel: job.etaMinutes ? `ETA ~${job.etaMinutes} min` : 'Assignment pending',
    distanceLabel: job.distanceKm ? `${job.distanceKm} km away` : '',
    statusLabel: jobStatusLabel(job.status),
    live: isActiveJob(job),
  };
}

export async function loadJobRecord(jobId, fallback) {
  try {
    const fresh = await fieldApi.job(jobId);
    if (fresh && (fresh.job || fresh.id)) return fresh.job || fresh;
  } catch (_error) {
    // Single-job endpoint may not exist yet; use the list or the passed snapshot.
  }
  if (fallback && fallback.id && String(fallback.id) === String(jobId)) return fallback;
  const data = await fieldApi.jobs();
  const match = (data.jobs || []).find((row) => String(row.id) === String(jobId));
  if (!match) throw new Error('This job could not be found.');
  return match;
}

export { jobStatusLabel };
