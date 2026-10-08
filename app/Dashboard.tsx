"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  ChecklistState,
  Scholarship,
  TrackerStatus,
} from "../lib/scholarships";
import ReminderCenter from "./ReminderCenter";
import DataPortability from "./DataPortability";
import ScholarshipEditor from "./ScholarshipEditor";
import { applyManualEdit, type ScholarshipEdit } from "../lib/scholarship-edits";

const checklistItems = [
  "Passport",
  "IELTS",
  "CV",
  "SOP/Motivation Letter",
  "Transcript",
  "Provisional/Final Certificate",
  "Recommendation Letter 1",
  "Recommendation Letter 2",
  "Research Proposal",
  "Portfolio/GitHub",
  "Application Submitted",
  "Interview",
  "Result",
] as const;

type Progress = {
  scholarshipId: string;
  status: TrackerStatus | "";
  notes: string;
  checklist: Record<string, ChecklistState>;
  updatedAt?: string;
};

type RefreshUpdate = {
  scholarshipId: string;
  patch: Partial<Scholarship>;
  sourceUrl: string;
  verifiedAt: string;
  updatedAt: string;
};

type TrackingRecord = {
  scholarshipId: string;
  scholarship: Partial<Scholarship>;
  discoveryInput: string;
  sourceUrl: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type SourceCheck = {
  scholarshipId: string;
  sourceUrl: string;
  httpStatus: number;
  outcome: string;
  error: string;
  lastCheckedAt: string;
};

type ChangeEntry = {
  id: number;
  scholarshipId: string;
  changeType: string;
  summary: string;
  sourceUrl: string;
  changedAt: string;
  verifiedAt: string;
  fieldChanges?: Array<{ field: string; before: unknown; after: unknown }>;
};

type ReviewEntry = { id: number; scholarshipId: string; sourceUrl: string; reason: string; candidatePatch: Record<string, unknown>; fieldChanges: Array<{ field: string; before: unknown; after: unknown }>; createdAt: string };

type DashboardPayload = {
  role: "owner" | "viewer";
  scholarships: Scholarship[];
  progress: Progress[];
  updates: RefreshUpdate[];
  manualEdits: ScholarshipEdit[];
  tracking: TrackingRecord[];
  sourceChecks: SourceCheck[];
  changes: ChangeEntry[];
  reviews: ReviewEntry[];
  storage: string;
  error?: string;
};

type ViewerRecord = {
  email: string;
  invitedBy: string;
  createdAt: string;
  updatedAt: string;
};

type OwnerProfile = {
  country: string;
  degree: string;
  intake: string;
  cgpa: string;
  graduation: string;
  ieltsTarget: string;
  priority: string;
};

type DisplayScholarship = Scholarship & {
  active: boolean;
  trackingOrigin: "curated" | "personal" | "watch";
};

const statuses: TrackerStatus[] = [
  "OPEN",
  "PREPARING",
  "WATCHING",
  "URGENT",
  "SUBMITTED",
  "RESULT PENDING",
  "SELECTED",
  "CLOSED",
];

const checklistStates: ChecklistState[] = [
  "Not started",
  "In progress",
  "Ready",
  "Not required",
];

const statusMeta: Record<TrackerStatus, { icon: string; label: string }> = {
  OPEN: { icon: "●", label: "OPEN" },
  PREPARING: { icon: "●", label: "PREPARING" },
  WATCHING: { icon: "●", label: "WATCHING" },
  URGENT: { icon: "●", label: "URGENT" },
  SUBMITTED: { icon: "✓", label: "SUBMITTED" },
  "RESULT PENDING": { icon: "●", label: "RESULT PENDING" },
  SELECTED: { icon: "◆", label: "SELECTED" },
  CLOSED: { icon: "●", label: "CLOSED" },
};

function daysUntil(date: string | null, now = new Date()) {
  if (!date) return null;
  const [year, month, day] = date.split("-").map(Number);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.ceil((Date.UTC(year, month - 1, day) - today) / 86_400_000);
}

function dateValue(date: string | null) {
  return date ? Date.parse(`${date}T23:59:59Z`) : Number.POSITIVE_INFINITY;
}

function nextMilestoneValue(item: Scholarship) {
  const dates = [item.opens, item.deadline]
    .filter((date): date is string => Boolean(date))
    .filter((date) => (daysUntil(date) ?? -1) >= 0)
    .map(dateValue);
  return dates.length ? Math.min(...dates) : Number.POSITIVE_INFINITY;
}

function formatDate(date: string | null) {
  if (!date) return "Not announced yet";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function formatCompactDate(date: string | null) {
  if (!date) return "Not announced";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function formatTimestamp(value?: string) {
  const parsed = Date.parse(value ?? "");
  if (!Number.isFinite(parsed)) return "Not checked yet";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(parsed));
}

function countdownLabel(date: string | null) {
  const days = daysUntil(date);
  if (days === null) return "—";
  if (days < 0) return "Closed";
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function defaultProgress(scholarshipId: string): Progress {
  return { scholarshipId, status: "", notes: "", checklist: {} };
}

function dynamicScholarship(id: string, patch: Partial<Scholarship>, verifiedAt: string): DisplayScholarship | null {
  if (!patch.name || !patch.country || !patch.programme || !patch.officialNoticeUrl) return null;
  return {
    id,
    name: patch.name,
    shortName: patch.shortName ?? patch.name,
    country: patch.country,
    universities: patch.universities ?? "See official notice",
    programme: patch.programme,
    areas: patch.areas ?? [],
    areaLabel: patch.areaLabel ?? "Field pending",
    fundingLevel: patch.fundingLevel ?? "Programme dependent",
    fundingCovers: patch.fundingCovers ?? "See the official notice.",
    bangladeshEligibility: patch.bangladeshEligibility ?? "Verify in the official notice.",
    academicRequirements: patch.academicRequirements ?? "Verify in the official notice.",
    englishRequirements: patch.englishRequirements ?? "Verify in the official notice.",
    workExperience: patch.workExperience ?? "Verify in the official notice.",
    finalYearStudents: patch.finalYearStudents ?? "Verify in the official notice.",
    intakes: patch.intakes ?? [],
    opens: patch.opens ?? null,
    deadline: patch.deadline ?? null,
    dateNote: patch.dateNote ?? "New official opportunity; review the source.",
    officialNoticeUrl: patch.officialNoticeUrl,
    applyUrl: patch.applyUrl ?? patch.officialNoticeUrl,
    lastVerified: patch.lastVerified ?? verifiedAt,
    baseStatus: patch.baseStatus ?? "WATCHING",
    fit: patch.fit ?? "Pending Review",
    fitReason: patch.fitReason ?? "Review the official criteria before classifying fit.",
    nextAction: patch.nextAction ?? "Review the official notice.",
    notes: patch.notes ?? "Added by the official-source watch.",
    sourceTag: patch.sourceTag ?? "NEW",
    active: true,
    trackingOrigin: "watch",
  };
}

function mergeScholarships(baselineScholarships: Scholarship[], updates: RefreshUpdate[], tracking: TrackingRecord[]) {
  const trackingById = new Map(tracking.map((item) => [item.scholarshipId, item]));
  const byId = new Map<string, DisplayScholarship>(
    baselineScholarships.map((item) => [
      item.id,
      {
        ...item,
        active: trackingById.get(item.id)?.active ?? true,
        trackingOrigin: "curated" as const,
      },
    ]),
  );
  for (const update of updates) {
    const current = byId.get(update.scholarshipId);
    if (current) {
      byId.set(update.scholarshipId, {
        ...current,
        ...update.patch,
        id: update.scholarshipId,
      });
    } else {
      const item = dynamicScholarship(update.scholarshipId, update.patch, update.verifiedAt);
      if (item) byId.set(update.scholarshipId, item);
    }
  }
  for (const record of tracking) {
    const item = record.scholarship as Scholarship;
    if (!item.id || !item.name) continue;
    byId.set(record.scholarshipId, {
      ...item,
      id: record.scholarshipId,
      active: record.active,
      trackingOrigin: "personal",
    });
  }
  return [...byId.values()];
}

function effectiveStatus(item: Scholarship, progress?: Progress): TrackerStatus {
  if (progress?.status) return progress.status;
  const remaining = daysUntil(item.deadline);
  if (remaining !== null && remaining < 0 && !["SUBMITTED", "RESULT PENDING", "SELECTED"].includes(item.baseStatus)) {
    return "CLOSED";
  }
  if (remaining !== null && remaining >= 0 && remaining < 7 && !["SUBMITTED", "RESULT PENDING", "SELECTED"].includes(item.baseStatus)) {
    return "URGENT";
  }
  return item.baseStatus;
}

function StatusPill({ status }: { status: TrackerStatus }) {
  const meta = statusMeta[status];
  return (
    <span className={`status-pill status-${status.toLowerCase().replaceAll(" ", "-")}`}>
      <span aria-hidden="true">{meta.icon}</span>{meta.label}
    </span>
  );
}

function LinkButton({ href, children, quiet = false }: { href: string; children: ReactNode; quiet?: boolean }) {
  if (!href) return <span className="link-button link-button-disabled">Source pending</span>;
  return (
    <a
      className={quiet ? "link-button link-button-quiet" : "link-button"}
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
    >
      {children} <span aria-hidden="true">↗</span>
    </a>
  );
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="detail-field"><dt>{label}</dt><dd>{children}</dd></div>;
}

export default function Dashboard({
  userEmail,
  userName,
  isOwner,
  profile,
}: {
  userEmail: string;
  userName: string;
  isOwner: boolean;
  profile: OwnerProfile | null;
}) {
  const [baselineScholarships, setBaselineScholarships] = useState<Scholarship[]>([]);
  const [updates, setUpdates] = useState<RefreshUpdate[]>([]);
  const [manualEdits, setManualEdits] = useState<ScholarshipEdit[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const closeEditorGuard = useRef<() => boolean>(() => true);
  const [tracking, setTracking] = useState<TrackingRecord[]>([]);
  const [sourceChecks, setSourceChecks] = useState<SourceCheck[]>([]);
  const [changes, setChanges] = useState<ChangeEntry[]>([]);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [storageState, setStorageState] = useState<"loading" | "connected" | "error">("loading");
  const [storageMessage, setStorageMessage] = useState("Connecting secure storage…");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [query, setQuery] = useState("");
  const [intake, setIntake] = useState("All");
  const [area, setArea] = useState("All");
  const [funding, setFunding] = useState("All");
  const [country, setCountry] = useState("All");
  const [stage, setStage] = useState("All");
  const [fit, setFit] = useState("All");
  const [visibility, setVisibility] = useState("Active");
  const [addInput, setAddInput] = useState("");
  const [addState, setAddState] = useState<"idle" | "checking" | "success" | "error">("idle");
  const [addMessage, setAddMessage] = useState("");
  const [archivedDuplicateId, setArchivedDuplicateId] = useState<string | null>(null);
  const [refreshState, setRefreshState] = useState<"idle" | "checking" | "fresh" | "attention" | "error">("idle");
  const [refreshMessage, setRefreshMessage] = useState("Official-source refresh runs when you visit.");
  const [sourceAttach, setSourceAttach] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [accessOpen, setAccessOpen] = useState(false);
  const [viewers, setViewers] = useState<ViewerRecord[]>([]);
  const [viewerEmail, setViewerEmail] = useState("");
  const [accessMessage, setAccessMessage] = useState("");
  const [accessBusy, setAccessBusy] = useState(false);
  const refreshStarted = useRef(false);
  const progressVersions = useRef<Record<string, number>>({});

  const loadDashboard = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/dashboard", { signal });
    const payload = (await response.json()) as DashboardPayload;
    if (!response.ok) throw new Error(payload.error || "Storage unavailable");
    setBaselineScholarships(payload.scholarships ?? []);
    setProgress(Object.fromEntries(payload.progress.map((item) => [item.scholarshipId, item])));
    setUpdates(payload.updates);
    setManualEdits(payload.manualEdits ?? []);
    setTracking(payload.tracking ?? []);
    setSourceChecks(payload.sourceChecks ?? []);
    setChanges(payload.changes);
    setReviews(payload.reviews ?? []);
    setStorageState("connected");
    setStorageMessage(isOwner ? `${payload.storage} · owner data synced` : "Shared scholarship facts · personal data redacted");
  }, [isOwner]);

  const runAutoRefresh = useCallback(async (force = false) => {
    if (!isOwner) return;
    setRefreshState("checking");
    setRefreshMessage(force ? "Rechecking every connected source…" : "Checking stale official sources…");
    try {
      const response = await fetch("/api/auto-refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force, limit: 30 }),
      });
      const payload = (await response.json()) as {
        checked?: number;
        updated?: number;
        attention?: number;
        failed?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Refresh failed");
      await loadDashboard();
      void fetch("/api/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "dispatch" }),
      }).catch(() => undefined);
      const reviewCount = (payload.attention ?? 0) + (payload.failed ?? 0);
      if (reviewCount) {
        setRefreshState("attention");
        setRefreshMessage(`${payload.checked ?? 0} checked · ${payload.updated ?? 0} date updates · ${reviewCount} need review`);
      } else {
        setRefreshState("fresh");
        setRefreshMessage(`${payload.checked ?? 0} source${payload.checked === 1 ? "" : "s"} checked · no stale dates found`);
      }
    } catch {
      setRefreshState("error");
      setRefreshMessage("Some source checks could not run; saved data remains available.");
    }
  }, [isOwner, loadDashboard]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("scholarship-command-theme");
    const nextTheme = savedTheme === "light" ? "light" : "dark";
    const frame = window.requestAnimationFrame(() => {
      setTheme(nextTheme);
      document.documentElement.dataset.theme = nextTheme;
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      loadDashboard(controller.signal)
        .then(() => {
          if (isOwner && !refreshStarted.current) {
            refreshStarted.current = true;
            void runAutoRefresh(false);
          }
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setStorageState("error");
          setStorageMessage("Secure storage needs attention; changes are temporarily read-only.");
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isOwner, loadDashboard, runAutoRefresh]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!closeEditorGuard.current()) return;
        setSelectedId(null);
        setEditingId(null);
        setAccessOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const sourceScholarships = useMemo(
    () => mergeScholarships(baselineScholarships, updates, tracking),
    [baselineScholarships, tracking, updates],
  );
  const allScholarships = useMemo(() => sourceScholarships.map((item) => applyManualEdit(item, manualEdits)), [sourceScholarships, manualEdits]);
  function updateManualEdit(edit: ScholarshipEdit) {
    setManualEdits((previous) => [...previous.filter((row) => row.scholarshipId !== edit.scholarshipId), edit]);
  }
  function closeDetails() {
    if (!closeEditorGuard.current()) return;
    setSelectedId(null); setEditingId(null); setEditMessage("");
  }
  function cancelEditor() {
    if (closeEditorGuard.current()) setEditingId(null);
  }
  const activeScholarships = useMemo(() => allScholarships.filter((item) => item.active), [allScholarships]);
  const scholarshipById = useMemo(() => new Map(allScholarships.map((item) => [item.id, item])), [allScholarships]);
  const sourceCheckById = useMemo(() => new Map(sourceChecks.map((item) => [item.scholarshipId, item])), [sourceChecks]);

  const filterOptions = useMemo(() => {
    const numeric = new Intl.Collator("en", { numeric: true }).compare;
    return {
      intakes: [...new Set(allScholarships.flatMap((item) => item.intakes).filter(Boolean))].sort(numeric),
      areas: [...new Set(allScholarships.flatMap((item) => item.areas).filter(Boolean))].sort(),
      funding: [...new Set(allScholarships.map((item) => item.fundingLevel))].sort(),
      countries: [...new Set(allScholarships.map((item) => item.country))].sort(),
      fits: [...new Set(allScholarships.map((item) => item.fit))].sort(),
      stages: statuses.filter((status) => allScholarships.some((item) => effectiveStatus(item, progress[item.id]) === status)),
    };
  }, [allScholarships, progress]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allScholarships
      .filter((item) => {
        const text = [item.name, item.country, item.areaLabel, item.programme, item.universities, ...item.areas]
          .join(" ")
          .toLowerCase();
        return (
          (!needle || text.includes(needle)) &&
          (visibility === "All" || (visibility === "Active" ? item.active : !item.active)) &&
          (intake === "All" || item.intakes.includes(intake)) &&
          (area === "All" || item.areas.includes(area)) &&
          (funding === "All" || item.fundingLevel === funding) &&
          (country === "All" || item.country === country) &&
          (fit === "All" || item.fit === fit) &&
          (stage === "All" || effectiveStatus(item, progress[item.id]) === stage)
        );
      })
      .sort((a, b) => {
        const order: Record<TrackerStatus, number> = {
          URGENT: 0, OPEN: 1, PREPARING: 2, WATCHING: 3, SUBMITTED: 4,
          "RESULT PENDING": 5, SELECTED: 6, CLOSED: 7,
        };
        const eligibility = Number(a.fit === "Currently Ineligible") - Number(b.fit === "Currently Ineligible");
        if (eligibility) return eligibility;
        const statusDifference = order[effectiveStatus(a, progress[a.id])] - order[effectiveStatus(b, progress[b.id])];
        return statusDifference || dateValue(a.deadline) - dateValue(b.deadline) || a.name.localeCompare(b.name);
      });
  }, [allScholarships, area, country, fit, funding, intake, progress, query, stage, visibility]);

  const events = useMemo(() => {
    const rows: Array<{ id: string; name: string; kind: "opens" | "deadline"; date: string; days: number; safe: boolean }> = [];
    for (const item of activeScholarships) {
      const status = effectiveStatus(item, progress[item.id]);
      if (item.opens) {
        const days = daysUntil(item.opens);
        if (days !== null && days >= 0 && days <= 365) rows.push({ id: `${item.id}-opens`, name: item.shortName, kind: "opens", date: item.opens, days, safe: ["SUBMITTED", "SELECTED"].includes(status) });
      }
      if (item.deadline) {
        const days = daysUntil(item.deadline);
        if (days !== null && days >= 0) rows.push({ id: `${item.id}-deadline`, name: item.shortName, kind: "deadline", date: item.deadline, days, safe: ["SUBMITTED", "SELECTED"].includes(status) });
      }
    }
    return rows.sort((a, b) => a.days - b.days).slice(0, 9);
  }, [activeScholarships, progress]);

  const nextTarget = useMemo(() => activeScholarships
    .filter((item) => !["Currently Ineligible", "Pending Review"].includes(item.fit))
    .filter((item) => effectiveStatus(item, progress[item.id]) !== "CLOSED")
    .sort((a, b) => nextMilestoneValue(a) - nextMilestoneValue(b))[0], [activeScholarships, progress]);

  const sharedTarget = useMemo(() => activeScholarships
    .filter((item) => effectiveStatus(item, progress[item.id]) !== "CLOSED")
    .sort((a, b) => nextMilestoneValue(a) - nextMilestoneValue(b))[0], [activeScholarships, progress]);
  const missionTarget = isOwner ? nextTarget : sharedTarget;

  const nextTasks = useMemo(() => {
    const tasks: Array<{ priority: "now" | "soon" | "build"; title: string; meta: string }> = [
      { priority: "now", title: "Book IELTS Academic", meta: "Complete language testing early enough to allow a retake before priority deadlines." },
    ];
    const candidates = activeScholarships
      .filter((item) => !["Currently Ineligible", "Pending Review"].includes(item.fit))
      .filter((item) => !["CLOSED", "SUBMITTED", "RESULT PENDING", "SELECTED"].includes(effectiveStatus(item, progress[item.id])))
      .sort((a, b) => dateValue(a.deadline) - dateValue(b.deadline));
    for (const item of candidates) {
      const itemProgress = progress[item.id] ?? defaultProgress(item.id);
      const missing = checklistItems.find((check) => !["Ready", "Not required"].includes(itemProgress.checklist[check] ?? "Not started"));
      const days = daysUntil(item.deadline);
      if (missing && days !== null && days <= 120) tasks.push({ priority: days < 30 ? "now" : "soon", title: `${missing} · ${item.shortName}`, meta: `${countdownLabel(item.deadline)} to deadline · ${item.nextAction}` });
      if (tasks.length >= 5) break;
    }
    if (tasks.length < 5) tasks.push({ priority: "build", title: "Secure two recommenders", meta: "Share your CV, transcript and achievement brief before application season." });
    if (tasks.length < 5) tasks.push({ priority: "build", title: "Build a reusable evidence bank", meta: "Collect project impact, GitHub links, leadership examples and Bangladesh-focused goals." });
    return tasks.slice(0, 5);
  }, [activeScholarships, progress]);

  const kpis = useMemo(() => {
    const current = activeScholarships.map((item) => ({
      status: effectiveStatus(item, progress[item.id]),
      deadlineDays: daysUntil(item.deadline),
      openingDays: daysUntil(item.opens),
    }));
    const ownerKpis = [
      { label: "Applications Open", value: current.filter(({ status }) => ["OPEN", "URGENT"].includes(status)).length, tone: "green" },
      { label: "Opening Soon", value: current.filter(({ openingDays }) => openingDays !== null && openingDays >= 0 && openingDays <= 120).length, tone: "yellow" },
      { label: "Deadline <30 Days", value: current.filter(({ deadlineDays }) => deadlineDays !== null && deadlineDays >= 7 && deadlineDays < 30).length, tone: "orange" },
      { label: "URGENT <7 Days", value: current.filter(({ deadlineDays }) => deadlineDays !== null && deadlineDays >= 0 && deadlineDays < 7).length, tone: "red" },
      { label: "Preparing", value: current.filter(({ status }) => status === "PREPARING").length, tone: "blue" },
      { label: "Submitted", value: current.filter(({ status }) => status === "SUBMITTED").length, tone: "teal" },
      { label: "Results Pending", value: current.filter(({ status }) => status === "RESULT PENDING").length, tone: "purple" },
      { label: "Total Tracked", value: activeScholarships.length, tone: "neutral" },
    ];
    if (isOwner) return ownerKpis;
    return [
      ...ownerKpis.slice(0, 4),
      { label: "Fully Funded", value: activeScholarships.filter((item) => item.fundingLevel === "Fully funded").length, tone: "teal" },
      { label: "Major Funded", value: activeScholarships.filter((item) => item.fundingLevel === "Major funded").length, tone: "purple" },
      { label: "Countries", value: new Set(activeScholarships.map((item) => item.country)).size, tone: "blue" },
      { label: "Total Shared", value: activeScholarships.length, tone: "neutral" },
    ];
  }, [activeScholarships, isOwner, progress]);

  const selected = selectedId ? scholarshipById.get(selectedId) ?? null : null;
  const selectedProgress = selected ? progress[selected.id] ?? defaultProgress(selected.id) : null;
  const selectedCheck = selected ? sourceCheckById.get(selected.id) ?? null : null;

  async function persistProgress(next: Progress) {
    if (storageState === "error") return;
    const requestVersion = (progressVersions.current[next.scholarshipId] ?? 0) + 1;
    progressVersions.current[next.scholarshipId] = requestVersion;
    setProgress((current) => ({ ...current, [next.scholarshipId]: next }));
    setSavingId(next.scholarshipId);
    setSaveMessage("Saving…");
    try {
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      const payload = (await response.json()) as { progress?: Progress; error?: string };
      if (!response.ok || !payload.progress) throw new Error(payload.error || "Save failed");
      if (progressVersions.current[next.scholarshipId] === requestVersion) {
        setProgress((current) => ({ ...current, [next.scholarshipId]: payload.progress as Progress }));
        setSaveMessage("Saved securely");
      } else {
        setSaveMessage("Unsaved changes");
      }
    } catch {
      setSaveMessage("Could not save — try again");
    } finally {
      setSavingId(null);
    }
  }

  async function addScholarship(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!addInput.trim() || addState === "checking") return;
    setAddState("checking");
    setAddMessage("Checking your tracker and researching the source…");
    setArchivedDuplicateId(null);
    try {
      const response = await fetch("/api/scholarships", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: addInput.trim() }),
      });
      const payload = (await response.json()) as {
        duplicate?: boolean;
        active?: boolean;
        scholarshipId?: string;
        scholarship?: Scholarship;
        message?: string;
        warning?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Could not add scholarship");
      if (payload.duplicate) {
        setAddState("success");
        setAddMessage(payload.message ?? "Already tracked.");
        if (payload.active === false && payload.scholarshipId) setArchivedDuplicateId(payload.scholarshipId);
        else if (payload.scholarshipId) setSelectedId(payload.scholarshipId);
        return;
      }
      await loadDashboard();
      setAddInput("");
      setAddState("success");
      setAddMessage(payload.warning ? `${payload.message} Source check note: ${payload.warning}` : payload.message ?? "Scholarship added.");
      if (payload.scholarship?.id) setSelectedId(payload.scholarship.id);
    } catch (error) {
      setAddState("error");
      setAddMessage(error instanceof Error ? error.message : "Could not add scholarship.");
    }
  }

  async function setTrackingActive(scholarshipId: string, active: boolean) {
    const response = await fetch("/api/scholarships", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scholarshipId, active }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(payload.error || "Tracking update failed");
    await loadDashboard();
    setArchivedDuplicateId(null);
    setVisibility(active ? "Active" : "Archived");
  }

  async function removeTracking(scholarshipId: string) {
    if (!window.confirm("Remove this scholarship from active tracking? Its saved progress will remain recoverable in Archived.")) return;
    const response = await fetch("/api/scholarships", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scholarshipId }),
    });
    if (!response.ok) return;
    setSelectedId(null);
    await loadDashboard();
  }

  async function attachOfficialSource() {
    if (!selected || !sourceAttach.trim()) return;
    setSaveMessage("Researching source…");
    try {
      const response = await fetch("/api/scholarships", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scholarshipId: selected.id, sourceUrl: sourceAttach.trim() }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Source could not be attached");
      setSourceAttach("");
      setSaveMessage("Official source connected");
      await loadDashboard();
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Source could not be attached");
    }
  }

  async function loadViewers() {
    if (!isOwner) return;
    const response = await fetch("/api/admin/viewers", { cache: "no-store" });
    const payload = (await response.json()) as { viewers?: ViewerRecord[]; error?: string };
    if (!response.ok) throw new Error(payload.error || "Viewer access is unavailable.");
    setViewers(payload.viewers ?? []);
  }

  async function openAccessAdmin() {
    setAccessOpen(true);
    setAccessMessage("Loading viewer access…");
    try {
      await loadViewers();
      setAccessMessage("Only listed emails can open the redacted shared view.");
    } catch (error) {
      setAccessMessage(error instanceof Error ? error.message : "Viewer access is unavailable.");
    }
  }

  async function addViewer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!viewerEmail.trim() || accessBusy) return;
    setAccessBusy(true);
    setAccessMessage("Allowing viewer…");
    try {
      const response = await fetch("/api/admin/viewers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: viewerEmail.trim() }),
      });
      const payload = (await response.json()) as { viewers?: ViewerRecord[]; email?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Viewer could not be added.");
      setViewers(payload.viewers ?? []);
      setViewerEmail("");
      setAccessMessage(`${payload.email ?? "Viewer"} can now open the shared view.`);
    } catch (error) {
      setAccessMessage(error instanceof Error ? error.message : "Viewer could not be added.");
    } finally {
      setAccessBusy(false);
    }
  }

  async function removeViewer(email: string) {
    if (!window.confirm(`Remove ${email} from dashboard viewing?`)) return;
    setAccessBusy(true);
    setAccessMessage(`Removing ${email}…`);
    try {
      const response = await fetch("/api/admin/viewers", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json()) as { viewers?: ViewerRecord[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Viewer could not be removed.");
      setViewers(payload.viewers ?? []);
      setAccessMessage(`${email} no longer has viewing access.`);
    } catch (error) {
      setAccessMessage(error instanceof Error ? error.message : "Viewer could not be removed.");
    } finally {
      setAccessBusy(false);
    }
  }

  function inviteMailto(email: string) {
    const subject = encodeURIComponent("Your CSE Scholarship Command Center access");
    const body = encodeURIComponent(
      `You can view the shared CSE Scholarship Command Center here:\n\n${window.location.origin}\n\nSign in with the ChatGPT account linked to ${email}. Personal profile, fit assessments, notes and application progress are hidden from viewers.`,
    );
    return `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
  }

  function updateTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("scholarship-command-theme", next);
  }

  function clearFilters() {
    setQuery(""); setIntake("All"); setArea("All"); setFunding("All");
    setCountry("All"); setStage("All"); setFit("All"); setVisibility("Active");
  }

  async function reviewSource(id: number, action: "apply" | "dismiss") {
    const response = await fetch("/api/reviews", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action }) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) { setRefreshMessage(payload.error || "Review action failed."); return; }
    setReviews((current) => current.filter((item) => item.id !== id));
    setRefreshMessage(action === "apply" ? "Verified change applied." : "Review item dismissed without changing scholarship data.");
    await loadDashboard();
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">SC</span>
          <div><p className="eyebrow">{isOwner ? "ANY DEVICE · OWNER CONTROL" : "SHARED VIEW · PERSONAL DATA HIDDEN"}</p><h1>CSE Scholarship Command Center</h1></div>
        </div>
        <div className="topbar-actions">
          {isOwner ? <button className={`sync-button sync-${refreshState}`} type="button" onClick={() => runAutoRefresh(true)} disabled={refreshState === "checking"}>
            <span aria-hidden="true">↻</span>{refreshState === "checking" ? "Checking…" : "Sync sources"}
          </button> : null}
          {isOwner ? <button className="access-admin-button" type="button" onClick={openAccessAdmin}><span aria-hidden="true">◈</span>Manage access</button> : null}
          <ReminderCenter userEmail={userEmail} isOwner={isOwner} scholarships={activeScholarships}/>
          <div className="owner-chip" title={userEmail}>
            <span>{userName.slice(0, 1).toUpperCase()}</span>
            <div><strong>{userName}</strong><small>{isOwner ? "Access administrator" : "Read-only viewer"}</small></div>
          </div>
          <button className="icon-button" type="button" onClick={updateTheme} aria-label="Toggle color theme">{theme === "dark" ? "☀" : "☾"}</button>
          <a className="signout-link" href="/signout-with-chatgpt?return_to=/">Sign out</a>
        </div>
      </header>

      <main>
        <section className="mission-grid" aria-labelledby="mission-title">
          <div className="mission-card">
            <div className="mission-copy">
              <p className="eyebrow" id="mission-title">{isOwner ? "NEXT BEST MOVE" : "SHARED SCHOLARSHIP INTELLIGENCE"}</p>
              {missionTarget ? <>
                <h2>{isOwner ? missionTarget.shortName : "Official scholarship watchlist"}</h2><p>{isOwner ? missionTarget.nextAction : `Next announced milestone: ${missionTarget.shortName}. Personal fit, profile and application progress are excluded from this view.`}</p>
                <div className="mission-meta">{isOwner ? <span>{missionTarget.fit}</span> : <span>Read-only</span>}<span>{missionTarget.deadline && (daysUntil(missionTarget.deadline) ?? -1) >= 0 ? `${countdownLabel(missionTarget.deadline)} to deadline` : missionTarget.opens && (daysUntil(missionTarget.opens) ?? -1) >= 0 ? `Opens in ${countdownLabel(missionTarget.opens)}` : "Date watch active"}</span></div>
              </> : <><h2>Build your next application</h2><p>Add an official scholarship link or name to begin tracking it.</p></>}
            </div>
            <div className="mission-radar" aria-hidden="true">
              <span className="radar-ring radar-ring-one"/><span className="radar-ring radar-ring-two"/><span className="radar-sweep"/>
              <strong>{events[0]?.days ?? "∞"}</strong><small>{events[0] ? "days to milestone" : "source watch"}</small>
            </div>
          </div>
          {isOwner && profile ? <aside className="profile-card" aria-label="Applicant profile">
            <div className="profile-head"><div className="avatar">BD</div><div><strong>{profile.country} · {profile.degree}</strong><span>{profile.intake}</span></div></div>
            <div className="profile-stats">
              <div><span>CGPA</span><strong>{profile.cgpa}</strong></div><div><span>Graduation</span><strong>{profile.graduation}</strong></div>
              <div><span>IELTS target</span><strong>{profile.ieltsTarget}</strong></div><div><span>Priority</span><strong>{profile.priority}</strong></div>
            </div>
            <div className={`source-radar source-${refreshState}`}><span aria-hidden="true">●</span><div><strong>Official-source radar</strong><small>{refreshMessage}</small></div></div>
          </aside> : <aside className="profile-card shared-privacy-card" aria-label="Shared-view privacy"><div className="privacy-mark" aria-hidden="true">◈</div><p className="eyebrow">PRIVACY-PROTECTED VIEW</p><h2>Scholarship facts only</h2><p>CGPA, IELTS target, fit assessments, private notes, checklists and application progress never enter this viewer response.</p><div className="privacy-status"><span aria-hidden="true">●</span>Read-only access for {userEmail}</div></aside>}
        </section>

        {isOwner ? <section className="add-command panel" aria-labelledby="add-scholarship-title">
          <div className="add-command-copy">
            <span className="command-icon" aria-hidden="true">＋</span>
            <div><p className="eyebrow">EXPAND YOUR WATCHLIST</p><h2 id="add-scholarship-title">Add Scholarship tracking</h2><p>Paste an official scholarship page or type its name. The command center checks for duplicates first, then adds it to the same checklist, deadline and source-monitoring system.</p></div>
          </div>
          <form className="add-command-form" onSubmit={addScholarship}>
            <div className="add-input-wrap"><span aria-hidden="true">⌕</span><input value={addInput} onChange={(event) => setAddInput(event.target.value)} placeholder="Official link or scholarship name" aria-label="Official scholarship link or name" /></div>
            <button type="submit" disabled={!addInput.trim() || addState === "checking"}>{addState === "checking" ? "Checking…" : "Track scholarship"}</button>
            <div className={`add-feedback add-${addState}`} aria-live="polite">
              <span>{addMessage || "Name-only entries stay in a research queue until an official source is connected."}</span>
              {archivedDuplicateId ? <button type="button" onClick={() => setTrackingActive(archivedDuplicateId, true)}>Restore tracking</button> : null}
            </div>
          </form>
        </section> : null}

        <section className="kpi-grid" aria-label="Scholarship status overview">
          {kpis.map((kpi) => <article className={`kpi-card kpi-${kpi.tone}`} key={kpi.label}><span className="kpi-dot" aria-hidden="true"/><strong>{kpi.value}</strong><span>{kpi.label}</span></article>)}
        </section>

        <section className="panel tracker-panel" aria-labelledby="tracker-title">
          <div className="section-heading tracker-heading">
            <div><p className="eyebrow">LIVE SHORTLIST</p><h2 id="tracker-title">Scholarship tracker</h2><p>{isOwner ? `${filtered.length} shown · ${activeScholarships.length} active · ${allScholarships.length - activeScholarships.length} archived` : `${filtered.length} shared opportunities · owner profile data excluded`}</p></div>
            <div className="section-actions"><span className={`storage-indicator storage-${storageState}`}><span aria-hidden="true">●</span>{storageMessage}</span><button className="quiet-button" type="button" onClick={clearFilters}>Reset filters</button></div>
          </div>

          <div className={`filter-bar filter-bar-${isOwner ? "owner" : "viewer"}`}>
            <label className="search-field"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search anything" aria-label="Search scholarships" /></label>
            {isOwner ? <label><span>Tracking</span><select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option>Active</option><option>Archived</option><option>All</option></select></label> : null}
            <label><span>Intake</span><select value={intake} onChange={(event) => setIntake(event.target.value)}><option>All</option>{filterOptions.intakes.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Area</span><select value={area} onChange={(event) => setArea(event.target.value)}><option>All</option>{filterOptions.areas.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Funding</span><select value={funding} onChange={(event) => setFunding(event.target.value)}><option>All</option>{filterOptions.funding.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Country</span><select value={country} onChange={(event) => setCountry(event.target.value)}><option>All</option>{filterOptions.countries.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Status</span><select value={stage} onChange={(event) => setStage(event.target.value)}><option>All</option>{filterOptions.stages.map((value) => <option key={value}>{value}</option>)}</select></label>
            {isOwner ? <label><span>My fit</span><select value={fit} onChange={(event) => setFit(event.target.value)}><option>All</option>{filterOptions.fits.map((value) => <option key={value}>{value}</option>)}</select></label> : null}
          </div>

          <div className="table-wrap">
            <table>
              <thead><tr><th>Scholarship</th><th>Country</th><th>Area</th><th>Funding</th><th>Intake</th><th>Opens</th><th>Deadline</th><th>Days Remaining</th>{isOwner ? <th>My Fit</th> : null}<th>Status</th>{isOwner ? <th>Next Action</th> : null}<th>Official Notice</th><th>Apply</th></tr></thead>
              <tbody>{filtered.map((item) => {
                const rowStatus = effectiveStatus(item, progress[item.id]);
                const check = sourceCheckById.get(item.id);
                return <tr className={!item.active ? "row-archived" : ""} key={item.id} onClick={() => setSelectedId(item.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedId(item.id); }} tabIndex={0} role="button" aria-label={`Open ${item.name} details`}>
                  <td data-label="Scholarship"><div className="scholarship-name"><span className={`source-mark source-mark-${check?.outcome ?? "idle"}`}>{item.sourceTag.slice(0, 3).toUpperCase()}</span><div><strong>{item.shortName}</strong><span>{isOwner && item.trackingOrigin === "personal" ? "Added by you · " : ""}{item.programme}</span>{isOwner ? <button className="scholarship-edit-link" type="button" aria-label={`Edit ${item.name}`} onKeyDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setSelectedId(item.id); setEditingId(item.id); setEditMessage(""); }}>✎ Edit scholarship</button> : null}</div></div></td>
                  <td data-label="Country">{item.country}</td><td data-label="Area"><span className="tag">{item.areaLabel}</span></td>
                  <td data-label="Funding"><span className={`funding funding-${item.fundingLevel.toLowerCase().replaceAll(" ", "-")}`}>{item.fundingLevel}</span></td>
                  <td data-label="Intake">{item.intakes.length ? item.intakes.join(" / ") : "Pending"}</td><td data-label="Opens">{formatCompactDate(item.opens)}</td><td data-label="Deadline">{formatCompactDate(item.deadline)}</td>
                  <td data-label="Days Remaining"><strong className="countdown">{countdownLabel(item.deadline)}</strong></td>{isOwner ? <td data-label="My Fit"><span className={`fit fit-${item.fit.toLowerCase().replaceAll(" ", "-")}`}>{item.fit}</span></td> : null}
                  <td data-label="Status"><StatusPill status={rowStatus}/></td>{isOwner ? <td data-label="Next Action"><span className="next-action">{item.nextAction}</span></td> : null}
                  <td data-label="Official Notice"><LinkButton href={item.officialNoticeUrl} quiet>Notice</LinkButton></td><td data-label="Apply"><LinkButton href={item.applyUrl}>Apply</LinkButton></td>
                </tr>;
              })}</tbody>
            </table>
            {!filtered.length ? <div className="empty-table"><strong>No scholarships match these filters.</strong><button type="button" onClick={clearFilters}>Clear all filters</button></div> : null}
          </div>
        </section>

        <section className={`lower-grid ${isOwner ? "" : "lower-grid-shared"}`}>
          {isOwner ? <article className="panel tasks-panel"><div className="section-heading compact"><div><p className="eyebrow">PRIORITY QUEUE</p><h2>What should I do next?</h2></div><span className="auto-label">AUTO-PRIORITISED</span></div><div className="task-list">{nextTasks.map((task, index) => <div className="task-row" key={`${task.title}-${index}`}><span className={`task-rank task-${task.priority}`}>{String(index + 1).padStart(2, "0")}</span><div><strong>{task.title}</strong><p>{task.meta}</p></div></div>)}</div></article> : null}
          <article className="panel deadline-panel"><div className="section-heading compact"><div><p className="eyebrow">DEADLINE CENTER · ASIA/DHAKA</p><h2>Upcoming milestones</h2><p>Closing time: Not announced unless the official source publishes one.</p></div></div><div className="timeline">{events.length ? events.map((event) => { const tone = event.safe ? "safe" : event.kind === "opens" ? "opening" : event.days < 7 ? "urgent" : event.days < 30 ? "near" : "future"; return <div className="timeline-row" key={event.id}><span className={`timeline-dot timeline-${tone}`}/><div><strong>{event.name}</strong><span>{event.kind === "opens" ? "Applications open" : "Application deadline"}</span></div><div className="timeline-date"><strong>{formatCompactDate(event.date)}</strong><span>{event.days === 0 ? "today" : `${event.days}d`}</span></div></div>; }) : <p className="empty-copy">No announced milestones in the next year.</p>}</div><div className="deadline-legend"><span><i className="legend-red"/>&lt;7 days</span><span><i className="legend-orange"/>&lt;30 days</span><span><i className="legend-yellow"/>opening</span><span><i className="legend-green"/>prepared</span></div></article>
          <article className="panel changes-panel"><div className="section-heading compact"><div><p className="eyebrow">SOURCE INTELLIGENCE</p><h2>New this week</h2></div><span className="verified-badge">OFFICIAL ONLY</span></div>{reviews.length ? <div className="review-queue"><h3>Owner review queue · {reviews.length}</h3>{reviews.map((review) => <div className="review-card" key={review.id}><strong>{review.fieldChanges?.map((change) => `${change.field}: ${String(change.before ?? "Not announced")} → ${String(change.after ?? "Not announced")}`).join(" · ") || "Official page changed — manual verification needed"}</strong><p>{review.reason}</p><div><a href={review.sourceUrl} target="_blank" rel="noreferrer">Official source ↗</a>{Object.keys(review.candidatePatch).length ? <button type="button" onClick={() => void reviewSource(review.id, "apply")}>Apply verified values</button> : null}<button type="button" onClick={() => void reviewSource(review.id, "dismiss")}>Dismiss</button></div></div>)}</div> : null}{changes.length ? <div className="changes-list">{changes.map((change) => <a key={change.id} href={change.sourceUrl} target="_blank" rel="noreferrer"><span>{change.changeType.replaceAll("_", " ")}</span><strong>{change.fieldChanges?.length ? change.fieldChanges.map((field) => `${field.field}: ${String(field.before ?? "Not announced")} → ${String(field.after ?? "Not announced")}`).join(" · ") : change.summary}</strong><small>Official source · verified {formatDate(change.verifiedAt)} ↗</small></a>)}</div> : !reviews.length ? <div className="no-changes"><span aria-hidden="true">✓</span><strong>No meaningful changes this week</strong><p>Quiet weeks stay quiet. Verified before/after changes appear here with their official source.</p></div> : null}</article>
          {isOwner ? <DataPortability scholarships={activeScholarships}/> : null}
        </section>

        <footer><span>Automatic date monitoring · official and candidate sources clearly labelled</span><span>{isOwner ? "Owner workspace · progress never overwritten by source refreshes" : "Shared read-only view · personal profile and application data excluded"}</span></footer>
      </main>

      {isOwner && accessOpen ? <div className="access-panel-layer">
        <button className="drawer-backdrop" type="button" aria-label="Close access administration" onClick={() => setAccessOpen(false)}/>
        <aside className="access-panel" role="dialog" aria-modal="true" aria-labelledby="access-title">
          <div className="access-panel-header"><div><p className="eyebrow">OWNER ADMINISTRATION</p><h2 id="access-title">Viewer access</h2><p>Allow a Google-linked ChatGPT email to see scholarship facts. Personal profile and application data remain owner-only.</p></div><button type="button" className="close-button" onClick={() => setAccessOpen(false)} aria-label="Close access administration">×</button></div>
          <form className="viewer-add-form" onSubmit={addViewer}>
            <label><span>Viewer email</span><input type="email" value={viewerEmail} onChange={(event) => setViewerEmail(event.target.value)} placeholder="student@example.com" autoComplete="email"/></label>
            <button type="submit" disabled={accessBusy || !viewerEmail.trim()}>{accessBusy ? "Updating…" : "Allow viewer"}</button>
          </form>
          <p className="access-message" aria-live="polite">{accessMessage}</p>
          <div className="viewer-list">
            {viewers.length ? viewers.map((viewer) => <article key={viewer.email}><div className="viewer-avatar" aria-hidden="true">{viewer.email.slice(0, 1).toUpperCase()}</div><div><strong>{viewer.email}</strong><span>Allowed {formatTimestamp(viewer.updatedAt)}</span></div><div className="viewer-actions"><a href={inviteMailto(viewer.email)}>Email invite</a><button type="button" disabled={accessBusy} onClick={() => removeViewer(viewer.email)}>Remove</button></div></article>) : <div className="empty-viewers"><span aria-hidden="true">◇</span><strong>No viewers allowed yet</strong><p>Add an email above. The invite button opens a prefilled message in your mail app; it does not send automatically.</p></div>}
          </div>
          <footer className="access-panel-footer"><span>Owner</span><strong>{userEmail}</strong><p>Access changes take effect on the viewer’s next page request.</p></footer>
        </aside>
      </div> : null}

      {selected && selectedProgress ? <div className="drawer-layer">
        <button className="drawer-backdrop" type="button" aria-label="Close scholarship details" onClick={closeDetails}/>
        <aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
          <div className="drawer-header"><div><p className="eyebrow">{isOwner ? "APPLICATION WORKSPACE" : "SHARED SCHOLARSHIP DETAILS"}</p><h2 id="drawer-title">{selected.name}</h2><div className="drawer-tags"><span>{selected.country}</span><span>{selected.fundingLevel}</span>{isOwner ? <span>{selected.fit}</span> : null}{isOwner && selected.trackingOrigin === "personal" ? <span>Added by you</span> : null}</div></div><button type="button" className="close-button" onClick={closeDetails} aria-label="Close details">×</button></div>
          <div className="drawer-scroll">
            {isOwner && editingId === selected.id ? <ScholarshipEditor key={selected.id} scholarship={selected} source={sourceScholarships.find((item) => item.id === selected.id)!} edit={manualEdits.find((row) => row.scholarshipId === selected.id)} closeGuardRef={closeEditorGuard} onCancel={cancelEditor} onConflict={updateManualEdit} onSaved={(edit) => { updateManualEdit(edit); setEditingId(null); setEditMessage("Scholarship saved. Your corrections are protected from automatic refreshes."); }}/> : <>
            {isOwner ? <section className="edit-scholarship-banner"><div><strong>Make this scholarship your own</strong><p>Edit facts, dates, links and your private assessment.</p></div><button type="button" className="save-button" disabled={storageState !== "connected"} onClick={() => { setEditingId(selected.id); setEditMessage(""); }}>✎ Edit scholarship</button></section> : null}
            {editMessage ? <p className="editor-saved" role="status">{editMessage}</p> : null}
            {manualEdits.some((row) => row.scholarshipId === selected.id && Object.keys(row.patch).length) ? <p className="manual-notice">Includes owner-edited values · manual corrections are not official verification.{isOwner ? " Open the editor to see protected fields or restore their source values." : " Confirm current requirements on the official notice."}</p> : null}
            {isOwner ? <>
              <section className="drawer-callout"><div><span>My fit</span><strong>{selected.fit}</strong><p>{selected.fitReason}</p></div><div><span>Next action</span><strong>{selected.nextAction}</strong></div></section>
              <section className={`source-check-card source-check-${selectedCheck?.outcome ?? "pending"}`}><div><span className="source-check-dot"/><div><strong>Source monitor</strong><p>{selectedCheck ? `${selectedCheck.outcome.replaceAll("-", " ")} · checked ${formatTimestamp(selectedCheck.lastCheckedAt)}` : selected.officialNoticeUrl ? "Queued for automatic checking" : "Official link required"}</p></div></div><button type="button" onClick={() => runAutoRefresh(true)} disabled={refreshState === "checking"}>Check now</button></section>
              {!selected.officialNoticeUrl && selected.trackingOrigin === "personal" ? <section className="drawer-section"><div className="drawer-section-title"><h3>Connect official source</h3><span>Required for auto-update</span></div><div className="attach-source"><input value={sourceAttach} onChange={(event) => setSourceAttach(event.target.value)} placeholder="https://official-programme-page…"/><button type="button" onClick={attachOfficialSource}>Research link</button></div></section> : null}
              <section className="drawer-section"><div className="drawer-section-title"><h3>Application status</h3><span>{saveMessage}</span></div><label className="status-select-label"><span>Manual status</span><select value={selectedProgress.status || selected.baseStatus} disabled={storageState === "error" || savingId === selected.id || !selected.active} onChange={(event) => persistProgress({ ...selectedProgress, status: event.target.value as TrackerStatus })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label></section>
              <section className="drawer-section"><div className="drawer-section-title"><h3>Document checklist</h3><span>Saved between devices</span></div><div className="checklist-grid">{checklistItems.map((item) => { const state = selectedProgress.checklist[item] ?? "Not started"; return <label className={`checklist-row checklist-${state.toLowerCase().replaceAll(" ", "-")}`} key={item}><span><i/>{item}</span><select value={state} disabled={storageState === "error" || savingId === selected.id || !selected.active} onChange={(event) => persistProgress({ ...selectedProgress, checklist: { ...selectedProgress.checklist, [item]: event.target.value as ChecklistState } })}>{checklistStates.map((value) => <option key={value}>{value}</option>)}</select></label>; })}</div></section>
              <section className="drawer-section"><div className="drawer-section-title"><h3>My private notes</h3><span>Never overwritten by refreshes</span></div><textarea value={selectedProgress.notes} disabled={storageState === "error" || !selected.active} onChange={(event) => { progressVersions.current[selected.id] = (progressVersions.current[selected.id] ?? 0) + 1; setSaveMessage("Unsaved changes"); setProgress((current) => ({ ...current, [selected.id]: { ...selectedProgress, notes: event.target.value } })); }} placeholder="Contacts, essay angles, portal details, interview notes…" rows={5}/><button className="save-button" type="button" disabled={storageState === "error" || savingId === selected.id || !selected.active} onClick={() => persistProgress(progress[selected.id] ?? selectedProgress)}>{savingId === selected.id ? "Saving…" : "Save private notes"}</button></section>
            </> : <section className="viewer-privacy-callout"><span aria-hidden="true">◈</span><div><strong>Personal application data is private</strong><p>This shared response contains no owner profile, fit assessment, checklist, notes or manual application status.</p></div></section>}
            <section className="drawer-section"><div className="drawer-section-title"><h3>Scholarship facts</h3><span>Baseline checked {formatDate(selected.lastVerified)}</span></div><dl className="detail-list"><DetailField label="University / universities">{selected.universities}</DetailField><DetailField label="Master’s programme">{selected.programme}</DetailField><DetailField label="CSE specialisation">{selected.areas.length ? selected.areas.join(" · ") : "Not verified yet"}</DetailField><DetailField label="Funding classification">{selected.fundingLevel}</DetailField><DetailField label="Exactly what funding covers">{selected.fundingCovers}</DetailField><DetailField label="Bangladesh eligibility">{selected.bangladeshEligibility}</DetailField><DetailField label="Academic requirements">{selected.academicRequirements}</DetailField><DetailField label="IELTS / English requirement">{selected.englishRequirements}</DetailField><DetailField label="Work experience">{selected.workExperience}</DetailField><DetailField label="Final-year bachelor students">{selected.finalYearStudents}</DetailField><DetailField label="Intake">{selected.intakes.length ? selected.intakes.join(" / ") : "Not announced yet"}</DetailField><DetailField label="Applications open">{formatDate(selected.opens)}</DetailField><DetailField label="Application deadline">{formatDate(selected.deadline)}</DetailField><DetailField label="Date note">{selected.dateNote}</DetailField>{isOwner ? <DetailField label="Source notes">{selected.notes}</DetailField> : null}</dl><div className="drawer-links"><LinkButton href={selected.officialNoticeUrl} quiet>Official notice</LinkButton><LinkButton href={selected.applyUrl}>Open application</LinkButton></div></section>
            {isOwner ? <section className="tracking-controls">{selected.active ? <><div><strong>Remove tracking</strong><p>Moves this scholarship to Archived while preserving your checklist and notes.</p></div><button className="danger-button" type="button" onClick={() => removeTracking(selected.id)}>Remove</button></> : <><div><strong>Archived scholarship</strong><p>Restore it to active tracking with all saved progress intact.</p></div><button className="restore-button" type="button" onClick={() => setTrackingActive(selected.id, true)}>Restore</button></>}</section> : null}
            </>}
          </div>
        </aside>
      </div> : null}
    </div>
  );
}
