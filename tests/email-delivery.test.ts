import test from "node:test";
import assert from "node:assert/strict";
import { deliveryHistoryRecipients, sendWithDeliveryAudit, testEmailRecipient, type DeliveryAttempt } from "../lib/email-delivery.ts";
import { emailProviderStatus, sendReminderEmail } from "../lib/reminders.ts";

test("testing mode targets primary owner, not the signed-in coadmin", () => {
  assert.equal(testEmailRecipient("owner-only", " Owner@example.com ", "admin@example.com"), "owner@example.com");
  assert.equal(testEmailRecipient("multi-user", "owner@example.com", "admin@example.com"), "admin@example.com");
});

test("viewers never receive administrator delivery history", () => {
  const admins = ["owner@example.com", "admin@example.com"];
  assert.deepEqual(deliveryHistoryRecipients(false, "viewer@example.com", admins), ["viewer@example.com"]);
  assert.deepEqual(deliveryHistoryRecipients(true, admins[1], admins), admins);
});

test("accepted test is saved as pending then sent with provider ID", async () => {
  const audit: DeliveryAttempt[] = [];
  assert.equal(await sendWithDeliveryAudit(async () => { assert.equal(audit[0].status, "pending"); return "provider-id"; }, async (record) => { audit.push(record); }), "provider-id");
  assert.deepEqual(audit.map((record) => record.status), ["pending", "sent"]);
  assert.equal(audit[1].providerId, "provider-id");
  assert.ok(audit[1].sentAt);
});

test("provider failure is saved and never claimed as sent", async () => {
  const audit: DeliveryAttempt[] = [];
  await assert.rejects(sendWithDeliveryAudit(async () => { throw new Error("API key rejected"); }, async (record) => { audit.push(record); }), /API key rejected/);
  assert.deepEqual(audit.map((record) => record.status), ["pending", "failed"]);
  assert.equal(audit[1].sentAt, "");
  assert.equal(audit[1].providerId, "");
});

test("audit failure before send prevents unrecorded sending", async () => {
  let sends = 0;
  await assert.rejects(sendWithDeliveryAudit(async () => { sends++; return "provider-id"; }, async () => { throw new Error("Database unavailable"); }), /Database unavailable/);
  assert.equal(sends, 0);
});

test("testing sender never becomes multi-user from flag alone", async () => {
  const previous = { key: process.env.RESEND_API_KEY, from: process.env.REMINDER_FROM_EMAIL, verified: process.env.REMINDER_VERIFIED_DOMAIN };
  try {
    process.env.RESEND_API_KEY = "test-not-a-real-key";
    process.env.REMINDER_FROM_EMAIL = "Scholarships <onboarding@resend.dev>";
    process.env.REMINDER_VERIFIED_DOMAIN = "true";
    assert.equal((await emailProviderStatus()).senderScope, "owner-only");
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => new Response(JSON.stringify({ message: "Restricted recipient" }), { status: 403 });
      await assert.rejects(sendReminderEmail({ to: "owner@example.com", subject: "test", html: "test", text: "test", idempotencyKey: "test" }), /Restricted recipient/);
    } finally { globalThis.fetch = originalFetch; }
  } finally {
    for (const [name, value] of [["RESEND_API_KEY", previous.key], ["REMINDER_FROM_EMAIL", previous.from], ["REMINDER_VERIFIED_DOMAIN", previous.verified]] as const) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
