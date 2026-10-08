import { timingSafeEqual } from "node:crypto";
export const WATCH_JOB = "cse-scholarship-watch";
export const WATCH_CRON = "0 3 * * *";
export function validCronRequest(request: Request, secret = process.env.CRON_SECRET) {
  if (!secret || secret.length < 32) return false;
  const supplied = Buffer.from(request.headers.get("authorization") || ""); const expected = Buffer.from(`Bearer ${secret}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
export function nextWatchWindow(now = new Date()) {
  const next = new Date(now); next.setUTCHours(3, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}
