-- Add an explicit accepted state to the field job lifecycle.
ALTER TABLE field_jobs DROP CONSTRAINT IF EXISTS field_jobs_status_check;
ALTER TABLE field_jobs
  ADD CONSTRAINT field_jobs_status_check
  CHECK (status IN (
    'open',
    'accepted',
    'on_the_way',
    'in_progress',
    'completed',
    'cancelled'
  ));
