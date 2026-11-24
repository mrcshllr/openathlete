-- Selfhost: the administrator's log and sign-up links. No foreign keys: the
-- log outlives the accounts it is about
CREATE TABLE IF NOT EXISTS "public"."admin_action" (
    "admin_action_id" SERIAL NOT NULL,
    "admin_user_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "target_user_id" INTEGER,
    "target" TEXT,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_action_pkey" PRIMARY KEY ("admin_action_id")
);
CREATE INDEX IF NOT EXISTS "admin_action_created_at_idx" ON "public"."admin_action"("created_at");

CREATE TABLE IF NOT EXISTS "public"."instance_invitation" (
    "instance_invitation_id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "created_by" INTEGER NOT NULL,
    "used_at" TIMESTAMP(3),
    "used_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instance_invitation_pkey" PRIMARY KEY ("instance_invitation_id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "instance_invitation_token_key" ON "public"."instance_invitation"("token");
