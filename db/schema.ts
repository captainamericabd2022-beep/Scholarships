import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";

export const userProgress = pgTable(
  "user_progress",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    scholarshipId: text("scholarship_id").notNull(),
    status: text("status").notNull().default(""),
    notes: text("notes").notNull().default(""),
    checklistJson: text("checklist_json").notNull().default("{}"),
    updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP::text)`),
  },
  (table) => [
    uniqueIndex("user_progress_user_scholarship_idx").on(
      table.userId,
      table.scholarshipId,
    ),
  ],
);

export const scholarshipUpdates = pgTable(
  "scholarship_updates",
  {
    id: serial("id").primaryKey(),
    scholarshipId: text("scholarship_id").notNull(),
    patchJson: text("patch_json").notNull().default("{}"),
    sourceUrl: text("source_url").notNull(),
    verifiedAt: text("verified_at").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP::text)`),
  },
  (table) => [
    uniqueIndex("scholarship_updates_scholarship_idx").on(table.scholarshipId),
  ],
);

export const changeLog = pgTable("change_log", {
  id: serial("id").primaryKey(),
  scholarshipId: text("scholarship_id").notNull(),
  changeType: text("change_type").notNull(),
  summary: text("summary").notNull(),
  sourceUrl: text("source_url").notNull(),
  changedAt: text("changed_at").notNull(),
  verifiedAt: text("verified_at").notNull(),
  fieldChangesJson: text("field_changes_json").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP::text)`),
});

// Owner corrections are an independent overlay, never a source-verification claim.
export const scholarshipManualEdits = pgTable("scholarship_manual_edits", {
  scholarshipId: text("scholarship_id").primaryKey(),
  userId: text("user_id").notNull(),
  patchJson: text("patch_json").notNull().default("{}"),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});

export const sourceReviewQueue = pgTable(
  "source_review_queue",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    scholarshipId: text("scholarship_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    contentHash: text("content_hash").notNull(),
    candidatePatchJson: text("candidate_patch_json").notNull().default("{}"),
    fieldChangesJson: text("field_changes_json").notNull().default("[]"),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP::text)`),
    reviewedAt: text("reviewed_at").notNull().default(""),
  },
  (table) => [
    uniqueIndex("source_review_user_scholarship_hash_idx").on(table.userId, table.scholarshipId, table.contentHash),
    index("idx_source_review_user_status_created").on(table.userId, table.status, table.createdAt),
  ],
);

export const monitorRuns = pgTable(
  "monitor_runs",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at").notNull(),
    status: text("status").notNull(),
    checkedCount: integer("checked_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    attentionCount: integer("attention_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    error: text("error").notNull().default(""),
  },
  (table) => [index("idx_monitor_runs_user_completed").on(table.userId, table.completedAt)],
);

export const userScholarshipTracking = pgTable(
  "user_scholarship_tracking",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    scholarshipId: text("scholarship_id").notNull(),
    scholarshipJson: text("scholarship_json").notNull().default("{}"),
    discoveryInput: text("discovery_input").notNull().default(""),
    sourceUrl: text("source_url").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP::text)`),
    updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP::text)`),
  },
  (table) => [
    uniqueIndex("user_tracking_user_scholarship_idx").on(
      table.userId,
      table.scholarshipId,
    ),
    index("idx_user_tracking_user_active").on(table.userId, table.isActive),
  ],
);

export const scholarshipSourceChecks = pgTable(
  "scholarship_source_checks",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    scholarshipId: text("scholarship_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    contentHash: text("content_hash").notNull().default(""),
    httpStatus: integer("http_status").notNull().default(0),
    outcome: text("outcome").notNull().default("pending"),
    error: text("error").notNull().default(""),
    lastCheckedAt: text("last_checked_at").notNull(),
  },
  (table) => [
    uniqueIndex("source_checks_user_scholarship_idx").on(
      table.userId,
      table.scholarshipId,
    ),
    index("idx_source_checks_user_checked").on(table.userId, table.lastCheckedAt),
  ],
);

export const viewerAccess = pgTable(
  "viewer_access",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    invitedBy: text("invited_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP::text)`),
    updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP::text)`),
  },
  (table) => [
    uniqueIndex("viewer_access_email_idx").on(table.email),
    index("idx_viewer_access_active_email").on(table.isActive, table.email),
  ],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    userId: text("user_id").notNull().default(""),
    isEnabled: boolean("is_enabled").notNull().default(false),
    scholarshipChanges: boolean("scholarship_changes").notNull().default(true),
    openingReminders: boolean("opening_reminders").notNull().default(true),
    deadlineReminders: boolean("deadline_reminders").notNull().default(true),
    deadlineThresholdsJson: text("deadline_thresholds_json").notNull().default("[30,14,7,3,1]"),
    createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP::text)`),
    updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP::text)`),
  },
  (table) => [
    uniqueIndex("notification_preferences_email_idx").on(table.email),
    index("idx_notification_preferences_enabled_email").on(table.isEnabled, table.email),
  ],
);

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: serial("id").primaryKey(),
    recipientEmail: text("recipient_email").notNull(),
    eventKey: text("event_key").notNull(),
    eventType: text("event_type").notNull(),
    scholarshipId: text("scholarship_id").notNull().default(""),
    subject: text("subject").notNull(),
    status: text("status").notNull().default("pending"),
    providerId: text("provider_id").notNull().default(""),
    error: text("error").notNull().default(""),
    attemptedAt: text("attempted_at").notNull(),
    sentAt: text("sent_at").notNull().default(""),
  },
  (table) => [
    uniqueIndex("notification_delivery_recipient_event_idx").on(
      table.recipientEmail,
      table.eventKey,
    ),
    index("idx_notification_deliveries_recipient_attempted").on(
      table.recipientEmail,
      table.attemptedAt,
    ),
    index("idx_notification_deliveries_status_attempted").on(
      table.status,
      table.attemptedAt,
    ),
  ],
);
