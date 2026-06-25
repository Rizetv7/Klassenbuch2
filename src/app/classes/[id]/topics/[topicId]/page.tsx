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

  return (
    <div className="space-y-4">
      <Link href={`/classes/${id}`} className="text-sm text-muted">← {topic.className}</Link>

      <div className="card p-6 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-ink/45">Projekt</p>
        <h1 className="display text-4xl mt-1">{topic.name}</h1>
        <p className="text-muted text-sm">{posts.length} Beiträge</p>
        {topic.canDelete && (
          <button onClick={deleteTopic} className="text-xs text-coral underline mt-2">Projekt löschen</button>
        )}
      </div>

      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="btn-accent w-full">Bild / Zitat / Notiz hinzufügen</button>
      ) : (
        <div className="space-y-2">
          <CreatePost classId={id} topicId={topicId} onCreated={(p) => { setPosts((ps) => [p, ...ps]); setShowAdd(false); }} />
          <button onClick={() => setShowAdd(false)} className="text-sm text-muted underline w-full text-center">Abbrechen</button>
        </div>
      )}

      <div className="space-y-3">
        {posts.length === 0 ? (
          <p className="text-muted text-center py-6">Noch nichts hier. Mach den Anfang!</p>
        ) : (
          posts.map((p) => (
            <PostCard key={p.id} post={p} showContext={false} onDeleted={(pid) => setPosts((ps) => ps.filter((x) => x.id !== pid))} />
          ))
        )}
      </div>
    </div>
  );
}
