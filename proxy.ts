import { clerkMiddleware } from "@clerk/nextjs/server";

// Every page/API also enforces authorization after the session is established.
export default clerkMiddleware();
export const config = { matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ico|webmanifest|woff2?)).*)", "/api/(.*)"] };
