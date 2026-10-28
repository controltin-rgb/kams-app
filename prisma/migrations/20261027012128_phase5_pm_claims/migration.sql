-- CreateEnum
CREATE TYPE "PmFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "PmRunStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'DONE', 'SKIPPED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('SENT', 'IN_REPAIR', 'RETURNED', 'REPLACED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PmSchedule" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assetId" TEXT,
    "locationId" TEXT,
    "frequency" "PmFrequency" NOT NULL,
    "startDate" DATE NOT NULL,
    "nextDueDate" DATE NOT NULL,
    "assignedTechId" TEXT,
    "checklistTemplate" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PmRun" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "PmRunStatus" NOT NULL DEFAULT 'SCHEDULED',
    "checklistResult" JSONB,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "doneById" TEXT,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PmRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalClaim" (
    "id" TEXT NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "ticketId" TEXT,
    "problem" TEXT NOT NULL,
    "sentDate" DATE NOT NULL,
    "expectedReturnDate" DATE,
    "actualReturnDate" DATE,
    "status" "ClaimStatus" NOT NULL DEFAULT 'SENT',
    "previousAssetStatus" "AssetStatus" NOT NULL,
    "cost" DECIMAL(10,2),
    "oldSerial" TEXT,
    "newSerial" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PmSchedule_active_nextDueDate_idx" ON "PmSchedule"("active", "nextDueDate");

-- CreateIndex
CREATE INDEX "PmRun_status_dueDate_idx" ON "PmRun"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "PmRun_scheduleId_dueDate_key" ON "PmRun"("scheduleId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalClaim_claimNumber_key" ON "ExternalClaim"("claimNumber");

-- CreateIndex
CREATE INDEX "ExternalClaim_status_idx" ON "ExternalClaim"("status");

-- CreateIndex
CREATE INDEX "ExternalClaim_assetId_idx" ON "ExternalClaim"("assetId");

-- AddForeignKey
ALTER TABLE "PmSchedule" ADD CONSTRAINT "PmSchedule_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmSchedule" ADD CONSTRAINT "PmSchedule_assignedTechId_fkey" FOREIGN KEY ("assignedTechId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmRun" ADD CONSTRAINT "PmRun_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "PmSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalClaim" ADD CONSTRAINT "ExternalClaim_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalClaim" ADD CONSTRAINT "ExternalClaim_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalClaim" ADD CONSTRAINT "ExternalClaim_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
