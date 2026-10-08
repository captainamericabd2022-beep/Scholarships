import { env } from "cloudflare:workers";
import type { Scholarship } from "../lib/scholarships";
import type { ScholarshipEdit } from "../lib/scholarship-edits";

type Row = { scholarship_id: string; patch_json: string; revision: number; updated_at: string };
function decode(row: Row): ScholarshipEdit {
  return { scholarshipId: row.scholarship_id, patch: JSON.parse(row.patch_json), revision: row.revision, updatedAt: row.updated_at };
}
export async function listManualEdits(): Promise<ScholarshipEdit[]> {
  const { results } = await env.DB.prepare("SELECT scholarship_id, patch_json, revision, updated_at FROM scholarship_manual_edits").all<Row>();
  return results.map(decode);
}
export async function getManualEdit(id: string): Promise<ScholarshipEdit | null> {
  const row = await env.DB.prepare("SELECT scholarship_id, patch_json, revision, updated_at FROM scholarship_manual_edits WHERE scholarship_id = ?").bind(id).first<Row>();
  return row ? decode(row) : null;
}
export async function saveManualEdit(id: string, userId: string, patch: Partial<Scholarship>, expectedRevision: number): Promise<ScholarshipEdit | null> {
  const updatedAt = new Date().toISOString();
  // Compare-and-swap prevents one open device from silently overwriting another.
  const statement = expectedRevision === 0
    ? env.DB.prepare("INSERT INTO scholarship_manual_edits (scholarship_id, user_id, patch_json, revision, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT (scholarship_id) DO NOTHING RETURNING scholarship_id, patch_json, revision, updated_at").bind(id, userId, JSON.stringify(patch), updatedAt)
    : env.DB.prepare("UPDATE scholarship_manual_edits SET user_id = ?, patch_json = ?, revision = revision + 1, updated_at = ? WHERE scholarship_id = ? AND revision = ? RETURNING scholarship_id, patch_json, revision, updated_at").bind(userId, JSON.stringify(patch), updatedAt, id, expectedRevision);
  const row = await statement.first<Row>();
  return row ? decode(row) : null;
}
