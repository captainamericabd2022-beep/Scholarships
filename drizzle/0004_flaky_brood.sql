CREATE TABLE `monitor_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text NOT NULL,
	`status` text NOT NULL,
	`checked_count` integer DEFAULT 0 NOT NULL,
	`updated_count` integer DEFAULT 0 NOT NULL,
	`attention_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`error` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_monitor_runs_user_completed` ON `monitor_runs` (`user_id`,`completed_at`);--> statement-breakpoint
CREATE TABLE `source_review_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`scholarship_id` text NOT NULL,
	`source_url` text NOT NULL,
	`content_hash` text NOT NULL,
	`candidate_patch_json` text DEFAULT '{}' NOT NULL,
	`field_changes_json` text DEFAULT '[]' NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_review_user_scholarship_hash_idx` ON `source_review_queue` (`user_id`,`scholarship_id`,`content_hash`);--> statement-breakpoint
CREATE INDEX `idx_source_review_user_status_created` ON `source_review_queue` (`user_id`,`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `change_log` ADD `field_changes_json` text DEFAULT '[]' NOT NULL;