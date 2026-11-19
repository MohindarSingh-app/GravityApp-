function dateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function attachment(row) {
  return {
    id: row.id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    contentType: row.mime_type,
    fileReference: row.file_reference,
    storageKey: row.file_reference,
    contentUrl: row.file_reference.startsWith('local/')
      ? `/api/customer/attachments/${row.id}/content`
      : null,
    uploadedBy: row.uploaded_by,
    byteSize: row.byte_size,
    createdAt: row.created_at,
  };
}

function statusEvent(row) {
  const oldStatus = row.old_status;
  const newStatus = row.new_status;
  const changedBy = row.changed_by;
  const changedAt = row.changed_at;
  return {
    id: row.id,
    oldStatus,
    newStatus,
    changedBy,
    changedAt,
    remarks: row.remarks,
    fromStatus: oldStatus,
    toStatus: newStatus,
    actorId: changedBy,
    note: row.remarks,
    createdAt: changedAt,
  };
}

function contract(row, extras = {}) {
  return {
    id: row.id,
    customerId: row.customer_id,
    companyId: row.company_id,
    siteId: row.site_id,
    contractNumber: row.contract_number,
    contractType: row.contract_type,
    amcType: row.contract_type,
    coverage: row.coverage,
    startDate: dateOnly(row.start_date),
    endDate: dateOnly(row.end_date),
    visitSchedule: {
      frequency: row.visit_frequency,
      visitsPerYear: row.visits_per_year,
      nextVisitDate: dateOnly(row.next_visit_date),
      preferredTime: row.preferred_visit_time,
    },
    status: row.status,
    assignedService: {
      engineerName: row.assigned_engineer_name,
      serviceTeam: row.assigned_service_team,
      contact: row.service_contact,
    },
    ...(typeof extras.openRequestCount === 'number' ? { openRequestCount: extras.openRequestCount } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function amcRequest(row, extras = {}) {
  return {
    id: row.id,
    customerId: row.customer_id,
    companyId: row.company_id,
    siteId: row.site_id,
    contractId: row.contract_id,
    existingContractId: row.contract_id,
    existingContractNumber: row.contract_number || null,
    requestNumber: row.request_number,
    requestType: row.request_type,
    serviceRequirement: row.service_requirement,
    requestedService: row.service_requirement,
    preferredDate: dateOnly(row.preferred_date),
    preferredTime: row.preferred_time,
    description: row.description,
    scheduledDate: dateOnly(row.scheduled_date),
    scheduledTime: row.scheduled_time,
    ...(extras.attachments ? { attachments: extras.attachments.map(attachment) } : {}),
    status: row.status,
    submittedAt: row.submitted_at,
    cancelledAt: row.cancelled_at,
    completedAt: row.completed_at,
    statusHistory: extras.history ? extras.history.map(statusEvent) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function reschedule(row) {
  return {
    id: row.id,
    amcRequestId: row.amc_request_id,
    amcContractId: row.amc_contract_id,
    customerId: row.customer_id,
    companyId: row.company_id,
    previousSchedule: dateOnly(row.previous_schedule),
    requestedSchedule: dateOnly(row.requested_schedule),
    oldScheduledDate: dateOnly(row.previous_schedule),
    requestedNewDate: dateOnly(row.requested_schedule),
    requestedNewTime: row.requested_time || null,
    reason: row.reason,
    notes: row.notes || '',
    status: row.status,
    previousRequestStatus: row.previous_request_status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function device(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    companyId: row.company_id,
    siteId: row.site_id,
    deviceType: row.device_type,
    manufacturer: row.manufacturer,
    model: row.model,
    serialNumber: row.serial_number,
    assetNumber: row.asset_number,
    powerRating: row.power_rating,
    location: row.location,
    installationLocation: row.location,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function ticket(row, extras = {}) {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    customerId: row.customer_id,
    companyId: row.company_id,
    siteId: row.site_id,
    deviceId: row.device_id,
    deviceType: row.device_type || null,
    deviceManufacturer: row.device_manufacturer || null,
    deviceModel: row.device_model || null,
    deviceSerialNumber: row.device_serial_number || null,
    deviceAssetNumber: row.device_asset_number || null,
    deviceLocation: row.device_location || null,
    repairScope: row.repair_scope,
    serviceType: row.service_type,
    priority: row.priority,
    requestedTurnaround: row.requested_turnaround,
    additionalRequirements: row.additional_requirements,
    issueDescription: row.issue_description,
    symptoms: row.symptoms,
    errorDetails: row.error_details,
    faultInformation: row.error_details,
    ...(extras.attachments ? { attachments: extras.attachments.map(attachment) } : {}),
    status: row.status,
    submittedAt: row.submitted_at,
    cancelledAt: row.cancelled_at,
    completedAt: row.completed_at,
    statusHistory: extras.history ? extras.history.map(statusEvent) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function budget(row) {
  if (row.budget_amount === null || row.budget_amount === undefined) return null;
  return {
    amount: Number(row.budget_amount).toFixed(2),
    currency: row.budget_currency,
  };
}

function projectRequest(row, extras = {}) {
  return {
    id: row.id,
    projectRequestId: row.id,
    customerId: row.customer_id,
    companyId: row.company_id,
    siteId: row.site_id,
    category: row.category_code,
    categoryName: row.category_name,
    projectType: row.project_type_code,
    projectTypeName: row.project_type_name,
    requestNumber: row.request_number,
    title: row.title,
    description: row.description,
    requirements: row.requirements,
    estimatedScope: row.estimated_scope,
    preferredTimeline: row.preferred_timeline,
    budget: budget(row),
    ...(extras.details ? {
      details: extras.details.map((item) => ({
        key: item.field_key,
        value: item.field_value,
        dataType: item.data_type,
      })),
    } : {}),
    ...(extras.attachments ? { attachments: extras.attachments.map(attachment) } : {}),
    status: row.status,
    submittedAt: row.submitted_at,
    cancelledAt: row.cancelled_at,
    completedAt: row.completed_at,
    statusHistory: extras.history ? extras.history.map(statusEvent) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serviceRequest(row, extras = {}) {
  return {
    id: row.id,
    requestNumber: row.request_number,
    customerId: row.customer_id,
    companyId: row.company_id,
    companyName: row.company_name,
    siteId: row.site_id,
    siteName: row.site_name,
    siteAddress: row.site_address,
    siteCity: row.site_city,
    siteType: row.site_type,
    categoryId: row.category_id,
    categoryCode: row.category_code,
    categoryName: row.category_name,
    status: row.status,
    statusLabel: row.status_label,
    priority: row.priority,
    preferredDate: dateOnly(row.preferred_date),
    preferredTime: row.preferred_time,
    assignedEngineerName: row.assigned_engineer_name,
    assignedAt: row.assigned_at,
    submittedAt: row.submitted_at,
    cancelledAt: row.cancelled_at,
    completedAt: row.completed_at,
    selections: extras.selections || [],
    answers: extras.answers || [],
    nextAction: extras.nextAction || null,
    nextActionLabel: extras.nextActionLabel || null,
    ...(extras.attachments ? { attachments: extras.attachments.map(attachment) } : {}),
    statusHistory: extras.history
      ? extras.history.map((event) => ({
        ...statusEvent(event),
        fromLabel: event.old_status && extras.statusLabels
          ? (extras.statusLabels[event.old_status] || event.old_status)
          : null,
        toLabel: extras.statusLabels
          ? (extras.statusLabels[event.new_status] || event.new_status)
          : event.new_status,
      }))
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function categories(rows) {
  const grouped = [];
  const index = new Map();
  for (const row of rows) {
    let category = index.get(row.category_code);
    if (!category) {
      category = { code: row.category_code, name: row.category_name, types: [] };
      index.set(row.category_code, category);
      grouped.push(category);
    }
    category.types.push({ code: row.type_code, name: row.type_name });
  }
  return grouped;
}

module.exports = {
  attachment,
  statusEvent,
  contract,
  amcRequest,
  reschedule,
  device,
  ticket,
  projectRequest,
  serviceRequest,
  categories,
};
