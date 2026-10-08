CREATE TABLE `viewer_access` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`invited_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `viewer_access_email_idx` ON `viewer_access` (`email`);--> statement-breakpoint
CREATE INDEX `idx_viewer_access_active_email` ON `viewer_access` (`is_active`,`email`);