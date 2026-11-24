-- Selfhost: what the administrator sees and sets. IF NOT EXISTS, so that the
-- migration stays harmless if main ever brings the same columns
ALTER TABLE "public"."user" ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMP(3);
ALTER TABLE "public"."user" ADD COLUMN IF NOT EXISTS "disabled_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "public"."instance_setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instance_setting_pkey" PRIMARY KEY ("key")
);
