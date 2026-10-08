import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { viewerAccess } from "../../../../db/schema";
import {
  configuredOwnerEmail,
  requestIdentity,
  requestUserId,
} from "../../../../lib/request-auth";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizedEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function privateJson(payload: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("cache-control", "private, no-store");
  return Response.json(payload, { ...init, headers });
}

async function activeViewers() {
  return getDb()
    .select({
      email: viewerAccess.email,
      invitedBy: viewerAccess.invitedBy,
      createdAt: viewerAccess.createdAt,
      updatedAt: viewerAccess.updatedAt,
    })
    .from(viewerAccess)
    .where(eq(viewerAccess.isActive, true))
    .orderBy(desc(viewerAccess.updatedAt));
}

async function requireOwner(request: Request) {
  const ownerId = await requestUserId(request);
  const identity = requestIdentity(request);
  return ownerId && identity ? identity : null;
}

export async function GET(request: Request) {
  if (!(await requireOwner(request))) {
    return privateJson({ error: "Owner access is required." }, { status: 403 });
  }
  return privateJson({ viewers: await activeViewers() });
}

export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return privateJson({ error: "Owner access is required." }, { status: 403 });
  }
  try {
    const payload = (await request.json()) as { email?: string };
    const email = normalizedEmail(payload.email);
    if (!emailPattern.test(email) || email.length > 254) {
      throw new Error("Enter a valid email address.");
    }
    if (email === await configuredOwnerEmail() || email === owner.email) {
      throw new Error("The owner already has full access.");
    }
    const now = new Date().toISOString();
    await getDb()
      .insert(viewerAccess)
      .values({
        email,
        isActive: true,
        invitedBy: owner.email,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: viewerAccess.email,
        set: { isActive: true, invitedBy: owner.email, updatedAt: now },
      });
    return privateJson({ ok: true, email, viewers: await activeViewers() });
  } catch (error) {
    return privateJson(
      { error: error instanceof Error ? error.message : "Viewer could not be added." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!(await requireOwner(request))) {
    return privateJson({ error: "Owner access is required." }, { status: 403 });
  }
  try {
    const payload = (await request.json()) as { email?: string };
    const email = normalizedEmail(payload.email);
    if (!email) throw new Error("Viewer email is required.");
    await getDb()
      .update(viewerAccess)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(viewerAccess.email, email));
    return privateJson({ ok: true, email, viewers: await activeViewers() });
  } catch (error) {
    return privateJson(
      { error: error instanceof Error ? error.message : "Viewer could not be removed." },
      { status: 400 },
    );
  }
}
