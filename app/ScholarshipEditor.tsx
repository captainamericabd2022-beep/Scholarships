"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Scholarship } from "../lib/scholarships";
import { editableFields, validateManualPatch, type EditableField, type ScholarshipEdit } from "../lib/scholarship-edits";

type Field = { key: EditableField; label: string; kind?: "textarea" | "date" | "list" | "url"; options?: string[] };
const sections: { title: string; private?: boolean; fields: Field[] }[] = [
  { title: "Programme & destination", fields: [
    { key: "name", label: "Scholarship name" }, { key: "shortName", label: "Short name" },
    { key: "country", label: "Country / countries" }, { key: "universities", label: "University / universities", kind: "textarea" },
    { key: "programme", label: "Master’s programme", kind: "textarea" },
    { key: "areas", label: "Fields (comma-separated)", kind: "list" }, { key: "areaLabel", label: "Short field label" },
  ] },
  { title: "Funding & eligibility", fields: [
    { key: "fundingLevel", label: "Funding classification", options: ["Fully funded", "Major funded", "Programme dependent", "Not verified"] },
    { key: "fundingCovers", label: "Exactly what funding covers", kind: "textarea" },
    { key: "bangladeshEligibility", label: "Bangladesh eligibility", kind: "textarea" },
    { key: "academicRequirements", label: "Academic requirements", kind: "textarea" },
    { key: "englishRequirements", label: "IELTS / English requirements", kind: "textarea" },
    { key: "workExperience", label: "Work-experience requirement", kind: "textarea" },
    { key: "finalYearStudents", label: "Can final-year students apply?", kind: "textarea" },
  ] },
  { title: "Dates & application links", fields: [
    { key: "intakes", label: "Intakes (comma-separated, any year)", kind: "list" },
    { key: "opens", label: "Application opening date", kind: "date" }, { key: "deadline", label: "Application deadline", kind: "date" },
    { key: "dateNote", label: "Date / closing-time notes", kind: "textarea" },
    { key: "officialNoticeUrl", label: "Official notice URL", kind: "url" }, { key: "applyUrl", label: "Application portal URL", kind: "url" },
    { key: "baseStatus", label: "Scholarship status (not your application progress)", options: ["OPEN", "PREPARING", "WATCHING", "URGENT", "SUBMITTED", "RESULT PENDING", "SELECTED", "CLOSED"] },
  ] },
  { title: "Your assessment · only you can see this", private: true, fields: [
    { key: "fit", label: "My fit", options: ["Strong Target", "Good Target", "Reach", "Currently Ineligible", "Pending Review"] },
    { key: "fitReason", label: "Fit reason", kind: "textarea" }, { key: "nextAction", label: "My next action", kind: "textarea" },
    { key: "notes", label: "Private source notes", kind: "textarea" },
  ] },
];

function textValue(value: unknown) { return Array.isArray(value) ? value.join(", ") : String(value ?? ""); }
function initialDraft(item: Scholarship) { return Object.fromEntries(editableFields.map((key) => [key, textValue(item[key])])) as Record<EditableField, string>; }

export default function ScholarshipEditor({ scholarship, source, edit, closeGuardRef, onCancel, onSaved, onConflict }: {
  scholarship: Scholarship;
  source: Scholarship;
  edit?: ScholarshipEdit;
  closeGuardRef: RefObject<() => boolean>;
  onCancel: () => void;
  onSaved: (edit: ScholarshipEdit) => void;
  onConflict: (edit: ScholarshipEdit) => void;
}) {
  // Snapshot the opened revision. Background refresh must not rebase an unsaved draft.
  const [initial] = useState(() => initialDraft(scholarship));
  const [initialEdit] = useState(edit);
  const [sourceSnapshot] = useState(source);
  const [draft, setDraft] = useState(initial);
  const [resetFields, setResetFields] = useState<EditableField[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = resetFields.length > 0 || editableFields.some((key) => draft[key] !== initial[key]);

  useEffect(() => {
    closeGuardRef.current = () => !saving && (!dirty || window.confirm("Discard your unsaved scholarship changes?"));
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => { closeGuardRef.current = () => true; window.removeEventListener("beforeunload", beforeUnload); };
  }, [closeGuardRef, dirty, saving]);

  useEffect(() => {
    formRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    const drawer = formRef.current?.closest<HTMLElement>("[role=dialog]");
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !drawer) return;
      const targets = [...drawer.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]")].filter((el) => el.offsetParent !== null);
      const first = targets[0], last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    drawer?.addEventListener("keydown", trapFocus);
    return () => drawer?.removeEventListener("keydown", trapFocus);
  }, []);

  function restoreField(key: EditableField) {
    setDraft((previous) => ({ ...previous, [key]: textValue(sourceSnapshot[key]) }));
    setResetFields((previous) => [...new Set([...previous, key])]);
    setError("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!dirty || saving) return;
    setSaving(true); setError("");
    try {
      const raw: Record<string, unknown> = {};
      for (const key of editableFields) {
        if (resetFields.includes(key) || draft[key] === initial[key]) continue;
        raw[key] = key === "areas" || key === "intakes" ? draft[key].split(",") : draft[key];
      }
      const patch = validateManualPatch(raw);
      const response = await fetch("/api/scholarship-edits", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ scholarshipId: scholarship.id, patch, resetFields, expectedRevision: initialEdit?.revision ?? 0 }) });
      const result = await response.json();
      if (!response.ok) {
        if (result.currentEdit) onConflict(result.currentEdit);
        throw new Error(result.error || "Could not save. Your draft is still here; please retry.");
      }
      closeGuardRef.current = () => true;
      onSaved(result.edit);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save. Please try again."); }
    finally { setSaving(false); }
  }

  return <form ref={formRef} className="scholarship-editor" onSubmit={save}>
    <div className="editor-intro"><p className="eyebrow">OWNER EDITOR</p><h3>Edit scholarship</h3><p>Changed fields are saved across devices and protected from automatic refreshes. They are labelled as manual, not newly verified facts. Use “Use source value” to resume automatic updates for a field.</p><p>Leave an unannounced date empty. Your application checklist and private application notes stay untouched.</p></div>
    {sections.map((section) => <fieldset key={section.title} disabled={saving} className={section.private ? "editor-section editor-private" : "editor-section"}>
      <legend>{section.title}</legend>
      <div className="editor-fields">{section.fields.map((field) => {
        const pinned = Object.hasOwn(initialEdit?.patch ?? {}, field.key) && !resetFields.includes(field.key);
        return <div className={`editor-field ${field.kind === "textarea" || field.kind === "url" ? "editor-wide" : ""}`} key={field.key}>
          <label htmlFor={`edit-${field.key}`}>{field.label}{pinned ? <span className="manual-badge">Manual</span> : null}</label>
          {field.options ? <select id={`edit-${field.key}`} value={draft[field.key]} onChange={(event) => { setDraft({ ...draft, [field.key]: event.target.value }); setResetFields(resetFields.filter((key) => key !== field.key)); }}>{field.options.map((value) => <option key={value}>{value}</option>)}</select>
            : field.kind === "textarea" ? <textarea id={`edit-${field.key}`} rows={3} maxLength={6000} value={draft[field.key]} onChange={(event) => { setDraft({ ...draft, [field.key]: event.target.value }); setResetFields(resetFields.filter((key) => key !== field.key)); }}/>
            : <input id={`edit-${field.key}`} type={field.kind === "date" ? "date" : field.kind === "url" ? "url" : "text"} maxLength={field.kind === "url" ? 2000 : 6000} value={draft[field.key]} onChange={(event) => { setDraft({ ...draft, [field.key]: event.target.value }); setResetFields(resetFields.filter((key) => key !== field.key)); }}/>
          }
          {field.kind === "date" && !draft[field.key] ? <small>Not announced yet</small> : null}
          {pinned ? <button className="source-reset-button" type="button" onClick={() => restoreField(field.key)}>Use source value</button> : resetFields.includes(field.key) ? <small>Source value will be restored on save.</small> : null}
        </div>;
      })}</div>
    </fieldset>)}
    <div className="editor-actions">
      <p role={error ? "alert" : "status"} className={error ? "editor-error" : "editor-hint"}>{error || (saving ? "Saving to secure storage…" : dirty ? "You have unsaved changes." : "Change a field to begin.")}</p>
      <div><button type="button" className="quiet-button" disabled={saving} onClick={onCancel}>Cancel</button><button type="submit" className="save-button" disabled={saving || !dirty}>{saving ? "Saving…" : "Save scholarship"}</button></div>
    </div>
  </form>;
}
