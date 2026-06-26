"use client";

import { useMemo, useState } from "react";
import type { Poll } from "./PollCard";

type ClassOption = { id: string; name: string };
type PollMode = "CUSTOM" | "STUDENTS" | "TEACHERS";

export function CreatePoll({
  classes,
  onCreated,
}: {
  classes: ClassOption[];
  onCreated: (poll: Poll) => void;
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<PollMode>("CUSTOM");
  const [options, setOptions] = useState(["", ""]);
  const [anonymous, setAnonymous] = useState(false);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const cleanOptions = useMemo(() => options.map((o) => o.trim()).filter(Boolean), [options]);

  function setOption(index: number, value: string) {
    setOptions((current) => current.map((option, i) => (i === index ? value : option)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    const res = await fetch("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId,
        question,
        description,
        options: mode === "CUSTOM" ? cleanOptions : [],
        candidateType: mode === "CUSTOM" ? null : mode,
        anonymous,
        multipleChoice,
      }),
    });
    const d = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok) {
      onCreated(d.poll);
      setQuestion("");
      setDescription("");
      setMode("CUSTOM");
      setOptions(["", ""]);
      setAnonymous(false);
      setMultipleChoice(false);
    } else {
      setError(d?.error || "Umfrage konnte nicht erstellt werden.");
    }
  }

  return (
    <form onSubmit={submit} className="glass-panel space-y-4 p-4 sm:p-5">
      <div>
        <p className="section-label mb-2">Neue Umfrage</p>
        <input
          className="input text-lg font-black"
          placeholder="Was sollen wir abstimmen?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={180}
          required
        />
      </div>

      {classes.length > 1 && (
        <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)} required>
          {classes.map((klass) => (
            <option key={klass.id} value={klass.id}>{klass.name}</option>
          ))}
        </select>
      )}

      <textarea
        className="input min-h-[82px]"
        placeholder="Beschreibung (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={260}
      />

      <div className="grid gap-2 sm:grid-cols-3">
        {([
          ["CUSTOM", "Antworten", "selber schreiben"],
          ["STUDENTS", "Alle Schüler:innen", "Personen werden beim Abstimmen ergänzt"],
          ["TEACHERS", "Alle Lehrpersonen", "Lehrer:innen werden beim Abstimmen ergänzt"],
        ] as const).map(([value, title, subtitle]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`glass-card p-3 text-left transition ${mode === value ? "border-ink bg-white/55" : "hover:bg-white/35"}`}
          >
            <span className="block text-sm font-black">{title}</span>
            <span className="mt-1 block text-[11px] font-bold text-ink/50">{subtitle}</span>
          </button>
        ))}
      </div>

      {mode === "CUSTOM" ? (
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={index} className="flex gap-2">
              <input
                className="input"
                placeholder={`Antwort ${index + 1}`}
                value={option}
                onChange={(e) => setOption(index, e.target.value)}
                maxLength={120}
                required={index < 2}
              />
              {options.length > 2 && (
                <button type="button" onClick={() => setOptions((current) => current.filter((_, i) => i !== index))} className="btn-soft px-4">
                  ×
                </button>
              )}
            </div>
          ))}
          {options.length < 8 && (
            <button type="button" onClick={() => setOptions((current) => [...current, ""])} className="btn-soft text-sm">
              Antwort hinzufügen
            </button>
          )}
        </div>
      ) : (
        <div className="glass-card p-4 text-sm font-black text-ink/60">
          Die Antwortliste startet leer. Beim Abstimmen wählt man eine Person aus der Klasse aus; sobald sie Stimmen hat, erscheint sie im Rennen. Fällt sie auf 0 Stimmen, verschwindet sie automatisch wieder.
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="glass-card flex cursor-pointer items-center gap-3 p-3 text-sm font-black text-ink/70">
          <input type="checkbox" className="h-4 w-4 accent-hotpink" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
          Stimmen anonym halten
        </label>
        <label className="glass-card flex cursor-pointer items-center gap-3 p-3 text-sm font-black text-ink/70">
          <input type="checkbox" className="h-4 w-4 accent-hotpink" checked={multipleChoice} onChange={(e) => setMultipleChoice(e.target.checked)} />
          Mehrfachauswahl
        </label>
      </div>

      {error && <p className="text-sm font-black text-coral">{error}</p>}
      <button className="btn-accent w-full" disabled={busy || (mode === "CUSTOM" && cleanOptions.length < 2)}>
        {busy ? "Erstellt..." : "Umfrage erstellen"}
      </button>
    </form>
  );
}
