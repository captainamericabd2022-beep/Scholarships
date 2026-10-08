import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { getManualEdit, saveManualEdit } from "../../../db/manual-edits";
import { scholarshipUpdates, userScholarshipTracking } from "../../../db/schema";
import { requestUserId } from "../../../lib/request-auth";
import { nextManualPatch, validateManualPatch, validateResetFields } from "../../../lib/scholarship-edits";
import { scholarships, type Scholarship } from "../../../lib/scholarships";
import { validateSourceUrl } from "../../../lib/source-research";

function reply(value: unknown, status = 200) { return Response.json(value, { status, headers: { "cache-control": "private, no-store" } }); }

export async function PATCH(request: Request) {
  const userId = await requestUserId(request);
  if (!userId) return reply({ error: "Only the dashboard owner can edit scholarships." }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 100_000) return reply({ error: "This edit is too large." }, 413);
    const payload = JSON.parse(raw);
    const id = payload.scholarshipId;
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(id)) throw new Error("Invalid scholarship id.");
    if (!Number.isSafeInteger(payload.expectedRevision) || payload.expectedRevision < 0) throw new Error("Reload the scholarship before editing.");
    const patch = validateManualPatch(payload.patch ?? {});
    const resetFields = validateResetFields(payload.resetFields ?? []);
    if (!Object.keys(patch).length && !resetFields.length) throw new Error("There are no changes to save.");
    if (patch.officialNoticeUrl) validateSourceUrl(patch.officialNoticeUrl);
    if (patch.applyUrl) validateSourceUrl(patch.applyUrl);
    const db = getDb();
    const [tracked] = await db.select().from(userScholarshipTracking).where(and(eq(userScholarshipTracking.scholarshipId, id), eq(userScholarshipTracking.userId, userId))).limit(1);
    const [updated] = await db.select().from(scholarshipUpdates).where(eq(scholarshipUpdates.scholarshipId, id)).limit(1);
    const baseline = scholarships.find((item) => item.id === id);
    const base = { ...baseline, ...(updated ? JSON.parse(updated.patchJson) : {}), ...(tracked ? JSON.parse(tracked.scholarshipJson) : {}) } as Scholarship;
    if (!base.name) return reply({ error: "Scholarship not found." }, 404);
    const previous = await getManualEdit(id);
    if ((previous?.revision ?? 0) !== payload.expectedRevision) return reply({ error: "This scholarship was edited on another device. Cancel and reopen the editor to load its latest values.", currentEdit: previous }, 409);
    const next = nextManualPatch(previous?.patch ?? {}, patch, resetFields);
    const effective = { ...base, ...next };
    if (effective.opens && effective.deadline && effective.opens > effective.deadline) throw new Error("The opening date cannot be after the deadline. Update both dates or clear the unannounced one.");
    const edit = await saveManualEdit(id, userId, next, payload.expectedRevision);
    if (!edit) return reply({ error: "Another edit was saved first. Cancel and reopen the editor before trying again.", currentEdit: await getManualEdit(id) }, 409);
    return reply({ ok: true, edit });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Unable to save scholarship." }, 400);
  }
}
