import { DatabaseSync } from "node:sqlite";
import { neon } from "@neondatabase/serverless";
import { enableWindowsTransport } from "./windows-fetch.mjs";

// Explicit local source only; never delete or mutate the original SQLite database.
const sourcePath = process.argv[2];
if (!sourcePath || !process.env.DATABASE_URL || !process.env.OWNER_EMAIL) throw new Error("Supply a SQLite source path, DATABASE_URL and OWNER_EMAIL.");
enableWindowsTransport();
const source = new DatabaseSync(sourcePath, { readOnly: true });
const sql = neon(process.env.DATABASE_URL);
const owner = `owner:${process.env.OWNER_EMAIL.trim().toLowerCase()}`;
const tables = ["user_progress", "scholarship_updates", "change_log", "scholarship_manual_edits", "source_review_queue", "monitor_runs", "user_scholarship_tracking", "scholarship_source_checks", "viewer_access", "notification_preferences", "notification_deliveries"];
const booleanColumns = new Set(["is_active", "is_enabled", "scholarship_changes", "opening_reminders", "deadline_reminders"]);
for (const table of tables) {
  const rows = source.prepare(`SELECT * FROM "${table}"`).all();
  let imported = 0;
  for (const original of rows) {
    const row = { ...original };
    // Historical developer fixtures must not grant anyone dashboard access.
    if (table === "viewer_access" && /@example\.(com|org|net)$|^editor-test-/i.test(String(row.email))) continue;
    if ("user_id" in row) row.user_id = owner;
    for (const column of booleanColumns) if (column in row) row[column] = Boolean(row[column]);
    const columns = Object.keys(row);
    const params = columns.map((key) => row[key]);
    const query = `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(",")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(",")}) ON CONFLICT DO NOTHING RETURNING *`;
    const result = await sql.query(query, params);
    imported += result.length;
  }
  // Imported IDs must not collide with future inserts.
  if (table !== "scholarship_manual_edits") await sql.query(`SELECT setval(pg_get_serial_sequence($1, 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM "${table}"), 0), 1), COALESCE((SELECT MAX(id) FROM "${table}"), 0) > 0)`, [table]);
  console.log(`${table}: ${imported} records preserved`);
}
source.close();
