-- CreateEnum
CREATE TYPE "OwnerType" AS ENUM ('deployer', 'authorized_submitter', 'third_party_rightsholder', 'unknown');

-- CreateEnum
CREATE TYPE "RightsStatus" AS ENUM ('owned', 'authorized', 'open_licensed', 'public_domain', 'insufficient_evidence', 'revoked', 'prohibited');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending_review', 'needs_changes', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('draft', 'published', 'temporarily_hidden', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('none', 'under_review', 'temporarily_hidden', 'restored', 'permanently_removed');

-- CreateEnum
CREATE TYPE "LinkStatus" AS ENUM ('pending', 'available', 'expired', 'need_password', 'password_error', 'risk_controlled', 'unsupported', 'unknown', 'disabled');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('official_site', 'author_page', 'license_registry', 'public_archive', 'user_submitted', 'other');

-- CreateEnum
CREATE TYPE "CaptureMethod" AS ENUM ('manual', 'csv_import', 'markdown_import', 'official_api');

-- CreateEnum
CREATE TYPE "AuthorizationStatus" AS ENUM ('pending', 'active', 'expired', 'revoked', 'rejected');

-- CreateEnum
CREATE TYPE "EvidenceVerificationStatus" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('pending', 'needs_info', 'approved', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'triaged', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "TakedownStatus" AS ENUM ('received', 'temporarily_hidden', 'awaiting_response', 'restored', 'permanently_removed', 'closed');

-- CreateEnum
CREATE TYPE "CounterNoticeStatus" AS ENUM ('received', 'under_review', 'accepted', 'rejected', 'closed');

-- CreateEnum
CREATE TYPE "HttpResultClass" AS ENUM ('none', '2xx', '3xx', '4xx', '5xx', 'network_error', 'blocked');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('visitor', 'admin_user', 'worker', 'system');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('preview', 'confirmed', 'processing', 'completed', 'partial_failure', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('pending', 'succeeded', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "OutboxEventType" AS ENUM ('resource_index_requested', 'resource_index_removed', 'link_check_requested', 'analytics_aggregate_requested', 'retention_cleanup_requested');

-- CreateEnum
CREATE TYPE "ConversionVerificationStatus" AS ENUM ('pending', 'verified', 'rejected', 'duplicate');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "username_normalized" VARCHAR(120) NOT NULL,
    "email_normalized" VARCHAR(320),
    "password_hash" TEXT NOT NULL,
    "password_hash_version" VARCHAR(32) NOT NULL,
    "is_disabled" BOOLEAN NOT NULL DEFAULT false,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_user_roles" (
    "admin_user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_user_roles_pkey" PRIMARY KEY ("admin_user_id","role_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "last_seen_at" TIMESTAMPTZ(6),
    "ip_hmac" VARCHAR(128),
    "user_agent_class" VARCHAR(64),

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_password_reset_tokens" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "summary" TEXT NOT NULL,
    "cover_object_ref" VARCHAR(500),
    "owner_type" "OwnerType" NOT NULL,
    "rights_status" "RightsStatus" NOT NULL,
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'pending_review',
    "publication_status" "PublicationStatus" NOT NULL DEFAULT 'draft',
    "complaint_status" "ComplaintStatus" NOT NULL DEFAULT 'none',
    "completeness_score" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMPTZ(6),
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_note_internal" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "parent_id" UUID,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_categories" (
    "resource_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_categories_pkey" PRIMARY KEY ("resource_id","category_id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "normalized_name" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_tags" (
    "resource_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_tags_pkey" PRIMARY KEY ("resource_id","tag_id")
);

-- CreateTable
CREATE TABLE "resource_sources" (
    "id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_url_hash" VARCHAR(128) NOT NULL,
    "source_name" VARCHAR(200) NOT NULL,
    "source_type" "SourceType" NOT NULL,
    "capture_method" "CaptureMethod" NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "resource_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorization_records" (
    "id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "rights_type" "RightsStatus" NOT NULL,
    "license_name" VARCHAR(200),
    "license_version" VARCHAR(80),
    "license_url" TEXT,
    "grantor_name_private" TEXT,
    "scope_private" TEXT,
    "territory" VARCHAR(120),
    "allows_commercial_promotion" BOOLEAN NOT NULL DEFAULT false,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "statement_private" TEXT,
    "verification_basis" TEXT NOT NULL,
    "status" "AuthorizationStatus" NOT NULL DEFAULT 'pending',
    "verified_by" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "authorization_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorization_evidence" (
    "id" UUID NOT NULL,
    "authorization_record_id" UUID NOT NULL,
    "object_ref_private" VARCHAR(500) NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "original_filename_redacted" VARCHAR(255),
    "uploaded_by" UUID NOT NULL,
    "verification_status" "EvidenceVerificationStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "authorization_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_files_summary" (
    "id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "directory_summary" TEXT,
    "file_count" BIGINT,
    "total_bytes" BIGINT,
    "source_name" VARCHAR(200),
    "observed_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "resource_files_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cloud_providers" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(40) NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "allowed_host_patterns" JSONB NOT NULL,
    "adapter_version" VARCHAR(40) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cloud_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cloud_links" (
    "id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "normalized_url" TEXT NOT NULL,
    "url_hash" VARCHAR(128) NOT NULL,
    "passcode_ciphertext" TEXT,
    "current_status" "LinkStatus" NOT NULL DEFAULT 'pending',
    "status_confirmations" INTEGER NOT NULL DEFAULT 0,
    "last_checked_at" TIMESTAMPTZ(6),
    "next_check_at" TIMESTAMPTZ(6),
    "redirect_template_id" UUID,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cloud_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_check_records" (
    "id" UUID NOT NULL,
    "cloud_link_id" UUID NOT NULL,
    "adapter_version" VARCHAR(40) NOT NULL,
    "status" "LinkStatus" NOT NULL,
    "http_result_class" "HttpResultClass" NOT NULL,
    "error_category" VARCHAR(80),
    "duration_ms" INTEGER,
    "checked_at" TIMESTAMPTZ(6) NOT NULL,
    "next_check_at" TIMESTAMPTZ(6),
    "response_metadata_redacted" JSONB,

    CONSTRAINT "link_check_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redirect_channels" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "provider_id" UUID NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "template" TEXT NOT NULL,
    "allowed_placeholders" JSONB NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "redirect_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "ticket_token_hash" VARCHAR(128) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "summary" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "cloud_url" TEXT NOT NULL,
    "provider_hint" VARCHAR(40),
    "passcode_ciphertext" TEXT,
    "rights_type" "RightsStatus" NOT NULL,
    "rights_statement_private" TEXT NOT NULL,
    "contact_private" TEXT NOT NULL,
    "truthfulness_accepted_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'pending',
    "resource_id" UUID,
    "reviewer_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "ticket_token_hash" VARCHAR(128) NOT NULL,
    "resource_id" UUID NOT NULL,
    "reason_code" VARCHAR(80) NOT NULL,
    "description_private" TEXT NOT NULL,
    "contact_private" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "handled_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "takedown_requests" (
    "id" UUID NOT NULL,
    "ticket_token_hash" VARCHAR(128) NOT NULL,
    "resource_id" UUID NOT NULL,
    "notice_identity_private" TEXT NOT NULL,
    "contact_private" TEXT NOT NULL,
    "work_or_source_private" TEXT NOT NULL,
    "request_private" TEXT NOT NULL,
    "evidence_ref_private" VARCHAR(500),
    "truthfulness_accepted_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "TakedownStatus" NOT NULL DEFAULT 'received',
    "handled_by" UUID,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "takedown_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counter_notices" (
    "id" UUID NOT NULL,
    "takedown_request_id" UUID NOT NULL,
    "submitter_contact_private" TEXT NOT NULL,
    "statement_private" TEXT NOT NULL,
    "evidence_ref_private" VARCHAR(500),
    "status" "CounterNoticeStatus" NOT NULL DEFAULT 'received',
    "handled_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "counter_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_blocklist" (
    "id" UUID NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "normalized_value" TEXT NOT NULL,
    "reason_private" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "source_blocklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" UUID NOT NULL,
    "resource_id" UUID,
    "case_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "from_status" VARCHAR(80),
    "to_status" VARCHAR(80) NOT NULL,
    "reason_private" TEXT NOT NULL,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "request_id" VARCHAR(128) NOT NULL,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_queries" (
    "id" UUID NOT NULL,
    "normalized_query" VARCHAR(500) NOT NULL,
    "filters_json" JSONB NOT NULL,
    "result_count" INTEGER NOT NULL,
    "coarse_session_id" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "search_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_suggestions" (
    "id" UUID NOT NULL,
    "term" VARCHAR(300) NOT NULL,
    "normalized_term" VARCHAR(300) NOT NULL,
    "source" VARCHAR(40) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "search_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "synonyms" (
    "id" UUID NOT NULL,
    "terms_json" JSONB NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "synonyms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "click_events" (
    "id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "cloud_link_id" UUID NOT NULL,
    "provider_slug" VARCHAR(40) NOT NULL,
    "channel_slug" VARCHAR(80),
    "referrer_page_type" VARCHAR(80),
    "allowed_utm_json" JSONB,
    "coarse_device" VARCHAR(40),
    "coarse_region" VARCHAR(40),
    "dedupe_key" VARCHAR(128) NOT NULL,
    "result" VARCHAR(40) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "click_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversion_events" (
    "id" UUID NOT NULL,
    "external_event_key" VARCHAR(255) NOT NULL,
    "provider_slug" VARCHAR(40) NOT NULL,
    "resource_id" UUID,
    "channel_slug" VARCHAR(80),
    "conversion_type" VARCHAR(80) NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "import_batch_id" UUID,
    "source_description" TEXT NOT NULL,
    "verification_status" "ConversionVerificationStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversion_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_analytics" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "metric" VARCHAR(80) NOT NULL,
    "provider_slug" VARCHAR(40),
    "channel_slug" VARCHAR(80),
    "resource_id" UUID,
    "value" BIGINT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "daily_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" UUID NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "format" VARCHAR(40) NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'preview',
    "requested_by" UUID NOT NULL,
    "confirmed_by" UUID,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ(6),

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "source_hash" VARCHAR(128) NOT NULL,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'pending',
    "error_code" VARCHAR(80),
    "error_detail_redacted" TEXT,
    "resource_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "aggregate_type" VARCHAR(80) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" "OutboxEventType" NOT NULL,
    "payload_version" INTEGER NOT NULL,
    "payload_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error_redacted" TEXT,
    "dead_lettered_at" TIMESTAMPTZ(6),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_failures" (
    "id" UUID NOT NULL,
    "job_type" VARCHAR(80) NOT NULL,
    "dedupe_key" VARCHAR(255) NOT NULL,
    "attempt" INTEGER NOT NULL,
    "error_category" VARCHAR(80) NOT NULL,
    "error_message_redacted" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "job_failures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(120) NOT NULL,
    "target_type" VARCHAR(80) NOT NULL,
    "target_id" UUID,
    "request_id" VARCHAR(128) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "changed_fields_summary" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(160) NOT NULL,
    "value_json" JSONB NOT NULL,
    "is_sensitive_ref" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "key" VARCHAR(160) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rollout_scope" JSONB,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_username_normalized_key" ON "admin_users"("username_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_normalized_key" ON "admin_users"("email_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "roles_slug_key" ON "roles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_slug_key" ON "permissions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_token_hash_key" ON "admin_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "admin_sessions_admin_user_id_revoked_at_expires_at_idx" ON "admin_sessions"("admin_user_id", "revoked_at", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "admin_password_reset_tokens_token_hash_key" ON "admin_password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "admin_password_reset_tokens_admin_user_id_expires_at_used_a_idx" ON "admin_password_reset_tokens"("admin_user_id", "expires_at", "used_at");

-- CreateIndex
CREATE INDEX "resources_publication_status_review_status_complaint_status_idx" ON "resources"("publication_status", "review_status", "complaint_status", "deleted_at");

-- CreateIndex
CREATE INDEX "resources_updated_at_idx" ON "resources"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "resource_sources_resource_id_idx" ON "resource_sources"("resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "resource_sources_source_url_hash_resource_id_key" ON "resource_sources"("source_url_hash", "resource_id");

-- CreateIndex
CREATE INDEX "authorization_records_resource_id_status_ends_at_idx" ON "authorization_records"("resource_id", "status", "ends_at");

-- CreateIndex
CREATE INDEX "authorization_evidence_authorization_record_id_deleted_at_idx" ON "authorization_evidence"("authorization_record_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "resource_files_summary_resource_id_key" ON "resource_files_summary"("resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "cloud_providers_slug_key" ON "cloud_providers"("slug");

-- CreateIndex
CREATE INDEX "cloud_links_resource_id_provider_id_is_enabled_deleted_at_idx" ON "cloud_links"("resource_id", "provider_id", "is_enabled", "deleted_at");

-- CreateIndex
CREATE INDEX "cloud_links_next_check_at_current_status_idx" ON "cloud_links"("next_check_at", "current_status");

-- CreateIndex
CREATE INDEX "link_check_records_cloud_link_id_checked_at_idx" ON "link_check_records"("cloud_link_id", "checked_at");

-- CreateIndex
CREATE UNIQUE INDEX "redirect_channels_slug_key" ON "redirect_channels"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_ticket_token_hash_key" ON "submissions"("ticket_token_hash");

-- CreateIndex
CREATE INDEX "submissions_status_created_at_idx" ON "submissions"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reports_ticket_token_hash_key" ON "reports"("ticket_token_hash");

-- CreateIndex
CREATE INDEX "reports_resource_id_status_idx" ON "reports"("resource_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "takedown_requests_ticket_token_hash_key" ON "takedown_requests"("ticket_token_hash");

-- CreateIndex
CREATE INDEX "takedown_requests_resource_id_status_idx" ON "takedown_requests"("resource_id", "status");

-- CreateIndex
CREATE INDEX "counter_notices_takedown_request_id_status_idx" ON "counter_notices"("takedown_request_id", "status");

-- CreateIndex
CREATE INDEX "source_blocklist_expires_at_idx" ON "source_blocklist"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "source_blocklist_kind_normalized_value_key" ON "source_blocklist"("kind", "normalized_value");

-- CreateIndex
CREATE INDEX "moderation_actions_resource_id_created_at_idx" ON "moderation_actions"("resource_id", "created_at");

-- CreateIndex
CREATE INDEX "moderation_actions_case_id_created_at_idx" ON "moderation_actions"("case_id", "created_at");

-- CreateIndex
CREATE INDEX "search_queries_created_at_expires_at_idx" ON "search_queries"("created_at", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "search_suggestions_normalized_term_source_key" ON "search_suggestions"("normalized_term", "source");

-- CreateIndex
CREATE INDEX "click_events_created_at_expires_at_idx" ON "click_events"("created_at", "expires_at");

-- CreateIndex
CREATE INDEX "click_events_resource_id_created_at_idx" ON "click_events"("resource_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "click_events_dedupe_key_created_at_key" ON "click_events"("dedupe_key", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversion_events_external_event_key_key" ON "conversion_events"("external_event_key");

-- CreateIndex
CREATE INDEX "conversion_events_occurred_at_provider_slug_idx" ON "conversion_events"("occurred_at", "provider_slug");

-- CreateIndex
CREATE INDEX "daily_analytics_day_metric_idx" ON "daily_analytics"("day", "metric");

-- CreateIndex
CREATE UNIQUE INDEX "daily_analytics_day_metric_provider_slug_channel_slug_resou_key" ON "daily_analytics"("day", "metric", "provider_slug", "channel_slug", "resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "import_batches_idempotency_key_key" ON "import_batches"("idempotency_key");

-- CreateIndex
CREATE INDEX "import_batches_status_created_at_idx" ON "import_batches"("status", "created_at");

-- CreateIndex
CREATE INDEX "import_rows_source_hash_idx" ON "import_rows"("source_hash");

-- CreateIndex
CREATE UNIQUE INDEX "import_rows_batch_id_row_number_key" ON "import_rows"("batch_id", "row_number");

-- CreateIndex
CREATE INDEX "outbox_events_processed_at_retry_count_created_at_idx" ON "outbox_events"("processed_at", "retry_count", "created_at");

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_type_aggregate_id_created_at_idx" ON "outbox_events"("aggregate_type", "aggregate_id", "created_at");

-- CreateIndex
CREATE INDEX "job_failures_job_type_dedupe_key_resolved_at_idx" ON "job_failures"("job_type", "dedupe_key", "resolved_at");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_created_at_idx" ON "audit_logs"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "admin_user_roles" ADD CONSTRAINT "admin_user_roles_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_user_roles" ADD CONSTRAINT "admin_user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_password_reset_tokens" ADD CONSTRAINT "admin_password_reset_tokens_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_categories" ADD CONSTRAINT "resource_categories_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_categories" ADD CONSTRAINT "resource_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_tags" ADD CONSTRAINT "resource_tags_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_tags" ADD CONSTRAINT "resource_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_sources" ADD CONSTRAINT "resource_sources_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorization_records" ADD CONSTRAINT "authorization_records_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorization_records" ADD CONSTRAINT "authorization_records_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorization_evidence" ADD CONSTRAINT "authorization_evidence_authorization_record_id_fkey" FOREIGN KEY ("authorization_record_id") REFERENCES "authorization_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorization_evidence" ADD CONSTRAINT "authorization_evidence_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_files_summary" ADD CONSTRAINT "resource_files_summary_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cloud_links" ADD CONSTRAINT "cloud_links_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cloud_links" ADD CONSTRAINT "cloud_links_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "cloud_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cloud_links" ADD CONSTRAINT "cloud_links_redirect_template_id_fkey" FOREIGN KEY ("redirect_template_id") REFERENCES "redirect_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_check_records" ADD CONSTRAINT "link_check_records_cloud_link_id_fkey" FOREIGN KEY ("cloud_link_id") REFERENCES "cloud_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redirect_channels" ADD CONSTRAINT "redirect_channels_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "cloud_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redirect_channels" ADD CONSTRAINT "redirect_channels_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_handled_by_fkey" FOREIGN KEY ("handled_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "takedown_requests" ADD CONSTRAINT "takedown_requests_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "takedown_requests" ADD CONSTRAINT "takedown_requests_handled_by_fkey" FOREIGN KEY ("handled_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_notices" ADD CONSTRAINT "counter_notices_takedown_request_id_fkey" FOREIGN KEY ("takedown_request_id") REFERENCES "takedown_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_notices" ADD CONSTRAINT "counter_notices_handled_by_fkey" FOREIGN KEY ("handled_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_blocklist" ADD CONSTRAINT "source_blocklist_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_cloud_link_id_fkey" FOREIGN KEY ("cloud_link_id") REFERENCES "cloud_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversion_events" ADD CONSTRAINT "conversion_events_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversion_events" ADD CONSTRAINT "conversion_events_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_analytics" ADD CONSTRAINT "daily_analytics_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
