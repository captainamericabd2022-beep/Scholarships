import type { Scholarship } from "./scholarships";

export const DEFAULT_REMINDER_THRESHOLDS = [30, 14, 7, 3, 1] as const;
export const ALLOWED_REMINDER_THRESHOLDS = [60, 30, 14, 7, 3, 1, 0] as const;

export type ReminderPreferences = {
  email: string;
  isEnabled: boolean;
  scholarshipChanges: boolean;
  openingReminders: boolean;
  deadlineReminders: boolean;
  deadlineThresholds: number[];
};

export type ReminderChange = {
  id: number;
  scholarshipId: string;
  changeType: string;
  summary: string;
  sourceUrl: string;
  changedAt: string;
};

export type ReminderEvent = {
  key: string;
  type: "scholarship-change" | "opening-reminder" | "deadline-reminder";
  scholarshipId: string;
  scholarshipName: string;
  title: string;
  detail: string;
  sourceUrl: string;
  daysRemaining: number | null;
  reminderThreshold: number | null;
  date: string | null;
};

export type EmailProviderStatus = {
  configured: boolean;
  provider: "Resend";
  from: string;
  senderScope: "owner-only" | "multi-user";
};

function datePartsInDhaka(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(value.year), month: Number(value.month), day: Number(value.day) };
}

export function daysUntilDateKey(dateKey: string | null, now = new Date()) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const today = datePartsInDhaka(now);
  return Math.round(
    (Date.UTC(year, month - 1, day) - Date.UTC(today.year, today.month - 1, today.day)) /
      86_400_000,
  );
}

export function normalizeThresholds(value: unknown) {
  if (!Array.isArray(value)) return [...DEFAULT_REMINDER_THRESHOLDS];
  const allowed = new Set<number>(ALLOWED_REMINDER_THRESHOLDS);
  const thresholds = [...new Set(value.map(Number).filter((item) => allowed.has(item)))];
  return thresholds.length ? thresholds.sort((a, b) => b - a) : [...DEFAULT_REMINDER_THRESHOLDS];
}

export function buildReminderEvents(
  scholarships: Scholarship[],
  changes: ReminderChange[],
  now = new Date(),
) {
  const events: ReminderEvent[] = [];
  const scholarshipById = new Map(scholarships.map((item) => [item.id, item]));
  const recentChangeCutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;

  for (const change of changes) {
    if (change.changeType === "RETRACTED_EXTRACTION") continue;
    const changedAt = Date.parse(change.changedAt);
    if (!Number.isFinite(changedAt) || changedAt < recentChangeCutoff) continue;
    const scholarship = scholarshipById.get(change.scholarshipId);
    const name = scholarship?.shortName || scholarship?.name || "Scholarship update";
    events.push({
      key: `change:${change.id}`,
      type: "scholarship-change",
      scholarshipId: change.scholarshipId,
      scholarshipName: name,
      title: `${name}: verified information changed`,
      detail: change.summary,
      sourceUrl: change.sourceUrl || scholarship?.officialNoticeUrl || "",
      daysRemaining: null,
      reminderThreshold: null,
      date: null,
    });
  }

  for (const scholarship of scholarships) {
    for (const [kind, date] of [
      ["opening-reminder", scholarship.opens],
      ["deadline-reminder", scholarship.deadline],
    ] as const) {
      const days = daysUntilDateKey(date, now);
      if (days === null || days < 0 || days > 60) continue;
      const action = kind === "opening-reminder" ? "applications open" : "application deadline";
      const timing = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
      const crossedThresholds = days === 0
        ? [0]
        : ALLOWED_REMINDER_THRESHOLDS.filter((threshold) => threshold > 0 && threshold >= days);
      for (const threshold of crossedThresholds) {
        events.push({
          key: `${kind}:${scholarship.id}:${date}:t${threshold}`,
          type: kind,
          scholarshipId: scholarship.id,
          scholarshipName: scholarship.shortName,
          title: `${scholarship.shortName}: ${action} ${timing}`,
          detail: `${action[0].toUpperCase()}${action.slice(1)} ${timing}. Review the official notice before acting.`,
          sourceUrl: scholarship.officialNoticeUrl,
          daysRemaining: days,
          reminderThreshold: threshold,
          date,
        });
      }
    }
  }
  return events;
}

export function eventsForPreferences(events: ReminderEvent[], preferences: ReminderPreferences) {
  const thresholds = new Set(preferences.deadlineThresholds);
  return events.filter((event) => {
    if (event.type === "scholarship-change") return preferences.scholarshipChanges;
    if (event.reminderThreshold === null || !thresholds.has(event.reminderThreshold)) return false;
    if (event.type === "opening-reminder") return preferences.openingReminders;
    return preferences.deadlineReminders;
  });
}

/**
 * Keeps one nearest crossed threshold per dated event, while retaining every
 * unsent scholarship-change event. Stable threshold keys make retries safe and
 * let a delayed daily run catch up without sending several stale reminders.
 */
export function selectCatchUpEvents(events: ReminderEvent[], sentKeys: Set<string>) {
  const changes = events.filter((event) => event.type === "scholarship-change" && !sentKeys.has(event.key));
  const dated = events.filter((event) => event.type !== "scholarship-change");
  const groups = new Map<string, ReminderEvent[]>();
  for (const event of dated) {
    const groupKey = `${event.type}|${event.scholarshipId}|${event.date ?? ""}`;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), event]);
  }
  const nearest = [...groups.values()].flatMap((group) => {
    const sentThresholds = group.filter((event) => sentKeys.has(event.key)).map((event) => event.reminderThreshold ?? Number.MAX_SAFE_INTEGER);
    const mostRecentSent = sentThresholds.length ? Math.min(...sentThresholds) : Number.MAX_SAFE_INTEGER;
    const pending = group.filter((event) => !sentKeys.has(event.key) && (event.reminderThreshold ?? Number.MAX_SAFE_INTEGER) < mostRecentSent).sort(
      (a, b) => (a.reminderThreshold ?? Number.MAX_SAFE_INTEGER) - (b.reminderThreshold ?? Number.MAX_SAFE_INTEGER),
    );
    return pending.length ? [pending[0]] : [];
  });
  return [...changes, ...nearest].sort((a, b) => a.key.localeCompare(b.key));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function safeOfficialUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export function renderReminderEmail(events: ReminderEvent[], siteUrl: string) {
  const deadlineCount = events.filter((event) => event.type === "deadline-reminder").length;
  const updateCount = events.filter((event) => event.type === "scholarship-change").length;
  const subject = deadlineCount
    ? `Scholarship reminder: ${deadlineCount} deadline${deadlineCount === 1 ? "" : "s"} need attention`
    : `Scholarship watch: ${updateCount || events.length} verified update${(updateCount || events.length) === 1 ? "" : "s"}`;
  const rows = events.map((event) => {
    const sourceUrl = safeOfficialUrl(event.sourceUrl);
    return `<tr><td style="padding:16px 0;border-bottom:1px solid #dce7e3"><div style="font-size:12px;font-weight:700;color:#177f70;text-transform:uppercase">${escapeHtml(event.type.replaceAll("-", " "))}</div><h3 style="margin:5px 0 6px;font-size:17px;color:#10221f">${escapeHtml(event.title)}</h3><p style="margin:0;color:#52635f;line-height:1.55">${escapeHtml(event.detail)}</p>${sourceUrl ? `<p style="margin:10px 0 0"><a href="${escapeHtml(sourceUrl)}" style="color:#0d796b;font-weight:700">Open official notice</a></p>` : ""}</td></tr>`;
  }).join("");
  const safeSiteUrl = safeOfficialUrl(siteUrl);
  const html = `<!doctype html><html><body style="margin:0;background:#f3f7f6;font-family:Arial,sans-serif;color:#10221f"><div style="max-width:640px;margin:0 auto;padding:28px 18px"><div style="background:#0c1715;border-radius:18px;padding:24px;color:#f4fffc"><div style="font-size:11px;letter-spacing:.14em;color:#75d5c2">CSE SCHOLARSHIP COMMAND CENTER</div><h1 style="margin:8px 0 6px;font-size:25px">Your scholarship reminder</h1><p style="margin:0;color:#bdd0cb;line-height:1.55">Only official scholarship facts are included. Personal profile, fit assessments, notes and application progress are never sent.</p></div><table role="presentation" style="width:100%;border-collapse:collapse;background:#fff;padding:0 22px"><tbody>${rows}</tbody></table><div style="background:#fff;border-radius:0 0 18px 18px;padding:20px 22px">${safeSiteUrl ? `<a href="${escapeHtml(safeSiteUrl)}" style="display:inline-block;background:#1d9b88;color:#fff;text-decoration:none;font-weight:700;padding:12px 17px;border-radius:9px">Open command center</a>` : ""}<p style="margin:16px 0 0;font-size:12px;color:#71817d">Manage or stop email reminders from the Reminders panel in your dashboard.</p></div></div></body></html>`;
  const text = [
    "CSE Scholarship Command Center — scholarship reminder",
    "",
    ...events.flatMap((event) => [event.title, event.detail, event.sourceUrl, ""]),
    safeSiteUrl ? `Dashboard: ${safeSiteUrl}` : "",
    "Manage or stop reminders from the Reminders panel.",
  ].filter(Boolean).join("\n");
  return { subject, html, text };
}

export async function emailProviderStatus(): Promise<EmailProviderStatus> {
  const values = process.env;
  const from = (values.REMINDER_FROM_EMAIL ?? "").trim();
  // Setting a flag cannot turn Resend's testing sender into a verified domain.
  const testingSender = /@resend\.dev\s*>?\s*$/i.test(from);
  return { configured: Boolean(values.RESEND_API_KEY?.trim() && from), provider: "Resend", from, senderScope: values.REMINDER_VERIFIED_DOMAIN?.trim().toLowerCase() === "true" && !testingSender ? "multi-user" : "owner-only" };
}

export async function sendReminderEmail(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}) {
  const values = process.env;
  const apiKey = values.RESEND_API_KEY?.trim();
  const from = values.REMINDER_FROM_EMAIL?.trim();
  if (!apiKey || !from) throw new Error("Email delivery is not connected yet.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "idempotency-key": args.idempotencyKey,
    },
    body: JSON.stringify({ from, to: [args.to], subject: args.subject, html: args.html, text: args.text }),
    signal: AbortSignal.timeout(25_000),
  });
  const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!response.ok || !payload.id) {
    throw new Error(payload.message || payload.name || `Email provider returned ${response.status}.`);
  }
  return payload.id;
}

export async function idempotencyKey(email: string, eventKeys: string[]) {
  const input = new TextEncoder().encode(`${email}|${eventKeys.sort().join("|")}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return `scholarship-reminder-${Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("").slice(0, 40)}`;
}
