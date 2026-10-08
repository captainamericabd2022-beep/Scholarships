import Dashboard from "./Dashboard";
import { UserButton } from "@clerk/nextjs";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { viewerAccess } from "../db/schema";
import { isAuthorizedOwner, requireUser } from "./auth";
import { readOwnerProfile } from "../lib/owner-profile";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireUser();
  const isOwner = await isAuthorizedOwner(user.email);
  let isViewer = false;
  if (!isOwner) {
    const [viewer] = await getDb()
      .select({ id: viewerAccess.id })
      .from(viewerAccess)
      .where(
        and(
          eq(viewerAccess.email, user.email.trim().toLowerCase()),
          eq(viewerAccess.isActive, true),
        ),
      )
      .limit(1);
    isViewer = Boolean(viewer);
  }
  if (!isOwner && !isViewer) {
    return (
      <main className="access-denied">
        <section>
          <span>SC</span>
          <p>PRIVATE COMMAND CENTER</p>
          <h1>This account is not authorized.</h1>
          <p>Ask the dashboard owner to allow this email, or sign in with an authorized account.</p>
          <UserButton />
        </section>
      </main>
    );
  }
  return (
    <Dashboard
      userEmail={user.email}
      userName={user.displayName}
      isOwner={isOwner}
      profile={isOwner ? await readOwnerProfile() : null}
    />
  );
}
