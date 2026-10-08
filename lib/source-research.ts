import type { Scholarship, TrackerStatus } from "./scholarships";

const blockedHosts = [
  "facebook.com",
  "youtube.com",
  "youtu.be",
  "linkedin.com",
  "scholars4dev.com",
  "scholarshipportal.com",
  "mastersportal.com",
  "opportunitiescorners.com",
  "opportunitydesk.org",
];

const establishedOfficialHosts = [
  "fcdo.gov.uk",
  "europa.eu",
  "upf.edu",
  "cybersure-master.eu",
  "master-ediss.eu",
  "ulb.be",
  "studyinkorea.go.kr",
  "mofa.go.kr",
  "stipendiumhungaricum.hu",
  "shed.gov.bd",
  "daad.de",
  "emb-japan.go.jp",
  "studyinjapan.go.jp",
  "fulbrightonline.org",
  "usembassy.gov",
  "iie.org",
  "chevening.org",
  "turkiyeburslari.gov.tr",
  "kaist.ac.kr",
  "stanford.edu",
  "si.se",
  "universityadmissions.se",
  "opintopolku.fi",
];

const monthPattern =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const datePattern = `(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}(?:st|nd|rd|th)?\\s+${monthPattern}\\s+\\d{4}|${monthPattern}\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,)?\\s+\\d{4})`;

export type SourceResearch = {
  title: string;
  text: string;
  contentHash: string;
  httpStatus: number;
  finalUrl: string;
  opens: string | null;
  deadline: string | null;
  confidence: "established-official" | "candidate-official";
  candidates: Partial<Record<MonitoredField, string | string[]>>;
  ambiguousFields: MonitoredField[];
  dateAmbiguities?: Array<"opens" | "deadline">;
  dateEvidence?: { opens: string[]; deadline: string[] };
};

export type MonitoredField =
  | "fundingCovers" | "fundingLevel" | "bangladeshEligibility"
  | "englishRequirements" | "workExperience" | "applyUrl" | "programme" | "areas";

export type FieldChange = { field: keyof Scholarship; before: unknown; after: unknown };

export function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function canonicalUrl(value: string) {
  try {
    const url = new URL(value.trim());
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    }
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    return `${url.protocol}//${url.hostname.toLowerCase()}${path}${url.search}`;
  } catch {
    return "";
  }
}

function hostnameMatches(hostname: string, host: string) {
  return hostname === host || hostname.endsWith(`.${host}`);
}

export function validateSourceUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a complete official https:// link.");
  }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Only secure official https:// links are accepted.");
  }
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ||
    hostname.includes(":")
  ) {
    throw new Error("Local or private-network links cannot be researched.");
  }
  if (blockedHosts.some((host) => hostnameMatches(hostname, host))) {
    throw new Error("Use the official government, university, embassy, or programme page instead.");
  }
  return url;
}

export function isEstablishedOfficialUrl(value: string) {
  try {
    const hostname = validateSourceUrl(value).hostname.toLowerCase();
    return establishedOfficialHosts.some((host) => hostnameMatches(hostname, host));
  } catch {
    return false;
  }
}

function decodeEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
  };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
    if (entity[0] === "#") {
      const hex = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : " ";
    }
    return named[entity.toLowerCase()] ?? " ";
  });
}

function readableText(html: string) {
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function pageTitle(html: string) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1];
  const title = og ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  return decodeEntities(title)
    .replace(/\s+[|–—-]\s+[^|–—-]{2,50}$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function evidenceSentences(text: string, pattern: RegExp) {
  const sentences = text.replace(/(\d)\.(\d)/g, "$1§$2").split(/(?<=[.!?])\s+/).map((sentence) => sentence.replace(/§/g, "."));
  return [...new Set(sentences.filter((sentence) => sentence.length >= 8 && sentence.length <= 320 && pattern.test(sentence)).map((sentence) => sentence.trim()))].slice(0, 4);
}

function applicationLinks(html: string, baseUrl: string) {
  const links: string[] = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = readableText(match[2]);
    if (!/(apply|application portal|start application|submit application)/i.test(label)) continue;
    try {
      const url = new URL(decodeEntities(match[1]), baseUrl);
      if (url.protocol === "https:") links.push(canonicalUrl(url.toString()));
    } catch { /* ignore malformed links */ }
  }
  return [...new Set(links.filter(Boolean))].slice(0, 4);
}

export function extractSourceSignals(html: string, text: string, finalUrl: string, title: string) {
  const candidates: SourceResearch["candidates"] = {};
  const ambiguous = new Set<MonitoredField>();
  const addSentence = (field: MonitoredField, pattern: RegExp) => {
    const values = evidenceSentences(text, pattern);
    if (values.length === 1) candidates[field] = values[0];
    if (values.length > 1) { candidates[field] = values[0]; ambiguous.add(field); }
  };
  addSentence("fundingCovers", /(fully funded|tuition fees?|monthly stipend|living allowance|travel costs?|airfare|insurance)/i);
  const fundingText = String(candidates.fundingCovers ?? "");
  if (/fully funded|full scholarship/i.test(fundingText)) candidates.fundingLevel = "Fully funded";
  else if (/partial scholarship|partially funded/i.test(fundingText)) candidates.fundingLevel = "Partial";
  addSentence("bangladeshEligibility", /(Bangladesh|Bangladeshi).{0,150}(eligible|national|citizen|applicant)|(?:eligible|national|citizen|applicant).{0,150}(Bangladesh|Bangladeshi)/i);
  addSentence("englishRequirements", /(IELTS|TOEFL|English language requirement|proof of English)/i);
  addSentence("workExperience", /(work experience|professional experience|employment experience|no experience required)/i);
  const links = applicationLinks(html, finalUrl);
  if (links.length) candidates.applyUrl = links[0];
  if (links.length > 1) ambiguous.add("applyUrl");
  const fieldText = `${title} ${text.slice(0, 7000)}`;
  const areaRules: Array<[RegExp, string]> = [
    [/artificial intelligence/i, "Artificial Intelligence"], [/machine learning/i, "Machine Learning"],
    [/data science/i, "Data Science"], [/cyber ?security/i, "Cybersecurity"],
    [/computer science/i, "Computer Science"], [/data engineering/i, "Data Engineering"],
    [/software engineering/i, "Software Engineering"],
  ];
  const areas = areaRules.filter(([pattern]) => pattern.test(fieldText)).map(([, label]) => label);
  if (areas.length) candidates.areas = areas;
  if (/(master|msc|m\.sc)/i.test(title) && areas.length) candidates.programme = title.slice(0, 180);
  return { candidates, ambiguousFields: [...ambiguous] };
}

function isoDate(value: string) {
  const cleaned = value.replace(/(\d)(st|nd|rd|th)\b/gi, "$1").replace(/,/g, "");
  const numeric = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dayFirst = cleaned.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i);
  const monthFirst = cleaned.match(/^([a-z]+)\s+(\d{1,2})\s+(\d{4})$/i);
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const year = Number(numeric?.[1] ?? dayFirst?.[3] ?? monthFirst?.[3]);
  const monthName = dayFirst?.[2] ?? monthFirst?.[1] ?? "";
  const month = numeric ? Number(numeric[2]) : months.indexOf(monthName.slice(0, 3).toLowerCase()) + 1;
  const day = Number(numeric?.[3] ?? dayFirst?.[1] ?? monthFirst?.[2]);
  if (!year || month < 1 || month > 12 || !day) return null;
  // Scholarship dates are calendar values, not local-machine midnight instants.
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

export function dateEvidence(text: string, keywords: string, now = new Date()) {
  const patterns = [
    new RegExp(`(?:${keywords})[^.]{0,110}?(${datePattern})`, "gi"),
    new RegExp(`(${datePattern})[^.]{0,70}?(?:${keywords})`, "gi"),
  ];
  const dates = new Set<string>();
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const parsed = isoDate(match[1]);
      if (parsed) dates.add(parsed);
    }
  }
  const today = now;
  const floor = new Date(Date.UTC(today.getUTCFullYear() - 1, 0, 1)).toISOString().slice(0, 10);
  const ceiling = new Date(Date.UTC(today.getUTCFullYear() + 4, 11, 31)).toISOString().slice(0, 10);
  const plausible = [...dates].filter((date) => date >= floor && date <= ceiling).sort();
  // Multiple dates may describe separate rounds, awards or years. Picking the
  // nearest one would invent programme context; require review instead.
  return { date: plausible.length === 1 ? plausible[0] : null, candidates: plausible, ambiguous: plausible.length > 1 };
}

async function hashText(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchPage(url: URL, signal: AbortSignal, redirectCount = 0): Promise<Response> {
  const response = await fetch(url, {
    redirect: "manual",
    headers: {
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
      "user-agent": "CSE-Scholarship-Command-Center/2.0 (+official-source-monitor)",
    },
    signal,
  });
  if (response.status >= 300 && response.status < 400 && redirectCount < 3) {
    const location = response.headers.get("location");
    if (!location) return response;
    const next = validateSourceUrl(new URL(location, url).toString());
    return fetchPage(next, signal, redirectCount + 1);
  }
  return response;
}

export async function researchOfficialPage(value: string): Promise<SourceResearch> {
  const url = validateSourceUrl(value);
  // One bounded budget covers redirects AND the body, not 15s per redirect.
  const response = await fetchPage(url, AbortSignal.timeout(15_000));
  if (!response.ok) throw new Error(`Official page returned HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new Error("The source is not an HTML scholarship page.");
  }
  const html = (await response.text()).slice(0, 1_500_000);
  const text = readableText(html).slice(0, 240_000);
  if (text.length < 80) throw new Error("The official page did not expose enough readable text.");
  const finalUrl = response.url || url.toString();
  const title = pageTitle(html);
  const signals = extractSourceSignals(html, text, finalUrl, title);
  const opening = dateEvidence(text, "applications? (?:open|start|begin)|opening date|application (?:start|opening)|start period|opens on");
  const closing = dateEvidence(text, "application deadline|deadline|closing date|applications? close|apply by|ending period|closes on");
  return {
    title,
    text,
    contentHash: await hashText(text),
    httpStatus: response.status,
    finalUrl,
    opens: opening.date,
    deadline: closing.date,
    dateAmbiguities: [...(opening.ambiguous ? ["opens" as const] : []), ...(closing.ambiguous ? ["deadline" as const] : [])],
    dateEvidence: { opens: opening.candidates, deadline: closing.candidates },
    confidence: isEstablishedOfficialUrl(finalUrl)
      ? "established-official"
      : "candidate-official",
    ...signals,
  };
}

function compactName(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

function stableSuffix(value: string) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 7);
}

export function scholarshipIdFor(value: string) {
  const slug = normalizeForMatch(value).replace(/\s+/g, "-").slice(0, 46) || "scholarship";
  return `custom-${slug}-${stableSuffix(value)}`;
}

export function statusFromDates(opens: string | null, deadline: string | null): TrackerStatus {
  const now = Date.now();
  const openTime = opens ? Date.parse(`${opens}T00:00:00Z`) : null;
  const deadlineTime = deadline ? Date.parse(`${deadline}T23:59:59Z`) : null;
  if (deadlineTime !== null && deadlineTime < now) return "CLOSED";
  if (openTime !== null && openTime > now) return "WATCHING";
  if (deadlineTime !== null && deadlineTime >= now && (openTime === null || openTime <= now)) {
    return "OPEN";
  }
  return "WATCHING";
}

export function buildPendingScholarship(input: {
  name?: string;
  sourceUrl?: string;
  research?: SourceResearch | null;
  verifiedOn: string;
}): Scholarship {
  const sourceUrl = input.sourceUrl ? canonicalUrl(input.sourceUrl) : "";
  const host = sourceUrl ? new URL(sourceUrl).hostname.replace(/^www\./, "") : "PENDING";
  const name = compactName(input.name || input.research?.title || host || "New scholarship");
  const opens = input.research?.opens ?? null;
  const deadline = input.research?.deadline ?? null;
  const years = [...new Set([opens?.slice(0, 4), deadline?.slice(0, 4)].filter(Boolean))] as string[];
  const confident = input.research?.confidence === "established-official";
  return {
    id: scholarshipIdFor(sourceUrl || name),
    name,
    shortName: name.slice(0, 54),
    country: "Not verified",
    universities: "To be verified from the official programme source",
    programme: "Master’s scholarship / programme — research queue",
    areas: [],
    areaLabel: "Field pending",
    fundingLevel: "Not verified",
    fundingCovers: "Not verified yet. Funding is never inferred from the scholarship name alone.",
    bangladeshEligibility: "Not verified yet.",
    academicRequirements: "Not verified yet.",
    englishRequirements: "Not verified yet.",
    workExperience: "Not verified yet.",
    finalYearStudents: "Not verified yet.",
    intakes: years,
    opens,
    deadline,
    dateNote: deadline
      ? "An explicit date was detected on the supplied source; confirm it in the official notice before submitting."
      : sourceUrl
        ? "No explicit current deadline was safely detected. Automatic source checks remain active."
        : "Add the official programme link so automatic source checks can begin.",
    officialNoticeUrl: sourceUrl,
    applyUrl: sourceUrl,
    lastVerified: input.verifiedOn,
    baseStatus: statusFromDates(opens, deadline),
    fit: "Pending Review",
    fitReason: "Profile fit remains unclassified until the official eligibility criteria are verified.",
    nextAction: sourceUrl
      ? "Review the official page and complete any fields still marked not verified."
      : "Attach the official government, university, embassy, or programme link.",
    notes: confident
      ? "Added from an established official-source domain. Detailed eligibility still requires structured review."
      : sourceUrl
        ? "Candidate source added. Confirm that the page belongs to the awarding government, university, embassy, or programme."
        : "Name-only item waiting for an official source link.",
    sourceTag: host.split(".")[0].slice(0, 6).toUpperCase(),
  };
}

export function extractAutomaticPatch(item: Scholarship, research: SourceResearch) {
  const patch: Partial<Scholarship> = {};
  const opens = research.dateAmbiguities?.includes("opens") ? null : research.opens;
  const deadline = research.dateAmbiguities?.includes("deadline") ? null : research.deadline;
  if (opens && opens !== item.opens) patch.opens = opens;
  if (deadline && deadline !== item.deadline) patch.deadline = deadline;
  const nextOpens = opens ?? item.opens;
  const nextDeadline = deadline ?? item.deadline;
  const nextStatus = statusFromDates(nextOpens, nextDeadline);
  if (nextStatus !== item.baseStatus && !["SUBMITTED", "RESULT PENDING", "SELECTED"].includes(item.baseStatus)) {
    patch.baseStatus = nextStatus;
  }
  // Application dates are not enrollment years: an October 2026 deadline can
  // belong to a 2027 intake. Never infer intake years from opening/deadline dates.
  return patch;
}

export function analyzeAutomaticChanges(item: Scholarship, research: SourceResearch) {
  const datePatch = extractAutomaticPatch(item, research);
  const safePatch: Partial<Scholarship> = research.confidence === "established-official" ? datePatch : {};
  const reviewPatch: Partial<Scholarship> = research.confidence === "established-official" ? {} : datePatch;
  for (const [field, value] of Object.entries(research.candidates) as Array<[MonitoredField, string | string[]]>) {
    if (JSON.stringify(item[field]) === JSON.stringify(value)) continue;
    // Official-domain provenance does not establish programme/award context.
    // Heuristic snippets (including IELTS numbers and portal links) require
    // human review before replacing a previously verified, complete fact.
    (reviewPatch as Record<string, unknown>)[field] = value;
  }
  const changesFor = (patch: Partial<Scholarship>): FieldChange[] => Object.entries(patch)
    .filter(([field]) => field !== "baseStatus" && field !== "dateNote" && field !== "intakes")
    .map(([field, after]) => ({ field: field as keyof Scholarship, before: item[field as keyof Scholarship], after }));
  return { safePatch, reviewPatch, safeChanges: changesFor(safePatch), reviewChanges: changesFor(reviewPatch) };
}

export const fieldLabels: Partial<Record<keyof Scholarship, string>> = {
  opens: "Opening date", deadline: "Deadline", fundingCovers: "Funding", fundingLevel: "Funding level",
  bangladeshEligibility: "Bangladesh eligibility", englishRequirements: "IELTS / English",
  workExperience: "Work experience", applyUrl: "Application portal", programme: "Master's programme",
  areas: "CSE programmes",
};

export function fieldChangeSummary(changes: FieldChange[]) {
  const show = (value: unknown) => value === null || value === "" ? "Not announced" : Array.isArray(value) ? value.join(", ") : String(value);
  return changes.slice(0, 4).map((change) => `${fieldLabels[change.field] ?? change.field}: ${show(change.before)} → ${show(change.after)}`).join(" · ");
}
