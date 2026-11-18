-- Selfhost: the job that applied a plan, as the training plan library on
-- main stores it (20261116130000_training_plan_library there). This
-- instance ran the library under its first migration names, so the column
-- comes on its own, and IF NOT EXISTS lets it pass once main's renamed
-- migrations are marked applied
ALTER TABLE "public"."training_plan" ADD COLUMN IF NOT EXISTS "apply_job_id" TEXT;

CREATE INDEX IF NOT EXISTS "training_plan_athlete_id_apply_job_id_idx" ON "public"."training_plan"("athlete_id", "apply_job_id");
