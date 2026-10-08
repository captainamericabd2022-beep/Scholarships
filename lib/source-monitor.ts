import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { listManualEdits } from "../db/manual-edits";
import {
  changeLog,
  monitorRuns,
  scholarshipSourceChecks,
  scholarshipUpdates,
  sourceReviewQueue,
  userScholarshipTracking,
} from "../db/schema";
import { scholarships, type Scholarship } from "./scholarships";
import {
  analyzeAutomaticChanges,
  fieldChangeSummary,
  researchOfficialPage,
} from "./source-research";
import { withJobLease } from "./background-jobs";

function safeJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function runSourceRefresh(userId: string, payload: { force?: boolean; limit?: number }) {
  const startedAt = new Date().toISOString();

  try {
    const force = Boolean(payload.force);
    const limit = Math.max(1, Math.min(100, Number(payload.limit) || 24));
    const db = getDb();
    const [updateRows, trackingRows, checkRows] = await Promise.all([
      db.select().from(scholarshipUpdates),
      db
        .select()
        .from(userScholarshipTracking)
        .where(eq(userScholarshipTracking.userId, userId)),
      db
        .select()
        .from(scholarshipSourceChecks)
        .where(eq(scholarshipSourceChecks.userId, userId)),
    ]);
    const updates = new Map(updateRows.map((row) => [row.scholarshipId, safeJson(row.patchJson)]));
    const tracking = new Map(trackingRows.map((row) => [row.scholarshipId, row]));
    const checks = new Map(checkRows.map((row) => [row.scholarshipId, row]));

    const baseline = scholarships.map((item) => ({
      item: { ...item, ...(updates.get(item.id) ?? {}) } as Scholarship,
      custom: false,
    }));
    const custom = trackingRows
      .filter((row) => row.isActive)
      .map((row) => safeJson(row.scholarshipJson) as unknown as Scholarship)
      .filter((item) => item.id && item.name)
      .map((item) => ({ item, custom: true }));
    const manualEdits = await listManualEdits();
    // Research a corrected source URL without treating owner-entered facts as verified data.
    const candidates = [...baseline, ...custom].map((target) => {
      const source = manualEdits.find((edit) => edit.scholarshipId === target.item.id)?.patch.officialNoticeUrl;
      return source === undefined ? target : { ...target, item: { ...target.item, officialNoticeUrl: source } };
    }).filter(({ item }) => {
      const row = tracking.get(item.id);
      return (row?.isActive ?? true) && Boolean(item.officialNoticeUrl);
    });

    const staleBefore = Date.now() - 18 * 60 * 60 * 1000;
    const staleCandidates = candidates.filter(({ item }) => {
        const checkedAt = Date.parse(checks.get(item.id)?.lastCheckedAt ?? "");
        return force || !Number.isFinite(checkedAt) || checkedAt < staleBefore;
      });
    // Oldest checks first prevents large watchlists from starving later items.
    staleCandidates.sort((a, b) => (Date.parse(checks.get(a.item.id)?.lastCheckedAt ?? "") || 0) - (Date.parse(checks.get(b.item.id)?.lastCheckedAt ?? "") || 0));
    const stale = staleCandidates.slice(0, limit);
    const researched: PromiseSettledResult<{ item: Scholarship; custom: boolean; research: Awaited<ReturnType<typeof researchOfficialPage>> }>[] = [];
    for (let offset = 0; offset < stale.length; offset += 6) {
      researched.push(...await Promise.allSettled(stale.slice(offset, offset + 6).map(async (target) => ({ ...target, research: await researchOfficialPage(target.item.officialNoticeUrl) }))));
    }

    let updated = 0;
    let attention = 0;
    let failed = 0;
    const now = new Date().toISOString();
    const verifiedAt = now.slice(0, 10);
    for (let index = 0; index < researched.length; index += 1) {
      const result = researched[index];
      const target = stale[index];
      const previousCheck = checks.get(target.item.id);
      if (result.status === "rejected") {
        failed += 1;
        await db
          .insert(scholarshipSourceChecks)
          .values({
            userId,
            scholarshipId: target.item.id,
            sourceUrl: target.item.officialNoticeUrl,
            contentHash: previousCheck?.contentHash ?? "",
            httpStatus: 0,
            outcome: "check-failed",
            error: result.reason instanceof Error ? result.reason.message.slice(0, 300) : "Source check failed.",
            lastCheckedAt: now,
          })
          .onConflictDoUpdate({
            target: [scholarshipSourceChecks.userId, scholarshipSourceChecks.scholarshipId],
            set: {
              outcome: "check-failed",
              error: result.reason instanceof Error ? result.reason.message.slice(0, 300) : "Source check failed.",
              lastCheckedAt: now,
            },
          });
        continue;
      }

      const { item, custom: isCustom, research } = result.value;
      const { safePatch: patch, reviewPatch, safeChanges, reviewChanges } = analyzeAutomaticChanges(item, research);
      const sourceChanged = Boolean(
        previousCheck?.contentHash && previousCheck.contentHash !== research.contentHash,
      );
      const patchKeys = Object.keys(patch);
      if (patchKeys.length) {
        patch.dateNote =
          "Dates were refreshed from explicit opening/deadline wording on the connected source. Confirm the official notice before final submission.";
        if (isCustom) {
          const row = tracking.get(item.id);
          if (row) {
            await db
              .update(userScholarshipTracking)
              .set({ scholarshipJson: JSON.stringify({ ...item, ...patch }), updatedAt: now })
              .where(eq(userScholarshipTracking.id, row.id));
          }
        } else {
          const currentPatch = updates.get(item.id) ?? {};
          await db
            .insert(scholarshipUpdates)
            .values({
              scholarshipId: item.id,
              patchJson: JSON.stringify({ ...currentPatch, ...patch }),
              sourceUrl: research.finalUrl,
              verifiedAt,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: scholarshipUpdates.scholarshipId,
              set: {
                patchJson: JSON.stringify({ ...currentPatch, ...patch }),
                sourceUrl: research.finalUrl,
                verifiedAt,
                updatedAt: now,
              },
            });
        }
        const opened = patch.baseStatus === "OPEN" && item.baseStatus !== "OPEN";
        await db.insert(changeLog).values({
          scholarshipId: item.id,
          changeType: opened ? "APPLICATION_OPENED" : "DEADLINE_CHANGED",
          summary: fieldChangeSummary(safeChanges) || (opened
            ? `${item.shortName} now has an explicitly dated open application window on its connected source.`
            : `${item.shortName} has verified information changes on its connected source.`),
          sourceUrl: research.finalUrl,
          changedAt: now,
          verifiedAt,
          fieldChangesJson: JSON.stringify(safeChanges),
        });
        updated += 1;
      }

      const ambiguousDates = research.dateAmbiguities?.length ? research.dateAmbiguities.map((field) => `${field}: ${research.dateEvidence?.[field].join(" / ")}`).join("; ") : "";
      const needsReview = Object.keys(reviewPatch).length > 0 || Boolean(ambiguousDates) || (sourceChanged && !patchKeys.length);
      if (needsReview) {
        await db.insert(sourceReviewQueue).values({
          userId,
          scholarshipId: item.id,
          sourceUrl: research.finalUrl,
          contentHash: research.contentHash,
          candidatePatchJson: JSON.stringify(reviewPatch),
          fieldChangesJson: JSON.stringify(reviewChanges),
          reason: ambiguousDates ? `Multiple official dates require programme/round confirmation. No replacement date was guessed. ${ambiguousDates}` : Object.keys(reviewPatch).length
            ? "The official page contains new or ambiguous monitored-field evidence. Owner confirmation is required before overwrite."
            : "The official source changed, but no safe structured replacement could be confirmed.",
          status: "pending",
          createdAt: now,
          reviewedAt: "",
        }).onConflictDoNothing();
        attention += 1;
      }

      await db
        .insert(scholarshipSourceChecks)
        .values({
          userId,
          scholarshipId: item.id,
          sourceUrl: research.finalUrl,
          contentHash: research.contentHash,
          httpStatus: research.httpStatus,
          outcome: needsReview ? "changed-needs-review" : research.confidence,
          error: "",
          lastCheckedAt: now,
        })
        .onConflictDoUpdate({
          target: [scholarshipSourceChecks.userId, scholarshipSourceChecks.scholarshipId],
          set: {
            sourceUrl: research.finalUrl,
            contentHash: research.contentHash,
            httpStatus: research.httpStatus,
            outcome: needsReview ? "changed-needs-review" : research.confidence,
            error: "",
            lastCheckedAt: now,
          },
        });
    }

    await db.insert(monitorRuns).values({
      userId, startedAt, completedAt: now, status: failed ? "completed-with-errors" : "success",
      checkedCount: stale.length, updatedCount: updated, attentionCount: attention, failedCount: failed, error: "",
    });
    return {
      ok: true,
      checked: stale.length,
      updated,
      attention,
      failed,
      skippedFresh: candidates.length - stale.length,
      remaining: Math.max(0, staleCandidates.length - stale.length),
      checkedAt: now,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automatic source refresh failed.";
    try {
      await getDb().insert(monitorRuns).values({
        userId, startedAt, completedAt: new Date().toISOString(), status: "failed",
        checkedCount: 0, updatedCount: 0, attentionCount: 0, failedCount: 1, error: message.slice(0, 300),
      });
    } catch { /* preserve the original monitoring error */ }
    throw new Error(message);
  }
}

export async function refreshOfficialSources(userId: string, options: { force?: boolean; limit?: number } = {}) {
  return withJobLease(`source-refresh:${userId}`, () => runSourceRefresh(userId, options));
}

