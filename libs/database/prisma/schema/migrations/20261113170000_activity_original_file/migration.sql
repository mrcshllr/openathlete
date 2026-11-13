-- Original device file (FIT) of an imported activity, to download it again.
-- A new table: nothing to rewrite, and the bytes stay out of the activity rows.

-- CreateTable
CREATE TABLE "event_activity_file" (
    "event_activity_file_id" SERIAL NOT NULL,
    "file_type" TEXT NOT NULL DEFAULT 'FIT',
    "size" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "event_activity_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_activity_file_pkey" PRIMARY KEY ("event_activity_file_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_activity_file_event_activity_id_key" ON "event_activity_file"("event_activity_id");

-- AddForeignKey
ALTER TABLE "event_activity_file" ADD CONSTRAINT "event_activity_file_event_activity_id_fkey" FOREIGN KEY ("event_activity_id") REFERENCES "event_activity"("event_activity_id") ON DELETE CASCADE ON UPDATE CASCADE;
