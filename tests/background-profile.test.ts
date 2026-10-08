import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { neutralProfile, profileDataKey, validateProfile } from "../lib/profile-policy";
import { nextWatchWindow, validCronRequest, WATCH_CRON } from "../lib/job-policy";
import { analyzeAutomaticChanges, dateEvidence, type SourceResearch } from "../lib/source-research";
import { scholarships } from "../lib/scholarships";

const owner = "owner@example.com", admin = "admin@example.com";
test("only administrators share a profile; viewers have isolated normalized keys", () => {
  assert.equal(profileDataKey(owner, owner, admin), "owner:owner@example.com");
  assert.equal(profileDataKey("ADMIN@EXAMPLE.COM ", owner, admin), "owner:owner@example.com");
  assert.equal(profileDataKey("Viewer@Example.com ", owner, admin), "profile:viewer@example.com");
  assert.notEqual(profileDataKey("a@example.com", owner, admin), profileDataKey("b@example.com", owner, admin));
  assert.equal(profileDataKey(admin, undefined, admin), "profile:admin@example.com");
});
test("profile edits accept arbitrary intake years, trim text, never edit permissions", () => {
  assert.equal(validateProfile({ ...neutralProfile(), intake: " 2032 / 2033 ", cgpa: " 3.58/4.00 " }).intake, "2032 / 2033");
  assert.throws(() => validateProfile({ ...neutralProfile(), email: owner }), /Unknown profile field/);
  assert.throws(() => validateProfile({ isAdmin: true }), /Unknown profile field/);
  assert.throws(() => validateProfile({ cgpa: 3.58 }), /enter text/);
  assert.throws(() => validateProfile({ country: "x".repeat(501) }), /at most 500/);
  assert.throws(() => validateProfile({ country: "bad\0value" }), /enter text/);
});
test("cron machine authentication fails closed without login, an adequate secret and exact Bearer value", () => {
  const secret = "a".repeat(64);
  const request = (value?: string) => new Request("https://example.com/api/cron/scholarship-watch", { headers: value ? { authorization: value } : {} });
  assert.equal(validCronRequest(request(`Bearer ${secret}`), secret), true);
  assert.equal(validCronRequest(request(), secret), false);
  assert.equal(validCronRequest(request("Bearer undefined"), ""), false);
  assert.equal(validCronRequest(request("Bearer short"), "short"), false);
  assert.equal(validCronRequest(request(`Bearer ${"b".repeat(64)}`), secret), false);
  assert.equal(validCronRequest(request(`Basic ${secret}`), secret), false);
});
test("daily schedule is 09:00 Bangladesh time and advances after the scheduled start", () => {
  assert.equal(WATCH_CRON, "0 3 * * *");
  assert.equal(nextWatchWindow(new Date("2026-10-08T02:59:00Z")), "2026-10-08T03:00:00.000Z");
  assert.equal(nextWatchWindow(new Date("2026-10-08T03:00:00Z")), "2026-10-09T03:00:00.000Z");
  assert.equal(nextWatchWindow(new Date("2026-12-31T23:00:00Z")), "2027-01-01T03:00:00.000Z");
});
test("multiple official deadlines require review rather than a guessed nearest round", () => {
  const now = new Date("2026-10-08T00:00:00Z");
  const single = dateEvidence("Application deadline: 15 January 2027.", "application deadline|deadline", now);
  assert.equal(single.date, "2027-01-15");
  assert.equal(dateEvidence("Deadline: January 15th, 2027.", "deadline", now).date, "2027-01-15");
  const multi = dateEvidence("Round one deadline: 15 January 2027. Round two deadline: 20 March 2027.", "deadline", now);
  assert.equal(multi.date, null);
  assert.equal(multi.ambiguous, true);
  assert.deepEqual(multi.candidates, ["2027-01-15", "2027-03-20"]);
  assert.equal(dateEvidence("Deadline: 2027-02-31.", "deadline", now).date, null);
  const item = { ...scholarships[0], deadline: "2027-04-01" };
  const research: SourceResearch = { title: "Official", text: "", httpStatus: 200, contentHash: "fixture", finalUrl: item.officialNoticeUrl, confidence: "established-official", opens: null, deadline: "2027-01-15", candidates: {}, ambiguousFields: [], dateAmbiguities: ["deadline"] };
  assert.equal(analyzeAutomaticChanges(item, research).safePatch.deadline, undefined);
});
test("only exact cron path bypasses Clerk, with no user-controlled profile target", async () => {
  const [proxy, cron, profile, source, service] = await Promise.all(["proxy.ts", "app/api/cron/scholarship-watch/route.ts", "app/api/profile/route.ts", "lib/source-monitor.ts", "lib/notification-service.ts"].map((path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")));
  assert.match(proxy, /pathname === "\/api\/cron\/scholarship-watch"/);
  assert.match(proxy, /return userMiddleware\(request, event\)/);
  assert.match(cron, /if \(!validCronRequest\(request\)\)/);
  assert.doesNotMatch(cron, /requestIdentity\(|verifiedSession\(/);
  assert.match(profile, /profileDataKey\(identity.email/);
  assert.match(profile, /eq\(viewerAccess.isActive, true\)/);
  assert.match(profile, /saveApplicantProfile\(access.dataKey/);
  assert.doesNotMatch(source, /userProgress|applicantProfiles/);
  assert.match(service, /withJobLease\(`email-dispatch:/);
  assert.match(service, /selectCatchUpEvents\(eligible, sentKeys\)/);
});
test("mobile profile form keeps Close and Save outside scroll content", async () => {
  const component = await readFile(new URL("../app/ProfileEditor.tsx", import.meta.url), "utf8");
  assert.match(component, /<ModalLayer className="profile-layer"/);
  assert.match(component, /aria-label="Close profile editor"/);
  assert.match(component, /<\/form>\s*<footer/);
  assert.match(component, /form="profile-editor-form"/);
  assert.match(component, /expectedRevision: revision/);
});
