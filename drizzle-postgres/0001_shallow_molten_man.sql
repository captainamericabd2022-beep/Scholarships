CREATE TABLE "applicant_profiles" (
	"data_key" text PRIMARY KEY NOT NULL,
	"profile_json" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "background_jobs" (
	"name" text PRIMARY KEY NOT NULL,
	"lease_token" text DEFAULT '' NOT NULL,
	"lease_until" text DEFAULT '' NOT NULL,
	"last_started_at" text DEFAULT '' NOT NULL,
	"last_completed_at" text DEFAULT '' NOT NULL,
	"last_status" text DEFAULT 'not-run' NOT NULL,
	"result_json" text DEFAULT '{}' NOT NULL,
	"last_error" text DEFAULT '' NOT NULL
);
