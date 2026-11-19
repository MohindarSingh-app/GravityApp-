const AppError = require('../../utils/energy_service/AppError');

const FIELD_TYPES = ['text', 'textarea', 'select', 'multiselect', 'number'];

function liveOptions(step) {
  return (step.options || []).filter((option) => !option.status || option.status === 'active');
}

function liveFields(step) {
  return (step.fields || []).filter((field) => !field.status || field.status === 'active');
}

// Walks a category configuration. A step opens when its parent option was chosen,
// when the step it follows is complete, or when it is a root step.
function activeStep(steps, path) {
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

function resolveSubmission(steps, selections) {
  const cursor = [];
  const choices = [];
  const forms = [];
  const pending = selections || [];
  let index = 0;
  for (let guard = 0; guard < 40; guard += 1) {
    const step = activeStep(steps, cursor);
    if (!step) break;
    if (step.kind === 'form') {
      forms.push(step);
      cursor.push({ stepId: step.id });
      continue;
    }
    if (step.kind !== 'choice') {
      throw new AppError('This service configuration could not be completed.', 422, 'INVALID_SERVICE_PATH');
    }
    const selection = pending[index];
    if (!selection || selection.stepId !== step.id) {
      throw new AppError(`Choose an option for ${step.title}.`, 422, 'INCOMPLETE_SERVICE_PATH');
    }
    const option = liveOptions(step).find((item) => item.id === selection.optionId);
    if (!option) {
      throw new AppError(`That option is not available for ${step.title}.`, 422, 'INVALID_SERVICE_OPTION');
    }
    cursor.push({ stepId: step.id, optionId: option.id });
    choices.push({ step, option });
    index += 1;
  }
  if (index !== pending.length || activeStep(steps, cursor)) {
    throw new AppError('Those service options do not match this category.', 422, 'INVALID_SERVICE_PATH');
  }
  return { choices, forms };
}

function optionValues(field) {
  return new Set((field.options || [])
    .filter((option) => !option.status || option.status === 'active')
    .map((option) => option.value));
}

function normalizeField(field, raw) {
  const missing = raw === undefined || raw === null || raw === ''
    || (Array.isArray(raw) && raw.length === 0);
  if (missing) {
    if (field.required) {
      throw new AppError(`Enter ${field.label}.`, 422, 'VALIDATION_ERROR', [{ path: field.id, message: `Enter ${field.label}.` }]);
    }
    return null;
  }
  if (field.type === 'select') {
    const value = String(raw).trim();
    if (['make', 'brand', 'manufacturer'].includes(field.key) && value === 'other') {
      throw new AppError(
        `Add the new make from the ${field.label} selector.`,
        422,
        'VALIDATION_ERROR',
        [{ path: field.id, message: `Add the new make from the ${field.label} selector.` }],
      );
    }
    if (!optionValues(field).has(value)) {
      throw new AppError(`Choose a valid ${field.label}.`, 422, 'VALIDATION_ERROR', [{ path: field.id, message: `Choose a valid ${field.label}.` }]);
    }
    return value;
  }
  if (field.type === 'multiselect') {
    if (!Array.isArray(raw)) {
      throw new AppError(`Choose ${field.label}.`, 422, 'VALIDATION_ERROR', [{ path: field.id, message: `Choose ${field.label}.` }]);
    }
    const allowed = optionValues(field);
    const values = [];
    raw.forEach((item) => {
      const value = String(item).trim();
      if (!allowed.has(value)) {
        throw new AppError(`Choose a valid ${field.label}.`, 422, 'VALIDATION_ERROR', [{ path: field.id, message: `Choose a valid ${field.label}.` }]);
      }
      if (!values.includes(value)) values.push(value);
    });
    if (field.required && values.length === 0) {
      throw new AppError(`Choose ${field.label}.`, 422, 'VALIDATION_ERROR', [{ path: field.id, message: `Choose ${field.label}.` }]);
    }
    return JSON.stringify(values);
  }
  const text = String(raw).trim();
  if (text.length > 4000) {
    throw new AppError(`${field.label} is too long.`, 422, 'VALIDATION_ERROR', [{ path: field.id, message: `${field.label} is too long.` }]);
  }
  if (field.type === 'number' && !/^\d+(\.\d+)?$/.test(text)) {
    throw new AppError(`Enter a number for ${field.label}.`, 422, 'VALIDATION_ERROR', [{ path: field.id, message: `Enter a number for ${field.label}.` }]);
  }
  if (field.required && field.type === 'textarea' && text.length < 2) {
    throw new AppError(`Enter ${field.label}.`, 422, 'VALIDATION_ERROR', [{ path: field.id, message: `Enter ${field.label}.` }]);
  }
  if (field.required && text.length < 1) {
    throw new AppError(`Enter ${field.label}.`, 422, 'VALIDATION_ERROR', [{ path: field.id, message: `Enter ${field.label}.` }]);
  }
  return text;
}

function validateAnswers(forms, answers) {
  const allowed = new Map();
  (forms || []).forEach((step) => {
    liveFields(step).forEach((field) => allowed.set(field.id, field));
  });
  const provided = new Map();
  (answers || []).forEach((answer) => {
    if (provided.has(answer.fieldId)) {
      throw new AppError('Each detail can only be sent once.', 422, 'VALIDATION_ERROR');
    }
    provided.set(answer.fieldId, answer.value);
  });
  for (const fieldId of provided.keys()) {
    if (!allowed.has(fieldId)) {
      throw new AppError('A detail does not belong to the selected service.', 422, 'INVALID_SERVICE_FIELD');
    }
  }
  const normalized = [];
  let priority = null;
  for (const [fieldId, field] of allowed) {
    const valueText = normalizeField(field, provided.has(fieldId) ? provided.get(fieldId) : undefined);
    if (valueText == null) continue;
    normalized.push({ fieldId, valueText, field });
    if ((field.key === 'urgency' || field.key === 'priority') && field.type === 'select') {
      priority = valueText;
    }
  }
  return { answers: normalized, priority };
}

module.exports = {
  FIELD_TYPES,
  activeStep,
  resolveSubmission,
  validateAnswers,
};
