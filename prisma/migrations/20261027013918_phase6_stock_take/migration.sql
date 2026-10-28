-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('MATCHED', 'RELOCATED', 'MISSING', 'UNREGISTERED');

-- CreateEnum
CREATE TYPE "AuditDecision" AS ENUM ('APPLY', 'IGNORE');

-- CreateTable
CREATE TABLE "AuditCampaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "scopeLocationIds" TEXT[],
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditCampaignAuditor" (
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AuditCampaignAuditor_pkey" PRIMARY KEY ("campaignId","userId")
);

-- CreateTable
CREATE TABLE "AuditScan" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "clientUuid" TEXT NOT NULL,
    "scannedCode" TEXT NOT NULL,
    "actualLocationId" TEXT,
    "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "notes" TEXT,
    "scannedById" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditRecord" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "assetId" TEXT,
    "scannedCode" TEXT NOT NULL,
    "scannedById" TEXT,
    "expectedLocationId" TEXT,
    "actualLocationId" TEXT,
    "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "result" "AuditResult" NOT NULL,
    "notes" TEXT,
    "scannedAt" TIMESTAMP(3),
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "decision" "AuditDecision",
    "reconciledById" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditScan_clientUuid_key" ON "AuditScan"("clientUuid");

-- CreateIndex
CREATE INDEX "AuditScan_campaignId_idx" ON "AuditScan"("campaignId");

-- CreateIndex
CREATE INDEX "AuditRecord_campaignId_result_idx" ON "AuditRecord"("campaignId", "result");

-- CreateIndex
CREATE UNIQUE INDEX "AuditRecord_campaignId_scannedCode_key" ON "AuditRecord"("campaignId", "scannedCode");

-- AddForeignKey
ALTER TABLE "AuditCampaignAuditor" ADD CONSTRAINT "AuditCampaignAuditor_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AuditCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditCampaignAuditor" ADD CONSTRAINT "AuditCampaignAuditor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditScan" ADD CONSTRAINT "AuditScan_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AuditCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRecord" ADD CONSTRAINT "AuditRecord_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AuditCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditRecord" ADD CONSTRAINT "AuditRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
