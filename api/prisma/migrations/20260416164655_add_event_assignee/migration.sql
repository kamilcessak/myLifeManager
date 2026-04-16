-- AlterTable
ALTER TABLE "events" ADD COLUMN     "assigneeId" TEXT;

-- CreateIndex
CREATE INDEX "events_assigneeId_idx" ON "events"("assigneeId");

-- CreateIndex
CREATE INDEX "events_teamId_assigneeId_idx" ON "events"("teamId", "assigneeId");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
