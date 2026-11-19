-- AMC quote requests are submitted without a preferred date; the team schedules after review.
ALTER TABLE amc_requests DROP CONSTRAINT IF EXISTS amc_requests_submitted_check;
