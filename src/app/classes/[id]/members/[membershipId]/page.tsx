"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PostCard, type Post } from "@/components/PostCard";
import { CreatePost } from "@/components/CreatePost";
import { PageLoading, PageReveal } from "@/components/LoadingState";
import { ProfileImagePicker } from "@/components/ProfileImagePicker";

type Member = { id: string; displayName: string; memberType: string; avatarUrl: string | null; manualAvatarUrl: string | null; accentColor: string | null };

const TABS = ["Alle", "Zitate", "Bilder", "Post-its"] as const;
type Tab = (typeof TABS)[number];

export default function MemberPage() {
  const { id, membershipId } = useParams<{ id: string; membershipId: string }>();
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [className, setClassName] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<Tab>("Alle");
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const cls = await fetch(`/api/classes/${id}`);
      if (cls.status === 401) return router.push("/login");
      const clsData = await cls.json();
      setClassName(clsData.name);
      setMember(clsData.members.find((m: Member) => m.id === membershipId) ?? null);
      const d = await fetch(`/api/posts?classId=${id}&subjectMembershipId=${membershipId}`).then((r) => r.json());
      setPosts(d.posts ?? []);
      setLoading(false);
    })();
  }, [id, membershipId]);

  if (loading) return <PageLoading />;
  if (!member) return <p className="text-coral font-bold">Person nicht gefunden.</p>;

  const isTeacher = member.memberType === "TEACHER";
  const firstName = member.displayName.split(" ")[0];
  const cover = posts.find((p) => p.imageUrl);
  const imageUrls = Array.from(new Set(posts.map((p) => p.imageUrl).filter(Boolean) as string[]));
  const heroQuote = posts.find((p) => p.kind === "QUOTE" && p.text);
  const shown = posts.filter((p) => (
    tab === "Alle" ? true : tab === "Zitate" ? p.kind === "QUOTE" : tab === "Bilder" ? p.kind === "IMAGE" : p.kind === "TEXT"
  ));

  async function updateAvatar(url: string | null) {
    const res = await fetch(`/api/classes/${id}/members/${membershipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarUrl: url }),
    });
    const d = await res.json().catch(() => null);
    if (!res.ok) throw new Error(d?.error || "Profilbild konnte nicht gespeichert werden.");
    setMember((current) => (current ? { ...current, manualAvatarUrl: d.avatarUrl ?? null } : current));
  }

  return (
    <PageReveal>
    <div className="space-y-6">
      <Link href={`/classes/${id}`} className="text-sm font-black text-ink/60">← {className}</Link>

      {/* Hero */}
      <section className="hero-frame min-h-[380px] p-5 sm:p-7">
        {cover?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.imageUrl} alt="" fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-24" />
        )}
        <div className="relative z-10 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
          <ProfileImagePicker
            name={member.displayName}
            accent={member.accentColor}
            manualUrl={member.manualAvatarUrl}
            fallbackUrl={cover?.imageUrl ?? null}
            images={imageUrls}
            onChange={updateAvatar}
          />
          <div className="glass-card p-5">
            <p className="section-label mb-2">{isTeacher ? "Lehrperson" : "Schüler:in"}</p>
            <h1 className="display break-words text-6xl leading-[0.86] sm:text-7xl">{member.displayName}</h1>
            {heroQuote?.text && <p className="mt-5 font-hand text-4xl leading-[0.95] text-hotpink">{heroQuote.text}</p>}
            <p className="mt-4 text-sm font-black text-ink/60">{posts.length} Beiträge</p>
          </div>
        </div>
      </section>

      {/* Add */}
      {!showAdd ? (
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)} className="btn-accent flex-1">{isTeacher ? "Lehrerzitat" : "Zitat"} / Bild / Post-it hinzufügen</button>
        </div>
      ) : (
        <div className="space-y-2">
          <CreatePost classId={id} subjectMembershipId={membershipId} onCreated={(p) => { setPosts((ps) => [p, ...ps]); setShowAdd(false); }} />
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
          <div className="glass-panel p-8 text-center font-bold text-ink/60 md:col-span-2 xl:col-span-3">Noch nichts über {firstName}. Mach den Anfang!</div>
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
