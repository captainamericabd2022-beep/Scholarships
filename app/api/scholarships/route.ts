import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  scholarshipSourceChecks,
  scholarshipUpdates,
  userScholarshipTracking,
} from "../../../db/schema";
import { scholarships, type Scholarship } from "../../../lib/scholarships";
import {
  buildPendingScholarship,
  canonicalUrl,
  normalizeForMatch,
  researchOfficialPage,
  validateSourceUrl,
} from "../../../lib/source-research";
import { requestUserId } from "../../../lib/request-auth";
import { listManualEdits } from "../../../db/manual-edits";
import { applyManualEdit } from "../../../lib/scholarship-edits";

function safeJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function sameScholarship(
  item: Pick<Scholarship, "name" | "shortName" | "officialNoticeUrl" | "applyUrl">,
  names: string[],
  sourceUrl: string,
) {
  const itemNames = [item.name, item.shortName].map(normalizeForMatch).filter(Boolean);
  const nameMatch = names.some((name) => itemNames.includes(name));
  const itemUrls = [item.officialNoticeUrl, item.applyUrl].map(canonicalUrl).filter(Boolean);
  return nameMatch || Boolean(sourceUrl && itemUrls.includes(sourceUrl));
}

export async function POST(request: Request) {
  const userId = await requestUserId(request);
  if (!userId) return Response.json({ error: "Owner sign-in is required." }, { status: 401 });

  try {
    const payload = (await request.json()) as { name?: string; sourceUrl?: string };
    let name = (payload.name ?? "").trim().slice(0, 160);
    let sourceUrl = (payload.sourceUrl ?? "").trim();
    if (!sourceUrl && /^https:\/\//i.test(name)) {
      sourceUrl = name;
      name = "";
    }
    if (!name && !sourceUrl) {
      return Response.json({ error: "Enter a scholarship name or official link." }, { status: 400 });
    }
    if (sourceUrl) sourceUrl = canonicalUrl(validateSourceUrl(sourceUrl).toString());

    let research = null;
    let researchWarning = "";
    if (sourceUrl) {
      try {
        research = await researchOfficialPage(sourceUrl);
        sourceUrl = canonicalUrl(research.finalUrl);
      } catch (error) {
        researchWarning = error instanceof Error ? error.message : "The page could not be checked yet.";
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const candidate = buildPendingScholarship({ name, sourceUrl, research, verifiedOn: today });
    const normalizedNames = [name, research?.title ?? candidate.name]
      .map(normalizeForMatch)
      .filter(Boolean);
    const db = getDb();
    const [updateRows, trackingRows] = await Promise.all([
      db.select().from(scholarshipUpdates),
      db
        .select()
        .from(userScholarshipTracking)
        .where(eq(userScholarshipTracking.userId, userId)),
    ]);
    const updatedScholarships = updateRows
      .map((row) => ({ id: row.scholarshipId, ...safeJson(row.patchJson) }))
      .filter((item) => typeof item.name === "string") as unknown as Scholarship[];
    const trackedScholarships = trackingRows
      .map((row) => ({ row, scholarship: safeJson(row.scholarshipJson) as unknown as Scholarship }))
      .filter(({ scholarship }) => typeof scholarship.name === "string");

    const edits = await listManualEdits();
    const baselineDuplicate = [...scholarships, ...updatedScholarships].map((item) => applyManualEdit(item, edits)).find((item) =>
      sameScholarship(item, normalizedNames, sourceUrl),
    );
    const trackedDuplicate = trackedScholarships.find(({ scholarship }) =>
      sameScholarship(applyManualEdit(scholarship, edits), normalizedNames, sourceUrl),
    );
    const duplicateId = baselineDuplicate?.id ?? trackedDuplicate?.row.scholarshipId;
    if (duplicateId) {
      const trackingRow = trackingRows.find((row) => row.scholarshipId === duplicateId);
      return Response.json({
        ok: true,
        duplicate: true,
        scholarshipId: duplicateId,
        active: trackingRow?.isActive ?? true,
        message: trackingRow?.isActive === false
          ? "This scholarship is already in your archive."
          : "You are already tracking this scholarship.",
      });
    }

    const now = new Date().toISOString();
    await db.insert(userScholarshipTracking).values({
      userId,
      scholarshipId: candidate.id,
      scholarshipJson: JSON.stringify(candidate),
      discoveryInput: name || sourceUrl,
      sourceUrl,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    if (research && sourceUrl) {
      await db.insert(scholarshipSourceChecks).values({
        userId,
        scholarshipId: candidate.id,
        sourceUrl,
        contentHash: research.contentHash,
        httpStatus: research.httpStatus,
        outcome: research.confidence,
        error: "",
        lastCheckedAt: now,
      });
    }
    return Response.json({
      ok: true,
      duplicate: false,
      scholarship: candidate,
      warning: researchWarning,
      message: sourceUrl
        ? "Added to tracking and connected to automatic source checks."
        : "Added to the research queue. Attach the official link when available.",
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to add scholarship." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const userId = await requestUserId(request);
  if (!userId) return Response.json({ error: "Owner sign-in is required." }, { status: 401 });

  try {
    const payload = (await request.json()) as {
      scholarshipId?: string;
      active?: boolean;
      sourceUrl?: string;
    };
    const scholarshipId = (payload.scholarshipId ?? "").trim();
    if (!scholarshipId) throw new Error("Missing scholarship id.");
    const db = getDb();
    const [existing] = await db
      .select()
      .from(userScholarshipTracking)
      .where(
        and(
          eq(userScholarshipTracking.userId, userId),
          eq(userScholarshipTracking.scholarshipId, scholarshipId),
        ),
      )
      .limit(1);
    const baseline = scholarships.find((item) => item.id === scholarshipId);
    if (!existing && !baseline) throw new Error("Scholarship was not found.");

    const now = new Date().toISOString();
    if (payload.sourceUrl) {
      if (!existing) throw new Error("Official sources can only be attached to scholarships you added.");
      const sourceUrl = canonicalUrl(validateSourceUrl(payload.sourceUrl).toString());
      const research = await researchOfficialPage(sourceUrl);
      const current = safeJson(existing.scholarshipJson) as unknown as Scholarship;
      const rebuilt = buildPendingScholarship({
        name: current.name,
        sourceUrl: research.finalUrl,
        research,
        verifiedOn: now.slice(0, 10),
      });
      const scholarship = { ...current, ...rebuilt, id: scholarshipId, name: current.name, shortName: current.shortName };
      await db
        .update(userScholarshipTracking)
        .set({
          scholarshipJson: JSON.stringify(scholarship),
          sourceUrl: canonicalUrl(research.finalUrl),
          updatedAt: now,
        })
        .where(eq(userScholarshipTracking.id, existing.id));
      await db
        .insert(scholarshipSourceChecks)
        .values({
          userId,
          scholarshipId,
          sourceUrl: canonicalUrl(research.finalUrl),
          contentHash: research.contentHash,
          httpStatus: research.httpStatus,
          outcome: research.confidence,
          error: "",
          lastCheckedAt: now,
        })
        .onConflictDoUpdate({
          target: [scholarshipSourceChecks.userId, scholarshipSourceChecks.scholarshipId],
          set: {
            sourceUrl: canonicalUrl(research.finalUrl),
            contentHash: research.contentHash,
            httpStatus: research.httpStatus,
            outcome: research.confidence,
            error: "",
            lastCheckedAt: now,
          },
        });
      return Response.json({ ok: true, scholarship });
    }

    const active = payload.active ?? true;
    if (existing) {
      await db
        .update(userScholarshipTracking)
        .set({ isActive: active, updatedAt: now })
        .where(eq(userScholarshipTracking.id, existing.id));
    } else if (baseline) {
      await db.insert(userScholarshipTracking).values({
        userId,
        scholarshipId,
        scholarshipJson: "{}",
        discoveryInput: baseline.name,
        sourceUrl: baseline.officialNoticeUrl,
        isActive: active,
        createdAt: now,
        updatedAt: now,
      });
    }
    return Response.json({ ok: true, scholarshipId, active });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to update tracking." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const userId = await requestUserId(request);
  if (!userId) return Response.json({ error: "Owner sign-in is required." }, { status: 401 });
  try {
    const payload = (await request.json()) as { scholarshipId?: string };
    const scholarshipId = (payload.scholarshipId ?? "").trim();
    if (!scholarshipId) throw new Error("Missing scholarship id.");
    const db = getDb();
    const [existing] = await db
      .select()
      .from(userScholarshipTracking)
      .where(
        and(
          eq(userScholarshipTracking.userId, userId),
          eq(userScholarshipTracking.scholarshipId, scholarshipId),
        ),
      )
      .limit(1);
    const baseline = scholarships.find((item) => item.id === scholarshipId);
    if (!existing && !baseline) throw new Error("Scholarship was not found.");
    const now = new Date().toISOString();
    if (existing) {
      await db
        .update(userScholarshipTracking)
        .set({ isActive: false, updatedAt: now })
        .where(eq(userScholarshipTracking.id, existing.id));
    } else if (baseline) {
      await db.insert(userScholarshipTracking).values({
        userId,
        scholarshipId,
        scholarshipJson: "{}",
        discoveryInput: baseline.name,
        sourceUrl: baseline.officialNoticeUrl,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      });
    }
    return Response.json({ ok: true, scholarshipId, active: false });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to remove scholarship." },
      { status: 400 },
    );
  }
}
