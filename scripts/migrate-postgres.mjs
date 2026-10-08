import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { enableWindowsTransport } from "./windows-fetch.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
enableWindowsTransport();
const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
await migrate(drizzle(sql), { migrationsFolder: fileURLToPath(new URL("../drizzle-postgres/", import.meta.url)) });
const tables = await sql`SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'`;
console.log(`Durable database ready (${tables[0].count} tables).`);
