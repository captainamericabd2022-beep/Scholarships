import { redirect } from "next/navigation";
import { verifiedSession } from "../lib/session";
import { isOwnerEmail } from "../lib/auth-policy";

export async function requireUser() {
  const user = await verifiedSession();
  if (!user) redirect("/sign-in");
  return user;
}
export async function isAuthorizedOwner(email: string) {
  return isOwnerEmail(email, process.env.OWNER_EMAIL);
}
