import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Deployment maintenance only. No secret is printed, passed in argv or saved.
const link = JSON.parse(await readFile(new URL("../.vercel/project.json", import.meta.url), "utf8"));
if (link.projectId !== "prj_qNG9zYtyO9OVNqeFcAaT7bMiCtvg" || link.orgId !== "team_5XcAGkoWZM0OzGL0SGZEmxzS") throw new Error("Unexpected Vercel project; no settings changed.");
const cli = join(process.env.APPDATA || "", "npm", "node_modules", "vercel", "dist", "index.js");
async function run(args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args, "--scope", "acme-5dc5", "--non-interactive"], { cwd: new URL("../", import.meta.url), windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let output = "";
    child.stdout.setEncoding("utf8"); child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", () => {});
    child.on("error", () => reject(new Error("Vercel CLI could not start.")));
    child.on("close", (code) => code === 0 ? resolve(output) : reject(new Error(`Vercel configuration command failed (${code}); no credential output was exposed.`)));
    child.stdin.end(input);
  });
}
const inventory = JSON.parse(await run(["env", "ls", "production", "--format", "json"]));
const rows = inventory.envs ?? inventory;
if (!Array.isArray(rows)) throw new Error("Unexpected environment inventory; nothing changed.");
if (!rows.some((row) => row.key === "CRON_SECRET")) {
  await run(["env", "add", "CRON_SECRET", "production", "--type", "secret", "--yes"], randomBytes(32).toString("hex"));
  console.log("Production machine-authentication secret configured securely.");
} else console.log("Existing production CRON_SECRET preserved.");
if (!rows.some((row) => row.key === "SCHOLARSHIP_CRON_ENABLED")) {
  await run(["env", "add", "SCHOLARSHIP_CRON_ENABLED", "production", "--type", "config", "--yes"], "true");
  console.log("Daily scheduling indicator enabled. Redeploy to activate the configuration.");
} else console.log("Existing scheduling configuration preserved.");
