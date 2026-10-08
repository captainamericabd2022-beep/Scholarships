const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";

function isLocalRequest(request: Request) {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export type RequestIdentity = {
  userId: string;
  email: string;
};

export async function configuredOwnerEmail() {
  try {
    const { env } = await import("cloudflare:workers");
    return ((env as unknown as { OWNER_EMAIL?: string }).OWNER_EMAIL ?? "")
      .trim()
      .toLowerCase();
  } catch {
    return (process.env.OWNER_EMAIL ?? "").trim().toLowerCase();
  }
}

export function requestIdentity(request: Request): RequestIdentity | null {
  const userId = request.headers.get(USER_ID_HEADER)?.trim();
  const email = request.headers.get(USER_EMAIL_HEADER)?.trim().toLowerCase();
  if (userId && email) return { userId, email };
  if (isLocalRequest(request)) {
    return { userId: "local-preview", email: "local-preview@localhost" };
  }
  return null;
}

export async function isOwnerIdentity(identity: RequestIdentity | null, request: Request) {
  if (!identity) return false;
  if (isLocalRequest(request)) return identity.userId === "local-preview";
  const ownerEmail = await configuredOwnerEmail();
  return Boolean(ownerEmail && identity.email === ownerEmail);
}

export async function requestUserId(request: Request) {
  const identity = requestIdentity(request);
  return await isOwnerIdentity(identity, request) ? identity?.userId ?? null : null;
}

export async function hasRefreshAccess(request: Request) {
  return Boolean(await requestUserId(request));
}
