import { configuredOwnerEmail } from "../../../../lib/request-auth";
import { ownerDataKey } from "../../../../lib/auth-policy";
import { refreshOfficialSources } from "../../../../lib/source-monitor";
import { dispatchReminders } from "../../../../lib/notification-service";
import { withJobLease, JobBusyError } from "../../../../lib/background-jobs";
import { validCronRequest, WATCH_JOB } from "../../../../lib/job-policy";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const headers = { "cache-control": "private, no-store" };
  // This is machine authentication, not a shortcut to any user/profile API.
  if (!validCronRequest(request)) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  const owner = await configuredOwnerEmail();
  if (!owner) return Response.json({ error: "Primary owner configuration is missing." }, { status: 503, headers });
  try {
    const result = await withJobLease(WATCH_JOB, async () => {
      const userId = ownerDataKey(owner);
      let refresh: Awaited<ReturnType<typeof refreshOfficialSources>> | { error: string };
      try { refresh = await refreshOfficialSources(userId, { limit: 60 }); }
      catch (error) { refresh = { error: error instanceof Error ? error.message : "Source refresh failed" }; }
      // Deadline catch-up must still run if a source is temporarily unavailable.
      const reminders = await dispatchReminders(userId);
      return { trigger: "server-cron", checkedAt: new Date().toISOString(), refresh, reminders: { sent: reminders.sent, failed: reminders.failed, planned: reminders.planned, message: reminders.message }, needsAttention: "error" in refresh || ("failed" in refresh && refresh.failed > 0) || reminders.failed > 0 };
    });
    console.info("Scholarship watch complete", { sent: result.reminders.sent, attention: result.needsAttention });
    return Response.json({ ok: true, ...result }, { headers });
  } catch (error) {
    if (error instanceof JobBusyError) return Response.json({ ok: true, skipped: "already-running" }, { headers });
    console.error("Scheduled scholarship watch failed");
    return Response.json({ error: "Scheduled check failed. Administrators can inspect reminder health." }, { status: 500, headers });
  }
}
