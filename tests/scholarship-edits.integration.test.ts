import test from "node:test";
import assert from "node:assert/strict";

const origin = process.env.CSE_TEST_ORIGIN;
test("local D1 editor: durable save, concurrent edit safety, privacy, exports and reset", { skip: !origin }, async () => {
  assert.ok(origin && ["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Integration writes are restricted to local test storage.");
  const call = (path: string, method = "GET", body?: unknown, headers = {}) => fetch(`${origin}${path}`, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const name = `Editor integration fixture ${Date.now()}`;
  const created = await (await call("/api/scholarships", "POST", { name })).json();
  assert.ok(created.scholarship?.id, JSON.stringify(created));
  const id = created.scholarship.id;
  const viewer = `editor-test-${Date.now()}@example.com`;
  try {
    const progress = { scholarshipId: id, status: "PREPARING", notes: "Local private application note", checklist: { Passport: "Ready", IELTS: "In progress" } };
    assert.equal((await call("/api/progress", "POST", progress)).status, 200);
    const input = { scholarshipId: id, expectedRevision: 0, patch: { shortName: "Edited integration fixture", programme: "Computer science test programme", deadline: "2035-01-15", opens: "2034-10-01", intakes: ["2035", "2036"], areas: ["AI", "New field"], fit: "Reach", fitReason: "Private fit detail", nextAction: "Private action", notes: "Private source note" } };
    const saved = await call("/api/scholarship-edits", "PATCH", input);
    assert.equal(saved.status, 200, await saved.clone().text());
    assert.equal((await saved.json()).edit.revision, 1);
    assert.equal((await call("/api/scholarship-edits", "PATCH", input)).status, 409);
    assert.equal((await call("/api/scholarship-edits", "PATCH", { scholarshipId: id, expectedRevision: 1, patch: { deadline: "2026-02-30" } })).status, 400);
    assert.equal((await call("/api/scholarship-edits", "PATCH", { scholarshipId: id, expectedRevision: 1, patch: { opens: "2036-01-01" } })).status, 400);
    const data = await (await call("/api/dashboard")).json();
    assert.equal(data.manualEdits.find((row: { scholarshipId: string }) => row.scholarshipId === id).patch.deadline, "2035-01-15");
    const savedProgress = data.progress.find((row: { scholarshipId: string }) => row.scholarshipId === id);
    assert.equal(savedProgress.notes, progress.notes); assert.deepEqual(savedProgress.checklist, progress.checklist);
    assert.equal(data.tracking.find((row: { scholarshipId: string }) => row.scholarshipId === id).scholarship.deadline, null, "Manual entry did not overwrite source facts.");
    assert.equal(data.changes.some((row: { scholarshipId: string }) => row.scholarshipId === id), false, "Manual entry was not logged as official verification.");
    assert.match(await (await call("/api/calendar")).text(), /20350115/);
    const backup = await (await call("/api/transfer")).json();
    assert.ok(backup.manualEdits.some((row: { scholarshipId: string }) => row.scholarshipId === id));
    assert.match(await (await call("/api/transfer?format=csv")).text(), /manual_edit/);
    const duplicate = await (await call("/api/scholarships", "POST", { name: "Edited integration fixture" })).json();
    assert.equal(duplicate.duplicate, true);
    assert.equal((await call("/api/admin/viewers", "POST", { email: viewer })).status, 200);
    const viewerHeaders = { "oai-authenticated-user-id": "editor-test-viewer", "oai-authenticated-user-email": viewer };
    assert.equal((await call("/api/scholarship-edits", "PATCH", input, viewerHeaders)).status, 403);
    const shared = await (await call("/api/dashboard", "GET", undefined, viewerHeaders)).json();
    assert.equal(shared.role, "viewer"); assert.deepEqual(shared.progress, []);
    const sharedPatch = shared.manualEdits.find((row: { scholarshipId: string }) => row.scholarshipId === id).patch;
    for (const key of ["fit", "fitReason", "notes", "nextAction"]) assert.equal(Object.hasOwn(sharedPatch, key), false);
    assert.equal(sharedPatch.deadline, "2035-01-15");
    const reset = await call("/api/scholarship-edits", "PATCH", { scholarshipId: id, expectedRevision: 1, resetFields: ["deadline"], patch: {} });
    assert.equal(reset.status, 200);
    const resetPatch = (await reset.json()).edit.patch;
    assert.equal(Object.hasOwn(resetPatch, "deadline"), false); assert.equal(resetPatch.shortName, "Edited integration fixture");
    const restore = await call("/api/transfer", "POST", { format: backup.format, version: backup.version, manualEdits: [{ scholarshipId: id, patch: { shortName: "Older backup", fundingCovers: "Backup funding note" } }] });
    assert.equal(restore.status, 200);
    const restored = (await (await call("/api/dashboard")).json()).manualEdits.find((row: { scholarshipId: string }) => row.scholarshipId === id);
    assert.equal(restored.patch.shortName, "Edited integration fixture"); assert.equal(restored.patch.fundingCovers, "Backup funding note");
  } finally {
    await call("/api/scholarships", "DELETE", { scholarshipId: id });
    await call("/api/admin/viewers", "DELETE", { email: viewer });
  }
});
