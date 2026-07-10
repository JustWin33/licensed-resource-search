-- Hand-written constraints that Prisma cannot express as partial unique indexes.
CREATE UNIQUE INDEX "resources_slug_active_uq"
  ON "resources" ("slug")
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "cloud_links_url_hash_active_uq"
  ON "cloud_links" ("url_hash")
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "cloud_links_primary_per_resource_provider_uq"
  ON "cloud_links" ("resource_id", "provider_id")
  WHERE "is_primary" = TRUE AND "is_enabled" = TRUE AND "deleted_at" IS NULL;

ALTER TABLE "resources"
  ADD CONSTRAINT "resources_completeness_range_ck"
  CHECK ("completeness_score" BETWEEN 0 AND 100);

ALTER TABLE "cloud_links"
  ADD CONSTRAINT "cloud_links_primary_enabled_ck"
  CHECK ("is_primary" = FALSE OR ("is_enabled" = TRUE AND "deleted_at" IS NULL));

