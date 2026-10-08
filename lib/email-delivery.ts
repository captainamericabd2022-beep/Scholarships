export type DeliveryAttempt = {
  status: "pending" | "sent" | "failed";
  providerId: string;
  error: string;
  attemptedAt: string;
  sentAt: string;
};

export function testEmailRecipient(scope: "owner-only" | "multi-user", owner: string, administrator: string) {
  return (scope === "owner-only" ? owner : administrator).trim().toLowerCase();
}

export function deliveryHistoryRecipients(isAdministrator: boolean, email: string, administrators: string[]) {
  return isAdministrator ? [...new Set(administrators)] : [email];
}

// One digest has several event audit rows. Display the message once while
// keeping every event row intact for deadline/change deduplication.
export function uniqueDeliveryMessages<T extends { recipientEmail: string; providerId: string; attemptedAt: string; subject: string; status: string }>(records: T[]) {
  const seen = new Set<string>();
  return records.filter((record) => {
    const attempt = record.providerId || `${record.attemptedAt}|${record.subject}`;
    const key = `${record.recipientEmail}|${record.status}|${attempt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Persist before sending; only provider acceptance earns `sent`. */
export async function sendWithDeliveryAudit(
  send: () => Promise<string>,
  save: (attempt: DeliveryAttempt) => Promise<void>,
  now = () => new Date().toISOString(),
) {
  const attemptedAt = now();
  await save({ status: "pending", providerId: "", error: "", attemptedAt, sentAt: "" });
  let providerId: string;
  try {
    providerId = await send();
    if (!providerId) throw new Error("Email provider did not return a message ID.");
  } catch (error) {
    await save({ status: "failed", providerId: "", error: error instanceof Error ? error.message.slice(0, 300) : "Email sending failed.", attemptedAt, sentAt: "" });
    throw error;
  }
  await save({ status: "sent", providerId, error: "", attemptedAt, sentAt: now() });
  return providerId;
}
