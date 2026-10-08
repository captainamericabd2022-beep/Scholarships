import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { listManualEdits } from "../../../db/manual-edits";
import { applyManualEdit } from "../../../lib/scholarship-edits";
import {
  changeLog,
  monitorRuns,
  notificationDeliveries,
  notificationPreferences,
  scholarshipUpdates,
  sourceReviewQueue,
  userScholarshipTracking,
  viewerAccess,
} from "../../../db/schema";
import {
  buildReminderEvents,
  emailProviderStatus,
  eventsForPreferences,
  idempotencyKey,
  normalizeThresholds,
  renderReminderEmail,
  selectCatchUpEvents,
  sendReminderEmail,
  type ReminderPreferences,
} from "../../../lib/reminders";
import { scholarships, type Scholarship } from "../../../lib/scholarships";
import {
  configuredOwnerEmail,
  requestIdentity,
  requestUserId,
} from "../../../lib/request-auth";

const LIVE_SITE_URL = "";

function privateJson(payload: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("cache-control", "private, no-store");
  return Response.json(payload, { ...init, headers });
}

function safeJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function savedThresholds(value: string) {
  try {
    return normalizeThresholds(JSON.parse(value));
  } catch {
    return normalizeThresholds(null);
  }
}


async function authorizedUser(request: Request) {
  const identity = await requestIdentity(request);
  if (!identity) return null;
  const ownerUserId = await requestUserId(request);
  if (ownerUserId) return { ...identity, userId: ownerUserId, isOwner: true };
  const [viewer] = await getDb()
    .select({ id: viewerAccess.id })
    .from(viewerAccess)
    .where(and(eq(viewerAccess.email, identity.email), eq(viewerAccess.isActive, true)))
    .limit(1);
  return viewer ? { ...identity, isOwner: false } : null;
}

function rowPreferences(row: typeof notificationPreferences.$inferSelect): ReminderPreferences {
  return {
    email: row.email,
    isEnabled: row.isEnabled,
    scholarshipChanges: row.scholarshipChanges,
    openingReminders: row.openingReminders,
    deadlineReminders: row.deadlineReminders,
    deadlineThresholds: savedThresholds(row.deadlineThresholdsJson),
  };
}

async function ensurePreferences(email: string, userId: string, isOwner: boolean) {
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
  });
  const [created] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.email, email))
    .limit(1);
  return created;
}

async function mergedScholarships() {
  const db = getDb();
  const [updateRows, trackingRows] = await Promise.all([
    db.select().from(scholarshipUpdates),
    db
      .select()
      .from(userScholarshipTracking)
      .where(eq(userScholarshipTracking.isActive, true)),
  ]);
  const updates = new Map(updateRows.map((row) => [row.scholarshipId, safeJson(row.patchJson)]));
  const items = new Map(
    scholarships.map((item) => [item.id, { ...item, ...(updates.get(item.id) ?? {}) } as Scholarship]),
  );
  for (const row of trackingRows) {
    const item = safeJson(row.scholarshipJson) as unknown as Scholarship;
    if (item.id && item.name) items.set(item.id, item);
  }
  const edits = await listManualEdits();
  return [...items.values()].map((item) => applyManualEdit(item, edits));
}

async function reminderSiteUrl() {
  return process.env.REMINDER_SITE_URL?.trim() || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : LIVE_SITE_URL);
}

export async function GET(request: Request) {
  const user = await authorizedUser(request);
  if (!user) return privateJson({ error: "Authorized sign-in is required." }, { status: 403 });
  try {
    const preferences = await ensurePreferences(user.email, user.userId, user.isOwner);
    const provider = await emailProviderStatus();
    const db = getDb();
    const recentDeliveries = await db
      .select({
        subject: notificationDeliveries.subject,
        status: notificationDeliveries.status,
        attemptedAt: notificationDeliveries.attemptedAt,
        sentAt: notificationDeliveries.sentAt,
        error: notificationDeliveries.error,
      })
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.recipientEmail, user.email))
      .orderBy(desc(notificationDeliveries.attemptedAt))
      .limit(8);
    const [latestRun] = await db.select().from(monitorRuns).where(eq(monitorRuns.userId, user.userId)).orderBy(desc(monitorRuns.completedAt)).limit(1);
    const pendingReviews = user.isOwner ? await db.select({ id: sourceReviewQueue.id }).from(sourceReviewQueue).where(and(eq(sourceReviewQueue.userId, user.userId), eq(sourceReviewQueue.status, "pending"))) : [];
    const [lastSuccessful] = await db.select({ sentAt: notificationDeliveries.sentAt }).from(notificationDeliveries).where(and(eq(notificationDeliveries.recipientEmail, user.email), eq(notificationDeliveries.status, "sent"))).orderBy(desc(notificationDeliveries.sentAt)).limit(1);
    const failedDeliveries = recentDeliveries.filter((delivery) => delivery.status === "failed").length;
    return privateJson({
      preferences: rowPreferences(preferences),
      provider: { configured: provider.configured, name: provider.provider, senderScope: provider.senderScope },
      recentDeliveries,
      health: {
        lastAutomaticCheck: latestRun?.completedAt ?? "",
        nextScheduledCheck: "",
        lastSuccessfulEmail: lastSuccessful?.sentAt ?? "",
        failedDeliveries,
        sourcesRequiringReview: pendingReviews.length,
        monitorStatus: latestRun?.status ?? "not-run",
      },
      automaticCheck: "Checks after every owner source refresh. The existing scheduled watch must be pointed to this Vercel URL; no new schedule has been created.",
    });
  } catch (error) {
    return privateJson(
      { error: error instanceof Error ? error.message : "Reminder settings are unavailable." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const user = await authorizedUser(request);
  if (!user) return privateJson({ error: "Authorized sign-in is required." }, { status: 403 });
  try {
    const current = await ensurePreferences(user.email, user.userId, user.isOwner);
    const payload = (await request.json()) as Partial<ReminderPreferences>;
    const now = new Date().toISOString();
    await getDb()
      .update(notificationPreferences)
      .set({
        isEnabled: typeof payload.isEnabled === "boolean" ? payload.isEnabled : current.isEnabled,
        scholarshipChanges: typeof payload.scholarshipChanges === "boolean" ? payload.scholarshipChanges : current.scholarshipChanges,
        openingReminders: typeof payload.openingReminders === "boolean" ? payload.openingReminders : current.openingReminders,
        deadlineReminders: typeof payload.deadlineReminders === "boolean" ? payload.deadlineReminders : current.deadlineReminders,
        deadlineThresholdsJson: payload.deadlineThresholds === undefined
          ? current.deadlineThresholdsJson
          : JSON.stringify(normalizeThresholds(payload.deadlineThresholds)),
        userId: user.userId,
        updatedAt: now,
      })
      .where(eq(notificationPreferences.id, current.id));
    const [updated] = await getDb()
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.id, current.id))
      .limit(1);
    return privateJson({ ok: true, preferences: rowPreferences(updated) });
  } catch (error) {
    return privateJson(
      { error: error instanceof Error ? error.message : "Reminder settings could not be saved." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const user = await authorizedUser(request);
  if (!user?.isOwner) return privateJson({ error: "Owner access is required." }, { status: 403 });
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      action?: "dispatch" | "test";
      dryRun?: boolean;
    };
    const provider = await emailProviderStatus();
    if (payload.action === "test") {
      if (!provider.configured) {
        return privateJson({ error: "Email sending is not connected yet. Add an authenticated Resend API key and verified sender address before a test can be delivered." }, { status: 503 });
      }
      const email = renderReminderEmail([{
        key: `test:${Date.now()}`,
        type: "deadline-reminder",
        scholarshipId: "test",
        scholarshipName: "Test reminder",
        title: "Your scholarship reminders are connected",
        detail: "This is a delivery test. Future messages contain only official scholarship facts and dates.",
        sourceUrl: "",
        daysRemaining: 7,
        reminderThreshold: 7,
        date: null,
      }], await reminderSiteUrl());
      const providerId = await sendReminderEmail({
        to: user.email,
        ...email,
        idempotencyKey: await idempotencyKey(user.email, [`test:${Date.now()}`]),
      });
      return privateJson({ ok: true, sent: 1, providerId, message: `Test email sent to ${user.email}.` });
    }

    const db = getDb();
    const ownerEmail = (await configuredOwnerEmail()) || user.email;
    const [viewerRows, changes, items] = await Promise.all([
      db
        .select({ email: viewerAccess.email })
        .from(viewerAccess)
        .where(eq(viewerAccess.isActive, true)),
      db.select().from(changeLog).orderBy(desc(changeLog.changedAt)).limit(100),
      mergedScholarships(),
    ]);
    await ensurePreferences(ownerEmail, user.userId, true);
    const refreshedPreferenceRows = await db.select().from(notificationPreferences);
    const preferenceByEmail = new Map(refreshedPreferenceRows.map((row) => [row.email, row]));
    const allowedEmails = new Set([ownerEmail, ...viewerRows.map((row) => row.email)]);
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
        return privateJson({
          error: "Reminder events are ready, but email delivery is not connected.",
          planned,
          recipients,
          provider: { configured: false, name: provider.provider },
        }, { status: 503 });
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
    return privateJson(result, failed ? { status: 502 } : undefined);
  } catch (error) {
    return privateJson(
      { error: error instanceof Error ? error.message : "Reminder dispatch failed." },
      { status: 500 },
    );
  }
}
