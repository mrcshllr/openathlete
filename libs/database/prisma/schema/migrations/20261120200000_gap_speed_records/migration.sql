-- Selfhost: best grade-adjusted speed by duration, which the critical speed
-- model of the training focus is read from
ALTER TYPE "public"."record_type" ADD VALUE IF NOT EXISTS 'GAP_SPEED';
