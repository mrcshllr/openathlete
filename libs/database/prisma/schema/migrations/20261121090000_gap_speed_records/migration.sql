-- Fastest grade-adjusted time of a run over 400 m, 800 m and 5 km, which
-- critical speed is read from. Additive; RECORDS_VERSION fills it in the
-- background
ALTER TYPE "public"."record_type" ADD VALUE 'GAP_SPEED';
