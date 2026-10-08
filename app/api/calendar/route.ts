import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { scholarshipUpdates, userScholarshipTracking } from "../../../db/schema";
import { scholarships, type Scholarship } from "../../../lib/scholarships";
import { requestUserId } from "../../../lib/request-auth";
import { listManualEdits } from "../../../db/manual-edits";
import { applyManualEdit } from "../../../lib/scholarship-edits";

function json(value: string) { try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; } }
function ics(value: string) { return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/[,;]/g, (x) => `\\${x}`); }
function nextDay(value: string) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10).replaceAll("-", ""); }

export async function GET(request: Request) {
  const userId = await requestUserId(request);
  if (!userId) return Response.json({ error: "Owner sign-in is required." }, { status: 401 });
  const [updates, tracked] = await Promise.all([getDb().select().from(scholarshipUpdates), getDb().select().from(userScholarshipTracking).where(eq(userScholarshipTracking.userId, userId))]);
  const patch = new Map(updates.map((row) => [row.scholarshipId, json(row.patchJson)]));
  const items: Scholarship[] = scholarships.map((item) => ({ ...item, ...(patch.get(item.id) ?? {}) } as Scholarship));
  for (const row of tracked.filter((item) => item.isActive)) { const item = json(row.scholarshipJson) as unknown as Scholarship; if (item.id && item.name) items.push(item); }
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const events: string[] = [];
  const edits = await listManualEdits();
  const archived = new Set(tracked.filter((row) => !row.isActive).map((row) => row.scholarshipId));
  for (const item of items.filter((row) => !archived.has(row.id)).map((row) => applyManualEdit(row, edits))) {
    const dates: Array<{ kind: string; date: string }> = [];
    if (item.opens) dates.push({ kind: "Applications open", date: item.opens });
    if (item.deadline) dates.push({ kind: "Application deadline", date: item.deadline });
    for (const event of dates) {
      events.push(["BEGIN:VEVENT", `UID:${ics(`${item.id}-${event.kind}-${event.date}@cse-scholarship-command-center`)}`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${event.date.replaceAll("-", "")}`, `DTEND;VALUE=DATE:${nextDay(event.date)}`, `SUMMARY:${ics(`${item.shortName} — ${event.kind}`)}`, `DESCRIPTION:${ics(`Verify the current time and requirements on the official notice. ${item.officialNoticeUrl}`)}`, `URL:${ics(item.officialNoticeUrl)}`, "END:VEVENT"].join("\r\n"));
    }
  }
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CSE Scholarship Command Center//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:CSE Scholarship Deadlines", "X-WR-TIMEZONE:Asia/Dhaka", ...events, "END:VCALENDAR"].join("\r\n");
  return new Response(body, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="cse-scholarship-deadlines.ics"`, "cache-control": "private, no-store" } });
}
