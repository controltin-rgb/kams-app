-- AlterTable
ALTER TABLE "AssetCategory" ADD COLUMN     "sceneModel" TEXT;

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "sceneSlot" TEXT;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "onHoldReason" TEXT;

-- CreateTable
CREATE TABLE "SceneEvent" (
    "id" BIGSERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SceneEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SceneLayout" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SceneLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SceneAvatar" (
    "userId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "deskSlot" TEXT,
    "colors" JSONB,

    CONSTRAINT "SceneAvatar_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "SceneEvent_createdAt_idx" ON "SceneEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SceneAvatar_deskSlot_key" ON "SceneAvatar"("deskSlot");

-- CreateIndex
CREATE UNIQUE INDEX "Location_sceneSlot_key" ON "Location"("sceneSlot");

-- AddForeignKey
ALTER TABLE "SceneAvatar" ADD CONSTRAINT "SceneAvatar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

