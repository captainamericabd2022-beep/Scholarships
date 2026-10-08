import { verifiedSession } from "./session";
import { administratorEmailAllowlist, isAdministratorEmail, sharedAdministratorDataKey, sameOriginMutation } from "./auth-policy";

export type RequestIdentity = { userId: string; email: string };
export async function configuredOwnerEmail() { return (process.env.OWNER_EMAIL ?? "").trim().toLowerCase(); }
export function configuredAdministratorEmail(email: string) { return isAdministratorEmail(email, process.env.OWNER_EMAIL, process.env.ADMIN_EMAILS); }
export function configuredAdministratorEmails() { return administratorEmailAllowlist(process.env.OWNER_EMAIL, process.env.ADMIN_EMAILS); }
export async function requestIdentity(request: Request): Promise<RequestIdentity | null> {
  if (!sameOriginMutation(request)) return null;
  // Client-supplied identity headers and localhost hostnames are never credentials.
  return verifiedSession();
}
export async function isOwnerIdentity(identity: RequestIdentity | null, request: Request) {
  return Boolean(identity && sameOriginMutation(request) && configuredAdministratorEmail(identity.email));
}
export async function requestUserId(request: Request) {
  const identity = await requestIdentity(request);
  return await isOwnerIdentity(identity, request) ? sharedAdministratorDataKey(identity!.email, process.env.OWNER_EMAIL, process.env.ADMIN_EMAILS) : null;
}
export async function hasRefreshAccess(request: Request) { return Boolean(await requestUserId(request)); }
