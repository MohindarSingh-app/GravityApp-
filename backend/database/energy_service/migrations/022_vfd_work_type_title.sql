UPDATE service_steps step
SET title = 'What work is needed?',
    summary = 'Choose the drive issue or work that best describes your request.',
    updated_at = NOW()
FROM service_categories category
WHERE step.category_id = category.id
  AND category.code = 'vfd_servo'
  AND step.code = 'work_type';
