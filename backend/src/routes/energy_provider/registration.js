const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/energy_provider/auth');
const { requireRegistrationOwner } = require('../../middleware/energy_provider/registrationAccess');
const {
  startRegistration,
  savePersonalDetails,
  saveProfessionalDetails,
  saveBankDetails,
  saveServiceArea,
  saveSpecializations,
  uploadDocument,
  getDocuments,
  getChecklist,
  deleteDocument,
  submitRegistration,
  getStatus,
  getRegistration,
} = require('../../controllers/energy_provider/registrationController');

router.post('/start', startRegistration);
router.use('/:id', authenticate, requireRegistrationOwner);
router.put('/:id/personal-details', savePersonalDetails);
router.put('/:id/professional-details', saveProfessionalDetails);
router.put('/:id/bank-details', saveBankDetails);
router.put('/:id/service-area', saveServiceArea);
router.put('/:id/specializations', saveSpecializations);
router.post('/:id/documents', uploadDocument);
router.get('/:id/documents', getDocuments);
router.get('/:id/checklist', getChecklist);
router.delete('/:id/documents/:docId', deleteDocument);
router.post('/:id/submit', submitRegistration);
router.get('/:id/status', getStatus);
router.get('/:id', getRegistration);

module.exports = router;
