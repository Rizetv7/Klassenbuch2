"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageReveal } from "@/components/LoadingState";

export default function InternalAccessPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/auth/me", { cache: "no-store" })
      .then((res) => {
        if (res.ok) router.replace("/archivzugang/uebersicht");
      })
      .catch(() => null)
      .finally(() => setChecking(false));
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Zugang nicht möglich.");
        return;
      }
      router.replace("/archivzugang/uebersicht");
      router.refresh();
    } catch {
      setError("Verbindung zum Server fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  if (checking) return null;

  return (
    <PageReveal>
      <div className="mx-auto flex min-h-[78vh] max-w-sm flex-col justify-center">
        <div className="mb-5 text-center">
          <p className="section-label mb-2">Archivzugang</p>
          <h1 className="display text-5xl leading-[0.9]">Interner Bereich</h1>
        </div>
        <form onSubmit={submit} className="glass-panel space-y-3 p-5">
          <div>
            <label className="label" htmlFor="internal-username">Kennung</label>
            <input
              id="internal-username"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="internal-password">Passwort</label>
            <input
              id="internal-password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error ? <p className="text-sm font-black text-coral">{error}</p> : null}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Prüft..." : "Öffnen"}
          </button>
        </form>
      </div>
    </PageReveal>
  );
}
