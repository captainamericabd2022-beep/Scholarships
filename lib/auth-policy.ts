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
export function ownerDataKey(email: string) { return `owner:${email.trim().toLowerCase()}`; }
export function sameOriginMutation(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
