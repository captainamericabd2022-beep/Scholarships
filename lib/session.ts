import "server-only";
import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { identityFromVerifiedAccount } from "./auth-policy";

export const verifiedSession = cache(async () => {
  const { userId } = await auth();
  if (!userId) return null;
  return identityFromVerifiedAccount(await currentUser());
});
