const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/energy_provider/auth');
const {
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
  advanceStage,
  completeWorkshopJob,
  maskedCall,
} = require('../../controllers/energy_provider/jobController');
router.use(authenticate);
// Reads
router.get('/open', listOpenJobs);
router.get('/mine', listMyJobs);
router.get('/workflow/steps', listWorkflowSteps);
router.get('/:id', getJob);
// Acceptance
router.post('/:id/accept', acceptJob);
router.post('/:id/decline', declineJob);
// Five step field workflow
router.post('/:id/workflow/check-in', checkIn);
router.post('/:id/workflow/location', recordLiveLocation);
router.post('/:id/workflow/diagnosis', saveDiagnosis);
router.post('/:id/workflow/parts', saveParts);
router.post('/:id/workflow/photos', savePhotos);
router.post('/:id/workflow/complete', completeJob);
// Masked calling (GAP-01) - must come before generic /:id routes matter less for POST, keep grouped here
router.post('/:id/masked-call', maskedCall);
// Workshop / panel stage machine
router.post('/:id/stage', advanceStage);
router.post('/:id/workshop/complete', completeWorkshopJob);
module.exports = router;
