import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  if (!process.env.DATABASE_URL) throw new Error("The durable database is not configured.");
  return drizzle(neon(process.env.DATABASE_URL), { schema });
}
let database: ReturnType<typeof createDb> | undefined;
export function getDb() { return database ??= createDb(); }
