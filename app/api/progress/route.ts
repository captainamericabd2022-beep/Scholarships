import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  scholarshipUpdates,
  userProgress,
  userScholarshipTracking,
} from "../../../db/schema";
import {
  checklistItems,
  scholarshipIds,
  type ChecklistState,
  type TrackerStatus,
} from "../../../lib/scholarships";
import { requestUserId } from "../../../lib/request-auth";

const validStatuses = new Set<TrackerStatus>([
  "OPEN",
  "PREPARING",
  "WATCHING",
  "URGENT",
  "SUBMITTED",
  "RESULT PENDING",
  "SELECTED",
  "CLOSED",
]);

const validChecklistStates = new Set<ChecklistState>([
  "Not started",
  "In progress",
  "Ready",
  "Not required",
]);

export async function POST(request: Request) {
  const userId = await requestUserId(request);
  if (!userId) {
    return Response.json({ error: "Sign in is required." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as {
      scholarshipId?: string;
      status?: TrackerStatus | "";
      notes?: string;
      checklist?: Record<string, ChecklistState>;
    };
    const scholarshipId = payload.scholarshipId?.trim() ?? "";
    const db = getDb();
    if (!scholarshipIds.has(scholarshipId)) {
      const [dynamicScholarship, userScholarship] = await Promise.all([
        db
        .select({ id: scholarshipUpdates.scholarshipId })
        .from(scholarshipUpdates)
        .where(eq(scholarshipUpdates.scholarshipId, scholarshipId))
        .limit(1),
        db
          .select({ id: userScholarshipTracking.scholarshipId })
          .from(userScholarshipTracking)
          .where(
            and(
              eq(userScholarshipTracking.userId, userId),
              eq(userScholarshipTracking.scholarshipId, scholarshipId),
            ),
          )
          .limit(1),
      ]);
      if (!dynamicScholarship[0] && !userScholarship[0]) {
        return Response.json({ error: "Unknown scholarship." }, { status: 400 });
      }
    }
    if (payload.status && !validStatuses.has(payload.status)) {
      return Response.json({ error: "Invalid status." }, { status: 400 });
    }

    const checklist = payload.checklist ?? {};
    const allowedItems = new Set<string>(checklistItems);
    for (const [item, state] of Object.entries(checklist)) {
      if (!allowedItems.has(item) || !validChecklistStates.has(state)) {
        return Response.json({ error: "Invalid checklist value." }, { status: 400 });
      }
    }

    const now = new Date().toISOString();
    const values = {
      userId,
      scholarshipId,
      status: payload.status ?? "",
      notes: (payload.notes ?? "").slice(0, 12000),
      checklistJson: JSON.stringify(checklist),
      updatedAt: now,
    };

    await db
      .insert(userProgress)
      .values(values)
      .onConflictDoUpdate({
        target: [userProgress.userId, userProgress.scholarshipId],
        set: {
          status: values.status,
          notes: values.notes,
          checklistJson: values.checklistJson,
          updatedAt: now,
        },
      });

    const [saved] = await db
      .select()
      .from(userProgress)
      .where(
        and(
          eq(userProgress.userId, userId),
          eq(userProgress.scholarshipId, scholarshipId),
        ),
      )
      .limit(1);

    return Response.json({
      ok: true,
      progress: {
        scholarshipId,
        status: saved.status,
        notes: saved.notes,
        checklist: JSON.parse(saved.checklistJson),
        updatedAt: saved.updatedAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save progress";
    return Response.json({ error: message }, { status: 500 });
  }
}
