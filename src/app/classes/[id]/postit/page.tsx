"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PostCard, type Post } from "@/components/PostCard";
import { CreatePost } from "@/components/CreatePost";

export default function PostitBoardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [className, setClassName] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const cls = await fetch(`/api/classes/${id}`);
      if (cls.status === 401) return router.push("/login");
      setClassName((await cls.json()).name);
      const d = await fetch(`/api/posts?classId=${id}&board=POSTIT`).then((r) => r.json());
      setPosts(d.posts ?? []);
      setLoading(false);
    })();
  }, [id]);

  return (
    <div className="space-y-4">
      <Link href={`/classes/${id}`} className="text-sm text-muted">← {className}</Link>
      <header>
        <h1 className="display text-4xl">Pinnwand</h1>
        <p className="text-muted text-sm">Notizen, Insider & Sprüche für alle — wie Post-its an der Wand.</p>
      </header>

      <CreatePost classId={id} board="POSTIT" onCreated={(p) => setPosts((ps) => [p, ...ps])} />

      {loading ? (
        <p className="text-muted">Lädt…</p>
      ) : posts.length === 0 ? (
        <p className="text-muted text-center py-6">Noch nichts angepinnt.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} showContext={false} onDeleted={(pid) => setPosts((ps) => ps.filter((x) => x.id !== pid))} />
          ))}
        </div>
      )}
    </div>
  );
}
