import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { applyManualEdit, editableFields, nextManualPatch, publicManualPatch, validateManualPatch, validateResetFields } from "../lib/scholarship-edits";
import { scholarships } from "../lib/scholarships";
import { buildReminderEvents } from "../lib/reminders";
import { requestUserId } from "../lib/request-auth";

test("manual fields are validated; dates may be cleared without inventing deadlines", () => {
  assert.deepEqual(validateManualPatch({ deadline: "", opens: null, intakes: ["2035", "2035", "2036"], areas: ["AI", " ML "] }), { deadline: null, opens: null, intakes: ["2035", "2036"], areas: ["AI", "ML"] });
  for (const patch of [{ deadline: "2027-02-29" }, { deadline: "unknown" }, { areas: "AI" }, { baseStatus: "FAKE" }, { fundingLevel: "Guaranteed" }, { name: " " }, { id: "changed-id" }, { lastVerified: "2027-01-01" }, { cgpa: "4.00" }, { applyUrl: "javascript:alert(1)" }, { officialNoticeUrl: "https://127.0.0.1/" }, { applyUrl: "https://user:pass@example.com/" }]) {
    assert.throws(() => validateManualPatch(patch));
  }
  assert.throws(() => validateResetFields(["id"]));
});

test("manual overrides survive refreshed facts and can resume source updates per field", () => {
  const edit = { scholarshipId: scholarships[0].id, patch: { deadline: "2027-01-15", fundingCovers: "Owner correction" }, revision: 1, updatedAt: "2026-09-05T00:00:00Z" };
  const refreshed = { ...scholarships[0], deadline: "2027-02-01", fundingCovers: "Latest source", programme: "New programme" };
  const result = applyManualEdit(refreshed, [edit]);
  assert.equal(result.deadline, "2027-01-15");
  assert.equal(result.fundingCovers, "Owner correction");
  assert.equal(result.programme, "New programme");
  const released = { ...edit, patch: nextManualPatch(edit.patch, {}, ["deadline"]) };
  assert.equal(applyManualEdit(refreshed, [released]).deadline, "2027-02-01");
  assert.equal(applyManualEdit(refreshed, [released]).fundingCovers, "Owner correction");
  assert.equal(edit.patch.deadline, "2027-01-15");
});

test("shared corrections never expose the owner assessment or private notes", () => {
  const patch = validateManualPatch({ name: "Shared fact", fit: "Reach", fitReason: "Private", nextAction: "Private", notes: "Private", englishRequirements: "Official course requirement" });
  assert.deepEqual(publicManualPatch(patch), { name: "Shared fact", englishRequirements: "Official course requirement" });
  assert.equal(patch.notes, "Private");
});

test("only the configured owner can edit on a hosted request", async () => {
  const previous = process.env.OWNER_EMAIL;
  process.env.OWNER_EMAIL = "owner@example.com";
  try {
    const request = (email?: string) => new Request("https://dashboard.example/api/scholarship-edits", { headers: email ? { "oai-authenticated-user-id": "account", "oai-authenticated-user-email": email } : {} });
    assert.equal(await requestUserId(request()), null);
    assert.equal(await requestUserId(request("viewer@example.com")), null);
    assert.equal(await requestUserId(request("OWNER@example.com")), "account");
  } finally { if (previous === undefined) delete process.env.OWNER_EMAIL; else process.env.OWNER_EMAIL = previous; }
});

test("reminder event calculations use the effective owner-entered deadline", () => {
  const item = applyManualEdit({ ...scholarships[0], deadline: "2028-01-01", opens: null }, [{ scholarshipId: scholarships[0].id, patch: { deadline: "2027-01-15" }, revision: 1, updatedAt: "2026-09-05" }]);
  const events = buildReminderEvents([item], [], new Date("2027-01-12T00:00:00Z"));
  assert.ok(events.some((event) => event.daysRemaining === 3));
});

test("all editable fields are present and protected dialog actions are reachable", async () => {
  const [editor, dashboard, css] = await Promise.all([readFile(new URL("../app/ScholarshipEditor.tsx", import.meta.url), "utf8"), readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"), readFile(new URL("../app/globals.css", import.meta.url), "utf8")]);
  for (const key of editableFields) assert.ok(editor.includes(`key: "${key}"`), key);
  assert.match(editor, /Save scholarship/); assert.match(editor, /Cancel/);
  assert.match(editor, /beforeunload/); assert.match(editor, /trapFocus/);
  assert.match(dashboard, /isOwner && editingId === selected.id/);
  assert.match(css, /\.editor-fields \{ grid-template-columns: minmax\(0, 1fr\)/);
});

test("favicon files have real image signatures and mobile sizes", async () => {
  const ico = await readFile(new URL("../public/favicon.ico", import.meta.url));
  assert.equal(ico.readUInt16LE(2), 1); assert.equal(ico.readUInt16LE(4), 3);
  for (const [name, size] of [["favicon-32.png", 32], ["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512]] as const) {
    const png = await readFile(new URL(`../public/${name}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
  }
});
