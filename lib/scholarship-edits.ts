import type { Scholarship } from "./scholarships";

export const editableFields = [
  "name", "shortName", "country", "universities", "programme", "areas", "areaLabel",
  "fundingLevel", "fundingCovers", "bangladeshEligibility", "academicRequirements",
  "englishRequirements", "workExperience", "finalYearStudents", "intakes", "opens",
  "deadline", "dateNote", "officialNoticeUrl", "applyUrl", "baseStatus", "fit",
  "fitReason", "nextAction", "notes",
] as const satisfies readonly (keyof Scholarship)[];
export type EditableField = typeof editableFields[number];
export type ScholarshipEdit = {
  scholarshipId: string;
  patch: Partial<Scholarship>;
  revision: number;
  updatedAt: string;
};

const allowed = new Set<string>(editableFields);
const requiredText = new Set(["name", "shortName", "country", "programme", "areaLabel"]);
const choices: Record<string, readonly string[]> = {
  fundingLevel: ["Fully funded", "Major funded", "Programme dependent", "Not verified"],
  baseStatus: ["OPEN", "PREPARING", "WATCHING", "URGENT", "SUBMITTED", "RESULT PENDING", "SELECTED", "CLOSED"],
  fit: ["Strong Target", "Good Target", "Reach", "Currently Ineligible", "Pending Review"],
};

export function validateManualPatch(value: unknown): Partial<Scholarship> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Changes must be an object.");
  const result: Record<string, unknown> = {};
  for (const [key, input] of Object.entries(value)) {
    if (!allowed.has(key)) throw new Error(`The field ${key} cannot be edited.`);
    if (key === "opens" || key === "deadline") {
      if (input === null || input === "") { result[key] = null; continue; }
      if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input) || !Number.isFinite(Date.parse(input)) || new Date(input).toISOString().slice(0, 10) !== input) {
        throw new Error(`${key}: enter a valid date, or clear it for Not announced yet.`);
      }
      result[key] = input;
    } else if (key === "areas" || key === "intakes") {
      if (!Array.isArray(input) || input.length > 40 || input.some((x) => typeof x !== "string" || x.length > 120)) throw new Error(`${key}: use a list of short text values.`);
      result[key] = [...new Set((input as string[]).map((x) => x.trim()).filter(Boolean))];
    } else {
      if (typeof input !== "string" || input.length > (key.endsWith("Url") ? 2000 : 6000)) throw new Error(`${key}: text is missing or too long.`);
      const text = input.trim();
      if (requiredText.has(key) && !text) throw new Error(`${key} cannot be empty.`);
      if (choices[key] && !choices[key].includes(text)) throw new Error(`${key}: select a supported value.`);
      if (key.endsWith("Url") && text) {
        let url: URL;
        try { url = new URL(text); } catch { throw new Error(`${key}: enter a complete HTTPS link.`); }
        if (url.protocol !== "https:" || url.username || url.password || url.port || !url.hostname.includes(".") || /^[\d.]+$/.test(url.hostname) || /(?:^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname)) throw new Error(`${key}: use a public HTTPS link without credentials.`);
      }
      result[key] = text;
    }
  }
  return result as Partial<Scholarship>;
}

export function validateResetFields(value: unknown): EditableField[] {
  if (!Array.isArray(value) || value.some((x) => typeof x !== "string" || !allowed.has(x))) throw new Error("Invalid fields to restore from the source.");
  return [...new Set(value)] as EditableField[];
}

export function nextManualPatch(current: Partial<Scholarship>, changes: Partial<Scholarship>, resetFields: EditableField[]) {
  const next = { ...current, ...changes };
  for (const field of resetFields) delete next[field];
  return next;
}

export function applyManualEdit<T extends { id: string }>(item: T, edits: ScholarshipEdit[]): T {
  const edit = edits.find((row) => row.scholarshipId === item.id);
  return edit ? { ...item, ...edit.patch, id: item.id } : item;
}

export function publicManualPatch(patch: Partial<Scholarship>) {
  const shared = { ...patch };
  delete shared.fit; delete shared.fitReason; delete shared.nextAction; delete shared.notes;
  return shared;
}
