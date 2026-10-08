import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const source = await readFile(new URL("../lib/scholarships.ts", import.meta.url), "utf8");
const urls = [
  ...new Set(
    [...source.matchAll(/https:\/\/[^"\s]+/g)]
      .map((match) => match[0])
      .filter((url) => !url.includes("app.local")),
  ),
];

async function check(url) {
  const headers = {
    "user-agent": "Mozilla/5.0 ScholarshipCommandCenterLinkCheck/1.0",
    accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
  };
  let response;
  try {
    response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 405 || response.status >= 500) {
      response = await fetch(url, {
        method: "GET",
        redirect: "manual",
        headers: { ...headers, range: "bytes=0-2048" },
        signal: AbortSignal.timeout(15_000),
      });
    }
    await response.body?.cancel();
    return { url, status: response.status, finalUrl: response.url, ok: response.status < 500 && response.status !== 404 };
  } catch (error) {
    // A few official university sites reject Node's TLS/client fingerprint while
    // remaining healthy in normal browsers. Confirm those with the system curl.
    try {
      const outputTarget = process.platform === "win32" ? "NUL" : "/dev/null";
      const executable = process.platform === "win32" ? "curl.exe" : "curl";
      const { stdout } = await execFileAsync(executable, [
        "-L",
        "-I",
        "--max-time",
        "30",
        "--silent",
        "--show-error",
        "--write-out",
        "%{http_code}",
        "--output",
        outputTarget,
        url,
      ]);
      const status = Number(stdout.trim().slice(-3));
      return { url, status, finalUrl: url, ok: status > 0 && status < 500 && status !== 404, fallback: "curl" };
    } catch (fallbackError) {
      return {
        url,
        status: "ERR",
        finalUrl: "",
        ok: false,
        error: `${error instanceof Error ? error.message : String(error)}; curl: ${
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        }`,
      };
    }
  }
}

const results = [];
for (let index = 0; index < urls.length; index += 6) {
  results.push(...(await Promise.all(urls.slice(index, index + 6).map(check))));
}

console.table(results.map(({ status, ok, url, finalUrl }) => ({ status, ok, url, finalUrl })));
const failed = results.filter((result) => !result.ok);
console.log(JSON.stringify({ total: results.length, reachable: results.length - failed.length, failed }, null, 2));
if (failed.length) process.exitCode = 1;
