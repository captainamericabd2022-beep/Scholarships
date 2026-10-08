// Mechanical favicon rasterization. Keep all formats in sync with the SVG source.
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../public/favicon.svg", import.meta.url));
for (const [name, size] of [["favicon-32.png", 32], ["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512]]) {
  await sharp(source).resize(size, size).png().toFile(fileURLToPath(new URL(`../public/${name}`, import.meta.url)));
}
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((size) => sharp(source).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((data, index) => {
  const start = 6 + index * 16;
  header[start] = sizes[index]; header[start + 1] = sizes[index];
  header.writeUInt16LE(1, start + 4); header.writeUInt16LE(32, start + 6);
  header.writeUInt32LE(data.length, start + 8); header.writeUInt32LE(offset, start + 12);
  offset += data.length;
});
await writeFile(new URL("../public/favicon.ico", import.meta.url), Buffer.concat([header, ...images]));
console.log("Generated SVG-matched ICO, PNG and Apple/PWA icons.");
