-- This is an empty migration.-- A child can belong to at most one ACTIVE parent; detached history rows are unlimited (CLAUDE.md §5.1)
CREATE UNIQUE INDEX "uq_active_child" ON "AssetRelationship" ("childId") WHERE "status" = 'ACTIVE';

-- An asset cannot be its own parent
ALTER TABLE "AssetRelationship" ADD CONSTRAINT "chk_relationship_not_self" CHECK ("parentId" <> "childId");
