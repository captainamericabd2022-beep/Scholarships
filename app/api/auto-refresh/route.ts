import { requestUserId } from "../../../lib/request-auth";
import { refreshOfficialSources } from "../../../lib/source-monitor";
import { JobBusyError } from "../../../lib/background-jobs";
export const maxDuration = 300;
export async function POST(request: Request) {
  const userId = await requestUserId(request);
  if (!userId) return Response.json({ error: "Administrator sign-in is required." }, { status: 401 });
  try {
    const payload = await request.json().catch(() => ({})) as { force?: boolean; limit?: number };
    return Response.json(await refreshOfficialSources(userId, { force: Boolean(payload.force), limit: Math.max(1, Math.min(30, Number(payload.limit) || 24)) }));
  } catch (error) {
    if (error instanceof JobBusyError) return Response.json({ ok: true, busy: true, checked: 0, message: error.message }, { status: 202 });
    console.error("Official source refresh failed");
    return Response.json({ error: error instanceof Error ? error.message : "Source refresh failed." }, { status: 500 });
  }
}
