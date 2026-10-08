CREATE TABLE "change_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"scholarship_id" text NOT NULL,
	"change_type" text NOT NULL,
	"summary" text NOT NULL,
	"source_url" text NOT NULL,
	"changed_at" text NOT NULL,
	"verified_at" text NOT NULL,
	"field_changes_json" text DEFAULT '[]' NOT NULL,
	"created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitor_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"started_at" text NOT NULL,
	"completed_at" text NOT NULL,
	"status" text NOT NULL,
	"checked_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"attention_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"error" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_email" text NOT NULL,
	"event_key" text NOT NULL,
	"event_type" text NOT NULL,
	"scholarship_id" text DEFAULT '' NOT NULL,
	"subject" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_id" text DEFAULT '' NOT NULL,
	"error" text DEFAULT '' NOT NULL,
	"attempted_at" text NOT NULL,
	"sent_at" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"user_id" text DEFAULT '' NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"scholarship_changes" boolean DEFAULT true NOT NULL,
	"opening_reminders" boolean DEFAULT true NOT NULL,
	"deadline_reminders" boolean DEFAULT true NOT NULL,
	"deadline_thresholds_json" text DEFAULT '[30,14,7,3,1]' NOT NULL,
	"created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
	"updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scholarship_manual_edits" (
	"scholarship_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"patch_json" text DEFAULT '{}' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scholarship_source_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"scholarship_id" text NOT NULL,
	"source_url" text NOT NULL,
	"content_hash" text DEFAULT '' NOT NULL,
	"http_status" integer DEFAULT 0 NOT NULL,
	"outcome" text DEFAULT 'pending' NOT NULL,
	"error" text DEFAULT '' NOT NULL,
	"last_checked_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scholarship_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"scholarship_id" text NOT NULL,
	"patch_json" text DEFAULT '{}' NOT NULL,
	"source_url" text NOT NULL,
	"verified_at" text NOT NULL,
	"updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_review_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"scholarship_id" text NOT NULL,
	"source_url" text NOT NULL,
	"content_hash" text NOT NULL,
	"candidate_patch_json" text DEFAULT '{}' NOT NULL,
	"field_changes_json" text DEFAULT '[]' NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
	"reviewed_at" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"scholarship_id" text NOT NULL,
	"status" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"checklist_json" text DEFAULT '{}' NOT NULL,
	"updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_scholarship_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"scholarship_id" text NOT NULL,
	"scholarship_json" text DEFAULT '{}' NOT NULL,
	"discovery_input" text DEFAULT '' NOT NULL,
	"source_url" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
	"updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "viewer_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"invited_by" text NOT NULL,
	"created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
	"updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_monitor_runs_user_completed" ON "monitor_runs" USING btree ("user_id","completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_delivery_recipient_event_idx" ON "notification_deliveries" USING btree ("recipient_email","event_key");--> statement-breakpoint
CREATE INDEX "idx_notification_deliveries_recipient_attempted" ON "notification_deliveries" USING btree ("recipient_email","attempted_at");--> statement-breakpoint
CREATE INDEX "idx_notification_deliveries_status_attempted" ON "notification_deliveries" USING btree ("status","attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_email_idx" ON "notification_preferences" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_notification_preferences_enabled_email" ON "notification_preferences" USING btree ("is_enabled","email");--> statement-breakpoint
CREATE UNIQUE INDEX "source_checks_user_scholarship_idx" ON "scholarship_source_checks" USING btree ("user_id","scholarship_id");--> statement-breakpoint
CREATE INDEX "idx_source_checks_user_checked" ON "scholarship_source_checks" USING btree ("user_id","last_checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "scholarship_updates_scholarship_idx" ON "scholarship_updates" USING btree ("scholarship_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_review_user_scholarship_hash_idx" ON "source_review_queue" USING btree ("user_id","scholarship_id","content_hash");--> statement-breakpoint
CREATE INDEX "idx_source_review_user_status_created" ON "source_review_queue" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_progress_user_scholarship_idx" ON "user_progress" USING btree ("user_id","scholarship_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_tracking_user_scholarship_idx" ON "user_scholarship_tracking" USING btree ("user_id","scholarship_id");--> statement-breakpoint
CREATE INDEX "idx_user_tracking_user_active" ON "user_scholarship_tracking" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "viewer_access_email_idx" ON "viewer_access" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_viewer_access_active_email" ON "viewer_access" USING btree ("is_active","email");