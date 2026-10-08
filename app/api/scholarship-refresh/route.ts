import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { changeLog, scholarshipUpdates } from "../../../db/schema";
import {
  allowedRefreshFields,
  scholarshipIds,
  scholarships,
  type Scholarship,
} from "../../../lib/scholarships";
import { hasRefreshAccess } from "../../../lib/request-auth";

const officialHosts = [
  "fcdo.gov.uk",
  "europa.eu",
  "upf.edu",
  "cybersure-master.eu",
  "master-ediss.eu",
  "ulb.be",
  "studyinkorea.go.kr",
  "mofa.go.kr",
  "stipendiumhungaricum.hu",
  "shed.gov.bd",
  "daad.de",
  "daad-bangladesh.org",
  "emb-japan.go.jp",
  "studyinjapan.go.jp",
  "fulbrightonline.org",
  "usembassy.gov",
  "iie.org",
  "chevening.org",
  "turkiyeburslari.gov.tr",
  "kaist.ac.kr",
  "stanford.edu",
  "si.se",
  "universityadmissions.se",
  "opintopolku.fi",
];

const changeTypes = new Set([
  "NEW_SCHOLARSHIP",
  "APPLICATION_OPENED",
  "DEADLINE_CHANGED",
  "ELIGIBILITY_CHANGED",
  "FUNDING_CHANGED",
  "PORTAL_OPENED",
  "PROGRAMME_FOUND",
]);

const baseById = new Map(scholarships.map((item) => [item.id, item]));

function isOfficialUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      officialHosts.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      )
    );
  } catch {
    return false;
  }
}

function cleanPatch(input: Record<string, unknown>) {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (allowedRefreshFields.has(key as keyof Scholarship)) cleaned[key] = value;
  }
  return cleaned;
}

function parsePatch(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  if (!(await hasRefreshAccess(request))) {
    return Response.json({ error: "Private-site authentication is required." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as {
      dryRun?: boolean;
      changes?: Array<{
        scholarshipId?: string;
        changeType?: string;
        summary?: string;
        sourceUrl?: string;
        verifiedAt?: string;
        changes?: Record<string, unknown>;
      }>;
    };
    const incoming = payload.changes ?? [];
    if (!incoming.length) {
      return Response.json({ ok: true, dryRun: Boolean(payload.dryRun), applied: 0, skipped: 0 });
    }

    const validated = incoming.map((item, index) => {
      const scholarshipId = item.scholarshipId?.trim() ?? "";
      const summary = item.summary?.trim() ?? "";
      const sourceUrl = item.sourceUrl?.trim() ?? "";
      const verifiedAt = item.verifiedAt?.trim() ?? "";
      const patch = cleanPatch(item.changes ?? {});
      if (!scholarshipId || !/^[a-z0-9-]{3,80}$/.test(scholarshipId)) {
        throw new Error(`Change ${index + 1}: invalid scholarshipId.`);
      }
      if (!item.changeType || !changeTypes.has(item.changeType)) {
        throw new Error(`Change ${index + 1}: invalid meaningful change type.`);
      }
      if (summary.length < 8 || summary.length > 360) {
        throw new Error(`Change ${index + 1}: summary must be 8–360 characters.`);
      }
      if (!isOfficialUrl(sourceUrl)) {
        throw new Error(`Change ${index + 1}: source must be an approved official HTTPS domain.`);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt)) {
        throw new Error(`Change ${index + 1}: verifiedAt must be YYYY-MM-DD.`);
      }
      if (!Object.keys(patch).length) {
        throw new Error(`Change ${index + 1}: no supported scholarship fields supplied.`);
      }
      if (!scholarshipIds.has(scholarshipId)) {
        const requiredForNew = [
          "name",
          "shortName",
          "country",
          "programme",
          "areas",
          "fundingLevel",
          "officialNoticeUrl",
          "applyUrl",
          "baseStatus",
          "fit",
          "nextAction",
        ];
        const missing = requiredForNew.filter((key) => !(key in patch));
        if (missing.length) {
          throw new Error(`Change ${index + 1}: new scholarship is missing ${missing.join(", ")}.`);
        }
      }
      return {
        scholarshipId,
        changeType: item.changeType,
        summary,
        sourceUrl,
        verifiedAt,
        patch,
      };
    });

    if (payload.dryRun) {
      return Response.json({ ok: true, dryRun: true, validated: validated.length, applied: 0 });
    }

    const db = getDb();
    let applied = 0;
    let skipped = 0;
    for (const item of validated) {
      const [existing] = await db
        .select()
        .from(scholarshipUpdates)
        .where(eq(scholarshipUpdates.scholarshipId, item.scholarshipId))
        .limit(1);
      const currentPatch = existing ? parsePatch(existing.patchJson) : {};
      const baseline = baseById.get(item.scholarshipId) ?? ({} as Scholarship);
      const effective = { ...baseline, ...currentPatch } as Record<string, unknown>;
      const actualPatch = Object.fromEntries(
        Object.entries(item.patch).filter(
          ([key, value]) => JSON.stringify(effective[key]) !== JSON.stringify(value),
        ),
      );
      if (!Object.keys(actualPatch).length) {
        skipped += 1;
        continue;
      }

      const now = new Date().toISOString();
      const merged = { ...currentPatch, ...actualPatch };
      await db
        .insert(scholarshipUpdates)
        .values({
          scholarshipId: item.scholarshipId,
          patchJson: JSON.stringify(merged),
          sourceUrl: item.sourceUrl,
          verifiedAt: item.verifiedAt,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: scholarshipUpdates.scholarshipId,
          set: {
            patchJson: JSON.stringify(merged),
            sourceUrl: item.sourceUrl,
            verifiedAt: item.verifiedAt,
            updatedAt: now,
          },
        });
      await db.insert(changeLog).values({
        scholarshipId: item.scholarshipId,
        changeType: item.changeType,
        summary: item.summary,
        sourceUrl: item.sourceUrl,
        changedAt: now,
        verifiedAt: item.verifiedAt,
      });
      applied += 1;
    }

    return Response.json({ ok: true, dryRun: false, applied, skipped });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refresh rejected";
    return Response.json({ error: message }, { status: 400 });
  }
}
