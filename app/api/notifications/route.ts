import { dispatchReminders, ensurePreferences, rowPreferences, reminderSiteUrl } from "../../../lib/notification-service";
import { and, desc, eq, inArray } from "drizzle-orm";
import { deliveryHistoryRecipients, sendWithDeliveryAudit, testEmailRecipient, uniqueDeliveryMessages } from "../../../lib/email-delivery";
import { getDb } from "../../../db";
import { jobHealth, JobBusyError } from "../../../lib/background-jobs";
import { nextWatchWindow, WATCH_JOB } from "../../../lib/job-policy";
import {
  monitorRuns,
  notificationDeliveries,
  notificationPreferences,
  sourceReviewQueue,
  scholarshipSourceChecks,
  viewerAccess,
} from "../../../db/schema";
import {
  emailProviderStatus,
  idempotencyKey,
  renderReminderEmail,
  sendReminderEmail,
  normalizeThresholds,
  type ReminderPreferences,
} from "../../../lib/reminders";
import {
  configuredOwnerEmail,
  configuredAdministratorEmails,
  requestIdentity,
  requestUserId,
} from "../../../lib/request-auth";

function privateJson(payload: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("cache-control", "private, no-store");
  return Response.json(payload, { ...init, headers });
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

export async function GET(request: Request) {
  const user = await authorizedUser(request);
  if (!user) return privateJson({ error: "Authorized sign-in is required." }, { status: 403 });
  try {
    const preferences = await ensurePreferences(user.email, user.userId, user.isOwner);
    const provider = await emailProviderStatus();
    const db = getDb();
    const historyScope = inArray(notificationDeliveries.recipientEmail, deliveryHistoryRecipients(user.isOwner, user.email, configuredAdministratorEmails()));
    const recentRows = await db
      .select({
        recipientEmail: notificationDeliveries.recipientEmail,
        providerId: notificationDeliveries.providerId,
        subject: notificationDeliveries.subject,
        status: notificationDeliveries.status,
        attemptedAt: notificationDeliveries.attemptedAt,
        sentAt: notificationDeliveries.sentAt,
        error: notificationDeliveries.error,
      })
      .from(notificationDeliveries)
      .where(historyScope)
      .orderBy(desc(notificationDeliveries.attemptedAt))
      .limit(100);
    const recentDeliveries = uniqueDeliveryMessages(recentRows).slice(0, 8).map((row) => ({ recipientEmail: row.recipientEmail, subject: row.subject, status: row.status, attemptedAt: row.attemptedAt, sentAt: row.sentAt, error: row.error }));
    const [latestRun] = await db.select().from(monitorRuns).where(eq(monitorRuns.userId, user.userId)).orderBy(desc(monitorRuns.completedAt)).limit(1);
    const pendingReviews = user.isOwner ? await db.select({ id: sourceReviewQueue.id }).from(sourceReviewQueue).where(and(eq(sourceReviewQueue.userId, user.userId), eq(sourceReviewQueue.status, "pending"))) : [];
    const unavailableSources = user.isOwner ? await db.select({ id: scholarshipSourceChecks.scholarshipId }).from(scholarshipSourceChecks).where(and(eq(scholarshipSourceChecks.userId, user.userId), eq(scholarshipSourceChecks.outcome, "check-failed"))) : [];
    const [lastSuccessful] = await db.select({ sentAt: notificationDeliveries.sentAt }).from(notificationDeliveries).where(and(historyScope, eq(notificationDeliveries.status, "sent"))).orderBy(desc(notificationDeliveries.sentAt)).limit(1);
    const failedDeliveries = recentDeliveries.filter((delivery) => delivery.status === "failed").length;
    const scheduled = await jobHealth(WATCH_JOB);
    const scheduleConfigured = process.env.SCHOLARSHIP_CRON_ENABLED === "true" && Boolean(process.env.CRON_SECRET);
    return privateJson({
      preferences: rowPreferences(preferences),
      provider: { configured: provider.configured, name: provider.provider, senderScope: provider.senderScope, testRecipient: user.isOwner ? testEmailRecipient(provider.senderScope, await configuredOwnerEmail(), user.email) : undefined },
      recentDeliveries,
      health: {
        lastAutomaticCheck: latestRun?.completedAt ?? "",
        nextScheduledCheck: scheduleConfigured ? nextWatchWindow() : "",
        lastScheduledCheck: scheduled?.lastCompletedAt ?? "",
        scheduledStatus: scheduled?.lastStatus ?? "not-run",
        scheduledError: user.isOwner ? scheduled?.lastError ?? "" : "",
        scheduleWindow: scheduleConfigured ? "Daily, 09:00–09:59 Asia/Dhaka" : "Not configured",
        lastSuccessfulEmail: lastSuccessful?.sentAt ?? "",
        failedDeliveries,
        sourcesRequiringReview: pendingReviews.length,
        sourcesUnavailable: unavailableSources.length,
        monitorStatus: latestRun?.status ?? "not-run",
      },
      automaticCheck: scheduleConfigured ? "Daily server-side official-source checks and unsent reminders run without a visit or login. The current plan schedules within the 09:00–09:59 Bangladesh-time window." : "Server scheduling is not configured. Administrator source refreshes also check for unsent reminders.",
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
        return privateJson({ error: "Email sending is not configured. Add RESEND_API_KEY and REMINDER_FROM_EMAIL in Vercel production, then redeploy." }, { status: 503 });
      }
      const recipient = testEmailRecipient(provider.senderScope, await configuredOwnerEmail(), user.email);
      if (!recipient) return privateJson({ error: "The primary test recipient is not configured." }, { status: 503 });
      const eventKey = `test:${crypto.randomUUID()}`;
      const email = renderReminderEmail([{
        key: eventKey,
        type: "deadline-reminder",
        scholarshipId: "test",
        scholarshipName: "Test reminder",
        title: "Scholarship email connection test",
        detail: "This is a delivery test. Future messages contain only official scholarship facts and dates.",
        sourceUrl: "",
        daysRemaining: 7,
        reminderThreshold: 7,
        date: null,
      }], await reminderSiteUrl());
      const db = getDb();
      const key = await idempotencyKey(recipient, [eventKey]);
      try {
        const providerId = await sendWithDeliveryAudit(
          () => sendReminderEmail({ to: recipient, ...email, subject: "Scholarship email connection test", idempotencyKey: key }),
          async (attempt) => {
            await db.insert(notificationDeliveries).values({ recipientEmail: recipient, eventKey, eventType: "test", scholarshipId: "test", subject: "Scholarship email connection test", ...attempt }).onConflictDoUpdate({ target: [notificationDeliveries.recipientEmail, notificationDeliveries.eventKey], set: attempt });
          },
        );
        return privateJson({ ok: true, sent: 1, providerId, message: `Resend accepted the test email to ${recipient}; recorded as sent. Check your inbox or spam folder.` });
      } catch (error) {
        return privateJson({ error: error instanceof Error ? error.message : "Test email failed. Check delivery history." }, { status: 502 });
      }
    }

    const result = await dispatchReminders(user.userId, { dryRun: Boolean(payload.dryRun) });
    return privateJson(result, result.failed ? { status: 502 } : undefined);
  } catch (error) {
    if (error instanceof JobBusyError) return privateJson({ ok: true, message: error.message }, { status: 202 });
    return privateJson(
      { error: error instanceof Error ? error.message : "Reminder dispatch failed." },
      { status: 500 },
    );
  }
}
