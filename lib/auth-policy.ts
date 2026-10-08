export type VerifiedIdentity = { userId: string; email: string; displayName: string };
export function identityFromVerifiedAccount(account: {
  id: string; primaryEmailAddressId: string | null; fullName: string | null;
  emailAddresses: { id: string; emailAddress: string; verification: { status: string } | null }[];
} | null): VerifiedIdentity | null {
  const primary = account?.emailAddresses.find((email) => email.id === account.primaryEmailAddressId);
  if (!account || !primary || primary.verification?.status !== "verified") return null;
  const email = primary.emailAddress.trim().toLowerCase();
  return { userId: account.id, email, displayName: account.fullName || email };
}
export function isOwnerEmail(email: string, configured: string | undefined) {
  const owner = configured?.trim().toLowerCase();
  return Boolean(owner && email.trim().toLowerCase() === owner);
}
export function administratorEmailAllowlist(owner: string | undefined, administrators: string | undefined) {
  // Fail closed without a primary owner, even if an administrator list exists.
  if (!owner?.trim()) return [];
  return [...new Set([owner, ...(administrators ?? "").split(",")].map((entry) => entry.trim().toLowerCase()).filter(Boolean))];
}
export function isAdministratorEmail(email: string, owner: string | undefined, administrators: string | undefined) {
  const normalized = email.trim().toLowerCase();
  return Boolean(normalized && administratorEmailAllowlist(owner, administrators).includes(normalized));
}
export function sharedAdministratorDataKey(email: string, owner: string | undefined, administrators: string | undefined) {
  return isAdministratorEmail(email, owner, administrators) ? ownerDataKey(owner!) : null;
}
export function ownerDataKey(email: string) { return `owner:${email.trim().toLowerCase()}`; }
export function sameOriginMutation(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
