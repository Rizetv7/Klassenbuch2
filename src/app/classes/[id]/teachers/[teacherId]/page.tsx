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

const TABS = ["Alle", "Zitate", "Bilder", "Notizen"] as const;
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
  const heroQuote = posts.find((p) => p.kind === "QUOTE" && p.text);
  const counts = {
    Alle: posts.length,
    Zitate: posts.filter((p) => p.kind === "QUOTE").length,
    Bilder: posts.filter((p) => p.kind === "IMAGE").length,
    Notizen: posts.filter((p) => p.kind === "TEXT").length,
  } as Record<Tab, number>;
  const shown = posts.filter((p) => (
    tab === "Alle" ? true : tab === "Zitate" ? p.kind === "QUOTE" : tab === "Bilder" ? p.kind === "IMAGE" : p.kind === "TEXT"
  ));

  return (
    <PageReveal>
    <div className="space-y-4">
      <Link
        href={`/classes/${id}?tab=Lehrpersonen`}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/25 px-3 py-1.5 text-xs font-black text-ink/65 transition hover:bg-white/40 hover:text-ink active:scale-95"
      >
        ← {teacher.className}
      </Link>

      {/* Hero: compact identity card, tidy on phones */}
      <section className="hero-frame overflow-hidden">
        {cover?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.imageUrl} alt="" fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-[0.16]" />
        )}
        <div className="relative z-10 p-4 sm:p-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <ProfileImagePicker
              name={teacher.name}
              accent={teacher.accentColor}
              manualUrl={teacher.avatarUrl}
              fallbackUrl={cover?.imageUrl ?? null}
              images={imageUrls}
              onChange={updateAvatar}
            />
            <div className="min-w-0 flex-1">
              <p className="section-label">{teacher.subject || "Lehrperson"}</p>
              <h1 className="display mt-1 break-words text-4xl leading-[0.9] sm:text-6xl">{teacher.name}</h1>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="chip">{counts.Zitate} Zitate</span>
                <span className="chip">{counts.Bilder} Bilder</span>
                <span className="chip">{counts.Notizen} Notizen</span>
              </div>
            </div>
          </div>
          {heroQuote?.text && (
            <blockquote className="soft-divider mt-4 pt-4">
              <p className="quote-big !text-xl leading-[1.05] sm:!text-2xl">“{heroQuote.text}”</p>
            </blockquote>
          )}
          <button onClick={deleteTeacher} className="relative z-10 mt-3 text-xs font-black text-coral/80 underline transition hover:text-coral">
            Lehrperson löschen
          </button>
        </div>
      </section>

      {/* Add */}
      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="btn-accent w-full">+ Neuer Eintrag über {teacher.name.split(" ")[0]}</button>
      ) : (
        <div className="space-y-2">
          <CreatePost classId={id} teacherId={teacherId} onCreated={(p) => { setPosts((ps) => [p, ...ps]); setShowAdd(false); }} />
          <button onClick={() => setShowAdd(false)} className="w-full text-center text-sm font-bold text-muted underline">Abbrechen</button>
        </div>
      )}

      {/* Filter tabs with counts — horizontally scrollable on phones */}
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`tab shrink-0 ${tab === t ? "tab-active" : ""}`}>
            {t}
            <span className={`ml-1.5 rounded-full px-1.5 text-[10px] ${tab === t ? "bg-oncolor/20" : "bg-white/40 text-ink/55"}`}>{counts[t]}</span>
          </button>
        ))}
      </div>

      {/* Posts — re-animates cleanly on every filter switch */}
      <div key={tab} className="grid animate-fade-up gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.length === 0 ? (
          <div className="glass-panel p-8 text-center font-bold text-ink/60 md:col-span-2 xl:col-span-3">
            {tab === "Alle" ? `Noch nichts über ${teacher.name}. Mach den Anfang!` : `Noch keine ${tab} über ${teacher.name}.`}
          </div>
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
