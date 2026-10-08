import { verifiedSession } from "./session";
import { isOwnerEmail, ownerDataKey, sameOriginMutation } from "./auth-policy";

export type RequestIdentity = { userId: string; email: string };
export async function configuredOwnerEmail() { return (process.env.OWNER_EMAIL ?? "").trim().toLowerCase(); }
export async function requestIdentity(request: Request): Promise<RequestIdentity | null> {
  if (!sameOriginMutation(request)) return null;
  // Client-supplied identity headers and localhost hostnames are never credentials.
  return verifiedSession();
}
export async function isOwnerIdentity(identity: RequestIdentity | null, request: Request) {
  return Boolean(identity && sameOriginMutation(request) && isOwnerEmail(identity.email, await configuredOwnerEmail()));
}
export async function requestUserId(request: Request) {
  const identity = await requestIdentity(request);
  return await isOwnerIdentity(identity, request) ? ownerDataKey(identity!.email) : null;
}
export async function hasRefreshAccess(request: Request) { return Boolean(await requestUserId(request)); }
