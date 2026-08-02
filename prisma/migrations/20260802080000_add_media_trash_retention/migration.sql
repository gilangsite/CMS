-- Add a workspace-level retention policy and a recoverable trash state for media.
ALTER TABLE "workspaces"
ADD COLUMN "media_trash_retention_days" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "media_assets"
ADD COLUMN "deleted_at" TIMESTAMP(3),
ADD COLUMN "purge_after" TIMESTAMP(3),
ADD COLUMN "deleted_by" TEXT;

CREATE INDEX "media_assets_workspace_id_deleted_at_idx"
ON "media_assets"("workspace_id", "deleted_at");

CREATE INDEX "media_assets_purge_after_idx"
ON "media_assets"("purge_after");
