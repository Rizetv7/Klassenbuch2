"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageLoading, PageReveal } from "@/components/LoadingState";
import { prefetchJson, swrJson } from "@/lib/swr";

type ClassItem = { id: string; name: string; role: string; memberCount: number; postCount: number };

export default function ClassesPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassItem[] | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // create fields
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [gradYear, setGradYear] = useState("");

  useEffect(() => {
    const cancel = swrJson<{ classes?: ClassItem[] }>("/api/classes", (data, meta) => {
      if (!data) {
        if (meta.status === 401) router.push("/login");
        return;
      }
      const list = data.classes ?? [];
      // Already in exactly one class -> go straight there (cache makes this instant).
      if (list.length === 1) {
        prefetchJson(`/api/classes/${list[0].id}`);
        router.replace(`/classes/${list[0].id}`);
        return;
      }
      setClasses(list);
    });
    return cancel;
  }, []);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/classes/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode }),
      });
      const d = await res.json();
      if (res.ok) router.push(`/classes/${d.id}`);
      else setError(d.error || "Fehler.");
    } finally {
      setBusy(false);
    }
  }

  async function createClass(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, school, gradYear }),
      });
      const d = await res.json();
      if (res.ok) router.push(`/classes/${d.id}`);
      else setError(d.error || "Fehler.");
    } finally {
      setBusy(false);
    }
  }

  if (classes === null) return <PageLoading />;

  // User already in classes (more than one) -> let them pick.
  if (classes.length > 0) {
    return (
      <PageReveal>
      <div className="space-y-6">
        <header>
          <p className="section-label mb-2">Auswahl</p>
          <h1 className="display text-6xl leading-[0.86] sm:text-7xl">Deine Klassen</h1>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          {classes.map((c, index) => (
            <Link
              key={c.id}
              href={`/classes/${c.id}`}
              className={`glass-card group min-h-[220px] p-5 transition hover:-translate-y-1 ${index % 2 ? "sm:mt-8" : ""}`}
            >
              <div className="flex h-full flex-col justify-between">
                <div>
                  <span className="chip mb-5">{c.role === "OWNER" ? "Eigene Klasse" : "Mitglied"}</span>
                  <h3 className="display break-words text-5xl leading-[0.86]">{c.name}</h3>
                </div>
                <div className="mt-8 flex items-end justify-between gap-4">
                  <p className="text-sm font-black text-ink/60">
                    {c.memberCount} Mitglieder<br />
                    {c.postCount} Erinnerungen
                  </p>
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-ink text-2xl font-black text-white transition group-hover:translate-x-1">›</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      </PageReveal>
    );
  }

  // No class yet -> join or create.
  return (
    <PageReveal>
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      <section className="hero-frame p-5 text-center sm:p-7">
        <p className="section-label mb-2">Einladungscode</p>
        <h1 className="display text-5xl leading-[0.86] sm:text-7xl">Tritt deiner Klasse bei</h1>
        <p className="mx-auto mb-5 mt-4 max-w-sm text-sm font-black text-ink/60">Gib den Code ein, den du bekommen hast.</p>
        <form onSubmit={join} className="relative z-10 space-y-3">
          <input
            className="input text-center font-mono text-3xl font-black uppercase"
            placeholder="M5I-2026"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            required
          />
          <button className="btn-accent w-full" disabled={busy}>{busy ? "…" : "Beitreten"}</button>
        </form>
        {error && <p className="relative z-10 mt-3 text-sm font-black text-coral">{error}</p>}
      </section>

      <section className="space-y-3">
        {!showCreate ? (
          <button onClick={() => setShowCreate(true)} className="glass-card w-full p-6 text-left transition hover:-translate-y-1">
            <span className="section-label">Noch kein Code?</span>
            <span className="display mt-3 block text-5xl leading-[0.88]">Neue Klasse erstellen</span>
            <span className="mt-4 block text-sm font-black text-ink/60">Für eine eigene Sammlung mit Beitritts-Code.</span>
          </button>
        ) : (
          <form onSubmit={createClass} className="glass-card space-y-3 p-5">
            <div>
              <p className="section-label mb-1">Neu</p>
              <h2 className="display text-5xl leading-[0.88]">Klasse erstellen</h2>
            </div>
            <input className="input" placeholder="Klassenname (z. B. M5i)" value={name} onChange={(e) => setName(e.target.value)} required />
            <input className="input" placeholder="Schule (optional)" value={school} onChange={(e) => setSchool(e.target.value)} />
            <input className="input" placeholder="Abschlussjahr (optional)" value={gradYear} onChange={(e) => setGradYear(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn-accent flex-1" disabled={busy}>{busy ? "…" : "Erstellen"}</button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-soft">Abbrechen</button>
            </div>
          </form>
        )}
      </section>
    </div>
    </PageReveal>
  );
}
