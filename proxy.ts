import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";

// Every page/API also enforces authorization after the session is established.
const userMiddleware = clerkMiddleware();
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  // Only this exact endpoint uses its own server-only CRON_SECRET verification.
  if (request.nextUrl.pathname === "/api/cron/scholarship-watch") return NextResponse.next();
  return userMiddleware(request, event);
}
export const config = { matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ico|webmanifest|woff2?)).*)", "/api/(.*)"] };
