import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { neonConfig } from "@neondatabase/serverless";

// Local Windows-only fallback. No credentials appear in process arguments.
// Deployed Vercel Functions continue to use ordinary fetch.
export function enableWindowsTransport() {
  if (process.platform !== "win32" || process.env.CSE_WINDOWS_TRANSPORT !== "1") return;
  neonConfig.fetchFunction = async (url, init = {}) => {
    const result = await new Promise((resolve, reject) => {
      const processHandle = spawn("pwsh.exe", ["-NoProfile", "-NonInteractive", "-File", fileURLToPath(new URL("./windows-http.ps1", import.meta.url))], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
      let output = "";
      processHandle.stdout.setEncoding("utf8");
      processHandle.stdout.on("data", (part) => { output += part; });
      processHandle.stderr.on("data", () => {});
      processHandle.on("error", reject);
      processHandle.on("close", (code) => {
        if (code !== 0) return reject(new Error("Local Windows HTTP transport failed."));
        try {
          const response = JSON.parse(output);
          resolve({ status: response.status, body: Buffer.from(response.bodyBase64, "base64").toString("utf8") });
        } catch {
          reject(new Error("Malformed local HTTP response."));
        }
      });
      processHandle.stdin.end(JSON.stringify({ url: String(url), method: init.method || "GET", headers: Object.fromEntries(new Headers(init.headers)), body: init.body || "" }));
    });
    return new Response(result.body, { status: result.status, headers: { "content-type": "application/json" } });
  };
}
