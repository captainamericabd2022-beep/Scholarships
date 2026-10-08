import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../db/index";
import { applicantProfiles, backgroundJobs } from "../db/schema";
import { neutralProfile, profileDataKey } from "../lib/profile-policy";
import { readApplicantProfile, saveApplicantProfile } from "../lib/owner-profile";
import { jobHealth, JobBusyError, withJobLease } from "../lib/background-jobs";
import { enableWindowsTransport } from "./windows-fetch.mjs";

enableWindowsTransport();
const db = getDb();
const fixture = `verification-${randomUUID()}`;
const owner = `${fixture}@example.invalid`, viewer = `viewer-${fixture}@example.invalid`;
const sharedKey = profileDataKey(owner, owner, "");
const viewerKey = profileDataKey(viewer, owner, "");
const job = `test:${fixture}`;
try {
  const original = { ...neutralProfile(), cgpa: "Fixture only", country: "বাংলাদেশ", intake: "2032" };
  assert.equal((await saveApplicantProfile(sharedKey, original, 0))?.revision, 1);
  assert.equal(await saveApplicantProfile(sharedKey, original, 0), null);
  assert.deepEqual((await readApplicantProfile(sharedKey)).profile, original);
  assert.deepEqual((await readApplicantProfile(viewerKey)).profile, neutralProfile());
  assert.equal((await saveApplicantProfile(viewerKey, { ...neutralProfile(), degree: "Own private fixture" }, 0))?.revision, 1);
  assert.equal((await readApplicantProfile(sharedKey)).profile.degree, "");
  assert.equal((await saveApplicantProfile(sharedKey, original, 1))?.revision, 2);
  assert.equal(await saveApplicantProfile(sharedKey, original, 1), null);
  let release!: () => void, acquired!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const ready = new Promise<void>((resolve) => { acquired = resolve; });
  const running = withJobLease(job, async () => { acquired(); await held; return { completed: true }; });
  await ready;
  try { await assert.rejects(withJobLease(job, async () => ({ duplicate: true })), JobBusyError); }
  finally { release(); }
  await running;
  assert.equal((await jobHealth(job))?.lastStatus, "success");
  await withJobLease(job, async () => ({ needsAttention: true }));
  assert.equal((await jobHealth(job))?.lastStatus, "completed-with-errors");
  await assert.rejects(withJobLease(job, async () => { throw new Error("Fixture failure"); }), /Fixture failure/);
  assert.equal((await jobHealth(job))?.lastStatus, "failed");
  assert.equal((await jobHealth(job))?.leaseUntil, "");
  await withJobLease(job, async () => ({ recovered: true }));
  console.log("PASS: durable profile persistence, isolated viewer data, stale-save protection, concurrent job exclusion, failure recovery and health history.");
} finally {
  await db.delete(applicantProfiles).where(eq(applicantProfiles.dataKey, sharedKey));
  await db.delete(applicantProfiles).where(eq(applicantProfiles.dataKey, viewerKey));
  await db.delete(backgroundJobs).where(eq(backgroundJobs.name, job));
  console.log("Removed only this run's isolated profile/job verification fixtures; real user data was not edited.");
}
