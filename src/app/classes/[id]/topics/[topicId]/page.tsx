"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PostCard, type Post } from "@/components/PostCard";
import { CreatePost } from "@/components/CreatePost";

type TopicDetail = {
  id: string;
  name: string;
  classId: string;
  className: string;
  canDelete: boolean;
};

export default function TopicPage() {
  const { id, topicId } = useParams<{ id: string; topicId: string }>();
  const router = useRouter();
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await fetch(`/api/topics/${topicId}`);
      if (t.status === 401) return router.push("/login");
      if (!t.ok) return setLoading(false);
      setTopic(await t.json());
      const d = await fetch(`/api/posts?classId=${id}&topicId=${topicId}`).then((r) => r.json());
      setPosts(d.posts ?? []);
      setLoading(false);
    })();
  }, [id, topicId]);

  async function deleteTopic() {
    if (!confirm("Dieses Projekt mit allen Beiträgen löschen?")) return;
    const res = await fetch(`/api/topics/${topicId}`, { method: "DELETE" });
    if (res.ok) router.push(`/classes/${id}`);
  }

  if (loading) return <p className="text-muted">Lädt…</p>;
  if (!topic) return <p className="text-coral font-bold">Projekt nicht gefunden.</p>;

  const cover = posts.find((p) => p.imageUrl);
  const featuredText = posts.find((p) => p.text)?.text;
  const stack = posts.filter((p) => p.imageUrl).slice(0, 3);

  return (
    <div className="space-y-6">
      <Link href={`/classes/${id}`} className="text-sm font-black text-ink/60">← {topic.className}</Link>

      <section className="hero-frame overflow-hidden p-0">
        <div className="project-cover min-h-[430px] rounded-none border-0">
          {cover?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
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
        {(featuredText || stack.length > 1) && (
          <div className="relative z-10 grid gap-4 p-5 sm:p-6 md:grid-cols-[1fr_auto]">
            {featuredText && (
              <div className="glass-card p-5">
                <p className="font-hand text-4xl leading-[0.95] text-hotpink">{featuredText}</p>
              </div>
            )}
            {stack.length > 1 && (
              <div className="flex -space-x-9 self-center justify-self-center">
                {stack.map((p, index) => (
                  <div key={p.id} className={`polaroid w-28 ${index === 1 ? "rotate-3" : index === 2 ? "-rotate-3" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.imageUrl!} alt="" className="aspect-square w-full rounded-[18px] object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="btn-accent w-full">Bild / Zitat / Notiz hinzufügen</button>
      ) : (
        <div className="space-y-2">
          <CreatePost classId={id} topicId={topicId} onCreated={(p) => { setPosts((ps) => [p, ...ps]); setShowAdd(false); }} />
          <button onClick={() => setShowAdd(false)} className="text-sm text-muted underline w-full text-center">Abbrechen</button>
        </div>
      )}

      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="glass-panel p-8 text-center font-bold text-ink/60">Noch nichts hier. Mach den Anfang!</div>
        ) : (
          posts.map((p) => (
            <PostCard key={p.id} post={p} showContext={false} onDeleted={(pid) => setPosts((ps) => ps.filter((x) => x.id !== pid))} />
          ))
        )}
      </div>
    </div>
  );
}
