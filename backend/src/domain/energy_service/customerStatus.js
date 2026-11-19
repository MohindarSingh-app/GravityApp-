const AppError = require('../../utils/energy_service/AppError');

const AMC_REQUEST_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'scheduled',
  'reschedule_requested',
  'rescheduled',
  'confirmed',
  'completed',
  'cancelled',
];

const AMC_CONTRACT_STATUSES = ['active', 'suspended', 'expired', 'cancelled'];

const AMC_RESCHEDULE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

const REPAIR_STATUSES = [
  'draft',
  'submitted',
  'received',
  'diagnosis',
  'estimate_required',
  'approved',
  'repair_in_progress',
  'ready',
  'returned',
  'completed',
  'cancelled',
];

const PROJECT_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'clarification_required',
  'approved',
  'in_progress',
  'completed',
  'cancelled',
];

const AMC_TYPES = ['comprehensive', 'non_comprehensive', 'preventive', 'labour', 'breakdown'];
const AMC_REQUEST_TYPES = ['new_amc', 'renewal', 'visit', 'coverage_change'];
const VISIT_FREQUENCIES = ['monthly', 'quarterly', 'half_yearly', 'yearly', 'custom'];

const DEVICE_TYPES = ['vfd', 'plc', 'hmi', 'servo', 'mcc', 'panel', 'motor', 'drive', 'sensor', 'other'];
const REPAIR_SCOPES = ['on_site', 'workshop', 'pickup_and_return'];
const REPAIR_SERVICE_TYPES = ['inspection', 'component_repair', 'replacement', 'calibration', 'overhaul', 'other'];
const REPAIR_PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const AMC_REQUEST_TRANSITIONS = {
  draft: ['submitted', 'cancelled'],
  submitted: ['under_review', 'cancelled'],
  under_review: ['scheduled', 'cancelled'],
  scheduled: ['reschedule_requested', 'confirmed', 'cancelled'],
  reschedule_requested: ['rescheduled', 'scheduled', 'confirmed', 'cancelled'],
  rescheduled: ['confirmed', 'reschedule_requested', 'cancelled'],
  confirmed: ['completed', 'reschedule_requested', 'cancelled'],
  completed: [],
  cancelled: [],
};

const AMC_CONTRACT_TRANSITIONS = {
  active: ['suspended', 'expired', 'cancelled'],
  suspended: ['active', 'expired', 'cancelled'],
  expired: ['cancelled'],
  cancelled: [],
};

const REPAIR_TRANSITIONS = {
  draft: ['submitted', 'cancelled'],
  submitted: ['received', 'cancelled'],
  received: ['diagnosis', 'cancelled'],
  diagnosis: ['estimate_required', 'cancelled'],
  estimate_required: ['approved', 'cancelled'],
  approved: ['repair_in_progress', 'cancelled'],
  repair_in_progress: ['ready', 'cancelled'],
  ready: ['returned', 'cancelled'],
  returned: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const PROJECT_TRANSITIONS = {
  draft: ['submitted', 'cancelled'],
  submitted: ['under_review', 'cancelled'],
  under_review: ['clarification_required', 'approved', 'cancelled'],
  clarification_required: ['under_review', 'cancelled'],
  approved: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// customer = the signed-in company member. manage = director owner or maintenance head.
// A manage actor may also take a customer edge.
const AMC_REQUEST_ACTORS = {
  'draft->submitted': 'customer',
  'draft->cancelled': 'customer',
  'submitted->under_review': 'manage',
  'submitted->cancelled': 'customer',
  'under_review->scheduled': 'manage',
  'under_review->cancelled': 'customer',
  'scheduled->reschedule_requested': 'customer',
  'scheduled->confirmed': 'manage',
  'scheduled->cancelled': 'customer',
  'reschedule_requested->rescheduled': 'manage',
  'reschedule_requested->scheduled': 'manage',
  'reschedule_requested->confirmed': 'manage',
  'reschedule_requested->cancelled': 'customer',
  'rescheduled->confirmed': 'manage',
  'rescheduled->reschedule_requested': 'customer',
  'rescheduled->cancelled': 'customer',
  'confirmed->completed': 'manage',
  'confirmed->reschedule_requested': 'customer',
  'confirmed->cancelled': 'manage',
};

const REPAIR_ACTORS = {
  'draft->submitted': 'customer',
  'draft->cancelled': 'customer',
  'submitted->received': 'manage',
  'submitted->cancelled': 'customer',
  'received->diagnosis': 'manage',
  'received->cancelled': 'customer',
  'diagnosis->estimate_required': 'manage',
  'diagnosis->cancelled': 'customer',
  'estimate_required->approved': 'customer',
  'estimate_required->cancelled': 'customer',
  'approved->repair_in_progress': 'manage',
  'approved->cancelled': 'manage',
  'repair_in_progress->ready': 'manage',
  'repair_in_progress->cancelled': 'manage',
  'ready->returned': 'manage',
  'ready->cancelled': 'manage',
  'returned->completed': 'manage',
  'returned->cancelled': 'manage',
};

const SERVICE_REQUEST_STATUSES = [
  'draft',
  'submitted',
  'searching',
  'assigned',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'failed',
];

const SERVICE_REQUEST_TRANSITIONS = {
  draft: ['submitted', 'cancelled'],
  submitted: ['searching', 'cancelled'],
  searching: ['assigned', 'cancelled', 'failed'],
  assigned: ['scheduled', 'searching', 'cancelled'],
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  failed: [],
};

const SERVICE_REQUEST_ACTORS = {
  'draft->submitted': 'customer',
  'draft->cancelled': 'customer',
  'submitted->searching': 'customer',
  'submitted->cancelled': 'customer',
  'searching->assigned': 'manage',
  'searching->cancelled': 'customer',
  'searching->failed': 'manage',
  'assigned->scheduled': 'manage',
  'assigned->searching': 'manage',
  'assigned->cancelled': 'customer',
  'scheduled->in_progress': 'manage',
  'scheduled->cancelled': 'customer',
  'in_progress->completed': 'manage',
  'in_progress->cancelled': 'manage',
};

const PROJECT_ACTORS = {
  'draft->submitted': 'customer',
  'draft->cancelled': 'customer',
  'submitted->under_review': 'manage',
  'submitted->cancelled': 'customer',
  'under_review->clarification_required': 'manage',
  'under_review->approved': 'manage',
  'under_review->cancelled': 'customer',
  'clarification_required->under_review': 'customer',
  'clarification_required->cancelled': 'customer',
  'approved->in_progress': 'manage',
  'approved->cancelled': 'manage',
  'in_progress->completed': 'manage',
  'in_progress->cancelled': 'manage',
};

const MACHINES = {
  amc_request: { transitions: AMC_REQUEST_TRANSITIONS, actors: AMC_REQUEST_ACTORS },
  amc_contract: { transitions: AMC_CONTRACT_TRANSITIONS, actors: null },
  repair_ticket: { transitions: REPAIR_TRANSITIONS, actors: REPAIR_ACTORS },
  project_request: { transitions: PROJECT_TRANSITIONS, actors: PROJECT_ACTORS },
  service_request: { transitions: SERVICE_REQUEST_TRANSITIONS, actors: SERVICE_REQUEST_ACTORS },
};

function canTransition(machine, from, to) {
  return Array.isArray(machine[from]) && machine[from].includes(to);
}

function actorAllows(required, actor) {
  if (actor === 'manage') return true;
  return required === 'customer' && actor === 'customer';
}

function assertStatusChange(kind, from, to, actor) {
  const machine = MACHINES[kind];
  if (!machine || !canTransition(machine.transitions, from, to)) {
    throw new AppError(
      'That status change is not allowed.',
      409,
      'INVALID_STATUS_TRANSITION',
      { from, to },
    );
  }
  if (machine.actors) {
    const required = machine.actors[`${from}->${to}`];
    if (!required || !actorAllows(required, actor)) {
      throw new AppError('You do not have access to this status change.', 403, 'FORBIDDEN');
    }
  } else if (actor !== 'manage') {
    throw new AppError('You do not have access to this status change.', 403, 'FORBIDDEN');
  }
}

module.exports = {
  AMC_REQUEST_STATUSES,
  AMC_CONTRACT_STATUSES,
  AMC_RESCHEDULE_STATUSES,
  REPAIR_STATUSES,
  PROJECT_STATUSES,
  SERVICE_REQUEST_STATUSES,
  AMC_TYPES,
  AMC_REQUEST_TYPES,
  VISIT_FREQUENCIES,
  DEVICE_TYPES,
  REPAIR_SCOPES,
  REPAIR_SERVICE_TYPES,
  REPAIR_PRIORITIES,
  AMC_REQUEST_TRANSITIONS,
  AMC_CONTRACT_TRANSITIONS,
  REPAIR_TRANSITIONS,
  PROJECT_TRANSITIONS,
  SERVICE_REQUEST_TRANSITIONS,
  canTransition,
  assertStatusChange,
};
