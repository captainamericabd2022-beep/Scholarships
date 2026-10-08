import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { changeLog, scholarshipUpdates, sourceReviewQueue, userScholarshipTracking } from "../../../db/schema";
import { fieldChangeSummary, type FieldChange } from "../../../lib/source-research";
import { requestUserId } from "../../../lib/request-auth";

function safeObject(value: string) {
  try { const result = JSON.parse(value); return result && typeof result === "object" ? result as Record<string, unknown> : {}; }
  catch { return {}; }
}

export async function PATCH(request: Request) {
  const userId = await requestUserId(request);
  if (!userId) return Response.json({ error: "Owner sign-in is required." }, { status: 401 });
  try {
    const payload = await request.json() as { id?: number; action?: "apply" | "dismiss" };
    if (!Number.isInteger(payload.id) || !["apply", "dismiss"].includes(payload.action ?? "")) {
      return Response.json({ error: "A valid review action is required." }, { status: 400 });
    }
    const db = getDb();
    const [review] = await db.select().from(sourceReviewQueue)
      .where(and(eq(sourceReviewQueue.id, Number(payload.id)), eq(sourceReviewQueue.userId, userId), eq(sourceReviewQueue.status, "pending"))).limit(1);
    if (!review) return Response.json({ error: "Review item not found." }, { status: 404 });
    const now = new Date().toISOString();
    if (payload.action === "apply") {
      const patch = safeObject(review.candidatePatchJson);
      if (!Object.keys(patch).length) return Response.json({ error: "This item has no structured values to apply; dismiss it after manual verification." }, { status: 400 });
      const [custom] = await db.select().from(userScholarshipTracking)
        .where(and(eq(userScholarshipTracking.userId, userId), eq(userScholarshipTracking.scholarshipId, review.scholarshipId))).limit(1);
      if (custom) {
        await db.update(userScholarshipTracking).set({ scholarshipJson: JSON.stringify({ ...safeObject(custom.scholarshipJson), ...patch }), updatedAt: now }).where(eq(userScholarshipTracking.id, custom.id));
      } else {
        const [existing] = await db.select().from(scholarshipUpdates).where(eq(scholarshipUpdates.scholarshipId, review.scholarshipId)).limit(1);
        await db.insert(scholarshipUpdates).values({ scholarshipId: review.scholarshipId, patchJson: JSON.stringify({ ...safeObject(existing?.patchJson ?? "{}"), ...patch }), sourceUrl: review.sourceUrl, verifiedAt: now.slice(0, 10), updatedAt: now })
          .onConflictDoUpdate({ target: scholarshipUpdates.scholarshipId, set: { patchJson: JSON.stringify({ ...safeObject(existing?.patchJson ?? "{}"), ...patch }), sourceUrl: review.sourceUrl, verifiedAt: now.slice(0, 10), updatedAt: now } });
      }
      const changes = JSON.parse(review.fieldChangesJson) as FieldChange[];
      await db.insert(changeLog).values({ scholarshipId: review.scholarshipId, changeType: "OWNER_VERIFIED_CHANGE", summary: fieldChangeSummary(changes), sourceUrl: review.sourceUrl, changedAt: now, verifiedAt: now.slice(0, 10), fieldChangesJson: review.fieldChangesJson });
    }
    await db.update(sourceReviewQueue).set({ status: payload.action === "apply" ? "applied" : "dismissed", reviewedAt: now }).where(eq(sourceReviewQueue.id, review.id));
    return Response.json({ ok: true, status: payload.action === "apply" ? "applied" : "dismissed" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Review action failed." }, { status: 400 });
  }
}
