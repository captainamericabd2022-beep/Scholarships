import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildReminderEvents, daysUntilDateKey, eventsForPreferences, selectCatchUpEvents } from "../lib/reminders.ts";
import { scholarships } from "../lib/scholarships.ts";
import { analyzeAutomaticChanges, extractSourceSignals, type SourceResearch } from "../lib/source-research.ts";

const target = { ...scholarships[0], opens: null, deadline: "2027-01-10" };
const preferences = { email: "owner@example.com", isEnabled: true, scholarshipChanges: true, openingReminders: true, deadlineReminders: true, deadlineThresholds: [7, 3, 1] };

test("delayed reminder check sends nearest crossed threshold", () => {
  const events = eventsForPreferences(buildReminderEvents([target], [], new Date("2027-01-08T00:00:00Z")), preferences);
  const pending = selectCatchUpEvents(events, new Set());
  assert.equal(pending.length, 1);
  assert.equal(pending[0].daysRemaining, 2);
  assert.equal(pending[0].reminderThreshold, 3);
  assert.match(pending[0].key, /:t3$/);
});

test("sent reminder keys prevent duplicate and stale catch-up", () => {
  const events = eventsForPreferences(buildReminderEvents([target], [], new Date("2027-01-09T00:00:00Z")), preferences);
  const first = selectCatchUpEvents(events, new Set());
  assert.equal(first[0].reminderThreshold, 1);
  assert.deepEqual(selectCatchUpEvents(events, new Set([first[0].key])), []);
});

test("countdown uses Asia/Dhaka calendar date", () => {
  assert.equal(daysUntilDateKey("2027-01-02", new Date("2027-01-01T23:30:00Z")), 0);
  assert.equal(daysUntilDateKey("2027-01-03", new Date("2027-01-01T23:30:00Z")), 1);
});

test("official-source parser detects monitored evidence and ambiguous portals", () => {
  const html = `<title>MSc Artificial Intelligence</title><p>This is a fully funded scholarship covering tuition fees and a monthly stipend.</p><p>Bangladeshi applicants are eligible.</p><p>IELTS 7.0 is required.</p><p>No work experience required.</p><a href="https://official.example/apply">Apply now</a><a href="https://official.example/portal">Application portal</a>`;
  const text = "This is a fully funded scholarship covering tuition fees and a monthly stipend. Bangladeshi applicants are eligible. IELTS 7.0 is required. No work experience required.";
  const result = extractSourceSignals(html, text, "https://official.example/program", "MSc Artificial Intelligence");
  assert.equal(result.candidates.fundingLevel, "Fully funded");
  assert.match(String(result.candidates.englishRequirements), /IELTS 7\.0/);
  assert.ok((result.candidates.areas as string[]).includes("Artificial Intelligence"));
  assert.ok(result.ambiguousFields.includes("applyUrl"));
});

test("viewer response excludes owner profile and application progress", async () => {
  const route = await readFile(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8");
  assert.match(route, /isOwner \? db\.select\(\)\.from\(userProgress\).*: Promise\.resolve\(\[\]\)/s);
  assert.match(route, /delete shared\.fit;/);
  assert.match(route, /delete shared\.notes;/);
  assert.match(route, /changes: isOwner \?/);
});

test("official text fragments require review and deadline years never redefine intakes", () => {
  const item = { ...scholarships[0], intakes: ["2027"], deadline: null, opens: null };
  const research: SourceResearch = { title: "Official scholarship", text: "", contentHash: "fixture", httpStatus: 200, finalUrl: item.officialNoticeUrl, opens: null, deadline: "2026-12-31", confidence: "established-official", ambiguousFields: [], candidates: { fundingCovers: "Separate merit award only", englishRequirements: "Read the general instructions", applyUrl: "https://official.example/application-instructions" } };
  const result = analyzeAutomaticChanges(item, research);
  assert.equal(result.safePatch.deadline, "2026-12-31");
  assert.equal(result.safePatch.intakes, undefined);
  assert.equal(result.safePatch.fundingCovers, undefined);
  assert.equal(result.safePatch.englishRequirements, undefined);
  assert.equal(result.safePatch.applyUrl, undefined);
  assert.equal(result.reviewPatch.fundingCovers, research.candidates.fundingCovers);
  assert.equal(analyzeAutomaticChanges(item, { ...research, confidence: "candidate-official" }).safePatch.deadline, undefined);
});

test("retracted automatic extractions never become verified-change email events", () => {
  const events = buildReminderEvents([target], [{ id: 99, scholarshipId: target.id, changeType: "RETRACTED_EXTRACTION", summary: "Needs review", sourceUrl: target.officialNoticeUrl, changedAt: "2027-01-08T00:00:00Z" }], new Date("2027-01-08T00:00:00Z"));
  assert.equal(events.some((event) => event.type === "scholarship-change"), false);
});

test("archived scholarship audit changes do not produce reminder emails", () => {
  const events = buildReminderEvents([], [{ id: 101, scholarshipId: target.id, changeType: "DEADLINE_CHANGED", summary: "Archived programme changed", sourceUrl: target.officialNoticeUrl, changedAt: "2027-01-08T00:00:00Z" }], new Date("2027-01-08T00:00:00Z"));
  assert.deepEqual(events, []);
});

test("mobile reminder modal is closable and viewport-safe", async () => {
  const [component, css, modal] = await Promise.all([
    readFile(new URL("../app/ReminderCenter.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/ModalLayer.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(component, /aria-label="Close reminder center"/);
  assert.match(component, /<ModalLayer className="reminder-layer"/);
  assert.match(component, /className="reminder-scroll"/);
  assert.match(component, /form="reminder-settings-form"/);
  assert.match(modal, /event\.key === "Escape"/);
  assert.match(modal, /createPortal\(/);
  assert.match(modal, /document\.body\)/);
  assert.match(modal, /element\.inert = true/);
  assert.match(modal, /previouslyFocused\.focus/);
  assert.match(css, /height: 100dvh/);
  assert.match(css, /overflow-y: auto/);
  assert.match(css, /font-size: 16px/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /\.modal-root \.access-panel-footer \{ grid-template-columns: auto minmax\(0,1fr\)/);
  assert.match(css, /\.lower-grid\s*\{\s*display: grid;\s*grid-template-columns: minmax\(0, 1\.2fr\)/);
});
