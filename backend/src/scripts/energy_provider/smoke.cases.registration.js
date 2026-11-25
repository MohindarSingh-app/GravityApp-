const RegistrationService = require('../../services/energy_provider/registrationService');
const AuthService = require('../../services/energy_provider/authService');
const UserModel = require('../../models/energy_provider/UserModel');
const DocumentModel = require('../../models/energy_provider/DocumentModel');
const { check, expectError } = require('./smoke.harness');
const OtpModel = require('../../models/energy_provider/OtpModel');
const RegistrationModel = require('../../models/energy_provider/RegistrationModel');
const JobModel = require('../../models/energy_provider/JobModel');
const JobService = require('../../services/energy_provider/jobService');


module.exports = async function registrationCases() {
  console.log('\nPartner registration');
  const mobile = '9000000021';
  const started = await RegistrationService.start({
    mobile,
    email: 'registration@example.com',
    role: 'service_partner',
  });
  check('registration start requests a registration OTP', started.otpSent && !!started.devOtp);
  await OtpModel.consume((await OtpModel.findLatestForMobile(mobile)).id);
  const secondRoleStarted = await RegistrationService.start({
    mobile,
    email: 'registration@example.com',
    role: 'repairing_partner',
  });
  check('the same verified mobile can create a separate role application', String(secondRoleStarted.id) !== String(started.id));
  await OtpModel.consume((await OtpModel.findLatestForMobile(mobile)).id);
  const repeatedRoleStarted = await RegistrationService.start({
    mobile,
    email: 'registration@example.com',
    role: 'repairing_partner',
  });
  check('repeat registration for the same role resumes its draft', repeatedRoleStarted.id === secondRoleStarted.id);

  const verified = await AuthService.verifyOtp({
    mobile,
    otp: repeatedRoleStarted.devOtp,
    purpose: 'registration',
  });
  check('registration OTP links the draft to the verified user', String(verified.registrationId) === String(secondRoleStarted.id));
  check('registration OTP creates a pending initial review request', verified.approvalRequired && verified.status === 'pending_initial_review');

  const userId = verified.user.id;
  const photo = `data:image/png;base64,${Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64')}`;
  await expectError(
    'partner profile cannot be completed before initial approval',
    () => RegistrationService.savePersonalDetails(secondRoleStarted.id, {
      fullName: 'Registration Partner',
      dateOfBirth: '1990-01-01',
      address: 'Jaipur',
      emergencyContact: '9000000022',
    }),
    403
  );
  await RegistrationModel.updateById(secondRoleStarted.id, { initial_review_status: 'approved' });
  await RegistrationService.savePersonalDetails(secondRoleStarted.id, {
    fullName: 'Registration Partner',
    dateOfBirth: '1990-01-01',
    address: 'Jaipur',
    emergencyContact: '9000000022',
    profilePhotoBase64: photo,
  });
  const savedUser = await UserModel.findById(userId);
  check('personal details store emergency contact and profile photo', savedUser.emergency_contact_phone === '9000000022' && savedUser.profile_photo === photo);

  const professionalDetails = {
    experience: '3 – 5 years',
    qualification: 'ITI — Electrician Trade',
    partnerType: 'service_partner',
    categories: ['PLC / SCADA', 'VFD / Drives'],
  };
  await RegistrationService.saveProfessionalDetails(secondRoleStarted.id, {
    ...professionalDetails,
    partnerType: 'repairing_partner',
    categories: ['VFD', 'PLC'],
  });
  check('role-specific professional details are accepted', true);
  await expectError(
    'professional categories cannot be submitted for another role',
    () => RegistrationService.saveProfessionalDetails(secondRoleStarted.id, {
      ...professionalDetails,
      partnerType: 'repairing_partner',
      categories: ['Lighting'],
    }),
    400
  );

  const checklist = await RegistrationService.getChecklist(secondRoleStarted.id);
  check('repairing-partner checklist includes required GST certificate', checklist.some((item) => item.type === 'gst' && item.required));
  await RegistrationService.saveBankDetails(secondRoleStarted.id, {
    accountNumber: '1234567890',
    ifscCode: 'HDFC0001234',
    accountHolderName: 'Registration Partner',
    bankName: 'Example Bank',
  });
  await RegistrationService.saveServiceArea(secondRoleStarted.id, { serviceAreas: ['Jaipur'] });

  for (const type of ['business_registration', 'gst', 'workshop_address', 'owner_id']) {
    await RegistrationService.uploadDocument(secondRoleStarted.id, {
      type,
      name: `${type}.pdf`,
      file: `smoke-${type}`,
    });
  }
  const submitted = await RegistrationService.submit(secondRoleStarted.id, { consent: true });
  check('complete registration can be submitted for review', submitted.status === 'under_review');

  const expertiseMobile = '9000000024';
  const expertiseStart = await RegistrationService.start({ mobile: expertiseMobile, email: 'expertise@example.com', role: 'service_partner' });
  const expertiseVerified = await AuthService.verifyOtp({ mobile: expertiseMobile, otp: expertiseStart.devOtp, purpose: 'registration' });
  const expertiseApplication = await RegistrationService.getById(expertiseVerified.registrationId);
  await RegistrationModel.updateById(expertiseApplication.id, { initial_review_status: 'approved' });
  await RegistrationService.saveProfessionalDetails(expertiseApplication.id, {
    experience: '3 – 5 years', qualification: 'ITI — Electrician Trade', partnerType: 'service_partner', categories: ['VFD / Drives'],
  });
  await RegistrationService.saveBankDetails(expertiseApplication.id, { accountNumber: '1234567890', ifscCode: 'HDFC0001234', accountHolderName: 'Expertise Partner' });
  await RegistrationService.saveServiceArea(expertiseApplication.id, { serviceAreas: ['Jaipur'] });
  for (const type of ['id_proof', 'address_proof', 'educational_certificate', 'gst']) {
    await RegistrationService.uploadDocument(expertiseApplication.id, { type, name: `${type}.pdf`, file: `expertise-${type}` });
  }
  await RegistrationService.submit(expertiseApplication.id, { consent: true });
  await RegistrationModel.updateById(expertiseApplication.id, { status: 'approved', partner_role: 'service_partner', specializations: null, specialization_status: 'unsubmitted' });
  await UserModel.updateById(expertiseVerified.user.id, { status: 'approved' });
  await UserModel.updateById(expertiseVerified.user.id, { specializationStatus: 'unsubmitted' });
  const expertise = await RegistrationService.saveSpecializations(expertiseApplication.id, {
    categories: {
      vfdDrives: { enabled: true, skills: ['Siemens SINAMICS'], groups: { 'VFD parameter tuning': ['Siemens SINAMICS'] } },
    },
  });
  check('expertise selections are saved as pending admin review', expertise.specializationStatus === 'pending');
  const pendingExpertisePartner = await UserModel.findById(expertiseVerified.user.id);
  check('pending expertise blocks marketplace feed', (await JobService.listOpenJobs(pendingExpertisePartner)).length === 0);
  const expertiseQueues = await RegistrationService.listSpecializationReviews();
  check('admin review queue contains submitted expertise', expertiseQueues.some((item) => String(item.id) === String(expertiseApplication.id)));

  const expertiseAdmin = await UserModel.create({ mobile: '9000000990', role: 'admin', status: 'approved' });
  const reviewedExpertise = await RegistrationService.reviewSpecializations(expertiseAdmin, expertiseApplication.id, { decision: 'approved' });
  check('admin approval updates expertise approval status', reviewedExpertise.specializationStatus === 'approved');
  const expertisePartner = await UserModel.findById(expertiseVerified.user.id);
  const matchedJob = await JobModel.create({ referenceId: 'EXPERTISE-MATCH-01', jobType: 'service', targetRole: 'service_partner', title: 'Siemens SINAMICS repair', category: 'VFD / Drives', equipment: 'Siemens SINAMICS', brand: 'Siemens', description: 'Matched skill test' });
  const unmatchedJob = await JobModel.create({ referenceId: 'EXPERTISE-MATCH-02', jobType: 'service', targetRole: 'service_partner', title: 'PLC fault check', category: 'PLC / SCADA', equipment: 'PLC', brand: 'Omron', description: 'Unmatched skill test' });
  const matchedJobs = await JobService.listOpenJobs(expertisePartner);
  const roleJobCountBeforeWrongSkill = matchedJobs.length;

  check('approved expertise returns its selected-brand job', matchedJobs.some((item) => item.referenceId === matchedJob.reference_id));
  const wrongSkillJob = await JobModel.create({ referenceId: 'EXPERTISE-MATCH-03', jobType: 'service', targetRole: 'service_partner', title: 'Delta drive inspection', category: 'VFD / Drives', equipment: 'Delta VFD', brand: 'Delta', equipmentModel: 'test model', description: 'Unselected brand skills test', issueTags: ['Delta drive inspection'] });
  const afterWrongSkillJob = await JobService.listOpenJobs(expertisePartner);
  check('approved expertise omits unselected skills within the same category', afterWrongSkillJob.length === roleJobCountBeforeWrongSkill && !afterWrongSkillJob.some((item) => item.referenceId === wrongSkillJob.reference_id));
  await JobModel.updateById(matchedJob.id, { status: 'cancelled' });
  await JobModel.updateById(unmatchedJob.id, { status: 'cancelled' });
  await JobModel.updateById(wrongSkillJob.id, { status: 'cancelled' });

  const anotherMobile = '9000000023';
  const anotherOtp = await AuthService.requestOtp({ mobile: anotherMobile, purpose: 'login' });
  await expectError(
    'login OTP cannot be used to verify registration',
    () => AuthService.verifyOtp({ mobile: anotherMobile, otp: anotherOtp.devOtp, purpose: 'registration' }),
    400
  );
};
