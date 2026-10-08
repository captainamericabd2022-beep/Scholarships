import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { and, eq, gte } from "drizzle-orm";
import { getDb } from "../db/index";
import { changeLog, scholarshipUpdates, sourceReviewQueue, userScholarshipTracking } from "../db/schema";
import { scholarships } from "../lib/scholarships";
import { fieldChangeSummary, type FieldChange } from "../lib/source-research";
import { enableWindowsTransport } from "./windows-fetch.mjs";

// One-time repair of this launch's heuristic text extractions, not user edits.
// Dry-run by default. The original SQLite snapshot is read-only.
const [since, sourcePath, mode] = process.argv.slice(2);
if (!since || !Number.isFinite(Date.parse(since)) || !sourcePath?.endsWith(".sqlite") || !process.env.OWNER_EMAIL) throw new Error("Supply a launch timestamp, explicit original SQLite path and OWNER_EMAIL.");
const apply = mode === "--apply";
enableWindowsTransport();
const db = getDb();
const ownerKey = `owner:${process.env.OWNER_EMAIL.trim().toLowerCase()}`;
const source = new DatabaseSync(sourcePath, { readOnly: true });
const previousUpdates = new Map(source.prepare("SELECT scholarship_id, patch_json FROM scholarship_updates").all().map((row) => [String(row.scholarship_id), JSON.parse(String(row.patch_json)) as Record<string, unknown>]));
source.close();
const textual = new Set(["fundingCovers", "fundingLevel", "bangladeshEligibility", "englishRequirements", "workExperience", "applyUrl", "programme", "areas"]);
const logs = await db.select().from(changeLog).where(gte(changeLog.changedAt, since));
const ownerApproved = new Set(logs.filter((row) => row.changeType === "OWNER_VERIFIED_CHANGE").map((row) => row.scholarshipId));
let quarantined = 0, restoredFields = 0, restoredIntakes = 0, archivedFixtures = 0;
for (const log of logs) {
  if (log.changeType !== "DEADLINE_CHANGED" || ownerApproved.has(log.scholarshipId)) continue;
  const changes = JSON.parse(log.fieldChangesJson) as FieldChange[];
  const candidates = changes.filter((change) => textual.has(change.field));
  if (!candidates.length) continue;
  const [record] = await db.select().from(scholarshipUpdates).where(eq(scholarshipUpdates.scholarshipId, log.scholarshipId));
  if (!record) continue;
  const patch = JSON.parse(record.patchJson) as Record<string, unknown>;
  // Never undo a newer source correction or an owner-approved change.
  const reversible = candidates.filter((change) => JSON.stringify(patch[change.field]) === JSON.stringify(change.after) || JSON.stringify(patch[change.field]) === JSON.stringify(change.before));
  if (!reversible.length) continue;
  const candidatePatch = Object.fromEntries(reversible.map((change) => [change.field, change.after]));
  for (const change of reversible) { if (change.before === undefined) delete patch[change.field]; else patch[change.field] = change.before; }
  if (apply) {
    await db.insert(sourceReviewQueue).values({ userId: ownerKey, scholarshipId: log.scholarshipId, sourceUrl: log.sourceUrl, contentHash: createHash("sha256").update(`review-only-policy:${log.id}:${log.fieldChangesJson}`).digest("hex"), candidatePatchJson: JSON.stringify(candidatePatch), fieldChangesJson: JSON.stringify(reversible), reason: "Automatic text snippets were held for review because official-domain provenance alone does not establish the programme or award context. The previous verified values were retained.", status: "pending", createdAt: new Date().toISOString(), reviewedAt: "" }).onConflictDoNothing();
    const saved = await db.update(scholarshipUpdates).set({ patchJson: JSON.stringify(patch), updatedAt: new Date().toISOString() }).where(and(eq(scholarshipUpdates.id, record.id), eq(scholarshipUpdates.patchJson, record.patchJson))).returning({ id: scholarshipUpdates.id });
    if (!saved.length) continue;
    const remaining = changes.filter((change) => !reversible.some((entry) => entry.field === change.field));
    await db.update(changeLog).set({ changeType: remaining.length ? log.changeType : "RETRACTED_EXTRACTION", summary: remaining.length ? fieldChangeSummary(remaining) : "Automatic text extraction held for owner review; previous verified values retained.", fieldChangesJson: JSON.stringify(remaining.length ? remaining : changes) }).where(eq(changeLog.id, log.id));
  }
  quarantined += 1; restoredFields += reversible.length;
}
for (const record of await db.select().from(scholarshipUpdates).where(gte(scholarshipUpdates.updatedAt, since))) {
  if (ownerApproved.has(record.scholarshipId)) continue;
  const patch = JSON.parse(record.patchJson) as Record<string, unknown>;
  if (!("intakes" in patch)) continue;
  const previous = previousUpdates.get(record.scholarshipId);
  const expected = previous?.intakes ?? scholarships.find((item) => item.id === record.scholarshipId)?.intakes;
  if (!expected || JSON.stringify(patch.intakes) === JSON.stringify(expected)) continue;
  if (previous && "intakes" in previous) patch.intakes = previous.intakes; else delete patch.intakes;
  if (apply) await db.update(scholarshipUpdates).set({ patchJson: JSON.stringify(patch), updatedAt: new Date().toISOString() }).where(and(eq(scholarshipUpdates.id, record.id), eq(scholarshipUpdates.patchJson, record.patchJson)));
  restoredIntakes += 1;
}
for (const record of await db.select().from(userScholarshipTracking).where(and(eq(userScholarshipTracking.userId, ownerKey), eq(userScholarshipTracking.isActive, true)))) {
  let name = ""; try { name = JSON.parse(record.scholarshipJson).name ?? ""; } catch { continue; }
  if (!/^Codex QA /i.test(name)) continue;
  if (apply) await db.update(userScholarshipTracking).set({ isActive: false, updatedAt: new Date().toISOString() }).where(and(eq(userScholarshipTracking.id, record.id), eq(userScholarshipTracking.scholarshipJson, record.scholarshipJson)));
  archivedFixtures += 1;
}
console.log(JSON.stringify({ mode: apply ? "applied" : "dry-run", quarantined, restoredFields, restoredIntakes, archivedFixtures, preserved: "Original database, notes, checklists, application statuses, manual edits and owner-approved source changes are never written by this script." }));
