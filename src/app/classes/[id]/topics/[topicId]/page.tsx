"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PostCard, type Post } from "@/components/PostCard";
import { CreatePost } from "@/components/CreatePost";
import { IconClose } from "@/components/Icons";

type TopicDetail = { id: string; name: string; classId: string; className: string; canDelete: boolean };
type Person = { id: string; name: string };

export default function TopicPage() {
  const { id, topicId } = useParams<{ id: string; topicId: string }>();
  const router = useRouter();
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [lightbox, setLightbox] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await fetch(`/api/topics/${topicId}`);
      if (t.status === 401) return router.push("/login");
      if (!t.ok) return setLoading(false);
      setTopic(await t.json());

      const [d, cls, teach] = await Promise.all([
        fetch(`/api/posts?classId=${id}&topicId=${topicId}&limit=100`).then((r) => r.json()),
        fetch(`/api/classes/${id}`).then((r) => r.json()),
        fetch(`/api/classes/${id}/teachers`).then((r) => r.json()),
      ]);
      setPosts(d.posts ?? []);
      const members: Person[] = (cls.members ?? []).map((m: { id: string; displayName: string }) => ({ id: m.id, name: m.displayName }));
      const teachers: Person[] = (teach.teachers ?? []).map((tt: { id: string; name: string }) => ({ id: `t_${tt.id}`, name: tt.name }));
      setPeople([...members, ...teachers]);
      setLoading(false);
    })();
  }, [id, topicId]);

  async function deleteTopic() {
    if (!confirm("Dieses Projekt mit allen Beiträgen löschen?")) return;
    const res = await fetch(`/api/topics/${topicId}`, { method: "DELETE" });
    if (res.ok) router.push(`/classes/${id}?tab=Projekte`);
  }

  function removePost(pid: string) {
    setPosts((ps) => ps.filter((x) => x.id !== pid));
    setLightbox(null);
  }

  if (loading) return <p className="text-muted">Lädt…</p>;
  if (!topic) return <p className="text-coral font-bold">Projekt nicht gefunden.</p>;

  const cover = posts.find((p) => p.imageUrl);
  const images = posts.filter((p) => p.kind === "IMAGE" && p.imageUrl);
  const others = posts.filter((p) => p.kind !== "IMAGE");

  return (
    <div className="space-y-6">
      <Link href={`/classes/${id}?tab=Projekte`} className="text-sm font-black text-ink/60">← {topic.className}</Link>

      <section className="hero-frame overflow-hidden p-0">
        <div className="project-cover min-h-[380px] rounded-none border-0">
          {cover?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover.imageUrl} alt="" fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-hotpink/40" />
          <div className="absolute inset-x-0 bottom-0 z-10 p-5 sm:p-8">
            <p className="section-label mb-3">Projekt</p>
            <h1 className="display max-w-4xl break-words text-6xl leading-[0.82] sm:text-8xl">{topic.name}</h1>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="chip">{posts.length} Beiträge</span>
              {topic.canDelete && (
                <button onClick={deleteTopic} className="chip text-coral">Projekt löschen</button>
              )}
            </div>
          </div>
        </div>
      </section>

      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="btn-accent w-full">Bild / Zitat / Notiz hinzufügen</button>
      ) : (
        <div className="space-y-2">
          <CreatePost classId={id} topicId={topicId} people={people} onCreated={(p) => { setPosts((ps) => [p, ...ps]); setShowAdd(false); }} />
          <button onClick={() => setShowAdd(false)} className="text-sm text-muted underline w-full text-center">Abbrechen</button>
        </div>
      )}

      {posts.length === 0 && <div className="glass-panel p-8 text-center font-bold text-ink/60">Noch nichts hier. Mach den Anfang!</div>}

      {/* Photo gallery */}
      {images.length > 0 && (
        <section>
          <p className="section-label mb-3">Galerie</p>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {images.map((p) => (
              <button key={p.id} onClick={() => setLightbox(p)} className="aspect-square overflow-hidden rounded-[18px] transition hover:-translate-y-0.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl!} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Quotes & notes */}
      {others.length > 0 && (
        <section className="space-y-4">
          <p className="section-label">Zitate &amp; Notizen</p>
          {others.map((p) => (
            <PostCard key={p.id} post={p} showContext={false} onDeleted={removePost} />
          ))}
        </section>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setLightbox(null)}>
          <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setLightbox(null)} className="mb-2 ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink">
              <IconClose size={18} />
            </button>
            <PostCard post={lightbox} showContext={false} onDeleted={removePost} />
          </div>
        </div>
      )}
    </div>
  );
}
