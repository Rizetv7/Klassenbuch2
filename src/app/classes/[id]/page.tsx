"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { InlineLoading, PageLoading, PageReveal } from "@/components/LoadingState";
import { Avatar } from "@/components/Nav";
import { swrJson } from "@/lib/swr";

type Member = {
  id: string;
  displayName: string;
  memberType: string;
  role: string;
  avatarUrl: string | null;
  accentColor: string | null;
  postCount: number;
};

type ClassDetail = {
  id: string;
  name: string;
  school: string | null;
  gradYear: string | null;
  joinCode: string;
  myRole: string;
  counts: { students: number; teachers: number; memories: number };
  members: Member[];
};

const TABS = ["Schüler", "Lehrpersonen", "Projekte"] as const;
type Tab = (typeof TABS)[number];

export default function ClassPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const initialTab = (TABS as readonly string[]).includes(search.get("tab") || "")
    ? (search.get("tab") as Tab)
    : "Schüler";
  const [data, setData] = useState<ClassDetail | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [showManage, setShowManage] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [error, setError] = useState("");

  function loadClass() {
    return swrJson<ClassDetail>(`/api/classes/${id}`, (detail, meta) => {
      if (detail) return setData(detail);
      if (meta.status === 401) return router.push("/login");
      if (!meta.fromCache && meta.status !== 0) setError("Klasse konnte nicht geladen werden.");
    });
  }
  useEffect(() => loadClass(), [id]);

  if (error) return <p className="text-coral font-bold">{error}</p>;
  if (!data) return <PageLoading />;

  const canMod = data.myRole === "OWNER" || data.myRole === "MODERATOR";
  const students = data.members;

  return (
    <PageReveal>
    <div className="space-y-6">
      {/* Banner */}
      <div className="hero-frame p-5 sm:p-7">
        <div className="relative z-10 grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="section-label mb-2">Klasse</p>
            <h1 className="display break-words text-6xl leading-[0.86] sm:text-7xl">{data.name}</h1>
            {data.school && <p className="mt-3 text-sm font-black text-ink/60">{data.school}{data.gradYear ? ` · ${data.gradYear}` : ""}</p>}
          </div>
          <div className="grid grid-cols-3 gap-2 md:w-[330px]">
            <Stat value={students.length} label="Schüler" />
            <Stat value={data.counts.teachers} label="Lehrpersonen" />
            <Stat value={data.counts.memories} label="Erinnerungen" />
          </div>
        </div>
        {canMod && (
          <div className="relative z-10 mt-5">
            <button onClick={() => setShowManage((v) => !v)} className="btn-soft text-sm">Verwalten</button>
          </div>
        )}
      </div>

      {showManage && canMod && <ManagePanel data={data} onChange={loadClass} />}

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`tab ${tab === t ? "tab-active" : ""}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "Schüler" && <MemberGrid members={students} classId={id} empty="Noch keine Schüler:innen beigetreten." />}
      {tab === "Lehrpersonen" && <TeachersTab classId={id} />}
      {tab === "Projekte" && <ProjectsTab classId={id} />}

      <div className="pt-3">
        <button onClick={() => setShowImport(true)} className="glass-card w-full p-4 text-left transition hover:-translate-y-0.5">
          <span className="section-label">Werkzeug</span>
          <span className="mt-1 block text-lg font-black">Daten importieren</span>
          <span className="mt-1 block text-sm font-bold text-ink/55">Zitate, Notizen und Bild-URLs aus einer Textliste übernehmen.</span>
        </button>
      </div>

      {showImport && (
        <DataImportModal
          classId={id}
          members={data.members}
          onClose={() => setShowImport(false)}
          onImported={loadClass}
        />
      )}
    </div>
    </PageReveal>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[24px] border border-white/50 bg-white/20 p-3 text-center">
      <p className="display text-4xl leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-black text-ink/60">{label}</p>
    </div>
  );
}

function ProjectsTab({ classId }: { classId: string }) {
  const [topics, setTopics] = useState<{ id: string; name: string; postCount: number; coverImageUrl: string | null; latestText: string | null }[] | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  function load() {
    return swrJson<{ topics?: any[] }>(`/api/classes/${classId}/topics`, (d) => {
      if (d) setTopics(d.topics ?? []);
    });
  }
  useEffect(() => load(), [classId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    const res = await fetch(`/api/classes/${classId}/topics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCreating(false);
    if (res.ok) {
      setName("");
      load();
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="glass-card flex flex-col gap-3 p-3 sm:flex-row">
        <input className="input" placeholder="Neues Projekt (z. B. Ausflug, Maturaball)" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-accent" disabled={creating}>Erstellen</button>
      </form>

      {topics === null ? (
        <InlineLoading />
      ) : topics.length === 0 ? (
        <div className="glass-panel p-8 text-center font-bold text-ink/60">Noch keine Projekte. Erstelle das erste!</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {topics.map((t) => (
            <Link key={t.id} href={`/classes/${classId}/topics/${t.id}`} className="glass-card group overflow-hidden p-2 transition hover:-translate-y-1">
              <div className="project-cover h-36 rounded-[24px] border-0">
                {t.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.coverImageUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                ) : (
                  <div className="grid h-full place-items-center px-6 text-center">
                    <span className="display text-5xl leading-none text-ink/40">{t.name.slice(0, 2).toUpperCase()}</span>
                  </div>
                )}
              </div>
              <div className="relative z-10 p-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="display break-words text-3xl leading-[0.9]">{t.name}</h3>
                  <span className="chip shrink-0">{t.postCount}</span>
                </div>
                {t.latestText && <p className="mt-3 line-clamp-2 font-hand text-2xl leading-[0.98] text-hotpink">{t.latestText}</p>}
                <p className="mt-4 text-[11px] font-black uppercase text-ink/50">Projekt öffnen</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MemberGrid({ members, classId, empty }: { members: Member[]; classId: string; empty: string }) {
  if (members.length === 0) return <p className="text-muted text-center py-6">{empty}</p>;
  const ordered = [...members].sort((a, b) => b.postCount - a.postCount || a.displayName.localeCompare(b.displayName));
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
      {ordered.map((m) => {
        const firstName = m.displayName.split(" ")[0];
        return (
          <Link
            key={m.id}
            href={`/classes/${classId}/members/${m.id}`}
            className="glass-card group flex min-h-[86px] items-center gap-2 p-2.5 transition hover:-translate-y-0.5"
          >
            <Avatar name={m.displayName} url={m.avatarUrl} accent={m.accentColor} size={38} />
            <div className="min-w-0">
              <p className="truncate text-sm font-black leading-tight">{firstName}</p>
              <p className="truncate text-[11px] font-bold text-ink/50">{m.postCount} Beiträge</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

type TeacherItem = { id: string; name: string; subject: string | null; avatarUrl: string | null; accentColor: string | null; postCount: number };

function TeachersTab({ classId }: { classId: string }) {
  const [teachers, setTeachers] = useState<TeacherItem[] | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [creating, setCreating] = useState(false);

  function load() {
    return swrJson<{ teachers?: TeacherItem[] }>(`/api/classes/${classId}/teachers`, (d) => {
      if (d) setTeachers(d.teachers ?? []);
    });
  }
  useEffect(() => load(), [classId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    const res = await fetch(`/api/classes/${classId}/teachers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, subject }),
    });
    setCreating(false);
    if (res.ok) {
      setName("");
      setSubject("");
      load();
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="glass-card flex flex-col gap-2 p-3 sm:flex-row">
        <input className="input" placeholder="Name der Lehrperson" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input sm:max-w-[40%]" placeholder="Fach (optional)" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <button className="btn-accent" disabled={creating}>Erstellen</button>
      </form>

      {teachers === null ? (
        <InlineLoading />
      ) : teachers.length === 0 ? (
        <div className="glass-panel p-8 text-center font-bold text-ink/60">Noch keine Lehrpersonen. Erstelle die erste!</div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
          {teachers.map((t) => (
            <Link key={t.id} href={`/classes/${classId}/teachers/${t.id}`} className="glass-card flex min-h-[86px] items-center gap-2 p-2.5 transition hover:-translate-y-0.5">
              <Avatar name={t.name} url={t.avatarUrl} accent={t.accentColor} size={38} />
              <div className="min-w-0">
                <p className="truncate text-sm font-black leading-tight">{t.name}</p>
                <p className="truncate text-[11px] font-bold text-ink/50">{t.subject ? `${t.subject} · ` : ""}{t.postCount} Beiträge</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

type ImportEntry = {
  id: string;
  line: number;
  rawName: string;
  targetType: "STUDENT" | "TEACHER";
  kind: "QUOTE" | "TEXT" | "IMAGE";
  typeLabel: string;
  text: string | null;
  context: string | null;
  imageUrl: string | null;
  matchKey: string;
  error?: string;
};

type PendingImport = {
  id: string;
  rawName: string;
  targetType: string;
  kind: string;
  text: string | null;
  context: string | null;
  imageUrl: string | null;
  createdAt: string;
};

const IMPORT_EXAMPLE = `# Format pro Zeile:
# Name | Typ | Inhalt | Kontext oder Beschreibung optional

Isai Graf | Zitat | "Das wird schon." | vor Mathe
Mia Keller | Notiz | Hat immer die besten Zusammenfassungen
Frau Meier | Lehrerzitat | Morgen gibt es keinen Test
Lea Sommer | Bild | https://example.com/foto.jpg | Maturareise`;

function normalizeImportName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function splitMatchKey(value: string) {
  const [type, id] = value.split(":");
  return {
    subjectMembershipId: type === "student" ? id : undefined,
    teacherId: type === "teacher" ? id : undefined,
  };
}

function detectImportType(label: string): Pick<ImportEntry, "kind" | "targetType" | "typeLabel"> {
  const normalized = normalizeImportName(label);
  const targetType = normalized.includes("lehrer") || normalized.includes("lehrperson") ? "TEACHER" : "STUDENT";
  const kind = normalized.includes("bild") || normalized.includes("foto")
    ? "IMAGE"
    : normalized.includes("notiz") || normalized.includes("note")
      ? "TEXT"
      : "QUOTE";
  return { kind, targetType, typeLabel: label || kind };
}

function guessMatchKey(rawName: string, targetType: "STUDENT" | "TEACHER", members: Member[], teachers: TeacherItem[]) {
  const wanted = normalizeImportName(rawName);
  if (!wanted) return "";
  const memberCandidates = members.filter((m) => m.memberType !== "TEACHER");
  const teacherCandidates = teachers;
  const findExactMember = memberCandidates.find((m) => normalizeImportName(m.displayName) === wanted);
  const findExactTeacher = teacherCandidates.find((t) => normalizeImportName(t.name) === wanted);
  if (targetType === "TEACHER" && findExactTeacher) return `teacher:${findExactTeacher.id}`;
  if (targetType === "STUDENT" && findExactMember) return `student:${findExactMember.id}`;

  const memberFirst = memberCandidates.filter((m) => normalizeImportName(m.displayName.split(" ")[0]) === wanted);
  const teacherFirst = teacherCandidates.filter((t) => normalizeImportName(t.name.split(" ")[0]) === wanted);
  if (targetType === "TEACHER" && teacherFirst.length === 1) return `teacher:${teacherFirst[0].id}`;
  if (targetType === "STUDENT" && memberFirst.length === 1) return `student:${memberFirst[0].id}`;
  return "";
}

function parseImportText(text: string, members: Member[], teachers: TeacherItem[]) {
  return text
    .split("\n")
    .map((raw, index) => ({ raw: raw.trim(), line: index + 1 }))
    .filter(({ raw }) => raw && !raw.startsWith("#"))
    .map(({ raw, line }) => {
      const parts = raw.split("|").map((part) => part.trim());
      if (parts.length < 3) {
        return {
          id: `${line}`,
          line,
          rawName: parts[0] || "",
          targetType: "STUDENT" as const,
          kind: "TEXT" as const,
          typeLabel: parts[1] || "",
          text: parts[2] || null,
          context: null,
          imageUrl: null,
          matchKey: "",
          error: "Zu wenige Spalten. Nutze: Name | Typ | Inhalt | optionaler Kontext",
        };
      }

      const detected = detectImportType(parts[1]);
      const imageUrl = detected.kind === "IMAGE" ? parts[2] || null : null;
      const bodyText = detected.kind === "IMAGE" ? parts[3] || null : parts[2] || null;
      const context = detected.kind === "QUOTE" ? parts[3] || null : null;
      return {
        id: `${line}-${parts[0]}`,
        line,
        rawName: parts[0],
        ...detected,
        text: bodyText,
        context,
        imageUrl,
        matchKey: guessMatchKey(parts[0], detected.targetType, members, teachers),
        error: detected.kind === "IMAGE" && !imageUrl ? "Bild braucht eine URL in der dritten Spalte." : undefined,
      };
    });
}

function DataImportModal({
  classId,
  members,
  onClose,
  onImported,
}: {
  classId: string;
  members: Member[];
  onClose: () => void;
  onImported: () => void;
}) {
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [pending, setPending] = useState<PendingImport[]>([]);
  const [pendingMatches, setPendingMatches] = useState<Record<string, string>>({});
  const [raw, setRaw] = useState("");
  const [entries, setEntries] = useState<ImportEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function loadImportData() {
    const [teacherData, pendingData] = await Promise.all([
      fetch(`/api/classes/${classId}/teachers`).then((r) => r.json()),
      fetch(`/api/classes/${classId}/import`).then((r) => r.json()),
    ]);
    const teacherList = teacherData.teachers ?? [];
    const pendingList = pendingData.pending ?? [];
    setTeachers(teacherList);
    setPending(pendingList);
    setPendingMatches(Object.fromEntries(pendingList.map((item: PendingImport) => [
      item.id,
      guessMatchKey(item.rawName, item.targetType === "TEACHER" ? "TEACHER" : "STUDENT", members, teacherList),
    ])));
  }

  useEffect(() => {
    loadImportData();
  }, [classId]);

  function preview() {
    setEntries(parseImportText(raw, members, teachers));
    setMsg("");
  }

  function updateEntryMatch(id: string, matchKey: string) {
    setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, matchKey } : entry));
  }

  async function submitImport() {
    const list = entries.length ? entries : parseImportText(raw, members, teachers);
    if (list.length === 0) return setMsg("Bitte zuerst Daten einfügen.");
    if (list.some((entry) => entry.error)) return setMsg("Bitte korrigiere die markierten Zeilen.");

    setBusy(true);
    const res = await fetch(`/api/classes/${classId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: list.map((entry) => ({
          rawName: entry.rawName,
          targetType: entry.targetType,
          kind: entry.kind,
          text: entry.text,
          context: entry.context,
          imageUrl: entry.imageUrl,
          ...splitMatchKey(entry.matchKey),
        })),
      }),
    });
    const d = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok) {
      setRaw("");
      setEntries([]);
      setMsg(`${d.imported} importiert, ${d.pending} offen zum späteren Matchen.`);
      await loadImportData();
      onImported();
    } else {
      setMsg(d?.error || "Import fehlgeschlagen.");
    }
  }

  async function resolvePending(item: PendingImport) {
    const matchKey = pendingMatches[item.id] || "";
    if (!matchKey) return setMsg("Bitte zuerst eine Person auswählen.");
    setBusy(true);
    const res = await fetch(`/api/classes/${classId}/import`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, ...splitMatchKey(matchKey) }),
    });
    const d = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok) {
      setMsg(`${item.rawName} wurde zugeordnet.`);
      await loadImportData();
      onImported();
    } else {
      setMsg(d?.error || "Zuordnung fehlgeschlagen.");
    }
  }

  const MatchSelect = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <select className="input !py-2" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Noch nicht matchen</option>
      <optgroup label="Schüler:innen">
        {members.filter((m) => m.memberType !== "TEACHER").map((m) => (
          <option key={m.id} value={`student:${m.id}`}>{m.displayName}</option>
        ))}
      </optgroup>
      <optgroup label="Lehrpersonen">
        {teachers.map((t) => (
          <option key={t.id} value={`teacher:${t.id}`}>{t.name}{t.subject ? ` (${t.subject})` : ""}</option>
        ))}
      </optgroup>
    </select>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/55 px-3 py-6 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl rounded-[34px] border border-white/50 bg-white/80 p-4 shadow-soft sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-label mb-2">Import</p>
            <h2 className="display text-5xl leading-[0.9]">Daten importieren</h2>
            <p className="mt-2 max-w-2xl text-sm font-black text-ink/60">
              Füge bestehende Zitate, Notizen und Bild-Links ein. Nicht erkannte Namen kannst du direkt matchen oder unten später zuordnen.
            </p>
          </div>
          <button onClick={onClose} className="btn-soft px-4">Schliessen</button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="glass-card p-4">
            <p className="section-label mb-2">Textformat</p>
            <p className="text-sm font-bold text-ink/65">
              Eine Zeile pro Eintrag, getrennt mit senkrechtem Strich:
            </p>
            <pre className="mt-3 whitespace-pre-wrap rounded-[22px] bg-ink/90 p-4 text-xs font-bold leading-relaxed text-white">{IMPORT_EXAMPLE}</pre>
          </section>

          <section className="space-y-3">
            <textarea
              className="input min-h-[260px] font-mono text-xs leading-relaxed"
              placeholder={IMPORT_EXAMPLE}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button onClick={preview} className="btn-soft" disabled={busy}>Vorschau erstellen</button>
              <button onClick={submitImport} className="btn-accent" disabled={busy}>{busy ? "Importiert..." : "Importieren"}</button>
            </div>
            {msg && <p className="text-sm font-black text-ink/60">{msg}</p>}
          </section>
        </div>

        {entries.length > 0 && (
          <section className="mt-5 space-y-2">
            <p className="section-label">Vorschau & Matching</p>
            <div className="grid gap-2">
              {entries.map((entry) => (
                <div key={entry.id} className="glass-card grid gap-3 p-3 lg:grid-cols-[1.2fr_0.9fr] lg:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{entry.rawName} · {entry.typeLabel}</p>
                    <p className="line-clamp-2 text-xs font-bold text-ink/55">
                      Zeile {entry.line}: {entry.imageUrl || entry.text}{entry.context ? ` · ${entry.context}` : ""}
                    </p>
                    {entry.error && <p className="mt-1 text-xs font-black text-coral">{entry.error}</p>}
                  </div>
                  <MatchSelect value={entry.matchKey} onChange={(value) => updateEntryMatch(entry.id, value)} />
                </div>
              ))}
            </div>
          </section>
        )}

        {pending.length > 0 && (
          <section className="mt-5 space-y-2">
            <p className="section-label">Noch offene Zuordnungen</p>
            <div className="grid gap-2">
              {pending.map((item) => (
                <div key={item.id} className="glass-card grid gap-3 p-3 lg:grid-cols-[1.1fr_0.9fr_auto] lg:items-center">
                  <div>
                    <p className="text-sm font-black">{item.rawName} · {item.kind}</p>
                    <p className="line-clamp-2 text-xs font-bold text-ink/55">{item.imageUrl || item.text}</p>
                  </div>
                  <MatchSelect
                    value={pendingMatches[item.id] || ""}
                    onChange={(value) => setPendingMatches((current) => ({ ...current, [item.id]: value }))}
                  />
                  <button onClick={() => resolvePending(item)} className="btn-primary" disabled={busy}>Zuordnen</button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ManagePanel({ data, onChange }: { data: ClassDetail; onChange: () => void }) {
  const router = useRouter();
  async function moderate(mid: string, body: Record<string, string>) {
    await fetch(`/api/classes/${data.id}/members/${mid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    onChange();
  }
  async function removeMember(mid: string) {
    if (!confirm("Mitglied entfernen?")) return;
    await fetch(`/api/classes/${data.id}/members/${mid}`, { method: "DELETE" });
    onChange();
  }
  async function deleteClass() {
    if (!confirm("Die ganze Klasse mit allen Beiträgen löschen?")) return;
    const res = await fetch(`/api/classes/${data.id}`, { method: "DELETE" });
    if (res.ok) router.push("/classes");
  }
  return (
    <div className="glass-card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <span className="font-extrabold text-sm">Einladungs-Code</span>
        <span className="font-mono font-bold text-lg">{data.joinCode}</span>
      </div>
      <div className="space-y-1.5">
        {data.members.filter((m) => m.role !== "OWNER").map((m) => (
          <div key={m.id} className="flex items-center gap-2 rounded-[22px] border border-white/40 bg-white/20 px-3 py-2 text-sm">
            <span className="flex-1 truncate">{m.displayName}</span>
            {data.myRole === "OWNER" && (
              <button onClick={() => moderate(m.id, { role: m.role === "MODERATOR" ? "MEMBER" : "MODERATOR" })} className="text-xs underline text-ink/70">
                {m.role === "MODERATOR" ? "Mod entz." : "→ Mod"}
              </button>
            )}
            <button onClick={() => moderate(m.id, { memberType: m.memberType === "TEACHER" ? "STUDENT" : "TEACHER" })} className="text-xs underline text-ink/70">
              {m.memberType === "TEACHER" ? "→ Schüler" : "→ Lehrer"}
            </button>
            <button onClick={() => removeMember(m.id)} className="text-xs text-coral underline">entfernen</button>
          </div>
        ))}
      </div>
      {data.myRole === "OWNER" && (
        <button onClick={deleteClass} className="text-xs text-coral underline">Klasse löschen</button>
      )}
    </div>
  );
}
