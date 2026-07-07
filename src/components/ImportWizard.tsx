"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "./Nav";
import { IconClose } from "./Icons";

// ---------------------------------------------------------------------------
// Import wizard: paste a list -> review & match -> done.
// Full-screen sheet on phones, centered card on larger screens.
// ---------------------------------------------------------------------------

type Person = { id: string; name: string; avatarUrl?: string | null; accentColor?: string | null };

type Draft = {
  id: string;
  rawName: string;
  kind: "QUOTE" | "TEXT" | "IMAGE";
  text: string | null;
  context: string | null;
  imageUrl: string | null;
  matchKey: string; // "student:<id>" | "teacher:<id>" | ""
  error?: string;
};

type PendingItem = {
  id: string;
  rawName: string;
  targetType: string;
  kind: string;
  text: string | null;
  imageUrl: string | null;
};

const KIND_LABEL: Record<Draft["kind"], string> = { QUOTE: "Zitat", TEXT: "Notiz", IMAGE: "Bild" };

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripQuotes(value: string) {
  return value.replace(/^["'„“”«»\s]+/, "").replace(/["'„“”«»\s]+$/, "").trim();
}

function splitMatchKey(value: string) {
  const [type, id] = value.split(":");
  return {
    subjectMembershipId: type === "student" ? id : undefined,
    teacherId: type === "teacher" ? id : undefined,
  };
}

// Find the best person for a pasted name: exact full name first, then a
// unique first-name match. Teachers win ties so "Frau Meier" lands right.
function guessMatch(rawName: string, students: Person[], teachers: Person[]): string {
  const wanted = normalizeName(rawName);
  if (!wanted) return "";

  const exactTeacher = teachers.find((t) => normalizeName(t.name) === wanted);
  if (exactTeacher) return `teacher:${exactTeacher.id}`;
  const exactStudent = students.find((s) => normalizeName(s.name) === wanted);
  if (exactStudent) return `student:${exactStudent.id}`;

  const teacherFirst = teachers.filter((t) => normalizeName(t.name.split(" ")[0]) === wanted);
  if (teacherFirst.length === 1) return `teacher:${teacherFirst[0].id}`;
  const studentFirst = students.filter((s) => normalizeName(s.name.split(" ")[0]) === wanted);
  if (studentFirst.length === 1) return `student:${studentFirst[0].id}`;
  return "";
}

// Parse one pasted line. Supported:
//   Name: Inhalt              (simplest — type is auto-detected)
//   Name: "Zitat" (Kontext)   (trailing parenthesis becomes context)
//   Name | Typ | Inhalt | Kontext   (old power format still works)
function parseLine(line: string, index: number, students: Person[], teachers: Person[]): Draft | null {
  const raw = line.trim();
  if (!raw || raw.startsWith("#")) return null;

  let rawName = "";
  let body = "";
  let context: string | null = null;
  let explicitKind: Draft["kind"] | null = null;

  if (raw.includes("|")) {
    const parts = raw.split("|").map((p) => p.trim());
    rawName = parts[0] ?? "";
    if (parts.length >= 3) {
      const typeWord = normalizeName(parts[1] ?? "");
      explicitKind = typeWord.includes("bild") || typeWord.includes("foto")
        ? "IMAGE"
        : typeWord.includes("notiz") || typeWord.includes("note")
          ? "TEXT"
          : "QUOTE";
      body = parts[2] ?? "";
      context = parts[3]?.trim() || null;
    } else {
      body = parts[1] ?? "";
    }
  } else {
    const colon = raw.indexOf(":");
    if (colon > 0 && colon < 60) {
      rawName = raw.slice(0, colon).trim();
      body = raw.slice(colon + 1).trim();
    } else {
      return {
        id: `${index}`,
        rawName: raw.slice(0, 40),
        kind: "QUOTE",
        text: null,
        context: null,
        imageUrl: null,
        matchKey: "",
        error: "Format: Name: Inhalt",
      };
    }
  }

  // trailing "(...)" -> context
  const parens = body.match(/\((.{2,80})\)\s*$/);
  if (parens && !context) {
    context = parens[1].trim();
    body = body.slice(0, parens.index).trim();
  }

  const isUrl = /^https?:\/\/\S+$/i.test(body.trim());
  const kind: Draft["kind"] = explicitKind ?? (isUrl ? "IMAGE" : "QUOTE");
  const text = kind === "IMAGE" ? null : stripQuotes(body);

  return {
    id: `${index}-${rawName}`,
    rawName,
    kind,
    text: text || null,
    context,
    imageUrl: isUrl ? body.trim() : null,
    matchKey: guessMatch(rawName, students, teachers),
    error: !rawName
      ? "Name fehlt"
      : kind === "IMAGE" && !isUrl
        ? "Bild braucht einen Link (https://…)"
        : kind !== "IMAGE" && !text
          ? "Inhalt fehlt"
          : undefined,
  };
}

const SAMPLE = `Isai: "Das wird schon." (vor der Prüfung)
Frau Meier: Morgen gibt es keinen Test
Mia: Hat immer die besten Zusammenfassungen`;

export function ImportWizard({
  classId,
  students,
  onClose,
  onImported,
}: {
  classId: string;
  students: Person[];
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [raw, setRaw] = useState("");
  const [teachers, setTeachers] = useState<Person[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [pendingMatches, setPendingMatches] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState({ imported: 0, open: 0 });

  // lock page scroll behind the sheet
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    (async () => {
      const [teacherData, pendingData] = await Promise.all([
        fetch(`/api/classes/${classId}/teachers`).then((r) => r.json()).catch(() => null),
        fetch(`/api/classes/${classId}/import`).then((r) => r.json()).catch(() => null),
      ]);
      const teacherList: Person[] = (teacherData?.teachers ?? []).map((t: any) => ({
        id: t.id,
        name: t.name,
        avatarUrl: t.avatarUrl,
        accentColor: t.accentColor,
      }));
      setTeachers(teacherList);
      const pendingList: PendingItem[] = pendingData?.pending ?? [];
      setPending(pendingList);
      setPendingMatches(
        Object.fromEntries(pendingList.map((item) => [item.id, guessMatch(item.rawName, students, teacherList)]))
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const parsed = useMemo(
    () => raw.split("\n").map((line, i) => parseLine(line, i, students, teachers)).filter(Boolean) as Draft[],
    [raw, students, teachers]
  );

  function goReview() {
    setError("");
    if (parsed.length === 0) {
      setError("Füge zuerst ein paar Zeilen ein.");
      return;
    }
    setDrafts(parsed);
    setStep(2);
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((current) => current.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  const broken = drafts.filter((d) => d.error).length;
  const matchedCount = drafts.filter((d) => !d.error && d.matchKey).length;
  const openCount = drafts.length - broken - matchedCount;

  async function submitImport() {
    if (busy) return;
    setError("");
    if (broken > 0) {
      setError("Bitte zuerst die rot markierten Einträge korrigieren oder entfernen.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/classes/${classId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: drafts.map((d) => ({
            rawName: d.rawName,
            targetType: d.matchKey.startsWith("teacher:") ? "TEACHER" : "STUDENT",
            kind: d.kind,
            text: d.text,
            context: d.context,
            imageUrl: d.imageUrl,
            ...splitMatchKey(d.matchKey),
          })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Import fehlgeschlagen.");
        return;
      }
      setResult({ imported: data.imported ?? 0, open: data.pending ?? 0 });
      setStep(3);
      onImported();
    } finally {
      setBusy(false);
    }
  }

  async function resolvePending(item: PendingItem) {
    const matchKey = pendingMatches[item.id] || "";
    if (!matchKey || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/classes/${classId}/import`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, ...splitMatchKey(matchKey) }),
      });
      if (res.ok) {
        setPending((current) => current.filter((p) => p.id !== item.id));
        onImported();
      }
    } finally {
      setBusy(false);
    }
  }

  const personFor = (matchKey: string): Person | null => {
    const [type, id] = matchKey.split(":");
    if (type === "student") return students.find((s) => s.id === id) ?? null;
    if (type === "teacher") return teachers.find((t) => t.id === id) ?? null;
    return null;
  };

  const PersonSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select
      className="input min-h-[44px] flex-1 !py-2 !text-base"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Später zuordnen</option>
      <optgroup label="Schüler:innen">
        {students.map((s) => (
          <option key={s.id} value={`student:${s.id}`}>{s.name}</option>
        ))}
      </optgroup>
      {teachers.length > 0 && (
        <optgroup label="Lehrpersonen">
          {teachers.map((t) => (
            <option key={t.id} value={`teacher:${t.id}`}>{t.name}</option>
          ))}
        </optgroup>
      )}
    </select>
  );

  return (
    <div className="fixed inset-0 z-50 bg-ink/45 sm:grid sm:place-items-center sm:p-6" onClick={onClose}>
      <div
        className="flex h-full w-full flex-col overflow-hidden shadow-soft sm:h-auto sm:max-h-[88vh] sm:max-w-xl sm:rounded-[34px] sm:border sm:border-white/60"
        style={{
          background: "linear-gradient(160deg, rgba(253,243,248,0.98), rgba(250,228,242,0.97))",
          animation: "rise-up 360ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center gap-3 border-b border-ink/5 px-5 pb-3 pt-[max(env(safe-area-inset-top),16px)] sm:pt-4">
          <div className="min-w-0 flex-1">
            <p className="section-label">Importieren</p>
            <h2 className="display truncate text-3xl leading-none">
              {step === 1 ? "Liste einfügen" : step === 2 ? "Zuordnen" : "Geschafft!"}
            </h2>
          </div>
          {/* step dots */}
          <div className="flex items-center gap-1.5" aria-hidden>
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`h-2 rounded-full transition-all duration-300 ${s === step ? "w-6 bg-hotpink" : "w-2 bg-ink/15"}`}
              />
            ))}
          </div>
          <button
            onClick={onClose}
            aria-label="Schliessen"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/70 text-ink/50 transition-all duration-150 hover:text-coral active:scale-90"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4" style={{ WebkitOverflowScrolling: "touch" }}>
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm font-bold text-ink/65">
                Eine Zeile pro Eintrag — einfach <span className="font-black text-ink">Name: Inhalt</span>.
                Zitate, Notizen, Bild-Links und Lehrpersonen werden automatisch erkannt.
              </p>
              <textarea
                className="input min-h-[220px] !text-base leading-relaxed"
                placeholder={SAMPLE}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                autoFocus
              />
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setRaw((r) => (r ? `${r}\n${SAMPLE}` : SAMPLE))} className="chip">
                  Beispiel einfügen
                </button>
                {parsed.length > 0 && (
                  <span className="text-xs font-black text-ink/50">{parsed.length} Einträge erkannt</span>
                )}
              </div>

              {pending.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="section-label">Noch offen von früher</p>
                  {pending.map((item) => (
                    <div key={item.id} className="glass-card space-y-2 p-3">
                      <p className="text-sm font-black">{item.rawName}</p>
                      <p className="line-clamp-2 text-xs font-bold text-ink/55">{item.imageUrl || item.text}</p>
                      <div className="flex gap-2">
                        <PersonSelect
                          value={pendingMatches[item.id] || ""}
                          onChange={(v) => setPendingMatches((c) => ({ ...c, [item.id]: v }))}
                        />
                        <button
                          onClick={() => resolvePending(item)}
                          className="btn-primary shrink-0"
                          disabled={busy || !pendingMatches[item.id]}
                        >
                          Posten
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-ink/65">
                <span className="font-black text-ink">{matchedCount}</span> werden direkt gepostet
                {openCount > 0 && <> · <span className="font-black text-ink">{openCount}</span> bleiben offen zum späteren Zuordnen</>}
                {broken > 0 && <> · <span className="font-black text-coral">{broken} fehlerhaft</span></>}
              </p>
              {drafts.map((draft) => {
                const person = personFor(draft.matchKey);
                return (
                  <div
                    key={draft.id}
                    className={`glass-card space-y-2.5 p-3 ${draft.error ? "!border-coral/60" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      {person ? (
                        <Avatar name={person.name} url={person.avatarUrl} accent={person.accentColor} size={30} ring={false} />
                      ) : (
                        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-white/60 text-sm font-black text-ink/40">?</span>
                      )}
                      <PersonSelect value={draft.matchKey} onChange={(v) => updateDraft(draft.id, { matchKey: v })} />
                      <button
                        onClick={() => setDrafts((c) => c.filter((d) => d.id !== draft.id))}
                        aria-label="Eintrag entfernen"
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/30 transition-all duration-150 hover:text-coral active:scale-90"
                      >
                        <IconClose size={16} />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(KIND_LABEL) as Draft["kind"][]).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => updateDraft(draft.id, { kind: k, error: undefined })}
                          className={`tab !px-3 !py-1.5 !text-xs ${draft.kind === k ? "tab-active" : ""}`}
                        >
                          {KIND_LABEL[k]}
                        </button>
                      ))}
                    </div>

                    <p className="break-words text-sm font-bold text-ink/80">
                      {draft.kind === "IMAGE" ? (
                        <span className="break-all text-xs">{draft.imageUrl || "— kein Link —"}</span>
                      ) : (
                        <>„{draft.text}“{draft.context && <span className="text-ink/50"> · {draft.context}</span>}</>
                      )}
                    </p>
                    <p className="text-[11px] font-bold text-ink/45">
                      eingefügt als „{draft.rawName}“{draft.error && <span className="font-black text-coral"> — {draft.error}</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {step === 3 && (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
              <span className="grid h-20 w-20 animate-pop-in place-items-center rounded-full bg-hotpink text-4xl text-white shadow-soft">✓</span>
              <h3 className="display text-4xl">{result.imported} gepostet</h3>
              {result.open > 0 && (
                <p className="max-w-xs text-sm font-bold text-ink/60">
                  {result.open} Einträge sind noch offen — sie tauchen beim nächsten Import unter „Noch offen" auf.
                </p>
              )}
            </div>
          )}
        </div>

        {/* sticky footer actions */}
        <div className="border-t border-ink/5 px-5 pt-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 14px)" }}>
          {error && <p className="mb-2 text-sm font-black text-coral">{error}</p>}
          {step === 1 && (
            <button onClick={goReview} className="btn-accent w-full !py-3" disabled={parsed.length === 0}>
              Weiter — {parsed.length || "keine"} Einträge prüfen
            </button>
          )}
          {step === 2 && (
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="btn-soft flex-1 !py-3" disabled={busy}>
                Zurück
              </button>
              <button onClick={submitImport} className="btn-accent flex-[2] !py-3" disabled={busy || drafts.length === 0}>
                {busy ? "Importiert…" : `${drafts.length} importieren`}
              </button>
            </div>
          )}
          {step === 3 && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setRaw("");
                  setDrafts([]);
                  setStep(1);
                }}
                className="btn-soft flex-1 !py-3"
              >
                Mehr importieren
              </button>
              <button onClick={onClose} className="btn-primary flex-1 !py-3">Fertig</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
