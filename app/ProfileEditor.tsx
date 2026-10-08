"use client";
import { useState, type FormEvent } from "react";
import ModalLayer from "./ModalLayer";
import { profileFields, type ApplicantProfile } from "../lib/profile-policy";

const labels: Record<keyof ApplicantProfile, string> = {
  country: "Country", degree: "Degree / subject", intake: "Target intakes (any year)", cgpa: "CGPA and scale", graduation: "Graduation / expected graduation",
  ieltsTarget: "IELTS / English result or target", priority: "Funding preference", currentStatus: "Current academic status", preferredFields: "Preferred fields", workExperience: "Work experience",
};

export default function ProfileEditor({ profile, isOwner, onSaved }: { profile: ApplicantProfile; isOwner: boolean; onSaved: (profile: ApplicantProfile) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(profile);
  const [snapshot, setSnapshot] = useState(profile);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(snapshot);

  function close() {
    if (saving || (dirty && !window.confirm("Discard your unsaved profile changes?"))) return;
    setOpen(false);
  }
  async function show() {
    setOpen(true); setLoading(true); setLoaded(false); setMessage("");
    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Profile unavailable.");
      setDraft(payload.profile); setSnapshot(payload.profile); setRevision(payload.revision); setLoaded(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Profile unavailable."); }
    finally { setLoading(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (saving || loading || !loaded || !dirty) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ profile: draft, expectedRevision: revision }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Save failed. Your draft is kept.");
      setDraft(payload.profile); setSnapshot(payload.profile); setRevision(payload.revision); onSaved(payload.profile);
      setMessage("Profile saved securely across devices.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Save failed. Your draft is kept."); }
    finally { setSaving(false); }
  }
  return <>
    <button className="profile-edit-button" type="button" onClick={() => void show()}><span aria-hidden="true">✎</span> Edit my profile</button>
    {open ? <ModalLayer className="profile-layer" onClose={close}>
      <button className="drawer-backdrop" type="button" aria-label="Close profile editor" onClick={close}/>
      <section className="profile-editor-panel" role="dialog" aria-modal="true" aria-labelledby="profile-editor-title">
        <header className="profile-editor-header"><div><p className="eyebrow">YOUR PRIVATE INFORMATION</p><h2 id="profile-editor-title">Edit applicant profile</h2></div><button className="close-button" type="button" aria-label="Close profile editor" onClick={close}>×</button></header>
        <form id="profile-editor-form" className="profile-editor-scroll" onSubmit={save}>
          <p className="profile-editor-help">{isOwner ? "The two authorized administrators share this profile. Invited viewers cannot see it." : "This is your own private profile. It does not reveal the administrators’ information and is not shared with other users."} Profile edits never change account permissions, scholarship facts or saved fit assessments.</p>
          <fieldset disabled={loading || saving || !loaded}><legend className="sr-only">Applicant information</legend><div className="profile-editor-fields">{profileFields.map((key) => <label key={key} htmlFor={`profile-${key}`}><span>{labels[key]}</span><input id={`profile-${key}`} maxLength={500} value={draft[key]} placeholder="Not set" onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}/></label>)}</div></fieldset>
          <p className="profile-editor-message" aria-live="polite">{loading ? "Loading your latest saved profile…" : message}</p>
        </form>
        <footer className="profile-editor-footer"><button className="quiet-button" type="button" onClick={close}>Close</button><button className="save-reminders" type="submit" form="profile-editor-form" disabled={loading || saving || !loaded || !dirty}>{saving ? "Saving…" : "Save profile"}</button></footer>
      </section>
    </ModalLayer> : null}
  </>;
}
