import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { listManualEdits } from "../db/manual-edits";
import { applyManualEdit } from "./scholarship-edits";
import { changeLog, notificationDeliveries, notificationPreferences, scholarshipUpdates, userScholarshipTracking, viewerAccess } from "../db/schema";
import { buildReminderEvents, emailProviderStatus, eventsForPreferences, idempotencyKey, normalizeThresholds, renderReminderEmail, selectCatchUpEvents, sendReminderEmail, type ReminderPreferences } from "./reminders";
import { scholarships, type Scholarship } from "./scholarships";
import { configuredOwnerEmail, configuredAdministratorEmails } from "./request-auth";
import { withJobLease } from "./background-jobs";
const LIVE_SITE_URL = "";
function safeJson(value: string) { try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; } }
function savedThresholds(value: string) { try { return normalizeThresholds(JSON.parse(value)); } catch { return normalizeThresholds(null); } }
export function rowPreferences(row: typeof notificationPreferences.$inferSelect): ReminderPreferences {
  return {
    email: row.email,
    isEnabled: row.isEnabled,
    scholarshipChanges: row.scholarshipChanges,
    openingReminders: row.openingReminders,
    deadlineReminders: row.deadlineReminders,
    deadlineThresholds: savedThresholds(row.deadlineThresholdsJson),
  };
}

export async function ensurePreferences(email: string, userId: string, isOwner: boolean) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.email, email))
    .limit(1);
  if (existing) {
    if (userId && existing.userId !== userId) {
      await db
        .update(notificationPreferences)
        .set({ userId, updatedAt: new Date().toISOString() })
        .where(eq(notificationPreferences.id, existing.id));
      return { ...existing, userId };
    }
    return existing;
  }
  const now = new Date().toISOString();
  await db.insert(notificationPreferences).values({
    email,
    userId,
    isEnabled: isOwner,
    scholarshipChanges: true,
    openingReminders: true,
    deadlineReminders: true,
    deadlineThresholdsJson: JSON.stringify([30, 14, 7, 3, 1]),
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();
  const [created] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.email, email))
    .limit(1);
  return created;
}

async function mergedScholarships(userId: string) {
  const db = getDb();
  const [updateRows, trackingRows] = await Promise.all([
    db.select().from(scholarshipUpdates),
    db
      .select()
      .from(userScholarshipTracking)
      .where(eq(userScholarshipTracking.userId, userId)),
  ]);
  const updates = new Map(updateRows.map((row) => [row.scholarshipId, safeJson(row.patchJson)]));
  const items = new Map(
    scholarships.map((item) => [item.id, { ...item, ...(updates.get(item.id) ?? {}) } as Scholarship]),
  );
  for (const row of trackingRows) {
    if (!row.isActive) continue;
    const item = safeJson(row.scholarshipJson) as unknown as Scholarship;
    if (item.id && item.name) items.set(item.id, item);
  }
  const edits = await listManualEdits();
  const tracked = new Map(trackingRows.map((row) => [row.scholarshipId, row.isActive]));
  return [...items.values()].filter((item) => tracked.get(item.id) ?? true).map((item) => applyManualEdit(item, edits));
}

export async function reminderSiteUrl() {
  return process.env.REMINDER_SITE_URL?.trim() || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : LIVE_SITE_URL);
}


async function runDispatch(userId: string, payload: { dryRun?: boolean }) {
    const provider = await emailProviderStatus();
    const db = getDb();
    const ownerEmail = await configuredOwnerEmail();
    if (!ownerEmail) throw new Error("Primary owner is not configured.");
    const [viewerRows, changes, items] = await Promise.all([
      db
        .select({ email: viewerAccess.email })
        .from(viewerAccess)
        .where(eq(viewerAccess.isActive, true)),
      db.select().from(changeLog).orderBy(desc(changeLog.changedAt)).limit(100),
      mergedScholarships(userId),
    ]);
    await ensurePreferences(ownerEmail, userId, true);
    const refreshedPreferenceRows = await db.select().from(notificationPreferences);
    const preferenceByEmail = new Map(refreshedPreferenceRows.map((row) => [row.email, row]));
    const allowedEmails = new Set([...configuredAdministratorEmails(), ...viewerRows.map((row) => row.email)]);
    const allEvents = buildReminderEvents(items, changes);
    const now = new Date().toISOString();
    let planned = 0;
    let sent = 0;
    let failed = 0;
    const recipients: Array<{ email: string; events: number }> = [];

    for (const email of allowedEmails) {
      if (provider.senderScope === "owner-only" && email !== ownerEmail) continue;
      const row = preferenceByEmail.get(email);
      if (!row || !row.isEnabled) continue;
      const preferences = rowPreferences(row);
      const eligible = eventsForPreferences(allEvents, preferences);
      if (!eligible.length) continue;
      const previous = await db
        .select({ eventKey: notificationDeliveries.eventKey })
        .from(notificationDeliveries)
        .where(and(
          eq(notificationDeliveries.recipientEmail, email),
          eq(notificationDeliveries.status, "sent"),
        ));
      const sentKeys = new Set(previous.map((delivery) => delivery.eventKey));
      const pending = selectCatchUpEvents(eligible, sentKeys);
      if (!pending.length) continue;
      planned += pending.length;
      recipients.push({ email, events: pending.length });
      if (payload.dryRun) continue;
      if (!provider.configured) {
        throw new Error("Reminder events are ready, but email delivery is not configured.");
      }
      const message = renderReminderEmail(pending, await reminderSiteUrl());
      try {
        const providerId = await sendReminderEmail({
          to: email,
          ...message,
          idempotencyKey: await idempotencyKey(email, pending.map((event) => event.key)),
        });
        for (const event of pending) {
          await db
            .insert(notificationDeliveries)
            .values({
              recipientEmail: email,
              eventKey: event.key,
              eventType: event.type,
              scholarshipId: event.scholarshipId,
              subject: message.subject,
              status: "sent",
              providerId,
              error: "",
              attemptedAt: now,
              sentAt: now,
            })
            .onConflictDoUpdate({
              target: [notificationDeliveries.recipientEmail, notificationDeliveries.eventKey],
              set: { status: "sent", providerId, error: "", attemptedAt: now, sentAt: now },
            });
        }
        sent += 1;
      } catch (error) {
        failed += 1;
        const messageText = error instanceof Error ? error.message.slice(0, 300) : "Email delivery failed.";
        for (const event of pending) {
          await db
            .insert(notificationDeliveries)
            .values({
              recipientEmail: email,
              eventKey: event.key,
              eventType: event.type,
              scholarshipId: event.scholarshipId,
              subject: message.subject,
              status: "failed",
              providerId: "",
              error: messageText,
              attemptedAt: now,
              sentAt: "",
            })
            .onConflictDoUpdate({
              target: [notificationDeliveries.recipientEmail, notificationDeliveries.eventKey],
              set: { status: "failed", providerId: "", error: messageText, attemptedAt: now },
            });
        }
      }
    }

    const result = {
      ok: failed === 0,
      dryRun: Boolean(payload.dryRun),
      planned,
      sent,
      failed,
      recipients,
      provider: { configured: provider.configured, name: provider.provider },
      message: failed
        ? `${failed} email delivery attempt${failed === 1 ? "" : "s"} failed. No failed message was marked as sent.`
        : planned
        ? payload.dryRun
          ? `${planned} reminder event${planned === 1 ? "" : "s"} ready for ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}.`
          : `${sent} email digest${sent === 1 ? "" : "s"} sent.`
        : "No new reminder events. Nothing was sent.",
    };
    return result;
}
export async function dispatchReminders(userId: string, options: { dryRun?: boolean } = {}) {
  return withJobLease(`email-dispatch:${userId}`, () => runDispatch(userId, options));
}

