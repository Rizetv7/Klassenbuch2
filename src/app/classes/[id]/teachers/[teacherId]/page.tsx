"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Avatar } from "@/components/Nav";
import { IconPencil } from "@/components/Icons";
import { PostCard, type Post } from "@/components/PostCard";
import { CreatePost } from "@/components/CreatePost";
import { uploadImageFile } from "@/lib/uploadImage";

type Teacher = {
  id: string;
  name: string;
  subject: string | null;
  avatarUrl: string | null;
  accentColor: string | null;
  className: string;
};

const TABS = ["Alle", "Zitate", "Bilder"] as const;
type Tab = (typeof TABS)[number];

export default function TeacherPage() {
  const { id, teacherId } = useParams<{ id: string; teacherId: string }>();
  const router = useRouter();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<Tab>("Alle");
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadTeacher() {
    const t = await fetch(`/api/teachers/${teacherId}`);
    if (t.status === 401) return router.push("/login");
    if (!t.ok) return setLoading(false);
    setTeacher(await t.json());
  }

  useEffect(() => {
    (async () => {
      await loadTeacher();
      const d = await fetch(`/api/posts?classId=${id}&teacherId=${teacherId}`).then((r) => r.json());
      setPosts(d.posts ?? []);
      setLoading(false);
    })();
  }, [id, teacherId]);

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImageFile(file).catch(() => null);
    if (!url) return;
    await fetch(`/api/teachers/${teacherId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarUrl: url }),
    });
    setTeacher((t) => (t ? { ...t, avatarUrl: url } : t));
  }

  async function deleteTeacher() {
    if (!confirm("Diese Lehrperson mit allen Beiträgen löschen?")) return;
    const res = await fetch(`/api/teachers/${teacherId}`, { method: "DELETE" });
    if (res.ok) router.push(`/classes/${id}?tab=Lehrpersonen`);
  }

  if (loading) return <p className="text-muted">Lädt…</p>;
  if (!teacher) return <p className="text-coral font-bold">Lehrperson nicht gefunden.</p>;

  const shown = posts.filter((p) => (tab === "Alle" ? true : tab === "Zitate" ? p.kind === "QUOTE" : p.kind === "IMAGE"));

  return (
    <div className="space-y-4">
      <Link href={`/classes/${id}?tab=Lehrpersonen`} className="text-sm text-muted">← {teacher.className}</Link>

      {/* Hero */}
      <div className="card p-6 flex flex-col items-center text-center">
        <label className="cursor-pointer relative">
          <Avatar name={teacher.name} url={teacher.avatarUrl} accent={teacher.accentColor} size={96} />
          <span className="absolute -bottom-1 -right-1 bg-ink text-white rounded-full w-8 h-8 grid place-items-center">
            <IconPencil size={16} />
          </span>
          <input type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
        </label>
        <h1 className="display text-4xl mt-3">{teacher.name}</h1>
        <p className="text-muted text-sm">{teacher.subject ? `${teacher.subject} · ` : ""}Lehrperson · {posts.length} Beiträge</p>
        <button onClick={deleteTeacher} className="text-xs text-coral underline mt-2">Lehrperson löschen</button>
      </div>

      {/* Add */}
      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="btn-accent w-full">Zitat / Bild hinzufügen</button>
      ) : (
        <div className="space-y-2">
          <CreatePost classId={id} teacherId={teacherId} onCreated={(p) => { setPosts((ps) => [p, ...ps]); setShowAdd(false); }} />
          <button onClick={() => setShowAdd(false)} className="text-sm text-muted underline w-full text-center">Abbrechen</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`tab ${tab === t ? "tab-active" : ""}`}>{t}</button>
        ))}
      </div>

      {/* Posts */}
      <div className="space-y-3">
        {shown.length === 0 ? (
          <p className="text-muted text-center py-6">Noch nichts über {teacher.name}. Mach den Anfang!</p>
        ) : (
          shown.map((p) => (
            <PostCard key={p.id} post={p} showContext={false} onDeleted={(pid) => setPosts((ps) => ps.filter((x) => x.id !== pid))} />
          ))
        )}
      </div>
    </div>
  );
}
