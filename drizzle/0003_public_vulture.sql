CREATE TABLE `notification_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipient_email` text NOT NULL,
	`event_key` text NOT NULL,
	`event_type` text NOT NULL,
	`scholarship_id` text DEFAULT '' NOT NULL,
	`subject` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_id` text DEFAULT '' NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`attempted_at` text NOT NULL,
	`sent_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_delivery_recipient_event_idx` ON `notification_deliveries` (`recipient_email`,`event_key`);--> statement-breakpoint
CREATE INDEX `idx_notification_deliveries_recipient_attempted` ON `notification_deliveries` (`recipient_email`,`attempted_at`);--> statement-breakpoint
CREATE INDEX `idx_notification_deliveries_status_attempted` ON `notification_deliveries` (`status`,`attempted_at`);--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`user_id` text DEFAULT '' NOT NULL,
	`is_enabled` integer DEFAULT false NOT NULL,
	`scholarship_changes` integer DEFAULT true NOT NULL,
	`opening_reminders` integer DEFAULT true NOT NULL,
	`deadline_reminders` integer DEFAULT true NOT NULL,
	`deadline_thresholds_json` text DEFAULT '[30,14,7,3,1]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_preferences_email_idx` ON `notification_preferences` (`email`);--> statement-breakpoint
CREATE INDEX `idx_notification_preferences_enabled_email` ON `notification_preferences` (`is_enabled`,`email`);
--> statement-breakpoint
PRAGMA optimize;
