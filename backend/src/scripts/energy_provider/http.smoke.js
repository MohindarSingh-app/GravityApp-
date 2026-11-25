/**
 * HTTP smoke test - entry point.
 *
 * Run with:  node scripts/http.smoke.js
 */

const { state, check, request, seed, db, server } = require('./http.harness');
const RegistrationModel = require('../../models/energy_provider/RegistrationModel');
const UserModel = require('../../models/energy_provider/UserModel');

let listener = null;

const run = async () => {
  // The app boots and migrates the schema as soon as it is required.
  listener = await server;
  await seed();

  console.log('Health and auth');
  const otp = await request('POST', '/auth/otp/request', { body: { mobile: '9876543210' } });
  check('otp request succeeds', otp.status === 200, otp.body);

  const otpCode = otp.body?.data?.devOtp;
  check('otp is returned in test mode', !!otpCode);

  const verify = await request('POST', '/auth/otp/verify', {
    body: { mobile: '9876543210', otp: otpCode },
  });
  check('otp verification succeeds', verify.status === 200, verify.body);

  const initialToken = verify.body?.data?.token;
  check('a token is issued', !!initialToken);

  const unauthorised = await request('GET', '/jobs/open');
  check('protected routes need a token', unauthorised.status === 401);

  console.log('\nRegistration API access');
  const registrationMobile = `9${String(Date.now()).slice(-9)}`;
  const registration = await request('POST', '/registration/start', {
    body: { mobile: registrationMobile, email: `partner-${registrationMobile}@example.com`, role: 'service_partner' },
  });
  check('registration start creates a draft and sends a separate registration OTP', registration.status === 200 && !!registration.body?.data?.devOtp);
  const registrationId = registration.body?.data?.id;
  const registrationVerify = await request('POST', '/auth/otp/verify', {
    body: {
      mobile: registrationMobile,
      otp: registration.body?.data?.devOtp,
      purpose: 'registration',
    },
  });
  check('registration OTP preserves the draft registration ID', String(registrationVerify.body?.data?.registrationId) === String(registrationId));
  check('registration waits for Superadmin approval before issuing a session', registrationVerify.body?.data?.approvalRequired === true && !registrationVerify.body?.data?.token);
  await RegistrationModel.updateById(registrationId, { initial_review_status: 'approved' });
  const registrationLoginRequest = await request('POST', '/auth/otp/request', {
    body: { mobile: registrationMobile, purpose: 'login' },
  });
  const registrationLogin = await request('POST', '/auth/otp/verify', {
    body: {
      mobile: registrationMobile,
      otp: registrationLoginRequest.body?.data?.devOtp,
      purpose: 'login',
    },
  });
  let token = registrationLogin.body?.data?.token;
  const registrationUserId = registrationLogin.body?.data?.user?.id;
  check('approved request can sign in to continue the profile', registrationLogin.status === 200 && !!token, registrationLogin.body);
  const publicChecklist = await request('GET', `/registration/${registrationId}/checklist`);
  check('registration details require authentication', publicChecklist.status === 401);
  const personalDetails = await request('PUT', `/registration/${registrationId}/personal-details`, {
    token,
    body: {
      fullName: 'Test Partner',
      dateOfBirth: '1990-01-01',
      address: 'Jaipur',
      emergencyContact: '9876543211',
      profilePhotoBase64: `data:image/png;base64,${Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64')}`,
    },
  });
  check('owner can save personal details and profile photo', personalDetails.status === 200, personalDetails.body);
  const checklist = await request('GET', `/registration/${registrationId}/checklist`, { token });
  const checklistTypes = checklist.body?.data?.filter((item) => item.required).map((item) => item.type) || [];
  check(
    'owner can read the required documents checklist',
    checklist.status === 200
      && checklistTypes.includes('id_proof')
      && checklistTypes.includes('address_proof')
      && checklistTypes.includes('educational_certificate')
      && !checklistTypes.includes('gst'),
    checklist.body
  );

  const licenseUpload = await request('POST', `/registration/${registrationId}/documents`, {
    token,
    body: {
      type: 'driving_license_photo',
      name: 'license.jpg',
      file: 'http-smoke-license',
    },
  });
  check('approved request can upload profile documents', licenseUpload.status === 200, licenseUpload.body);
  await UserModel.updateById(registrationUserId, { role: 'service_partner', status: 'approved' });
  await RegistrationModel.updateById(registrationId, { status: 'approved' });
  const crossAccount = await request('GET', `/registration/${registrationId}/checklist`, {
    token: initialToken,
  });
  check('another account cannot read a registration', crossAccount.status === 403);

  console.log('\nPartner status');
  const online = await request('POST', '/partner/status', { token, body: { online: true } });
  check('partner can go online', online.status === 200, online.body);
  check('partner is online', online.body?.data?.isOnline === true);

  console.log('\nDelivery partner verification');
  const currentVerification = await request('GET', '/partner/delivery-verification', { token });
  check('delivery verification endpoint returns the current status', currentVerification.status === 200 && currentVerification.body?.data === null, currentVerification.body);
  const verificationSubmission = await request('POST', '/partner/delivery-verification', {
    token,
    body: {
      vehicleType: 'Bike / Scooter',
      vehicleNumber: 'RJ14 XX 1234',
      licenseDocumentId: licenseUpload.body?.data?.id,
    },
  });
  check('delivery verification is submitted over HTTP', verificationSubmission.status === 200, verificationSubmission.body);
  check('delivery verification is pending review', verificationSubmission.body?.data?.status === 'pending');
  const pendingDeliveryJobs = await request('GET', '/delivery/open', { token });
  check('pending service partners cannot access delivery requests', pendingDeliveryJobs.status === 403, pendingDeliveryJobs.body);

  console.log('\nJob marketplace');
  const open = await request('GET', '/jobs/open', { token });
  check('open jobs are listed', open.status === 200 && open.body.data.length === 1);
  const jobId = open.body?.data?.[0]?.id;

  const accept = await request('POST', `/jobs/${jobId}/accept`, { token });
  check('job is accepted over HTTP', accept.status === 200, accept.body);
  check('accepted job is assigned', accept.body?.data?.status === 'accepted');
  check('accepted job response does not expose customer phone', accept.body?.data?.customerPhone === null && accept.body?.data?.customerPhoneMasked === '******3210');

  const second = await request('POST', `/jobs/${jobId}/accept`, { token });
  check('a second acceptance is rejected', second.status === 409, second.body);

  const partnerScheduleDenied = await request('GET', '/admin/schedule', { token });
  check('partner accounts cannot access dispatcher schedule', partnerScheduleDenied.status === 403);

  const adminOtp = await request('POST', '/auth/otp/request', {
    body: { mobile: '9000000015', purpose: 'login' },
  });
  const adminLogin = await request('POST', '/auth/otp/verify', {
    body: {
      mobile: '9000000015',
      otp: adminOtp.body?.data?.devOtp,
      purpose: 'login',
    },
  });
  const adminToken = adminLogin.body?.data?.token;
  check('pre-provisioned administrator can sign in over OTP', adminLogin.status === 200 && !!adminToken);
  const adminSchedule = await request('GET', '/admin/schedule', { token: adminToken });
  check('administrator can list assigned active jobs', adminSchedule.status === 200 && adminSchedule.body?.data?.length === 1);
  const scheduledAt = '2030-07-01T10:30:00+05:30';
  const scheduleUpdate = await request('PUT', `/admin/schedule/${jobId}`, {
    token: adminToken,
    body: { scheduledAt },
  });
  check('administrator can assign an appointment time', scheduleUpdate.status === 200 && scheduleUpdate.body?.data?.scheduledAt === scheduledAt);
  const scheduleNotices = await request('GET', '/marketplace/notifications', { token });
  check('partner is notified when the appointment changes', scheduleNotices.status === 200 && scheduleNotices.body.data.some((item) => item.type === 'schedule' && item.jobId === jobId));
  const invalidSchedule = await request('PUT', `/admin/schedule/${jobId}`, {
    token: adminToken,
    body: { scheduledAt: '2030-07-01T10:30' },
  });
  check('appointment time requires an explicit timezone', invalidSchedule.status === 400);
  const impossibleDate = await request('PUT', `/admin/schedule/${jobId}`, {
    token: adminToken,
    body: { scheduledAt: '2030-02-31T10:30:00Z' },
  });
  check('appointment time rejects impossible calendar dates', impossibleDate.status === 400);

  const mine = await request('GET', '/jobs/mine', { token });
  check('assigned jobs are listed with the dispatcher appointment', mine.status === 200 && mine.body.data.length === 1 && mine.body.data[0].scheduledAt === scheduledAt);

  const detail = await request('GET', `/jobs/${jobId}`, { token });
  check('job detail includes the workflow', detail.body?.data?.workflow?.length === 5);

  const steps = await request('GET', '/jobs/workflow/steps', { token });
  check('workflow steps endpoint responds', steps.status === 200 && steps.body.data.length === 5);

  console.log('\nFive step workflow');
  const checkin = await request('POST', `/jobs/${jobId}/workflow/check-in`, { token });
  check('check-in succeeds', checkin.status === 200, checkin.body);

  const locationUpdate = await request('POST', `/jobs/${jobId}/workflow/location`, {
    token,
    body: { latitude: 18.5204, longitude: 73.8567 },
  });
  check('active job accepts a valid live location', locationUpdate.status === 200, locationUpdate.body);
  const invalidLocation = await request('POST', `/jobs/${jobId}/workflow/location`, {
    token,
    body: { latitude: 91, longitude: 73.8567 },
  });
  check('live location rejects invalid coordinates', invalidLocation.status === 400, invalidLocation.body);

  const diagnosis = await request('POST', `/jobs/${jobId}/workflow/diagnosis`, {
    token,
    body: { findings: 'Phase fault', issueTags: ['Overcurrent'] },
  });
  check('diagnosis succeeds', diagnosis.status === 200, diagnosis.body);

  const badPart = await request('POST', `/jobs/${jobId}/workflow/parts`, {
    token,
    body: { parts: [{ name: 'IGBT module', quantity: 1, unitCost: 5000 }] },
  });
  check('workshop-only parts are rejected over HTTP', badPart.status === 400, badPart.body);

  const parts = await request('POST', `/jobs/${jobId}/workflow/parts`, {
    token,
    body: { parts: [{ name: 'Cooling fan', quantity: 1, unitCost: 350 }] },
  });
  check('site replaceable parts are accepted', parts.status === 200, parts.body);

  const photos = await request('POST', `/jobs/${jobId}/workflow/photos`, {
    token,
    body: {
      photos: [
        { type: 'before', fileName: 'b.jpg' },
        { type: 'after', fileName: 'a.jpg' },
      ],
    },
  });
  check('photos are accepted', photos.status === 200, photos.body);

  const complete = await request('POST', `/jobs/${jobId}/workflow/complete`, {
    token,
    body: {
      customerOtp: '4821',
      checklist: [
        { id: 'work_completed', checked: true },
        { id: 'customer_satisfied', checked: true },
        { id: 'site_cleaned', checked: true },
      ],
    },
  });
  check('completion succeeds', complete.status === 200, complete.body);
  check('payout is returned', complete.body?.data?.payoutAmount === 1035);

  console.log('\nDashboard, earnings and notifications');
  const dashboard = await request('GET', '/dashboard', { token });
  check('dashboard responds', dashboard.status === 200, dashboard.body);
  check('dashboard counts the completed job', dashboard.body?.data?.stats?.completedJobs === 1);

  const earnings = await request('GET', '/marketplace/earnings', { token });
  check('earnings are listed', earnings.status === 200 && earnings.body.data.length === 1);

  const summary = await request('GET', '/marketplace/earnings/summary', { token });
  check('earnings summary responds', summary.status === 200);
  check('earnings summary totals the payout', summary.body?.data?.totalNet === 1035);

  const notifications = await request('GET', '/marketplace/notifications', { token });
  check(
    'notifications are listed',
    notifications.status === 200 && notifications.body.data.length >= 1
  );

  const products = await request('GET', '/marketplace/products', { token });
  check('product catalogue responds', products.status === 200 && products.body.data.length === 0);

  console.log('\nError handling');
  const missing = await request('GET', '/jobs/999999', { token });
  check('a missing job returns 404', missing.status === 404, missing.body);

  const unknown = await request('GET', '/does-not-exist', { token });
  check('an unknown route returns 404', unknown.status === 404);
};

run()
  .catch((err) => {
    console.error('\nHTTP smoke test crashed:', err);
    state.failed += 1;
  })
  .finally(async () => {
    if (listener) listener.close();
    await db.close();
    console.log(`\n${state.passed} passed, ${state.failed} failed`);
    if (state.failed > 0) process.exit(1);
  });
