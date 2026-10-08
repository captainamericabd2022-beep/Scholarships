import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  changeLog,
  scholarshipSourceChecks,
  scholarshipUpdates,
  sourceReviewQueue,
  userProgress,
  userScholarshipTracking,
  viewerAccess,
} from "../../../db/schema";
import { scholarships, type Scholarship } from "../../../lib/scholarships";
import { requestIdentity, requestUserId } from "../../../lib/request-auth";
import { listManualEdits } from "../../../db/manual-edits";
import { publicManualPatch } from "../../../lib/scholarship-edits";

function safeJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function redactScholarship(item: Scholarship) {
  const shared: Partial<Scholarship> = { ...item };
  delete shared.fit;
  delete shared.fitReason;
  delete shared.nextAction;
  delete shared.notes;
  return shared;
}

function redactPatch(patch: Record<string, unknown>) {
  const shared = { ...patch };
  delete shared.fit;
  delete shared.fitReason;
  delete shared.nextAction;
  delete shared.notes;
  return shared;
}

function privateJson(payload: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("cache-control", "private, no-store");
  return Response.json(payload, { ...init, headers });
}

export async function GET(request: Request) {
  const identity = await requestIdentity(request);
  if (!identity) {
    return privateJson({ error: "Sign in is required." }, { status: 401 });
  }

  try {
    const db = getDb();
    const ownerUserId = await requestUserId(request);
    let isOwner = Boolean(ownerUserId);
    if (!isOwner) {
      const [viewer] = await db
        .select({ id: viewerAccess.id })
        .from(viewerAccess)
        .where(
          and(
            eq(viewerAccess.email, identity.email),
            eq(viewerAccess.isActive, true),
          ),
        )
        .limit(1);
      if (!viewer) {
        return privateJson({ error: "This email is not allowed to view the dashboard." }, { status: 403 });
      }
      isOwner = false;
    }
    const userId = ownerUserId ?? identity.userId;
    const [progressRows, updateRows, changeRows, trackingRows, sourceCheckRows, sharedTrackingRows, reviewRows] = await Promise.all([
      isOwner ? db.select().from(userProgress).where(eq(userProgress.userId, userId)) : Promise.resolve([]),
      db.select().from(scholarshipUpdates),
      db.select().from(changeLog).orderBy(desc(changeLog.changedAt)).limit(50),
      isOwner ? db
        .select()
        .from(userScholarshipTracking)
        .where(eq(userScholarshipTracking.userId, userId)) : Promise.resolve([]),
      isOwner ? db
        .select()
        .from(scholarshipSourceChecks)
        .where(eq(scholarshipSourceChecks.userId, userId)) : Promise.resolve([]),
      isOwner ? Promise.resolve([]) : db
        .select({
          scholarshipId: userScholarshipTracking.scholarshipId,
          scholarshipJson: userScholarshipTracking.scholarshipJson,
        })
        .from(userScholarshipTracking)
        .where(eq(userScholarshipTracking.isActive, true)),
      isOwner ? db.select().from(sourceReviewQueue).where(and(eq(sourceReviewQueue.userId, userId), eq(sourceReviewQueue.status, "pending"))).orderBy(desc(sourceReviewQueue.createdAt)).limit(30) : Promise.resolve([]),
    ]);

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const manualEdits = await listManualEdits();
    const sharedScholarships = new Map(
      scholarships.map((item) => [item.id, redactScholarship(item)]),
    );
    for (const row of sharedTrackingRows) {
      const item = safeJson(row.scholarshipJson);
      if (typeof item.name !== "string") continue;
      sharedScholarships.set(
        row.scholarshipId,
        redactScholarship({ ...item, id: row.scholarshipId } as unknown as Scholarship),
      );
    }
    return privateJson({
      role: isOwner ? "owner" : "viewer",
      manualEdits: manualEdits.map((edit) => ({ ...edit, patch: isOwner ? edit.patch : publicManualPatch(edit.patch) })),
      scholarships: isOwner ? scholarships : [...sharedScholarships.values()],
      progress: progressRows.map((row) => ({
        scholarshipId: row.scholarshipId,
        status: row.status,
        notes: row.notes,
        checklist: safeJson(row.checklistJson),
        updatedAt: row.updatedAt,
      })),
      updates: updateRows.map((row) => ({
        scholarshipId: row.scholarshipId,
        patch: isOwner ? safeJson(row.patchJson) : redactPatch(safeJson(row.patchJson)),
        sourceUrl: row.sourceUrl,
        verifiedAt: row.verifiedAt,
        updatedAt: row.updatedAt,
      })),
      tracking: trackingRows.map((row) => ({
        scholarshipId: row.scholarshipId,
        scholarship: safeJson(row.scholarshipJson),
        discoveryInput: row.discoveryInput,
        sourceUrl: row.sourceUrl,
        active: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      sourceChecks: sourceCheckRows.map((row) => ({
        scholarshipId: row.scholarshipId,
        sourceUrl: row.sourceUrl,
        httpStatus: row.httpStatus,
        outcome: row.outcome,
        error: row.error,
        lastCheckedAt: row.lastCheckedAt,
      })),
      changes: isOwner ? changeRows.filter((row) => {
        if (row.changeType === "RETRACTED_EXTRACTION") return false;
        const timestamp = Date.parse(row.changedAt);
        return Number.isFinite(timestamp) && timestamp >= weekAgo;
      }).map((row) => ({ ...row, fieldChanges: safeJson(row.fieldChangesJson) })) : [],
      reviews: reviewRows.map((row) => ({ id: row.id, scholarshipId: row.scholarshipId, sourceUrl: row.sourceUrl, reason: row.reason, candidatePatch: safeJson(row.candidatePatchJson), fieldChanges: JSON.parse(row.fieldChangesJson), createdAt: row.createdAt })),
      storage: isOwner ? "Neon Postgres" : "Shared read-only view",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dashboard data unavailable";
    return privateJson({ error: message }, { status: 500 });
  }
}
