"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
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
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
        return;
      }
      const msg = await res.json().catch(() => null);
      setError(
        msg?.error ||
          `Anmeldung fehlgeschlagen (Serverfehler ${res.status}). Ist die Datenbank korrekt eingerichtet?`
      );
    } catch {
      setError("Verbindung zum Server fehlgeschlagen. Bitte später erneut versuchen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto card p-6 mt-8">
      <h1 className="text-xl font-bold mb-4">Anmelden</h1>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">E-Mail</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label">Passwort</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Anmelden…" : "Anmelden"}
        </button>
      </form>
      <p className="text-sm text-gray-500 mt-4 text-center">
        Noch kein Konto?{" "}
        <Link href="/register" className="text-brand-600 font-medium">Registrieren</Link>
      </p>
    </div>
  );
}
