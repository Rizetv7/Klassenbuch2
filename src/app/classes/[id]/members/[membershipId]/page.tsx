"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PostCard, type Post } from "@/components/PostCard";
import { CreatePost } from "@/components/CreatePost";
import { PageLoading, PageReveal } from "@/components/LoadingState";
import { ProfileImagePicker } from "@/components/ProfileImagePicker";
import { swrJson } from "@/lib/swr";

type Member = { id: string; displayName: string; memberType: string; avatarUrl: string | null; manualAvatarUrl: string | null; accentColor: string | null };

const TABS = ["Alle", "Zitate", "Bilder", "Notizen"] as const;
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
    // both requests run in parallel and render from cache instantly on repeat visits
    let gotClass = false;
    let gotPosts = false;
    const done = () => {
      if (gotClass && gotPosts) setLoading(false);
    };
    const cancelClass = swrJson<{ name: string; members: Member[] }>(`/api/classes/${id}`, (clsData, meta) => {
      if (!clsData) {
        if (meta.status === 401) router.push("/login");
        return;
      }
      setClassName(clsData.name);
      setMember(clsData.members.find((m: Member) => m.id === membershipId) ?? null);
      gotClass = true;
      done();
    });
    const cancelPosts = swrJson<{ posts?: Post[] }>(`/api/posts?classId=${id}&subjectMembershipId=${membershipId}`, (d) => {
      if (!d) return;
      setPosts(d.posts ?? []);
      gotPosts = true;
      done();
    });
    return () => {
      cancelClass();
      cancelPosts();
    };
  }, [id, membershipId]);

  if (loading) return <PageLoading />;
  if (!member) return <p className="text-coral font-bold">Person nicht gefunden.</p>;

  const isTeacher = member.memberType === "TEACHER";
  const firstName = member.displayName.split(" ")[0];
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
    <div className="space-y-4">
      <Link
        href={`/classes/${id}`}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/25 px-3 py-1.5 text-xs font-black text-ink/65 transition hover:bg-white/40 hover:text-ink active:scale-95"
      >
        ← {className}
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
              name={member.displayName}
              accent={member.accentColor}
              manualUrl={member.manualAvatarUrl}
              fallbackUrl={cover?.imageUrl ?? null}
              images={imageUrls}
              onChange={updateAvatar}
            />
            <div className="min-w-0 flex-1">
              <p className="section-label">{isTeacher ? "Lehrperson" : "Schüler:in"}</p>
              <h1 className="display mt-1 break-words text-4xl leading-[0.9] sm:text-6xl">{member.displayName}</h1>
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
        </div>
      </section>

      {/* Add */}
      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="btn-accent w-full">
          + Neuer Eintrag über {firstName}
        </button>
      ) : (
        <div className="space-y-2">
          <CreatePost classId={id} subjectMembershipId={membershipId} onCreated={(p) => { setPosts((ps) => [p, ...ps]); setShowAdd(false); }} />
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
            {tab === "Alle" ? `Noch nichts über ${firstName}. Mach den Anfang!` : `Noch keine ${tab} über ${firstName}.`}
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
