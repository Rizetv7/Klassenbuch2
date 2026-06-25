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
  memberType: string;
  memberCount: number;
  postCount: number;
};

export default function ClassesPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassItem[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createType, setCreateType] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [joinCode, setJoinCode] = useState("");
  const [joinType, setJoinType] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/classes");
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    setClasses((await res.json()).classes);
  }
  useEffect(() => {
    load();
  }, []);

  async function createClass(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, memberType: createType }),
    });
    const d = await res.json();
    if (res.ok) router.push(`/classes/${d.id}`);
    else setError(d.error || "Fehler.");
  }

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Meine Klassen</h1>

      {classes === null ? (
        <p className="text-gray-400">Lädt…</p>
      ) : classes.length === 0 ? (
        <p className="text-gray-500">Du bist noch in keiner Klasse.</p>
      ) : (
        <div className="grid gap-3">
          {classes.map((c) => (
            <Link key={c.id} href={`/classes/${c.id}`} className="card p-4 hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">{c.name}</h2>
                  {c.description && <p className="text-sm text-gray-500">{c.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {c.memberCount} Mitglieder · {c.postCount} Beiträge
                    {c.role === "OWNER" && " · 👑 Ersteller:in"}
                    {c.role === "MODERATOR" && " · 🛡️ Moderator:in"}
                  </p>
                </div>
                <span className="text-xs font-mono bg-gray-100 rounded px-2 py-1">{c.joinCode}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="grid md:grid-cols-2 gap-4">
        <form onSubmit={createClass} className="card p-4 space-y-3">
          <h3 className="font-semibold">➕ Neue Klasse erstellen</h3>
          <input className="input" placeholder="Klassenname (z. B. 10b 2026)" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="input" placeholder="Beschreibung (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <select className="input" value={createType} onChange={(e) => setCreateType(e.target.value as "STUDENT" | "TEACHER")}>
            <option value="STUDENT">Ich bin Schüler:in</option>
            <option value="TEACHER">Ich bin Lehrer:in</option>
          </select>
          <button className="btn-primary w-full">Erstellen</button>
        </form>

        <form onSubmit={join} className="card p-4 space-y-3">
          <h3 className="font-semibold">🔑 Klasse beitreten</h3>
          <input className="input uppercase" placeholder="Beitritts-Code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} required />
          <select className="input" value={joinType} onChange={(e) => setJoinType(e.target.value as "STUDENT" | "TEACHER")}>
            <option value="STUDENT">Ich bin Schüler:in</option>
            <option value="TEACHER">Ich bin Lehrer:in</option>
          </select>
          <button className="btn-primary w-full">Beitreten</button>
        </form>
      </div>
    </div>
  );
}
