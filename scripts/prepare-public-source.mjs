// Remove personal assessments from the seed data before publishing a source copy.
// This script changes only the containing export folder, never the original site.
import { readFile, writeFile } from "node:fs/promises";
import ts from "typescript";

const target = new URL("../lib/scholarships.ts", import.meta.url);
const text = await readFile(target, "utf8");
const source = ts.createSourceFile("scholarships.ts", text, ts.ScriptTarget.Latest, true);
const neutral = {
  fit: "Pending Review",
  fitReason: "Compare the current official criteria with your own profile before assessing fit.",
  nextAction: "Check the official notice and update your application plan.",
  notes: "",
};
const replacements = [];
let scholarshipsFound = 0;
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "scholarships" && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
    for (const item of node.initializer.elements) {
      if (!ts.isObjectLiteralExpression(item)) continue;
      scholarshipsFound += 1;
      for (const property of item.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const name = property.name.getText(source).replace(/^["']|["']$/g, "");
        if (Object.hasOwn(neutral, name)) replacements.push({ start: property.initializer.getStart(source), end: property.initializer.end, value: JSON.stringify(neutral[name]) });
      }
    }
  }
  ts.forEachChild(node, visit);
}
visit(source);
if (scholarshipsFound !== 18 || replacements.length !== scholarshipsFound * 4) throw new Error("Unexpected seed structure; no source was changed.");
let updated = text;
for (const change of replacements.sort((a, b) => b.start - a.start)) updated = updated.slice(0, change.start) + change.value + updated.slice(change.end);
await writeFile(target, updated);
console.log(`Prepared ${scholarshipsFound} public scholarship seeds without private assessments.`);
