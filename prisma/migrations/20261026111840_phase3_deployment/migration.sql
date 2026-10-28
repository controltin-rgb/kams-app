-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('COMPONENT', 'ACCESSORY', 'SOFTWARE');

-- CreateEnum
CREATE TYPE "RelationStatus" AS ENUM ('ACTIVE', 'DETACHED');

-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('HANDOVER', 'RETURN', 'MOVE', 'SWAP_PARTIAL', 'SWAP_FULL');

-- CreateEnum
CREATE TYPE "TransferItemAction" AS ENUM ('ASSIGN', 'RETURN', 'MOVE', 'ATTACH', 'DETACH');

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "transferId" TEXT;

-- CreateTable
CREATE TABLE "AssetRelationship" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "type" "RelationType" NOT NULL DEFAULT 'COMPONENT',
    "status" "RelationStatus" NOT NULL DEFAULT 'ACTIVE',
    "attachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detachedAt" TIMESTAMP(3),

    CONSTRAINT "AssetRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetTransfer" (
    "id" TEXT NOT NULL,
    "docNumber" TEXT NOT NULL,
    "type" "TransferType" NOT NULL,
    "reason" TEXT,
    "ticketId" TEXT,
    "toOwnerId" TEXT,
    "toLocationId" TEXT,
    "toDepartmentId" TEXT,
    "performedById" TEXT NOT NULL,
    "signedByName" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetTransferItem" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "action" "TransferItemAction" NOT NULL,
    "parentAssetId" TEXT,
    "fromOwnerId" TEXT,
    "toOwnerId" TEXT,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "fromDepartmentId" TEXT,
    "toDepartmentId" TEXT,
    "fromStatus" "AssetStatus",
    "toStatus" "AssetStatus",

    CONSTRAINT "AssetTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetRelationship_parentId_status_idx" ON "AssetRelationship"("parentId", "status");

-- CreateIndex
CREATE INDEX "AssetRelationship_childId_idx" ON "AssetRelationship"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetTransfer_docNumber_key" ON "AssetTransfer"("docNumber");

-- CreateIndex
CREATE INDEX "AssetTransfer_createdAt_idx" ON "AssetTransfer"("createdAt");

-- CreateIndex
CREATE INDEX "AssetTransferItem_transferId_idx" ON "AssetTransferItem"("transferId");

-- CreateIndex
CREATE INDEX "AssetTransferItem_assetId_idx" ON "AssetTransferItem"("assetId");

-- CreateIndex
CREATE INDEX "Attachment_transferId_idx" ON "Attachment"("transferId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "AssetTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRelationship" ADD CONSTRAINT "AssetRelationship_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRelationship" ADD CONSTRAINT "AssetRelationship_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetTransfer" ADD CONSTRAINT "AssetTransfer_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetTransferItem" ADD CONSTRAINT "AssetTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "AssetTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetTransferItem" ADD CONSTRAINT "AssetTransferItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
