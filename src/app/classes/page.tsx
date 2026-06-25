"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ClassItem = {
  id: string;
  name: string;
  description: string | null;
  joinCode: string;
  role: string;
  memberCount: number;
  postCount: number;
};

export default function ClassesPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassItem[] | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinType, setJoinType] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // create fields
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [createType, setCreateType] = useState<"STUDENT" | "TEACHER">("STUDENT");

  async function load() {
    const res = await fetch("/api/classes");
    if (res.status === 401) return router.push("/login");
    setClasses((await res.json()).classes);
  }
  useEffect(() => {
    load();
  }, []);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/classes/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinCode, memberType: joinType }),
    });
    const d = await res.json();
    if (res.ok) router.push(`/classes/${d.id}`);
    else setError(d.error || "Fehler.");
  }

  async function createClass(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, school, gradYear, memberType: createType }),
    });
    const d = await res.json();
    if (res.ok) router.push(`/classes/${d.id}`);
    else setError(d.error || "Fehler.");
  }

  return (
    <div className="space-y-6">
      {/* Join — prominent */}
      <section className="card p-5 text-center">
        <h1 className="font-hand text-3xl mb-1">Tritt deiner Klasse bei</h1>
        <p className="text-muted text-sm mb-4">Gib den Code ein, den du bekommen hast.</p>
        <form onSubmit={join} className="space-y-3">
          <input
            className="input text-center text-2xl font-extrabold tracking-widest uppercase"
            placeholder="M5I-2026"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            required
          />
          <div className="flex gap-2 justify-center text-sm">
            <button type="button" onClick={() => setJoinType("STUDENT")} className={joinType === "STUDENT" ? "btn-primary" : "btn-soft"}>🎓 Schüler:in</button>
            <button type="button" onClick={() => setJoinType("TEACHER")} className={joinType === "TEACHER" ? "btn-primary" : "btn-soft"}>🧑‍🏫 Lehrer:in</button>
          </div>
          <button className="btn-accent w-full">Beitreten</button>
        </form>
      </section>

      {error && <p className="text-sm text-coral font-bold text-center">{error}</p>}

      {/* My classes */}
      {classes && classes.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-extrabold">Meine Klassen</h2>
          {classes.map((c) => (
            <Link key={c.id} href={`/classes/${c.id}`} className="card p-4 flex items-center justify-between hover:shadow-soft transition">
              <div>
                <h3 className="font-extrabold">{c.name}</h3>
                <p className="text-xs text-muted">
                  {c.memberCount} Mitglieder · {c.postCount} Erinnerungen
                  {c.role === "OWNER" && " · 👑"}
                  {c.role === "MODERATOR" && " · 🛡️"}
                </p>
              </div>
              <span className="text-xs font-mono chip">{c.joinCode}</span>
            </Link>
          ))}
        </section>
      )}

      {/* Create — subtle */}
      <section>
        {!showCreate ? (
          <button onClick={() => setShowCreate(true)} className="text-sm text-muted underline w-full text-center">
            Neue Klasse erstellen
          </button>
        ) : (
          <form onSubmit={createClass} className="card p-5 space-y-3">
            <h2 className="font-extrabold">Neue Klasse erstellen</h2>
            <input className="input" placeholder="Klassenname (z. B. M5i)" value={name} onChange={(e) => setName(e.target.value)} required />
            <input className="input" placeholder="Schule (optional)" value={school} onChange={(e) => setSchool(e.target.value)} />
            <input className="input" placeholder="Abschlussjahr (optional)" value={gradYear} onChange={(e) => setGradYear(e.target.value)} />
            <select className="input" value={createType} onChange={(e) => setCreateType(e.target.value as "STUDENT" | "TEACHER")}>
              <option value="STUDENT">Ich bin Schüler:in</option>
              <option value="TEACHER">Ich bin Lehrer:in</option>
            </select>
            <div className="flex gap-2">
              <button className="btn-accent flex-1">Erstellen</button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-soft">Abbrechen</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
