"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { InlineLoading, PageLoading, PageReveal } from "@/components/LoadingState";
import { Avatar } from "@/components/Nav";
import { ImportWizard } from "@/components/ImportWizard";
import { ThemeMenu } from "@/components/ThemeMenu";
import { clearApiCache, prefetchJson, swrJson } from "@/lib/swr";

type Member = {
  id: string;
  displayName: string;
  memberType: string;
  role: string;
  aminaMode: boolean;
  leftAt: string | null;
  avatarUrl: string | null;
  accentColor: string | null;
  postCount: number;
};

type ClassDetail = {
  id: string;
  name: string;
  description: string | null;
  school: string | null;
  gradYear: string | null;
  joinCode: string;
  myRole: string;
  counts: { students: number; teachers: number; memories: number };
  members: Member[];
  inactiveMembers: Member[];
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
        <div className="relative z-10 mt-5 flex flex-wrap gap-2">
          <ThemeMenu />
          {canMod && (
            <button onClick={() => setShowManage((v) => !v)} className="btn-soft text-sm">
              {data.myRole === "OWNER" ? "Klasseneinstellungen" : "Moderation"}
            </button>
          )}
        </div>
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
        <ImportWizard
          classId={id}
          students={data.members
            .filter((m) => m.memberType !== "TEACHER")
            .map((m) => ({ id: m.id, name: m.displayName, avatarUrl: m.avatarUrl, accentColor: m.accentColor }))}
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
            <Link
              key={t.id}
              href={`/classes/${classId}/topics/${t.id}`}
              onPointerEnter={() => {
                prefetchJson(`/api/topics/${t.id}`);
                prefetchJson(`/api/posts?classId=${classId}&topicId=${t.id}&limit=100`);
              }}
              className="glass-card group overflow-hidden p-2 transition hover:-translate-y-1"
            >
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
                {t.latestText && <p className="mt-3 line-clamp-2 text-sm font-black text-hotpink">“{t.latestText}”</p>}
                <p className="mt-4 text-[11px] font-black uppercase text-ink/50">Projekt öffnen</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Join code as a tap-to-copy chip: one tap, code is in the clipboard.
function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  }
  return (
    <button
      type="button"
      onClick={copy}
      title="Code kopieren"
      className="group flex items-center gap-2 rounded-full bg-white/25 px-4 py-2 transition hover:bg-white/40 active:scale-95"
    >
      <span className="font-mono text-2xl font-black tracking-widest">{code}</span>
      <span className={`text-[11px] font-black ${copied ? "animate-fade-in text-ink/80" : "text-ink/45"}`}>
        {copied ? "Kopiert ✓" : "Kopieren"}
      </span>
    </button>
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
            // warm the person's posts the moment the finger/cursor arrives —
            // the page then opens instantly from cache
            onPointerEnter={() => prefetchJson(`/api/posts?classId=${classId}&subjectMembershipId=${m.id}`)}
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
            <Link
              key={t.id}
              href={`/classes/${classId}/teachers/${t.id}`}
              onPointerEnter={() => {
                prefetchJson(`/api/teachers/${t.id}`);
                prefetchJson(`/api/posts?classId=${classId}&teacherId=${t.id}`);
              }}
              className="glass-card flex min-h-[86px] items-center gap-2 p-2.5 transition hover:-translate-y-0.5"
            >
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

function ManagePanel({ data, onChange }: { data: ClassDetail; onChange: () => void }) {
  const router = useRouter();
  const isOwner = data.myRole === "OWNER";
  const [name, setName] = useState(data.name);
  const [description, setDescription] = useState(data.description || "");
  const [school, setSchool] = useState(data.school || "");
  const [gradYear, setGradYear] = useState(data.gradYear || "");
  const [accountName, setAccountName] = useState("");
  const [archiveConfirmation, setArchiveConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [panelError, setPanelError] = useState("");

  async function request(url: string, init: RequestInit) {
    setBusy(true);
    setPanelError("");
    setMessage("");
    try {
      const res = await fetch(url, init);
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Änderung fehlgeschlagen.");
      return body;
    } catch (reason) {
      setPanelError(reason instanceof Error ? reason.message : "Änderung fehlgeschlagen.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function moderate(mid: string, body: Record<string, unknown>) {
    const result = await request(`/api/classes/${data.id}/members/${mid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (result) onChange();
  }

  async function saveClass(e: React.FormEvent) {
    e.preventDefault();
    const result = await request(`/api/classes/${data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, school, gradYear }),
    });
    if (result) {
      setMessage("Klasseneinstellungen gespeichert.");
      onChange();
    }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    const result = await request(`/api/classes/${data.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: accountName }),
    });
    if (result) {
      setAccountName("");
      setMessage(result.restored ? "Person und frühere Einträge wiederhergestellt." : "Person hinzugefügt.");
      onChange();
    }
  }

  async function removeMember(mid: string) {
    if (!confirm("Person aus der Klasse entfernen? Ihre bisherigen Beiträge bleiben erhalten.")) return;
    const result = await request(`/api/classes/${data.id}/members/${mid}`, { method: "DELETE" });
    if (result) {
      setMessage("Person deaktiviert. Sie kann jederzeit wiederhergestellt werden.");
      onChange();
    }
  }

  async function deleteClass() {
    const result = await request(`/api/classes/${data.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: archiveConfirmation }),
    });
    if (result) {
      clearApiCache();
      router.push("/classes");
    }
  }

  async function rotateCode() {
    if (!confirm("Neuen Einladungscode erzeugen? Der bisherige Code funktioniert danach nicht mehr.")) return;
    const result = await request(`/api/classes/${data.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regenerateJoinCode: true }),
    });
    if (result) {
      setMessage("Neuer Einladungscode erstellt.");
      onChange();
    }
  }

  return (
    <div className="glass-panel space-y-7 p-4 sm:p-6">
      {panelError ? <p className="rounded-[18px] bg-coral/15 p-3 text-sm font-black text-coral">{panelError}</p> : null}
      {message ? <p className="rounded-[18px] bg-white/25 p-3 text-sm font-black">{message}</p> : null}

      {isOwner ? (
        <form onSubmit={saveClass} className="space-y-3 border-b border-white/35 pb-6">
          <div>
            <p className="section-label">Klasse</p>
            <h2 className="display text-3xl">Grunddaten</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="label">Name</span><input className="input" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></label>
            <label><span className="label">Schule</span><input className="input" value={school} onChange={(event) => setSchool(event.target.value)} maxLength={100} /></label>
            <label><span className="label">Abschlussjahr</span><input className="input" value={gradYear} onChange={(event) => setGradYear(event.target.value)} maxLength={100} /></label>
            <label className="sm:col-span-2"><span className="label">Beschreibung</span><textarea className="input min-h-24 resize-y" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} /></label>
          </div>
          <button className="btn-primary" disabled={busy}>Speichern</button>
        </form>
      ) : null}

      <section className="space-y-3 border-b border-white/35 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="section-label">Zugang</p><h2 className="display text-3xl">Einladung</h2></div>
          <CopyCode code={data.joinCode} />
        </div>
        {isOwner ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <form onSubmit={addMember} className="flex flex-1 gap-2">
              <input className="input" value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Genauer Kontoname" minLength={2} required />
              <button className="btn-accent shrink-0" disabled={busy}>Hinzufügen</button>
            </form>
            <button type="button" className="btn-soft" onClick={rotateCode} disabled={busy}>Code erneuern</button>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div><p className="section-label">Personen</p><h2 className="display text-3xl">Aktive Mitglieder</h2></div>
        <div className="divide-y divide-white/30">
          {data.members.map((member) => (
            <div key={member.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate font-black">{member.displayName}</p>
                <p className="text-xs font-bold text-ink/45">{member.role === "OWNER" ? "Klassenleitung" : member.role === "MODERATOR" ? "Moderation" : "Mitglied"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {isOwner ? (
                  <button type="button" onClick={() => moderate(member.id, { aminaMode: !member.aminaMode })} className={`chip ${member.aminaMode ? "!bg-hotpink/25 !border-hotpink/40" : ""}`} disabled={busy}>
                    Amina {member.aminaMode ? "an" : "aus"}
                  </button>
                ) : null}
                {member.role !== "OWNER" ? (
                  <>
                  {isOwner ? <button type="button" onClick={() => moderate(member.id, { role: member.role === "MODERATOR" ? "MEMBER" : "MODERATOR" })} className="chip" disabled={busy}>{member.role === "MODERATOR" ? "Mod entfernen" : "Zu Mod"}</button> : null}
                  <button type="button" onClick={() => moderate(member.id, { memberType: member.memberType === "TEACHER" ? "STUDENT" : "TEACHER" })} className="chip" disabled={busy}>{member.memberType === "TEACHER" ? "Als Schüler" : "Als Lehrer"}</button>
                  <button type="button" onClick={() => removeMember(member.id)} className="chip !text-coral" disabled={busy}>Entfernen</button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {isOwner && data.inactiveMembers?.length ? (
        <section className="space-y-2 border-t border-white/35 pt-6">
          <div><p className="section-label">Gesichert</p><h2 className="display text-3xl">Entfernte Personen</h2></div>
          {data.inactiveMembers.map((member) => (
            <div key={member.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 truncate font-black">{member.displayName}</span>
              <button type="button" className="btn-soft !px-3 !py-2" onClick={() => moderate(member.id, { restore: true })} disabled={busy}>Wiederherstellen</button>
            </div>
          ))}
        </section>
      ) : null}

      {isOwner ? (
        <section className="space-y-3 border-t border-coral/25 pt-6">
          <div><p className="section-label !text-coral">Archiv</p><h2 className="display text-3xl">Klasse archivieren</h2></div>
          <input className="input" value={archiveConfirmation} onChange={(event) => setArchiveConfirmation(event.target.value)} placeholder={`Zur Bestätigung „${data.name}“ eingeben`} />
          <button type="button" onClick={deleteClass} className="btn-soft !text-coral" disabled={busy || archiveConfirmation !== data.name}>Sicher archivieren</button>
        </section>
      ) : null}
    </div>
  );
}
