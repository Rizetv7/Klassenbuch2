"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Avatar } from "@/components/Nav";

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
  const [error, setError] = useState("");

  async function loadClass() {
    const res = await fetch(`/api/classes/${id}`);
    if (res.status === 401) return router.push("/login");
    if (!res.ok) return setError((await res.json()).error || "Fehler.");
    setData(await res.json());
  }
  useEffect(() => {
    loadClass();
  }, [id]);

  if (error) return <p className="text-coral font-bold">{error}</p>;
  if (!data) return <p className="text-muted">Lädt…</p>;

  const canMod = data.myRole === "OWNER" || data.myRole === "MODERATOR";
  const students = data.members.filter((m) => m.memberType === "STUDENT");
  const teachers = data.members.filter((m) => m.memberType === "TEACHER");

  return (
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
            <Stat value={data.counts.students} label="Schüler" />
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
      {tab === "Lehrpersonen" && <TeacherGrid members={teachers} classId={id} />}
      {tab === "Projekte" && <ProjectsTab classId={id} />}
    </div>
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

  async function load() {
    const d = await fetch(`/api/classes/${classId}/topics`).then((r) => r.json());
    setTopics(d.topics ?? []);
  }
  useEffect(() => {
    load();
  }, [classId]);

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
        <p className="text-muted">Lädt…</p>
      ) : topics.length === 0 ? (
        <div className="glass-panel p-8 text-center font-bold text-ink/60">Noch keine Projekte. Erstelle das erste!</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {topics.map((t) => (
            <Link key={t.id} href={`/classes/${classId}/topics/${t.id}`} className="glass-card group overflow-hidden transition hover:-translate-y-1">
              <div className="project-cover h-48 rounded-b-none border-0">
                {t.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                ) : (
                  <div className="grid h-full place-items-center px-6 text-center">
                    <span className="display text-6xl leading-none text-ink/40">{t.name.slice(0, 2).toUpperCase()}</span>
                  </div>
                )}
              </div>
              <div className="relative z-10 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="display break-words text-5xl leading-[0.88]">{t.name}</h3>
                  <span className="chip shrink-0">{t.postCount}</span>
                </div>
                {t.latestText && <p className="mt-4 font-hand text-3xl leading-[0.98] text-hotpink">{t.latestText}</p>}
                <p className="mt-5 text-xs font-black uppercase text-ink/50">Projekt öffnen</p>
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
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {members.map((m) => (
        <Link key={m.id} href={`/classes/${classId}/members/${m.id}`} className="glass-card group flex min-h-[178px] flex-col items-center justify-center gap-2 p-4 text-center transition hover:-translate-y-1">
          <div className="transition group-hover:scale-[1.04]">
            <Avatar name={m.displayName} url={m.avatarUrl} accent={m.accentColor} size={72} />
          </div>
          <span className="text-base font-black leading-tight">{m.displayName.split(" ")[0]}</span>
          <span className="chip">{m.postCount} Beiträge</span>
        </Link>
      ))}
    </div>
  );
}

function TeacherGrid({ members, classId }: { members: Member[]; classId: string }) {
  if (members.length === 0) return <p className="text-muted text-center py-6">Noch keine Lehrpersonen.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {members.map((m) => (
        <Link key={m.id} href={`/classes/${classId}/members/${m.id}`} className="glass-card flex items-center gap-3 p-4 transition hover:-translate-y-1">
          <Avatar name={m.displayName} url={m.avatarUrl} accent={m.accentColor} size={52} />
          <div>
            <p className="font-black">{m.displayName}</p>
            <p className="text-xs font-bold text-muted">Lehrperson · {m.postCount} Zitate</p>
          </div>
        </Link>
      ))}
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
