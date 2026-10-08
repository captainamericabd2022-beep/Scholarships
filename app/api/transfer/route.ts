import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { userProgress, userScholarshipTracking } from "../../../db/schema";
import { requestUserId } from "../../../lib/request-auth";
import { getManualEdit, listManualEdits, saveManualEdit } from "../../../db/manual-edits";
import { validateManualPatch } from "../../../lib/scholarship-edits";

function parseJson(value: string) { try { return JSON.parse(value); } catch { return {}; } }
function csvCell(value: unknown) { const text = typeof value === "string" ? value : JSON.stringify(value ?? ""); return `"${text.replaceAll('"', '""')}"`; }

export async function GET(request: Request) {
  const userId = await requestUserId(request);
  if (!userId) return Response.json({ error: "Owner sign-in is required." }, { status: 401 });
  const db = getDb();
  const [progress, tracking] = await Promise.all([
    db.select().from(userProgress).where(eq(userProgress.userId, userId)),
    db.select().from(userScholarshipTracking).where(eq(userScholarshipTracking.userId, userId)),
  ]);
  const exportData = {
    format: "cse-scholarship-command-center-backup", version: 1, exportedAt: new Date().toISOString(),
    manualEdits: await listManualEdits(),
    progress: progress.map((row) => ({ scholarshipId: row.scholarshipId, status: row.status, notes: row.notes, checklist: parseJson(row.checklistJson), updatedAt: row.updatedAt })),
    tracking: tracking.map((row) => ({ scholarshipId: row.scholarshipId, scholarship: parseJson(row.scholarshipJson), discoveryInput: row.discoveryInput, sourceUrl: row.sourceUrl, active: row.isActive, createdAt: row.createdAt, updatedAt: row.updatedAt })),
  };
  const format = new URL(request.url).searchParams.get("format") ?? "json";
  if (format === "csv") {
    const header = ["record_type", "scholarship_id", "status", "notes", "checklist_json", "active", "scholarship_json", "source_url", "updated_at"];
    const rows = [
      ...exportData.progress.map((row) => ["progress", row.scholarshipId, row.status, row.notes, row.checklist, "", "", "", row.updatedAt]),
      ...exportData.tracking.map((row) => ["tracking", row.scholarshipId, "", "", "", row.active, row.scholarship, row.sourceUrl, row.updatedAt]),
      ...exportData.manualEdits.map((row) => ["manual_edit", row.scholarshipId, "", "", "", "", row.patch, "", row.updatedAt]),
    ];
    return new Response([header.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="scholarship-command-center-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "private, no-store" } });
  }
  return new Response(JSON.stringify(exportData, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="scholarship-command-center-${new Date().toISOString().slice(0, 10)}.json"`, "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  const userId = await requestUserId(request);
  if (!userId) return Response.json({ error: "Owner sign-in is required." }, { status: 401 });
  const size = Number(request.headers.get("content-length") || 0);
  if (size > 2_000_000) return Response.json({ error: "Backup is larger than 2 MB." }, { status: 413 });
  try {
    const backup = await request.json() as { format?: string; version?: number; progress?: unknown[]; tracking?: unknown[]; manualEdits?: unknown[] };
    if (backup.format !== "cse-scholarship-command-center-backup" || backup.version !== 1) throw new Error("Unsupported backup format.");
    const progress = Array.isArray(backup.progress) ? backup.progress.slice(0, 500) as Array<Record<string, unknown>> : [];
    const tracking = Array.isArray(backup.tracking) ? backup.tracking.slice(0, 500) as Array<Record<string, unknown>> : [];
    const edits = (Array.isArray(backup.manualEdits) ? backup.manualEdits.slice(0, 500) : []).map((row) => {
      const edit = row as Record<string, unknown>;
      if (typeof edit.scholarshipId !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(edit.scholarshipId)) throw new Error("Invalid scholarship id in manual edit backup.");
      return { scholarshipId: edit.scholarshipId, patch: validateManualPatch(edit.patch) };
    });
    const db = getDb(); const now = new Date().toISOString(); let restored = 0;
    for (const row of progress) {
      if (typeof row.scholarshipId !== "string" || row.scholarshipId.length > 160) continue;
      const values = { userId, scholarshipId: row.scholarshipId, status: typeof row.status === "string" ? row.status.slice(0, 40) : "", notes: typeof row.notes === "string" ? row.notes.slice(0, 20_000) : "", checklistJson: JSON.stringify(row.checklist && typeof row.checklist === "object" ? row.checklist : {}), updatedAt: now };
      await db.insert(userProgress).values(values).onConflictDoUpdate({ target: [userProgress.userId, userProgress.scholarshipId], set: values }); restored += 1;
    }
    for (const row of tracking) {
      if (typeof row.scholarshipId !== "string" || !row.scholarship || typeof row.scholarship !== "object") continue;
      const values = { userId, scholarshipId: row.scholarshipId.slice(0, 160), scholarshipJson: JSON.stringify(row.scholarship), discoveryInput: typeof row.discoveryInput === "string" ? row.discoveryInput.slice(0, 500) : "Imported backup", sourceUrl: typeof row.sourceUrl === "string" ? row.sourceUrl.slice(0, 1500) : "", isActive: row.active !== false, updatedAt: now };
      await db.insert(userScholarshipTracking).values({ ...values, createdAt: now }).onConflictDoUpdate({ target: [userScholarshipTracking.userId, userScholarshipTracking.scholarshipId], set: values }); restored += 1;
    }
    for (const edit of edits) {
      const existing = await getManualEdit(edit.scholarshipId);
      // Backups fill missing overrides; a live owner correction always wins.
      const saved = await saveManualEdit(edit.scholarshipId, userId, { ...edit.patch, ...(existing?.patch ?? {}) }, existing?.revision ?? 0);
      if (!saved) throw new Error("A manual edit changed during restore. Reload and retry the backup.");
      restored += 1;
    }
    return Response.json({ ok: true, restored, message: `Restored ${restored} saved records. Existing manual scholarship corrections were preserved.` });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Backup could not be restored." }, { status: 400 }); }
}
