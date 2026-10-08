"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Scholarship } from "../lib/scholarships";
import { daysUntilDateKey } from "../lib/reminders";

type Preferences = {
  email: string;
  isEnabled: boolean;
  scholarshipChanges: boolean;
  openingReminders: boolean;
  deadlineReminders: boolean;
  deadlineThresholds: number[];
};

type Delivery = {
  subject: string;
  status: string;
  attemptedAt: string;
  sentAt: string;
  error: string;
};

type SettingsPayload = {
  preferences?: Preferences;
  provider?: { configured: boolean; name: string; senderScope?: "owner-only" | "multi-user" };
  health?: { lastAutomaticCheck: string; nextScheduledCheck: string; lastSuccessfulEmail: string; failedDeliveries: number; sourcesRequiringReview: number; monitorStatus: string };
  recentDeliveries?: Delivery[];
  automaticCheck?: string;
  error?: string;
};

const thresholdOptions = [60, 30, 14, 7, 3, 1, 0];

function daysUntil(value: string | null) {
  return daysUntilDateKey(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date)
    : "—";
}

export default function ReminderCenter({
  userEmail,
  isOwner,
  scholarships,
}: {
  userEmail: string;
  isOwner: boolean;
  scholarships: Scholarship[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [provider, setProvider] = useState<{ configured: boolean; name: string; senderScope?: "owner-only" | "multi-user" }>({ configured: false, name: "Email provider" });
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [health, setHealth] = useState<SettingsPayload["health"]>(undefined);

  const upcoming = useMemo(() => scholarships.flatMap((item) => [
    item.opens ? { id: `${item.id}-opens`, name: item.shortName, kind: "opens", date: item.opens, days: daysUntil(item.opens) } : null,
    item.deadline ? { id: `${item.id}-deadline`, name: item.shortName, kind: "deadline", date: item.deadline, days: daysUntil(item.deadline) } : null,
  ]).filter((item): item is NonNullable<typeof item> & { days: number } => Boolean(item && item.days !== null && item.days >= 0 && item.days <= 60))
    .sort((a, b) => a.days - b.days)
    .slice(0, 6), [scholarships]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  async function loadSettings() {
    setLoading(true);
    setMessage("Loading reminder settings…");
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const payload = (await response.json()) as SettingsPayload;
      if (!response.ok || !payload.preferences) throw new Error(payload.error || "Settings unavailable.");
      setPreferences(payload.preferences);
      setProvider(payload.provider ?? { configured: false, name: "Email provider" });
      setDeliveries(payload.recentDeliveries ?? []);
      setHealth(payload.health);
      setMessage(payload.automaticCheck ?? "Reminder settings loaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reminder settings are unavailable.");
    } finally {
      setLoading(false);
    }
  }

  function showPanel() {
    setOpen(true);
    void loadSettings();
  }

  function updatePreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPreferences((current) => current ? { ...current, [key]: value } : current);
  }

  function toggleThreshold(value: number) {
    if (!preferences) return;
    const current = new Set(preferences.deadlineThresholds);
    if (current.has(value)) current.delete(value); else current.add(value);
    updatePreference("deadlineThresholds", [...current].sort((a, b) => b - a));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!preferences || saving) return;
    setSaving(true);
    setMessage("Saving reminder preferences…");
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(preferences),
      });
      const payload = (await response.json()) as SettingsPayload & { ok?: boolean };
      if (!response.ok || !payload.preferences) throw new Error(payload.error || "Preferences could not be saved.");
      setPreferences(payload.preferences);
      setMessage(payload.preferences.isEnabled
        ? "Email reminders are enabled for this address."
        : "Email reminders are paused for this address.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Preferences could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function ownerAction(action: "dispatch" | "test") {
    setSaving(true);
    setMessage(action === "test" ? "Sending a private test email…" : "Checking for unsent reminders…");
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Reminder check failed.");
      const resultMessage = payload.message || "Reminder check complete.";
      await loadSettings();
      setMessage(resultMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reminder check failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className="reminder-button" type="button" onClick={showPanel}>
        <span aria-hidden="true">◷</span>Reminders
      </button>
      {open ? <div className="reminder-layer">
        <button className="drawer-backdrop" type="button" aria-label="Close reminder center" onClick={() => setOpen(false)}/>
        <aside className="reminder-panel" role="dialog" aria-modal="true" aria-labelledby="reminder-title">
          <div className="reminder-panel-header">
            <div><p className="eyebrow">DEADLINE & UPDATE ALERTS</p><h2 id="reminder-title">Reminder center</h2><p>Choose what reaches {userEmail}. Emails contain public scholarship facts only.</p></div>
            <button className="close-button reminder-close-button" type="button" aria-label="Close reminder center" onClick={() => setOpen(false)}><span aria-hidden="true">×</span><b>Close</b></button>
          </div>

          <div className={`provider-banner provider-${provider.configured ? "ready" : "setup"}`}>
            <span aria-hidden="true">{provider.configured ? "●" : "○"}</span>
            <div><strong>{provider.configured ? `${provider.name} connected` : "Email delivery needs connection"}</strong><p>{provider.configured ? "Automatic messages can be delivered and deduplicated." : "Your settings are saved now; messages will not be claimed as sent until an authenticated provider is connected."}</p></div>
          </div>
          {provider.configured && provider.senderScope === "owner-only" ? <div className="sender-domain-notice"><strong>Owner-only test sender</strong><p>Resend’s testing domain can deliver only to the owner. Verify a sending domain and set <code>REMINDER_VERIFIED_DOMAIN=true</code> to enable invited-user delivery.</p><a href="https://resend.com/docs/dashboard/domains/introduction" target="_blank" rel="noreferrer">Set up a verified domain ↗</a></div> : null}

          <section className="reminder-health" aria-label="Reminder health">
            <div className="reminder-section-title"><div><p className="eyebrow">SYSTEM HEALTH</p><h3>Reminder health</h3></div><span className={`health-dot health-${health?.monitorStatus ?? "not-run"}`}>●</span></div>
            <div className="health-grid">
              <div><span>Last automatic check</span><strong>{health?.lastAutomaticCheck ? formatDate(health.lastAutomaticCheck) : "Not run yet"}</strong></div>
              <div><span>Next scheduled check</span><strong>{health?.nextScheduledCheck ? formatDate(health.nextScheduledCheck) : "Watch reconnection pending"}</strong></div>
              <div><span>Last successful email</span><strong>{health?.lastSuccessfulEmail ? formatDate(health.lastSuccessfulEmail) : "None yet"}</strong></div>
              <div><span>Failed deliveries</span><strong>{health?.failedDeliveries ?? 0}</strong></div>
              <div><span>Sources requiring review</span><strong>{health?.sourcesRequiringReview ?? 0}</strong></div>
            </div>
          </section>

          {preferences ? <form className="reminder-settings" onSubmit={save}>
            <label className="master-notification-toggle" htmlFor="reminder-enabled" aria-label="Enable email notifications"><div><strong>Email notifications</strong><span>{preferences.email}</span></div><input id="reminder-enabled" type="checkbox" checked={preferences.isEnabled} onChange={(event) => updatePreference("isEnabled", event.target.checked)}/><i aria-hidden="true"/></label>
            <fieldset disabled={!preferences.isEnabled || loading}>
              <legend>Notify me about</legend>
              <label htmlFor="reminder-changes" aria-label="Notify me about verified information changes"><input id="reminder-changes" type="checkbox" checked={preferences.scholarshipChanges} onChange={(event) => updatePreference("scholarshipChanges", event.target.checked)}/><span><strong>Verified information changes</strong><small>New calls, changed eligibility, funding, dates or application links.</small></span></label>
              <label htmlFor="reminder-openings" aria-label="Notify me about application openings"><input id="reminder-openings" type="checkbox" checked={preferences.openingReminders} onChange={(event) => updatePreference("openingReminders", event.target.checked)}/><span><strong>Application openings</strong><small>Remind me before a confirmed application opening date.</small></span></label>
              <label htmlFor="reminder-deadlines" aria-label="Notify me about application deadlines"><input id="reminder-deadlines" type="checkbox" checked={preferences.deadlineReminders} onChange={(event) => updatePreference("deadlineReminders", event.target.checked)}/><span><strong>Application deadlines</strong><small>Send countdown reminders only once at each selected interval.</small></span></label>
            </fieldset>
            <div className="threshold-settings"><span>Countdown intervals</span><div>{thresholdOptions.map((value) => <label key={value} className={preferences.deadlineThresholds.includes(value) ? "selected" : ""}><input type="checkbox" checked={preferences.deadlineThresholds.includes(value)} onChange={() => toggleThreshold(value)}/>{value === 0 ? "Due day" : `${value}d`}</label>)}</div></div>
            <button className="save-reminders" type="submit" disabled={saving || loading}>{saving ? "Working…" : "Save reminder settings"}</button>
          </form> : <div className="reminder-loading">{loading ? "Loading your preferences…" : "Preferences unavailable."}</div>}

          <p className="reminder-message" aria-live="polite">{message}</p>

          <section className="reminder-preview">
            <div className="reminder-section-title"><div><p className="eyebrow">NEXT 60 DAYS</p><h3>Upcoming reminder moments</h3></div><span>{upcoming.length}</span></div>
            <div>{upcoming.length ? upcoming.map((item) => <article key={item.id}><i className={item.days <= 3 ? "urgent" : item.days <= 7 ? "near" : "future"}/><div><strong>{item.name}</strong><span>{item.kind === "opens" ? "Applications open" : "Deadline"} · {formatDate(item.date)}</span></div><b>{item.days === 0 ? "Today" : `${item.days}d`}</b></article>) : <p className="empty-copy">No confirmed opening or deadline dates in the next 60 days.</p>}</div>
          </section>

          {isOwner ? <section className="reminder-owner-tools"><div><p className="eyebrow">OWNER CONTROLS</p><h3>Delivery check</h3><p>Every owner source refresh checks this queue. Your existing scholarship watch can trigger it by opening the dashboard.</p></div><div><button type="button" disabled={saving} onClick={() => ownerAction("dispatch")}>Check & send now</button><button type="button" disabled={saving} onClick={() => ownerAction("test")}>{provider.configured ? "Send test email" : "Test email setup"}</button></div></section> : null}

          <section className="delivery-history"><div className="reminder-section-title"><div><p className="eyebrow">DELIVERY HISTORY</p><h3>Recent messages</h3></div></div>{deliveries.length ? deliveries.map((delivery, index) => <article key={`${delivery.attemptedAt}-${index}`}><span className={`delivery-status delivery-${delivery.status}`}>{delivery.status}</span><div><strong>{delivery.subject}</strong><small>{formatDate(delivery.sentAt || delivery.attemptedAt)}{delivery.error ? ` · ${delivery.error}` : ""}</small></div></article>) : <p className="empty-copy">No reminder emails have been sent to this address yet.</p>}</section>
        </aside>
      </div> : null}
    </>
  );
}
