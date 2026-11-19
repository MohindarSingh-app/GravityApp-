ALTER TABLE public.attachments
  DROP CONSTRAINT IF EXISTS attachments_entity_type_check;

ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_entity_type_check
  CHECK (
    entity_type IS NULL
    OR entity_type IN (
      'amc_request',
      'repair_ticket',
      'project_request',
      'service_request',
      'field_signal'
    )
  );
