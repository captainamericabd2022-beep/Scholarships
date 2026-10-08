CREATE TABLE `scholarship_source_checks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`scholarship_id` text NOT NULL,
	`source_url` text NOT NULL,
	`content_hash` text DEFAULT '' NOT NULL,
	`http_status` integer DEFAULT 0 NOT NULL,
	`outcome` text DEFAULT 'pending' NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`last_checked_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_checks_user_scholarship_idx` ON `scholarship_source_checks` (`user_id`,`scholarship_id`);--> statement-breakpoint
CREATE INDEX `idx_source_checks_user_checked` ON `scholarship_source_checks` (`user_id`,`last_checked_at`);--> statement-breakpoint
CREATE TABLE `user_scholarship_tracking` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`scholarship_id` text NOT NULL,
	`scholarship_json` text DEFAULT '{}' NOT NULL,
	`discovery_input` text DEFAULT '' NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_tracking_user_scholarship_idx` ON `user_scholarship_tracking` (`user_id`,`scholarship_id`);--> statement-breakpoint
CREATE INDEX `idx_user_tracking_user_active` ON `user_scholarship_tracking` (`user_id`,`is_active`);