"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PostCard, type Post } from "@/components/PostCard";

export default function HomePage() {
  const [me, setMe] = useState<{ name: string } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me").then((r) => r.json());
      setMe(meRes.user);
      if (meRes.user) {
        const d = await fetch("/api/posts").then((r) => r.json());
        setPosts(d.posts ?? []);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-gray-400">Lädt…</p>;

  if (!me) {
    return (
      <div className="text-center py-16">
        <h1 className="text-3xl font-bold mb-3">📓 Das digitale Klassenbuch</h1>
        <p className="text-gray-500 max-w-md mx-auto mb-6">
          Sammelt eure besten Zitate, Bilder und Erinnerungen — gemeinsam mit
          eurer ganzen Klasse. Liken, kommentieren, festhalten.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/register" className="btn-primary">Loslegen</Link>
          <Link href="/login" className="btn-ghost">Anmelden</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hallo {me.name.split(" ")[0]} 👋</h1>
        <Link href="/classes" className="btn-ghost">Meine Klassen</Link>
      </div>

      {posts.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          <p className="mb-3">Noch nichts im Feed.</p>
          <Link href="/classes" className="btn-primary">Klasse erstellen oder beitreten</Link>
        </div>
      ) : (
        posts.map((p) => (
          <PostCard key={p.id} post={p} onDeleted={(id) => setPosts((ps) => ps.filter((x) => x.id !== id))} />
        ))
      )}
    </div>
  );
}
