"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PostCard, type Post } from "@/components/PostCard";
import { CreatePost } from "@/components/CreatePost";
import { PageLoading, PageReveal } from "@/components/LoadingState";
import { ProfileImagePicker } from "@/components/ProfileImagePicker";
import { swrJson } from "@/lib/swr";

type Teacher = {
  id: string;
  name: string;
  subject: string | null;
  avatarUrl: string | null;
  accentColor: string | null;
  className: string;
};

const TABS = ["Alle", "Zitate", "Bilder", "Post-its"] as const;
type Tab = (typeof TABS)[number];

export default function TeacherPage() {
  const { id, teacherId } = useParams<{ id: string; teacherId: string }>();
  const router = useRouter();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<Tab>("Alle");
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // teacher + posts in parallel, cache-first on repeat visits
    let gotTeacher = false;
    let gotPosts = false;
    const done = () => {
      if (gotTeacher && gotPosts) setLoading(false);
    };
    const cancelTeacher = swrJson<Teacher>(`/api/teachers/${teacherId}`, (t, meta) => {
      if (!t) {
        if (meta.status === 401) return router.push("/login");
        if (!meta.fromCache) setLoading(false);
        return;
      }
      setTeacher(t);
      gotTeacher = true;
      done();
    });
    const cancelPosts = swrJson<{ posts?: Post[] }>(`/api/posts?classId=${id}&teacherId=${teacherId}`, (d) => {
      if (!d) return;
      setPosts(d.posts ?? []);
      gotPosts = true;
      done();
    });
    return () => {
      cancelTeacher();
      cancelPosts();
    };
  }, [id, teacherId]);

  async function updateAvatar(url: string | null) {
    const res = await fetch(`/api/teachers/${teacherId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarUrl: url }),
    });
    const d = await res.json().catch(() => null);
    if (!res.ok) throw new Error(d?.error || "Profilbild konnte nicht gespeichert werden.");
    setTeacher((t) => (t ? { ...t, avatarUrl: url } : t));
  }

  async function deleteTeacher() {
    if (!confirm("Diese Lehrperson mit allen Beiträgen löschen?")) return;
    const res = await fetch(`/api/teachers/${teacherId}`, { method: "DELETE" });
    if (res.ok) router.push(`/classes/${id}?tab=Lehrpersonen`);
  }

  if (loading) return <PageLoading />;
  if (!teacher) return <p className="text-coral font-bold">Lehrperson nicht gefunden.</p>;

  const cover = posts.find((p) => p.imageUrl);
  const imageUrls = Array.from(new Set(posts.map((p) => p.imageUrl).filter(Boolean) as string[]));
  const shown = posts.filter((p) => (
    tab === "Alle" ? true : tab === "Zitate" ? p.kind === "QUOTE" : tab === "Bilder" ? p.kind === "IMAGE" : p.kind === "TEXT"
  ));

  return (
    <PageReveal>
    <div className="space-y-4">
      <Link href={`/classes/${id}?tab=Lehrpersonen`} className="text-sm text-muted">← {teacher.className}</Link>

      {/* Hero */}
      <div className="card p-6 flex flex-col items-center text-center">
        <ProfileImagePicker
          name={teacher.name}
          accent={teacher.accentColor}
          manualUrl={teacher.avatarUrl}
          fallbackUrl={cover?.imageUrl ?? null}
          images={imageUrls}
          onChange={updateAvatar}
        />
        <h1 className="display text-4xl mt-3">{teacher.name}</h1>
        <p className="text-muted text-sm">{teacher.subject ? `${teacher.subject} · ` : ""}Lehrperson · {posts.length} Beiträge</p>
        <button onClick={deleteTeacher} className="text-xs text-coral underline mt-2">Lehrperson löschen</button>
      </div>

      {/* Add */}
      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="btn-accent w-full">Zitat / Bild / Post-it hinzufügen</button>
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
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.length === 0 ? (
          <p className="text-muted py-6 text-center md:col-span-2 xl:col-span-3">Noch nichts über {teacher.name}. Mach den Anfang!</p>
        ) : (
          shown.map((p) => (
            <PostCard key={p.id} post={p} showContext={false} onDeleted={(pid) => setPosts((ps) => ps.filter((x) => x.id !== pid))} />
          ))
        )}
      </div>
    </div>
    </PageReveal>
  );
}
