-- Efficiency of a run: metres per joule on its flat stretches and the
-- efficiency factor of its power. Computed with the intensity figures, so
-- INTENSITY_VERSION fills them in the background
-- Selfhost: IF NOT EXISTS, since this instance added the columns under the
-- PR's earlier name (20261117120000_run_efficiency)
ALTER TABLE "public"."event_activity"
  ADD COLUMN IF NOT EXISTS "flat_speed_per_watt" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "power_efficiency_factor" DOUBLE PRECISION;
