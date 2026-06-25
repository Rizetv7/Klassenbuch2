"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PostCard, type Post } from "@/components/PostCard";

export default function HomePage() {
  const [me, setMe] = useState<{ name: string } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [memory, setMemory] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me").then((r) => r.json());
      setMe(meRes.user);
      if (meRes.user) {
        const [feed, rnd] = await Promise.all([
          fetch("/api/posts").then((r) => r.json()),
          fetch("/api/posts?random=1").then((r) => r.json()),
        ]);
        setPosts(feed.posts ?? []);
        setMemory(rnd.posts?.[0] ?? null);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Skeleton />;

  if (!me) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center">
        <div className="text-6xl mb-3">📓</div>
        <h1 className="font-hand text-5xl mb-2">Klassenbuch</h1>
        <p className="text-muted max-w-xs mb-6">
          Sammelt eure besten Zitate, Bilder und Momente — als gemeinsames Erinnerungsbuch der Klasse.
        </p>
        <div className="flex gap-3">
          <Link href="/register" className="btn-accent">Loslegen ✨</Link>
          <Link href="/login" className="btn-soft">Anmelden</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-hand text-4xl">Hey {me.name.split(" ")[0]} 👋</h1>
        <p className="text-muted text-sm">Was ist heute neu in der Klasse?</p>
      </header>

      {memory && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🎞️</span>
            <h2 className="font-extrabold">Erinnerung des Tages</h2>
          </div>
          <div className="relative">
            <div className="absolute -inset-1 rounded-xl2 bg-butter/50 -rotate-1" />
            <div className="relative">
              <PostCard post={memory} />
            </div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <h2 className="font-extrabold">Heute neu</h2>
        </div>
        {posts.length === 0 ? (
          <div className="card p-8 text-center text-muted">
            <p className="mb-3">Noch nichts hier. Mach den Anfang!</p>
            <Link href="/classes" className="btn-accent">Klasse beitreten</Link>
          </div>
        ) : (
          posts.map((p) => (
            <PostCard key={p.id} post={p} onDeleted={(id) => setPosts((ps) => ps.filter((x) => x.id !== id))} />
          ))
        )}
      </section>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 w-40 bg-paper rounded-2xl" />
      <div className="h-40 bg-paper rounded-xl2" />
      <div className="h-40 bg-paper rounded-xl2" />
    </div>
  );
}
