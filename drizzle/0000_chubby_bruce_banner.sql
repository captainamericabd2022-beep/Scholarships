CREATE TABLE `change_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scholarship_id` text NOT NULL,
	`change_type` text NOT NULL,
	`summary` text NOT NULL,
	`source_url` text NOT NULL,
	`changed_at` text NOT NULL,
	`verified_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scholarship_updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scholarship_id` text NOT NULL,
	`patch_json` text DEFAULT '{}' NOT NULL,
	`source_url` text NOT NULL,
	`verified_at` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scholarship_updates_scholarship_idx` ON `scholarship_updates` (`scholarship_id`);--> statement-breakpoint
CREATE TABLE `user_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`scholarship_id` text NOT NULL,
	`status` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`checklist_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_progress_user_scholarship_idx` ON `user_progress` (`user_id`,`scholarship_id`);