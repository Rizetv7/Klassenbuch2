"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
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
    <div className="min-h-[80vh] flex flex-col justify-center max-w-sm mx-auto">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">📓</div>
        <h1 className="font-hand text-4xl">Klassenbuch</h1>
        <p className="text-muted text-sm">Euer digitales Erinnerungsbuch</p>
      </div>

      <form onSubmit={submit} className="card p-6 space-y-3">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Isai Graf" required />
        </div>
        <div>
          <label className="label">Passwort</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-coral font-bold">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Anmelden…" : "Anmelden"}
        </button>
      </form>

      <p className="text-sm text-muted mt-5 text-center">
        Noch kein Konto?{" "}
        <Link href="/register" className="text-ink font-bold underline">Registrieren</Link>
      </p>
    </div>
  );
}
