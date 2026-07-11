"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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

const SAMPLE = `Isai | Zitat | "Das wird schon." | vor Mathe
Frau Meier | Lehrerzitat | Morgen gibt es keinen Test
Mia | Notiz | Hat immer die besten Zusammenfassungen
Lea | Bild | https://example.com/foto.jpg`;

const FORMAT_EXAMPLE = `# Eine Zeile pro Eintrag:
Name | Typ | Inhalt | Kontext (optional)

Isai | Zitat | "Das wird schon." | vor Mathe
Frau Meier | Lehrerzitat | Kein Test morgen
Mia | Notiz | Beste Zusammenfassungen
Lea | Bild | https://…/foto.jpg

# Kurzform geht auch:
Isai: "Das wird schon." (vor Mathe)`;

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
  // One assignment per pasted NAME (not per entry): "isai" -> "student:…"
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [pendingMatches, setPendingMatches] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState({ imported: 0, open: 0 });
  // Portal target is only available after mount (SSR safety).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
    // seed one match per unique name (first guessed hit wins)
    const seeded: Record<string, string> = {};
    for (const d of parsed) {
      const key = normalizeName(d.rawName);
      if (!(key in seeded)) seeded[key] = d.matchKey;
      else if (!seeded[key] && d.matchKey) seeded[key] = d.matchKey;
    }
    setMatches(seeded);
    setStep(2);
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((current) => current.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  // entries grouped by pasted name — assignment happens once per group
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; entries: Draft[] }>();
    for (const d of drafts) {
      const key = normalizeName(d.rawName);
      const group = map.get(key) ?? { label: d.rawName, entries: [] };
      group.entries.push(d);
      map.set(key, group);
    }
    return Array.from(map.entries()).map(([key, value]) => ({ key, ...value }));
  }, [drafts]);

  const matchFor = (rawName: string) => matches[normalizeName(rawName)] || "";
  const broken = drafts.filter((d) => d.error).length;
  const matchedCount = drafts.filter((d) => !d.error && matchFor(d.rawName)).length;
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
          sourceText: raw,
          entries: drafts.map((d) => {
            const matchKey = matchFor(d.rawName);
            return {
              rawName: d.rawName,
              targetType: matchKey.startsWith("teacher:") ? "TEACHER" : "STUDENT",
              kind: d.kind,
              text: d.text,
              context: d.context,
              imageUrl: d.imageUrl,
              ...splitMatchKey(matchKey),
            };
          }),
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

  if (!mounted) return null;

  // Rendered through a portal on <body>: the page content behind is wrapped
  // in reveal animations that use transform, and a transformed ancestor
  // breaks position:fixed (sheet would stick to the page, nav would float
  // above the footer buttons).
  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black/50 sm:grid sm:place-items-center sm:p-6" onClick={onClose}>
      <div
        className="flex h-[100dvh] w-full flex-col overflow-hidden shadow-soft sm:h-auto sm:max-h-[88vh] sm:max-w-xl sm:rounded-[34px] sm:border sm:border-white/60"
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
              <div>
                <p className="section-label mb-2">Format</p>
                <pre className="overflow-x-auto whitespace-pre rounded-[22px] bg-ink/90 p-4 font-mono text-[11px] font-bold leading-relaxed text-oncolor/90">{FORMAT_EXAMPLE}</pre>
              </div>
              <textarea
                className="input min-h-[200px] font-mono !text-base leading-relaxed"
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

              {/* one card per pasted NAME: assign the person once, every
                  entry below follows automatically */}
              {groups.map((group) => {
                const matchKey = matchFor(group.label);
                const person = personFor(matchKey);
                return (
                  <div key={group.key} className="glass-card space-y-2.5 p-3">
                    <div className="flex items-center gap-2">
                      {person ? (
                        <Avatar name={person.name} url={person.avatarUrl} accent={person.accentColor} size={34} ring={false} />
                      ) : (
                        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-white/60 text-sm font-black text-ink/40">?</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-black uppercase text-ink/45">
                          „{group.label}“ · {group.entries.length} {group.entries.length === 1 ? "Eintrag" : "Einträge"}
                        </p>
                        <PersonSelect
                          value={matchKey}
                          onChange={(v) => setMatches((c) => ({ ...c, [group.key]: v }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {group.entries.map((draft) => (
                        <div
                          key={draft.id}
                          className={`flex items-start gap-2 rounded-[18px] border bg-white/25 px-3 py-2 ${draft.error ? "border-coral/60" : "border-white/40"}`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              const order: Draft["kind"][] = ["QUOTE", "TEXT", "IMAGE"];
                              const next = order[(order.indexOf(draft.kind) + 1) % order.length];
                              updateDraft(draft.id, { kind: next, error: undefined });
                            }}
                            title="Typ wechseln"
                            className="chip shrink-0 !px-2.5 !py-1 !text-[10px]"
                          >
                            {KIND_LABEL[draft.kind]}
                          </button>
                          <p className="min-w-0 flex-1 break-words text-sm font-bold text-ink/80">
                            {draft.kind === "IMAGE" ? (
                              <span className="break-all text-xs">{draft.imageUrl || "— kein Link —"}</span>
                            ) : (
                              <>„{draft.text}“{draft.context && <span className="text-ink/50"> · {draft.context}</span>}</>
                            )}
                            {draft.error && <span className="block text-xs font-black text-coral">{draft.error}</span>}
                          </p>
                          <button
                            onClick={() => setDrafts((c) => c.filter((d) => d.id !== draft.id))}
                            aria-label="Eintrag entfernen"
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink/30 transition-all duration-150 hover:text-coral active:scale-90"
                          >
                            <IconClose size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {step === 3 && (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
              <span className="grid h-20 w-20 animate-pop-in place-items-center rounded-full bg-hotpink text-4xl text-snow shadow-soft">✓</span>
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
    </div>,
    document.body
  );
}
