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
    <div className="space-y-4">
      {/* Banner */}
      <div className="card p-6">
        <h1 className="display text-4xl">{data.name}</h1>
        {data.school && <p className="text-muted text-sm">{data.school}{data.gradYear ? ` · ${data.gradYear}` : ""}</p>}
        <div className="flex gap-2 mt-3 flex-wrap text-xs">
          <span className="chip">{data.counts.students} Schüler</span>
          <span className="chip">{data.counts.teachers} Lehrpersonen</span>
          <span className="chip">{data.counts.memories} Erinnerungen</span>
        </div>
        {canMod && (
          <div className="mt-4">
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

function ProjectsTab({ classId }: { classId: string }) {
  const [topics, setTopics] = useState<{ id: string; name: string; postCount: number }[] | null>(null);
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
    <div className="space-y-3">
      <form onSubmit={create} className="flex gap-2">
        <input className="input" placeholder="Neues Projekt (z. B. Ausflug, Maturaball)" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-accent" disabled={creating}>Erstellen</button>
      </form>

      {topics === null ? (
        <p className="text-muted">Lädt…</p>
      ) : topics.length === 0 ? (
        <p className="text-muted text-center py-6">Noch keine Projekte. Erstelle das erste!</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {topics.map((t) => (
            <Link key={t.id} href={`/classes/${classId}/topics/${t.id}`} className="card p-4 flex items-center justify-between hover:shadow-soft transition">
              <span className="font-extrabold">{t.name}</span>
              <span className="chip">{t.postCount} Beiträge</span>
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
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
      {members.map((m) => (
        <Link key={m.id} href={`/classes/${classId}/members/${m.id}`} className="flex flex-col items-center text-center gap-1.5 group">
          <div className="group-hover:-translate-y-0.5 transition">
            <Avatar name={m.displayName} url={m.avatarUrl} accent={m.accentColor} size={72} />
          </div>
          <span className="text-sm font-bold leading-tight">{m.displayName.split(" ")[0]}</span>
          <span className="text-xs text-muted">{m.postCount} Beiträge</span>
        </Link>
      ))}
    </div>
  );
}

function TeacherGrid({ members, classId }: { members: Member[]; classId: string }) {
  if (members.length === 0) return <p className="text-muted text-center py-6">Noch keine Lehrpersonen.</p>;
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      {members.map((m) => (
        <Link key={m.id} href={`/classes/${classId}/members/${m.id}`} className="card p-4 flex items-center gap-3 hover:shadow-soft transition">
          <Avatar name={m.displayName} url={m.avatarUrl} accent={m.accentColor} size={52} />
          <div>
            <p className="font-extrabold">{m.displayName}</p>
            <p className="text-xs text-muted">Lehrperson · {m.postCount} Zitate</p>
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
    <div className="card p-4 space-y-3 bg-paper/40">
      <div className="flex items-center justify-between">
        <span className="font-extrabold text-sm">Einladungs-Code</span>
        <span className="font-mono font-bold text-lg">{data.joinCode}</span>
      </div>
      <div className="space-y-1.5">
        {data.members.filter((m) => m.role !== "OWNER").map((m) => (
          <div key={m.id} className="flex items-center gap-2 text-sm bg-white rounded-2xl px-3 py-2">
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
