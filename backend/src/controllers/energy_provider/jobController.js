/**
 * Job marketplace controller.
 *
 * All handlers are thin: they pull the authenticated partner from `req.user`
 * (already loaded from the database by the auth middleware) and hand off to
 * the service layer.
 */

const JobService = require('../../services/energy_provider/jobService');
const DeliveryService = require('../../services/energy_provider/deliveryService');
const WorkshopService = require('../../services/energy_provider/workshopService');
const { asyncHandler, ok } = require('../../utils/energy_provider/apiError');

/** GET /api/v1/jobs/open - open requests for this partner's marketplace. */
const listOpenJobs = asyncHandler(async (req, res) =>
  ok(res, 'Open jobs fetched', await JobService.listOpenJobs(req.user))
);

/** GET /api/v1/jobs/mine - jobs assigned to this partner. */
const listMyJobs = asyncHandler(async (req, res) =>
  ok(res, 'Assigned jobs fetched', await JobService.listMyJobs(req.user))
);

/** GET /api/v1/jobs/:id - full job detail including the workflow. */
const getJob = asyncHandler(async (req, res) =>
  ok(res, 'Job fetched', await JobService.getJobDetail(req.user, req.params.id))
);

/** POST /api/v1/jobs/:id/accept - claim the job. */
const acceptJob = asyncHandler(async (req, res) =>
  ok(res, 'Job accepted', await JobService.acceptJob(req.user, req.params.id))
);

/** POST /api/v1/jobs/:id/decline - decline the offer. */
const declineJob = asyncHandler(async (req, res) =>
  ok(res, 'Job declined', await JobService.declineJob(req.user, req.params.id, req.body || {}))
);

/** GET /api/v1/jobs/workflow/steps - the five step definitions. */
const listWorkflowSteps = asyncHandler(async (req, res) =>
  ok(res, 'Workflow steps fetched', JobService.workflowSteps())
);

/** POST /api/v1/jobs/:id/workflow/check-in */
const checkIn = asyncHandler(async (req, res) =>
  ok(res, 'Checked in at site', await JobService.checkIn(req.user, req.params.id, req.body || {}))
);

/** POST /api/v1/jobs/:id/workflow/location */
const recordLiveLocation = asyncHandler(async (req, res) =>
  ok(res, 'Live location updated', await JobService.recordLiveLocation(req.user, req.params.id, req.body || {}))
);

/** POST /api/v1/jobs/:id/workflow/diagnosis */
const saveDiagnosis = asyncHandler(async (req, res) =>
  ok(res, 'Diagnosis saved', await JobService.saveDiagnosis(req.user, req.params.id, req.body || {}))
);

/** POST /api/v1/jobs/:id/workflow/parts */
const saveParts = asyncHandler(async (req, res) =>
  ok(res, 'Parts saved', await JobService.saveParts(req.user, req.params.id, req.body || {}))
);

/** POST /api/v1/jobs/:id/workflow/photos */
const savePhotos = asyncHandler(async (req, res) =>
  ok(res, 'Photos saved', await JobService.savePhotos(req.user, req.params.id, req.body || {}))
);

/** POST /api/v1/jobs/:id/workflow/complete - sign off and close the job. */
const completeJob = asyncHandler(async (req, res) =>
  ok(res, 'Job completed', await JobService.completeJob(req.user, req.params.id, req.body || {}))
);

/** POST /api/v1/jobs/:id/masked-call - open a protected call session (GAP-01). */
const maskedCall = asyncHandler(async (req, res) =>
  ok(res, 'Masked call session opened', await JobService.requestMaskedCall(req.user, req.params.id))
);
// ---- delivery -----------------------------------------------------------

/** GET /api/v1/delivery/open */
const listOpenDeliveryJobs = asyncHandler(async (req, res) =>
  ok(res, 'Open delivery jobs fetched', await DeliveryService.listOpenJobs(req.user))
);

/** POST /api/v1/delivery/:id/accept */
const acceptDelivery = asyncHandler(async (req, res) =>
  ok(res, 'Delivery job accepted', await DeliveryService.acceptJob(req.user, req.params.id))
);

/** POST /api/v1/delivery/:id/arrival - confirm pickup or drop. */
const confirmArrival = asyncHandler(async (req, res) =>
  ok(res, 'Arrival confirmed', await DeliveryService.confirmArrival(req.user, req.params.id, req.body || {}))
);

/** POST /api/v1/delivery/:id/complete */
const completeDelivery = asyncHandler(async (req, res) =>
  ok(res, 'Delivery completed', await DeliveryService.completeDelivery(req.user, req.params.id))
);

// ---- workshop -----------------------------------------------------------

/** POST /api/v1/jobs/:id/stage - advance a workshop / panel job. */
const advanceStage = asyncHandler(async (req, res) =>
  ok(res, 'Stage advanced', await WorkshopService.advanceStage(req.user, req.params.id, req.body || {}))
);

/** POST /api/v1/jobs/:id/workshop/complete */
const completeWorkshopJob = asyncHandler(async (req, res) =>
  ok(res, 'Workshop job completed', await WorkshopService.completeJob(req.user, req.params.id, req.body || {}))
);

module.exports = {
  listOpenJobs,
  listMyJobs,
  getJob,
  acceptJob,
  declineJob,
  listWorkflowSteps,
  checkIn,
  recordLiveLocation,
  saveDiagnosis,
  saveParts,
  savePhotos,
  completeJob,
  listOpenDeliveryJobs,
  acceptDelivery,
  confirmArrival,
  completeDelivery,
  advanceStage,
  completeWorkshopJob,
  maskedCall,
};
