import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { backgroundJobs } from "../db/schema";
export class JobBusyError extends Error {}
export async function withJobLease<T>(name: string, work: () => Promise<T>): Promise<T> {
  const db = getDb(); const token = crypto.randomUUID(); const started = new Date().toISOString();
  const lease = { leaseToken: token, leaseUntil: new Date(Date.now() + 10 * 60_000).toISOString(), lastStartedAt: started, lastStatus: "running", lastError: "" };
  const acquired = await db.insert(backgroundJobs).values({ name, ...lease }).onConflictDoUpdate({ target: backgroundJobs.name, set: lease, setWhere: sql`${backgroundJobs.leaseUntil} < ${started}` }).returning({ name: backgroundJobs.name });
  if (!acquired.length) throw new JobBusyError("A check is already running. It will finish without duplicate work.");
  try {
    const result = await work();
    const attention = result && typeof result === "object" && "needsAttention" in result && result.needsAttention;
    await db.update(backgroundJobs).set({ leaseUntil: "", leaseToken: "", lastCompletedAt: new Date().toISOString(), lastStatus: attention ? "completed-with-errors" : "success", resultJson: JSON.stringify(result), lastError: "" }).where(and(eq(backgroundJobs.name, name), eq(backgroundJobs.leaseToken, token)));
    return result;
  } catch (error) {
    await db.update(backgroundJobs).set({ leaseUntil: "", leaseToken: "", lastCompletedAt: new Date().toISOString(), lastStatus: "failed", lastError: error instanceof Error ? error.message.slice(0, 300) : "Background job failed." }).where(and(eq(backgroundJobs.name, name), eq(backgroundJobs.leaseToken, token)));
    throw error;
  }
}
export async function jobHealth(name: string) { const [row] = await getDb().select().from(backgroundJobs).where(eq(backgroundJobs.name, name)).limit(1); return row; }
