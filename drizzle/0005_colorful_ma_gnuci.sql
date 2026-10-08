CREATE TABLE `scholarship_manual_edits` (
	`scholarship_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`patch_json` text DEFAULT '{}' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
