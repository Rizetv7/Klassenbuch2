"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearApiCache } from "@/lib/swr";

export function LoginCard() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      if (res.ok) {
        clearApiCache(); // never show another account's cached data
        router.push("/");
        router.refresh();
        return;
      }
      const msg = await res.json().catch(() => null);
      setError(msg?.error || `Anmeldung fehlgeschlagen (Fehler ${res.status}).`);
    } catch {
      setError("Verbindung zum Server fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[78vh] max-w-sm flex-col justify-center px-1">
      <div className="mb-5 text-center">
        <p className="section-label mb-2">Anmelden</p>
        <h1 className="display text-6xl leading-[0.86]">Maturaziitig</h1>
      </div>

      <form onSubmit={submit} className="glass-panel space-y-3 p-5">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
        </div>
        <div>
          <label className="label">Passwort</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Passwort" required />
        </div>
        {error && <p className="text-sm font-black text-coral">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Anmelden..." : "Anmelden"}
        </button>
      </form>

      <p className="mt-4 text-center text-xs font-bold text-ink/55">
        Noch kein Konto? <Link href="/register" className="text-ink underline">Registrieren</Link>
      </p>
    </div>
  );
}
