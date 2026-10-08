import { neonConfig } from "@neondatabase/serverless";
import { enableWindowsTransport } from "./windows-fetch.mjs";

// Read-only credential check; never print keys, request headers or response bodies.
enableWindowsTransport();
const key = process.env.RESEND_API_KEY?.trim();
if (!key) { console.log(JSON.stringify({ configured: false, error: "RESEND_API_KEY is absent" })); process.exit(1); }
try {
  const request = neonConfig.fetchFunction ?? fetch;
  const response = await request("https://api.resend.com/domains", { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(45000) });
  const payload = await response.json().catch(() => ({}));
  console.log(JSON.stringify({ status: response.status, credentialsAccepted: response.ok ? true : undefined, sendingOnly: payload.name === "restricted_api_key" ? "Domain inspection is not permitted; verify with an email test." : undefined, error: response.ok ? undefined : payload.name || "Provider check failed", domains: response.ok && Array.isArray(payload.data) ? payload.data.map(({ name, status }) => ({ name, status })) : undefined }));
  if (!response.ok && payload.name !== "restricted_api_key") process.exitCode = 1;
} catch { console.log(JSON.stringify({ error: "Provider could not be reached" })); process.exitCode = 1; }
