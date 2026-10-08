import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../db/index";
import { getManualEdit, saveManualEdit } from "../db/manual-edits";
import { scholarshipManualEdits, scholarshipUpdates, userProgress } from "../db/schema";
import { publicManualPatch } from "../lib/scholarship-edits";
import { enableWindowsTransport } from "./windows-fetch.mjs";

enableWindowsTransport();
const fixtureId = `launch-verification-${randomUUID()}`;
const fixtureUser = `test:${fixtureId}`;
const db = getDb();
const fixtureNotes = "Verification fixture — বাংলা €";
try {
  await db.insert(userProgress).values({ userId: fixtureUser, scholarshipId: fixtureId, status: "PREPARING", notes: fixtureNotes, checklistJson: JSON.stringify({ Passport: true, IELTS: false }) });
  const created = await saveManualEdit(fixtureId, fixtureUser, { deadline: "2027-01-15", notes: "Private fixture", fit: "Reach" }, 0);
  assert.equal(created?.revision, 1);
  assert.equal(await saveManualEdit(fixtureId, fixtureUser, { deadline: "2027-01-16" }, 0), null);
  const updated = await saveManualEdit(fixtureId, fixtureUser, { deadline: "2027-01-17", notes: "Private fixture", fit: "Reach" }, 1);
  assert.equal(updated?.revision, 2);
  assert.equal(await saveManualEdit(fixtureId, fixtureUser, { deadline: "2027-01-18" }, 1), null);
  assert.equal((await getManualEdit(fixtureId))?.patch.deadline, "2027-01-17");
  assert.deepEqual(publicManualPatch(updated!.patch), { deadline: "2027-01-17" });
  await db.insert(scholarshipUpdates).values({ scholarshipId: fixtureId, patchJson: JSON.stringify({ deadline: "2027-02-01" }), sourceUrl: "https://example.org/verification-fixture", verifiedAt: new Date().toISOString() });
  const [saved] = await db.select().from(userProgress).where(eq(userProgress.scholarshipId, fixtureId));
  assert.equal(saved.notes, fixtureNotes);
  assert.equal(saved.status, "PREPARING");
  assert.deepEqual(JSON.parse(saved.checklistJson), { Passport: true, IELTS: false });
  console.log("PASS: Neon persistence, duplicate/stale-edit protection, private-field filtering and progress preservation.");
} finally {
  await db.delete(scholarshipManualEdits).where(eq(scholarshipManualEdits.scholarshipId, fixtureId));
  await db.delete(scholarshipUpdates).where(eq(scholarshipUpdates.scholarshipId, fixtureId));
  await db.delete(userProgress).where(eq(userProgress.scholarshipId, fixtureId));
  console.log("Removed only this run's isolated verification fixtures.");
}
