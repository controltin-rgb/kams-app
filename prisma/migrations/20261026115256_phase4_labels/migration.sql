-- CreateEnum
CREATE TYPE "LabelKind" AS ENUM ('ASSET', 'STATUS');

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "labelTemplateId" TEXT;

-- CreateTable
CREATE TABLE "LabelTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "LabelKind" NOT NULL DEFAULT 'ASSET',
    "paperPreset" TEXT NOT NULL DEFAULT 'A4_4x10',
    "pageWidthMm" DECIMAL(8,2) NOT NULL,
    "pageHeightMm" DECIMAL(8,2) NOT NULL,
    "labelWidthMm" DECIMAL(8,2) NOT NULL,
    "labelHeightMm" DECIMAL(8,2) NOT NULL,
    "columns" INTEGER NOT NULL DEFAULT 1,
    "rows" INTEGER NOT NULL DEFAULT 1,
    "marginTopMm" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "marginLeftMm" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "gapXMm" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "gapYMm" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "design" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LabelTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LabelTemplate_kind_idx" ON "LabelTemplate"("kind");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_labelTemplateId_fkey" FOREIGN KEY ("labelTemplateId") REFERENCES "LabelTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
