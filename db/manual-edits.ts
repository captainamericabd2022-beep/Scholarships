import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./index";
import { scholarshipManualEdits } from "./schema";
import type { Scholarship } from "../lib/scholarships";
import type { ScholarshipEdit } from "../lib/scholarship-edits";

function decode(row: typeof scholarshipManualEdits.$inferSelect): ScholarshipEdit {
  return { scholarshipId: row.scholarshipId, patch: JSON.parse(row.patchJson), revision: row.revision, updatedAt: row.updatedAt };
}
export async function listManualEdits(): Promise<ScholarshipEdit[]> {
  return (await getDb().select().from(scholarshipManualEdits)).map(decode);
}
export async function getManualEdit(id: string): Promise<ScholarshipEdit | null> {
  const [row] = await getDb().select().from(scholarshipManualEdits).where(eq(scholarshipManualEdits.scholarshipId, id)).limit(1);
  return row ? decode(row) : null;
}
export async function saveManualEdit(id: string, userId: string, patch: Partial<Scholarship>, expectedRevision: number): Promise<ScholarshipEdit | null> {
  const values = { userId, patchJson: JSON.stringify(patch), updatedAt: new Date().toISOString() };
  // Single-statement compare-and-swap prevents device edits from clobbering each other.
  const [row] = expectedRevision === 0
    ? await getDb().insert(scholarshipManualEdits).values({ scholarshipId: id, ...values, revision: 1 }).onConflictDoNothing().returning()
    : await getDb().update(scholarshipManualEdits).set({ ...values, revision: sql`${scholarshipManualEdits.revision} + 1` }).where(and(eq(scholarshipManualEdits.scholarshipId, id), eq(scholarshipManualEdits.revision, expectedRevision))).returning();
  return row ? decode(row) : null;
}
