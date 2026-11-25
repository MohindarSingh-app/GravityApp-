const { test } = require('node:test');
const assert = require('node:assert/strict');
const JobCoreService = require('./jobCoreService');
const RegistrationModel = require('../../models/energy_provider/RegistrationModel');
const JobModel = require('../../models/energy_provider/JobModel');
const { PartnerResponseModel } = require('../../models/energy_provider/MarketplaceModels');

test('approved service partners receive published Service Admin jobs outside their specialty filter', async () => {
  const originals = {
    findByMobile: RegistrationModel.findByMobile,
    findLatestByUserAndRole: RegistrationModel.findLatestByUserAndRole,
    findLatestByUser: RegistrationModel.findLatestByUser,
    toApi: RegistrationModel.toApi,
    findOpenForRole: JobModel.findOpenForRole,
    toApi: JobModel.toApi,
    findByPartner: PartnerResponseModel.findByPartner,
  };
  const application = {
    partner_role: 'service_partner',
    status: 'approved',
    specialization_status: 'approved',
    categories: ['VFD / Drives'],
    specializations: {
      categories: {
        vfdDrives: { enabled: true, skills: ['Siemens SINAMICS'], groups: {} },
      },
    },
  };
  const serviceAdminJob = {
    id: 1,
    reference_id: 'SA-EC-AB12CD34',
    target_role: 'service_partner',
    title: 'Control panel inspection',
    category: 'Electrical',
    status: 'open',
    customer_phone: '',
  };

  RegistrationModel.findByMobile = async () => [];
  RegistrationModel.findLatestByUserAndRole = async () => application;
  RegistrationModel.findLatestByUser = async () => null;
  RegistrationModel.toApi = (record) => record;
  JobModel.findOpenForRole = async () => [serviceAdminJob];
  JobModel.toApi = (job) => ({ id: job.id, referenceId: job.reference_id });
  PartnerResponseModel.findByPartner = async () => [];

  try {
    const jobs = await JobCoreService.listOpenJobs({
      id: 10,
      mobile: '9000000010',
      role: 'service_partner',
      status: 'approved',
      specialization_status: 'approved',
    });

    assert.deepEqual(jobs.map((job) => job.referenceId), ['SA-EC-AB12CD34']);
  } finally {
    Object.assign(RegistrationModel, {
      findByMobile: originals.findByMobile,
      findLatestByUserAndRole: originals.findLatestByUserAndRole,
      findLatestByUser: originals.findLatestByUser,
      toApi: originals.toApi,
    });
    Object.assign(JobModel, {
      findOpenForRole: originals.findOpenForRole,
      toApi: originals.toApi,
    });
    PartnerResponseModel.findByPartner = originals.findByPartner;
  }
});
