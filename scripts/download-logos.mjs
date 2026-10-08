import { readFile, mkdir } from "node:fs/promises";
import sharp from "sharp";
import { neonConfig } from "@neondatabase/serverless";
import { enableWindowsTransport } from "./windows-fetch.mjs";

// Run only when deliberately refreshing the official branding assets.
// Downloaded SVGs are rasterized; the dashboard never embeds remote SVG markup.
enableWindowsTransport();
const brands = JSON.parse(await readFile(new URL("../public/scholarships/branding.json", import.meta.url), "utf8"));
const assets = [...new Map(Object.entries(brands).map(([id, brand]) => [brand.src, { id, ...brand }])).values()];
const selected = process.argv.slice(2).length ? assets.filter(({ id }) => process.argv.slice(2).includes(id)) : assets;
const request = neonConfig.fetchFunction ?? fetch;
await mkdir(new URL("../public/scholarships/", import.meta.url), { recursive: true });
let failures = 0;
for (let offset = 0; offset < selected.length; offset += 4) {
  await Promise.all(selected.slice(offset, offset + 4).map(async (brand) => {
    try {
      if (new URL(brand.asset).protocol !== "https:") throw new Error("Official HTTPS asset required");
      const response = await request(brand.asset, { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > 8_000_000) throw new Error("Asset too large");
      const output = new URL(`../public${brand.src}`, import.meta.url);
      const result = await sharp(buffer).rotate().resize({ width: 384, height: 192, fit: "inside", withoutEnlargement: true }).webp({ lossless: true }).toFile(output.pathname.replace(/^\/([A-Za-z]:)/, "$1"));
      console.log(JSON.stringify({ id: brand.id, status: "saved", width: result.width, height: result.height, bytes: result.size }));
    } catch (error) {
      failures += 1;
      console.log(JSON.stringify({ id: brand.id, status: "failed", reason: error instanceof Error ? error.message : "Asset unavailable" }));
    }
  }));
}
if (failures) process.exitCode = 1;
