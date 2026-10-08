import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("build contains the scholarship command center experience", async () => {
  const [layout, dashboard, data] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/scholarships.ts", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /CSE Scholarship Command Center/i);
  assert.match(dashboard, /Scholarship tracker/);
  assert.match(dashboard, /What should I do next\?/);
  assert.match(dashboard, /Deadline center/i);
  assert.match(data, /KAIST Scholarship/);
  assert.match(data, /CYBERSURE/);
  assert.match(data, /not announced/i);
  assert.doesNotMatch(dashboard, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("keeps verified source facts separate from durable user progress", async () => {
  const [data, dashboard, schema, hosting, refreshRoute, dashboardRoute, viewerRoute, page, reminderRoute, reminderEngine, reminderCenter] = await Promise.all([
    readFile(new URL("../lib/scholarships.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/scholarship-refresh/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/viewers/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/notifications/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reminders.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ReminderCenter.tsx", import.meta.url), "utf8"),
  ]);

  assert.equal((data.match(/^ {4}id: "/gm) ?? []).length, 18);
  for (const name of [
    "Commonwealth Master’s",
    "Erasmus Mundus",
    "EMAI",
    "CYBERSURE",
    "EDISS",
    "DEAI",
    "GKS Graduate",
    "Stipendium Hungaricum",
    "DAAD STEM",
    "MEXT Japan",
    "Fulbright Bangladesh",
    "Bangladesh Ministry Watch",
  ]) {
    assert.match(data, new RegExp(name));
  }
  assert.match(dashboard, /\/api\/progress/);
  assert.match(dashboard, /Never overwritten by refreshes/);
  assert.match(schema, /user_progress/);
  assert.match(schema, /scholarship_updates/);
  assert.match(schema, /change_log/);
  const hostingConfig = JSON.parse(hosting);
  assert.equal(hostingConfig.d1, "DB");
  assert.equal(hostingConfig.r2, null);
  assert.match(hostingConfig.project_id, /^appgprj_/);
  assert.match(refreshRoute, /approved official HTTPS domain/);
  assert.match(refreshRoute, /dryRun/);
  assert.match(schema, /viewer_access/);
  assert.match(dashboardRoute, /redactScholarship/);
  assert.match(dashboardRoute, /delete shared\.fit/);
  assert.match(dashboardRoute, /isOwner \? db\.select\(\)\.from\(userProgress\)/);
  assert.match(viewerRoute, /requestUserId/);
  assert.match(viewerRoute, /isActive/);
  assert.match(page, /profile=\{isOwner/);
  assert.match(dashboard, /Manage access/);
  assert.match(dashboard, /Privacy-protected view/i);
  assert.match(schema, /notification_preferences/);
  assert.match(schema, /notification_deliveries/);
  assert.match(reminderRoute, /notification_delivery_recipient_event_idx|onConflictDoUpdate/);
  assert.match(reminderRoute, /Viewer.*opt-in|isEnabled: isOwner/i);
  assert.match(reminderEngine, /ALLOWED_REMINDER_THRESHOLDS = \[60, 30, 14, 7, 3, 1, 0\]/);
  assert.match(reminderEngine, /idempotency-key/);
  assert.match(reminderEngine, /Personal profile, fit assessments, notes and application progress are never sent/);
  assert.match(reminderCenter, /Reminder center/);
  assert.match(reminderCenter, /reminder-close-button/);
  assert.match(reminderCenter, />Close</);
  assert.match(reminderCenter, /Check & send now/);
  assert.doesNotMatch(reminderCenter, /disabled=\{saving \|\| !provider\.configured\}/);
  assert.match(dashboard, /action: "dispatch"/);
});
