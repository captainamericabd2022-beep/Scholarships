import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { viewerAccess } from "../../../db/schema";
import { configuredAdministratorEmail, requestIdentity } from "../../../lib/request-auth";
import { profileDataKey, validateProfile } from "../../../lib/profile-policy";
import { readApplicantProfile, saveApplicantProfile } from "../../../lib/owner-profile";
function json(payload: unknown, status = 200) { return Response.json(payload, { status, headers: { "cache-control": "private, no-store" } }); }
async function profileAccess(request: Request) {
  const identity = await requestIdentity(request); if (!identity) return null;
  const administrator = configuredAdministratorEmail(identity.email);
  if (!administrator) {
    const [viewer] = await getDb().select({ id: viewerAccess.id }).from(viewerAccess).where(and(eq(viewerAccess.email, identity.email), eq(viewerAccess.isActive, true))).limit(1);
    if (!viewer) return null;
  }
  return { dataKey: profileDataKey(identity.email, process.env.OWNER_EMAIL, process.env.ADMIN_EMAILS), administrator };
}
export async function GET(request: Request) {
  try {
    const access = await profileAccess(request); if (!access) return json({ error: "An approved, verified sign-in is required." }, 403);
    return json({ ...await readApplicantProfile(access.dataKey, access.administrator), scope: access.administrator ? "shared-admin" : "personal" });
  } catch { return json({ error: "Your profile is temporarily unavailable." }, 500); }
}
export async function PATCH(request: Request) {
  try {
    const access = await profileAccess(request); if (!access) return json({ error: "An approved, verified sign-in is required." }, 403);
    const payload = await request.json() as { profile?: unknown; expectedRevision?: number };
    if (!Number.isInteger(payload.expectedRevision) || payload.expectedRevision! < 0) return json({ error: "Reload your profile before saving." }, 400);
    const saved = await saveApplicantProfile(access.dataKey, validateProfile(payload.profile), payload.expectedRevision!);
    if (!saved) return json({ error: "This profile changed on another device. Your draft is kept; reload the latest version before saving." }, 409);
    return json({ ok: true, ...saved });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Profile could not be saved." }, 400); }
}
