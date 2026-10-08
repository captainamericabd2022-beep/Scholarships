import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { applicantProfiles } from "../db/schema";
import { neutralProfile, validateProfile, type ApplicantProfile } from "./profile-policy";
import { ownerDataKey } from "./auth-policy";

function configuredProfile(): ApplicantProfile {
  try { return validateProfile(JSON.parse(process.env.OWNER_PROFILE_JSON || "{}")); }
  catch { return neutralProfile(); }
}
export async function readApplicantProfile(dataKey: string, sharedAdmin = false) {
  const [row] = await getDb().select().from(applicantProfiles).where(eq(applicantProfiles.dataKey, dataKey)).limit(1);
  let profile = sharedAdmin ? configuredProfile() : neutralProfile();
  if (row) { try { profile = validateProfile(JSON.parse(row.profileJson)); } catch { /* preserve safe fallback */ } }
  return { profile, revision: row?.revision ?? 0, updatedAt: row?.updatedAt ?? "" };
}
export async function readOwnerProfile() { return (await readApplicantProfile(ownerDataKey(process.env.OWNER_EMAIL || ""), true)).profile; }
export async function saveApplicantProfile(dataKey: string, profile: ApplicantProfile, expectedRevision: number) {
  const db = getDb();
  const values = { profileJson: JSON.stringify(validateProfile(profile)), revision: expectedRevision + 1, updatedAt: new Date().toISOString() };
  const rows = expectedRevision === 0
    ? await db.insert(applicantProfiles).values({ dataKey, ...values }).onConflictDoNothing().returning()
    : await db.update(applicantProfiles).set(values).where(and(eq(applicantProfiles.dataKey, dataKey), eq(applicantProfiles.revision, expectedRevision))).returning();
  return rows.length ? { profile: JSON.parse(rows[0].profileJson) as ApplicantProfile, revision: rows[0].revision, updatedAt: rows[0].updatedAt } : null;
}
