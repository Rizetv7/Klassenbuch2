"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ClassItem = { id: string; name: string };

export default function ProjectsPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassItem[] | null>(null);

  useEffect(() => {
    fetch("/api/classes").then((r) => {
      if (r.status === 401) return router.push("/login");
      return r.json().then((d) => setClasses(d.classes ?? []));
    });
  }, []);

  if (!classes) return <p className="text-muted">Lädt…</p>;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-hand text-4xl">🎨 Projekte</h1>
        <p className="text-muted text-sm">Kreative Boards eurer Klasse — Pinnwand, Foto-Album & Zitate-Wand.</p>
      </header>

      {classes.length === 0 ? (
        <div className="card p-8 text-center text-muted">
          <p className="mb-3">Tritt zuerst einer Klasse bei.</p>
          <Link href="/classes" className="btn-accent">Zu den Klassen</Link>
        </div>
      ) : (
        classes.map((c) => (
          <section key={c.id} className="space-y-2">
            <h2 className="font-extrabold">{c.name}</h2>
            <div className="grid grid-cols-3 gap-3">
              <BoardTile href={`/classes/${c.id}/postit`} className="postit !rotate-0" emoji="📌" label="Pinnwand" />
              <BoardTile href={`/classes/${c.id}?tab=Bilder`} className="polaroid !rotate-0" emoji="📷" label="Foto-Album" />
              <BoardTile href={`/classes/${c.id}?tab=Zitate`} className="card" emoji="💬" label="Zitate-Wand" />
            </div>
          </section>
        ))
      )}

      <p className="text-xs text-muted text-center pt-2">
        Weitere Board-Typen (Voting, Scrapbook, Sticker-Board) folgen.
      </p>
    </div>
  );
}

function BoardTile({ href, className, emoji, label }: { href: string; className: string; emoji: string; label: string }) {
  return (
    <Link href={href} className={`${className} aspect-square flex flex-col items-center justify-center gap-1 text-center hover:-translate-y-1 transition`}>
      <span className="text-3xl">{emoji}</span>
      <span className="text-sm font-bold">{label}</span>
    </Link>
  );
}
