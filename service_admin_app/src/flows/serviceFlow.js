// Keep the step walk aligned with Service_admin_Backend/src/domain/serviceFlow.js.
const KNOWN_FIELDS = new Set(['text', 'textarea', 'select', 'multiselect', 'number']);

export const SERVICE_TIME_SLOTS = [
  { value: '09:00', label: '9:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '18:00', label: '6:00 PM' },
];

export function activeStep(steps, path) {
  const completed = new Set((path || []).map((entry) => entry.stepId));
  const chosen = new Set((path || []).map((entry) => entry.optionId).filter(Boolean));
  const last = path && path.length ? path[path.length - 1] : null;
  const open = (steps || []).filter((step) => {
    if (step.status && step.status !== 'active') return false;
    if (completed.has(step.id)) return false;
    if (step.parentOptionId && step.followsStepId) return false;
    if (step.parentOptionId) return chosen.has(step.parentOptionId);
    if (step.followsStepId) return completed.has(step.followsStepId);
    return true;
  });
  if (!open.length) return null;
  const score = (step) => {
    if (last && step.parentOptionId && step.parentOptionId === last.optionId) return 30;
    if (step.parentOptionId && chosen.has(step.parentOptionId)) return 20;
    if (last && step.followsStepId && step.followsStepId === last.stepId) return 12;
    if (step.followsStepId && completed.has(step.followsStepId)) return 10;
    if (!step.parentOptionId && !step.followsStepId) return 1;
    return 0;
  };
  open.sort((a, b) => (
    score(b) - score(a)
    || (a.sortOrder || 0) - (b.sortOrder || 0)
    || String(a.code || '').localeCompare(String(b.code || ''))
  ));
  return open[0];
}

export function pathFromTrail(trail) {
  return (trail || []).map((item) => (
    item.type === 'choice'
      ? { stepId: item.stepId, optionId: item.optionId }
      : { stepId: item.stepId }
  ));
}

export function currentStep(draft) {
  return activeStep(draft.steps || [], pathFromTrail(draft.trail));
}

function optionSet(field) {
  return new Set((field.options || []).map((option) => option.value));
}

export function fieldError(field, raw) {
  const missing = raw === undefined || raw === null || raw === ''
    || (Array.isArray(raw) && raw.length === 0);
  if (missing) return field.required ? `Enter ${field.label}.` : '';
  if (field.type === 'select') {
    return optionSet(field).has(String(raw)) ? '' : `Choose ${field.label}.`;
  }
  if (field.type === 'multiselect') {
    if (!Array.isArray(raw)) return `Choose ${field.label}.`;
    const allowed = optionSet(field);
    if (raw.some((value) => !allowed.has(value))) return `Choose ${field.label}.`;
    if (field.required && raw.length === 0) return `Choose ${field.label}.`;
    return '';
  }
  const text = String(raw).trim();
  if (text.length > 4000) return `${field.label} is too long.`;
  if (field.type === 'number' && !/^\d+(\.\d+)?$/.test(text)) return `Enter a number for ${field.label}.`;
  if (field.required && field.type === 'textarea' && text.length < 2) return `Enter ${field.label}.`;
  return '';
}

export function stepFieldErrors(fields, answers) {
  const errors = {};
  (fields || []).forEach((field) => {
    const message = fieldError(field, answers[field.id]);
    if (message) errors[field.id] = message;
  });
  return Object.keys(errors).length ? errors : null;
}

const DEPENDENTS = {
  make: ['specify_make', 'drive_model', 'model'],
  screen_size: ['screen_size_other'],
  problem_type: ['error_code'],
};

export function answerOf(fields, answers, key) {
  const field = (fields || []).find((item) => item.key === key);
  return field ? (answers || {})[field.id] : undefined;
}

function hasField(fields, key) {
  return (fields || []).some((item) => item.key === key);
}

function fieldHidden(field, fields, answers) {
  const make = answerOf(fields, answers, 'make');
  if (field.key === 'specify_make' && hasField(fields, 'make')) return true;
  if ((field.key === 'drive_model' || field.key === 'model') && hasField(fields, 'make') && !make) return true;
  if (field.key === 'screen_size_other' && answerOf(fields, answers, 'screen_size') !== 'other') return true;
  if (field.key === 'error_code' && hasField(fields, 'problem_type')
    && answerOf(fields, answers, 'problem_type') !== 'error_code') return true;
  return false;
}

function hiddenByStep(step, field) {
  const code = step.code || '';
  const install = code.endsWith('_install') || code.includes('_install_');
  const driveOrMotor = code.startsWith('vfd_detail_') || code.startsWith('motor_detail_');
  if (field.key === 'hardware_list' && code.startsWith('vfd_detail_') && !install) return true;
  if (field.key === 'application' && code.startsWith('motor_detail_') && !code.startsWith('motor_detail_install_')) return true;
  if (field.key === 'problem_type' && driveOrMotor && install) return true;
  return false;
}

export function visibleFields(step, answers) {
  const fields = (step && step.fields) || [];
  return fields.filter((field) => !fieldHidden(field, fields, answers) && !hiddenByStep(step, field));
}

export function fieldGroup(step, fieldId) {
  const fields = (step && step.fields) || [];
  const field = fields.find((item) => item.id === fieldId);
  if (!field) return [];
  const keys = [field.key, ...(DEPENDENTS[field.key] || [])];
  return fields.filter((item) => keys.includes(item.key));
}

export function applyAnswer(fields, answers, fieldId, value) {
  const field = (fields || []).find((item) => item.id === fieldId);
  const next = { ...(answers || {}), [fieldId]: value };
  if (!field) return next;
  const dependents = DEPENDENTS[field.key] || [];
  (fields || [])
    .filter((item) => dependents.includes(item.key))
    .forEach((item) => {
      if (field.key === 'make' || fieldHidden(item, fields, next)) delete next[item.id];
    });
  return next;
}

export function modelPlaceholder(field, fields, answers) {
  const makeField = (fields || []).find((item) => item.key === 'make');
  const selected = makeField && (answers || {})[makeField.id];
  const option = makeField && (makeField.options || []).find((item) => item.value === selected);
  return (option && option.summary) || field.placeholder || '';
}

export function trailSteps(steps, trail) {
  const list = [];
  for (let index = 0; index < (trail || []).length; index += 1) {
    const step = activeStep(steps, pathFromTrail(trail.slice(0, index)));
    if (!step || step.id !== trail[index].stepId) break;
    list.push(step);
  }
  return list;
}

export function unsupportedField(fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    return { label: 'Service fields', issue: 'missing' };
  }
  return fields.find((field) => (
    !field
    || !field.id
    || !field.label
    || !KNOWN_FIELDS.has(field.type)
    || (['select', 'multiselect'].includes(field.type)
      && (!Array.isArray(field.options)
        || field.options.length === 0
        || field.options.some((option) => !option || option.value == null || !option.label)))
  )) || null;
}

export function stepProgress(trail, currentTitle) {
  const titles = (trail || []).map((item) => item.stepTitle).filter(Boolean);
  const labels = ['Category', ...titles];
  if (currentTitle) labels.push(currentTitle);
  labels.push('Site', 'Review', 'Done');
  return { labels, index: currentTitle ? 1 + titles.length : 0 };
}

export function phaseProgress(trail, phase) {
  const titles = (trail || []).map((item) => item.stepTitle).filter(Boolean);
  const labels = ['Category', ...titles, 'Site', 'Review', 'Done'];
  const index = { site: titles.length + 1, review: titles.length + 2, done: titles.length + 3 }[phase] || 0;
  return { labels, index };
}

export function displayAnswer(field, raw) {
  if (raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0)) return '';
  if (!field) return String(raw);
  if (field.key === 'hardware_list') {
    try {
      const items = JSON.parse(String(raw));
      if (Array.isArray(items)) {
        return items.map((item, index) => [
          `Item ${index + 1}`,
          item.type,
          item.rating && `${item.rating} kW`,
          item.make,
          item.application,
        ].filter(Boolean).join(' · ')).join('; ');
      }
    } catch (_error) {
      return String(raw);
    }
  }
  if (field.type === 'select') {
    const match = (field.options || []).find((option) => option.value === raw);
    return match ? match.label : String(raw);
  }
  if (field.type === 'multiselect') {
    return (Array.isArray(raw) ? raw : []).map((value) => {
      const match = (field.options || []).find((option) => option.value === value);
      return match ? match.label : value;
    }).join(', ');
  }
  return String(raw);
}

export function reviewRows(draft, site) {
  const rows = [];
  const steps = draft.steps || [];
  (draft.trail || []).forEach((item, index) => {
    if (item.type === 'choice') {
      rows.push({ label: item.stepTitle, value: item.optionName, edit: { kind: 'choice', index } });
    }
    if (item.type !== 'form') return;
    const step = steps.find((entry) => entry.id === item.stepId);
    visibleFields(step, draft.answers).forEach((field) => {
      rows.push({
        label: field.label,
        value: displayAnswer(field, (draft.answers || {})[field.id]),
        edit: { kind: 'field', stepId: step.id, fieldId: field.id },
      });
    });
  });
  if (site) {
    rows.push({ label: 'Site', value: site.siteName, edit: { kind: 'site' } });
    rows.push({
      label: 'Address',
      value: site.fullAddress || [site.address, site.city, site.state].filter(Boolean).join(', '),
      edit: { kind: 'site' },
    });
    rows.push({ label: 'Site type', value: site.siteTypeLabel || site.siteType, edit: { kind: 'site' } });
  }
  if (draft.preferredDate) rows.push({ label: 'Preferred date', value: draft.preferredDate });
  if (draft.preferredTime) rows.push({ label: 'Preferred time', value: draft.preferredTime });
  return rows;
}

export function buildServiceRequest(draft) {
  const steps = draft.steps || [];
  const relevant = new Set();
  (draft.trail || []).forEach((item) => {
    if (item.type !== 'form') return;
    const step = steps.find((entry) => entry.id === item.stepId);
    visibleFields(step, draft.answers).forEach((field) => relevant.add(field.id));
  });
  const answers = [];
  Object.entries(draft.answers || {}).forEach(([fieldId, value]) => {
    if (!relevant.has(fieldId)) return;
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return;
    answers.push({ fieldId, value });
  });
  const payload = {
    categoryId: draft.categoryId,
    siteId: draft.siteId,
    selections: (draft.trail || [])
      .filter((item) => item.type === 'choice')
      .map((item) => ({ stepId: item.stepId, optionId: item.optionId })),
  };
  if (answers.length) payload.answers = answers;
  if (draft.preferredDate) payload.preferredDate = draft.preferredDate;
  if (draft.preferredTime) payload.preferredTime = draft.preferredTime;
  if (Array.isArray(draft.attachmentIds) && draft.attachmentIds.length) {
    payload.attachmentIds = draft.attachmentIds;
  }
  return payload;
}

export function siteErrors(draft) {
  const errors = {};
  if (!draft.siteId) errors.siteId = 'Choose a site.';
  return Object.keys(errors).length ? errors : null;
}

export function trailError(draft) {
  const steps = draft.steps || [];
  const path = [];
  for (const item of draft.trail || []) {
    const step = activeStep(steps, path);
    if (!step || step.id !== item.stepId) {
      return 'These service steps are out of date. Go back and choose the service again.';
    }
    if (item.type === 'choice') {
      const option = (step.options || []).find((entry) => entry.id === item.optionId);
      if (!option) return 'That option is no longer available.';
      path.push({ stepId: step.id, optionId: option.id });
    } else {
      if (stepFieldErrors(visibleFields(step, draft.answers), draft.answers || {})) {
        return 'Check the details before submitting.';
      }
      path.push({ stepId: step.id });
    }
  }
  if (activeStep(steps, path)) return 'Finish the remaining service details.';
  if (!(draft.trail || []).some((item) => item.type === 'choice')) return 'Choose a service before submitting.';
  return '';
}

export function submittedService(result) {
  const request = result && result.serviceRequest;
  const confirmation = result && result.confirmation;
  return Boolean(
    request
    && confirmation
    && request.id
    && request.requestNumber
    && confirmation.requestNumber
    && confirmation.requestNumber === request.requestNumber
    && confirmation.serviceRequestId === request.id,
  );
}
