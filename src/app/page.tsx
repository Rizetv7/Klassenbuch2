"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PostCard, type Post } from "@/components/PostCard";

export default function HomePage() {
  const [me, setMe] = useState<{ name: string } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [memory, setMemory] = useState<Post | null>(null);
  const [hasClass, setHasClass] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me").then((r) => r.json());
      setMe(meRes.user);
      if (meRes.user) {
        const [feed, rnd, cls] = await Promise.all([
          fetch("/api/posts").then((r) => r.json()),
          fetch("/api/posts?random=1").then((r) => r.json()),
          fetch("/api/classes").then((r) => r.json()),
        ]);
        setPosts(feed.posts ?? []);
        setMemory(rnd.posts?.[0] ?? null);
        setHasClass((cls.classes ?? []).length > 0);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Skeleton />;

  if (!me) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center">
        <h1 className="display text-5xl mb-3">Klassenbuch</h1>
        <p className="text-muted max-w-xs mb-6">
          Sammelt eure besten Zitate, Bilder und Momente — als gemeinsames Erinnerungsbuch der Klasse.
        </p>
        <div className="flex gap-3">
          <Link href="/register" className="btn-accent">Loslegen</Link>
          <Link href="/login" className="btn-soft">Anmelden</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="display text-4xl">Hey {me.name.split(" ")[0]}</h1>
        <p className="text-muted text-sm">Was ist heute neu in der Klasse?</p>
      </header>

      {memory && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/45">Erinnerung des Tages</h2>
          <PostCard post={memory} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-ink/45">Heute neu</h2>
        {posts.length === 0 ? (
          <div className="card p-8 text-center text-muted">
            {hasClass ? (
              <>
                <p className="mb-3">Noch nichts in deiner Klasse. Mach den Anfang!</p>
                <Link href="/classes" className="btn-accent">Zur Klasse</Link>
              </>
            ) : (
              <>
                <p className="mb-3">Du bist noch in keiner Klasse.</p>
                <Link href="/classes" className="btn-accent">Klasse beitreten</Link>
              </>
            )}
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
