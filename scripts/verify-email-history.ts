import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db/index";
import { notificationDeliveries } from "../db/schema";
import { enableWindowsTransport } from "./windows-fetch.mjs";

// Read-only evidence check. Never print provider credentials or email bodies.
enableWindowsTransport();
const recipient = process.argv[2]?.trim().toLowerCase();
if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error("Supply the administrator test recipient email.");
const records = await getDb().select({ id: notificationDeliveries.id, status: notificationDeliveries.status, providerId: notificationDeliveries.providerId, attemptedAt: notificationDeliveries.attemptedAt, sentAt: notificationDeliveries.sentAt, error: notificationDeliveries.error }).from(notificationDeliveries).where(and(eq(notificationDeliveries.recipientEmail, recipient), eq(notificationDeliveries.eventType, "test"))).orderBy(desc(notificationDeliveries.attemptedAt)).limit(3);
console.log(JSON.stringify(records.map(({ providerId, ...record }) => ({ ...record, hasProviderId: Boolean(providerId) }))));
