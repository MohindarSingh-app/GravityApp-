/**
 * Job marketplace facade.
 *
 * Composes the read model, the acceptance logic and the five step field
 * workflow behind one service object so the controllers stay thin and the
 * routes keep a single entry point per concern.
 */

const JobCoreService = require('./jobCoreService');
const JobAcceptService = require('./jobAcceptService');
const WorkflowService = require('./workflowService');

const JobService = {
  // ---- reads -----------------------------------------------------------
  listOpenJobs: (...args) => JobCoreService.listOpenJobs(...args),
  getJobDetail: (...args) => JobCoreService.getJobDetail(...args),
  canSeePii: (...args) => JobCoreService.canSeePii(...args),
  listMyJobs: (...args) => JobCoreService.listMyJobs(...args),
  requestMaskedCall: (...args) => JobCoreService.requestMaskedCall(...args),

  // ---- acceptance ------------------------------------------------------
  acceptJob: (...args) => JobAcceptService.acceptJob(...args),
  declineJob: (...args) => JobAcceptService.declineJob(...args),

  // ---- five step field workflow ----------------------------------------
  workflowSteps: (...args) => WorkflowService.steps(...args),
  checkIn: (...args) => WorkflowService.checkIn(...args),
  saveDiagnosis: (...args) => WorkflowService.saveDiagnosis(...args),
  saveParts: (...args) => WorkflowService.saveParts(...args),
  savePhotos: (...args) => WorkflowService.savePhotos(...args),
  completeJob: (...args) => WorkflowService.completeJob(...args),
};

module.exports = JobService;
