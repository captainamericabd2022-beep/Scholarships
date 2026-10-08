import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { scholarships } from "../lib/scholarships.ts";

test("every seeded scholarship has a local official-source image with provenance", async () => {
  const brands = JSON.parse(await readFile(new URL("../public/scholarships/branding.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(brands).sort(), scholarships.map((item) => item.id).sort());
  for (const item of scholarships) {
    const brand = brands[item.id];
    assert.match(brand.src, /^\/scholarships\/[a-z-]+\.webp$/);
    assert.equal(new URL(brand.source).protocol, "https:");
    assert.equal(new URL(brand.asset).protocol, "https:");
    assert.equal(new URL(brand.source).hostname, new URL(brand.asset).hostname);
    assert.match(brand.verified, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(brand.label);
    const file = await readFile(new URL(`../public${brand.src}`, import.meta.url));
    assert.equal(file.subarray(0, 4).toString(), "RIFF");
    assert.equal(file.subarray(8, 12).toString(), "WEBP");
    assert.ok(file.length < 100_000, "Small local image avoids external tracking and expensive mobile downloads");
  }
});

test("all dashboard dialogs share focus trapping, background isolation and scroll restoration", async () => {
  const [dashboard, reminders, modal, logos] = await Promise.all(["Dashboard", "ReminderCenter", "ModalLayer", "ScholarshipLogo"].map((name) => readFile(new URL(`../app/${name}.tsx`, import.meta.url), "utf8")));
  assert.match(dashboard, /<ModalLayer className="access-panel-layer"/);
  assert.match(dashboard, /<ModalLayer className="drawer-layer" onClose=\{closeDetails\}/);
  assert.match(reminders, /<ModalLayer className="reminder-layer"/);
  assert.match(modal, /event\.key !== "Tab"/);
  assert.match(modal, /originalInert/);
  assert.match(modal, /window\.scrollTo\(scrollLeft, scrollTop\)/);
  assert.match(logos, /failedSource !== brand\.src/);
  assert.match(logos, /onError=/);
  assert.match(logos, /alt="" aria-hidden="true"/);
  assert.doesNotMatch(logos, /fetch\(|https:\/\/.*(?:favicon|google)/);
});
