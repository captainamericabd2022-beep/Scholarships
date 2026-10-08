"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Scholarship } from "../lib/scholarships";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function DataPortability({ scholarships }: { scholarships: Scholarship[] }) {
  const [message, setMessage] = useState("Backups merge safely and never delete newer records.");
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [todayKey] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").then((registration) => {
      const worker = registration.active ?? registration.waiting ?? registration.installing;
      worker?.postMessage({ type: "CACHE_PUBLIC_SNAPSHOT", scholarships: scholarships.map(({ id, shortName, country, opens, deadline, officialNoticeUrl }) => ({ id, shortName, country, opens, deadline, officialNoticeUrl })) });
    });
    const capture = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt); };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, [scholarships]);
  const nearest = useMemo(() => scholarships.filter((item) => item.deadline && item.deadline >= todayKey).sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)))[0], [scholarships, todayKey]);
  const googleEnd = nearest?.deadline ? new Date(`${nearest.deadline}T00:00:00Z`).getTime() + 86_400_000 : 0;
  const googleEndKey = googleEnd ? new Date(googleEnd).toISOString().slice(0, 10).replaceAll("-", "") : "";
  const googleUrl = nearest?.deadline ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${nearest.shortName} application deadline`)}&dates=${nearest.deadline.replaceAll("-", "")}/${googleEndKey}&details=${encodeURIComponent(`Closing time is not announced in the structured record. Verify the official deadline time: ${nearest.officialNoticeUrl}`)}&ctz=Asia%2FDhaka` : "https://calendar.google.com/calendar/";
  async function restore(file?: File) {
    if (!file) return;
    setMessage("Validating and merging backup…");
    try {
      const response = await fetch("/api/transfer", { method: "POST", headers: { "content-type": "application/json" }, body: await file.text() });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Restore failed.");
      setMessage(`${payload.message} Reloading…`); window.setTimeout(() => window.location.reload(), 700);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Restore failed."); }
  }
  return <article className="panel data-tools-panel">
    <div className="section-heading compact"><div><p className="eyebrow">CALENDAR · BACKUP · MOBILE</p><h2>Portable command center</h2></div><span className="verified-badge">OWNER ONLY</span></div>
    <div className="data-tool-grid">
      <a className="data-tool" href="/api/calendar"><strong>Download calendar</strong><span>All confirmed dates · ICS · Asia/Dhaka</span></a>
      <a className="data-tool" href={googleUrl} target="_blank" rel="noreferrer"><strong>Add nearest to Google Calendar</strong><span>{nearest?.shortName ?? "Open Google Calendar"}</span></a>
      <a className="data-tool" href="/api/transfer?format=json"><strong>JSON backup</strong><span>Scholarships, notes and checklists</span></a>
      <a className="data-tool" href="/api/transfer?format=csv"><strong>CSV export</strong><span>Portable spreadsheet copy</span></a>
      <button className="data-tool" type="button" onClick={() => input.current?.click()}><strong>Restore backup</strong><span>Safe merge import</span></button>
      <button className="data-tool" type="button" disabled={!installPrompt} onClick={async () => { if (!installPrompt) return; await installPrompt.prompt(); setInstallPrompt(null); }}><strong>Install mobile app</strong><span>{installPrompt ? "Open full-screen from your home screen" : "Use browser menu → Install app"}</span></button>
    </div>
    <input ref={input} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void restore(event.target.files?.[0])}/>
    <p className="data-tool-message" aria-live="polite">{message}</p>
  </article>;
}
