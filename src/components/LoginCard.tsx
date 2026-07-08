"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearApiCache } from "@/lib/swr";

type Step = "email" | "code" | "password";

export function LoginCard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  // resend countdown ticks once a second
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function finishLogin(account: { aminaMode?: boolean } | null) {
    clearApiCache(); // never show another account's cached data
    router.push(account?.aminaMode ? "/amina" : "/");
    router.refresh();
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/email/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const msg = await res.json().catch(() => null);
      if (res.ok) {
        setStep("code");
        setCode("");
        setCooldown(60);
        setTimeout(() => codeRef.current?.focus(), 50);
      } else {
        setError(msg?.error || `Senden fehlgeschlagen (Fehler ${res.status}).`);
      }
    } catch {
      setError("Verbindung zum Server fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(value: string) {
    if (busy || !/^\d{6}$/.test(value)) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: value }),
      });
      if (res.ok) {
        finishLogin(await res.json());
        return;
      }
      const msg = await res.json().catch(() => null);
      setError(msg?.error || `Anmeldung fehlgeschlagen (Fehler ${res.status}).`);
      setCode("");
      codeRef.current?.focus();
    } catch {
      setError("Verbindung zum Server fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword(e: React.FormEvent) {
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
        finishLogin(await res.json());
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

  function switchStep(next: Step) {
    setStep(next);
    setError("");
  }

  return (
    <div className="mx-auto flex min-h-[78vh] max-w-sm flex-col justify-center px-1">
      <div className="mb-5 text-center">
        <p className="section-label mb-2">Anmelden</p>
        <h1 className="display text-6xl leading-[0.86]">Maturaziitig</h1>
      </div>

      {step === "email" && (
        <form onSubmit={sendCode} className="glass-panel space-y-3 p-5 animate-fade-up">
          <div>
            <label className="label">Deine E-Mail</label>
            <input
              className="input"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@mail.ch"
              required
              autoFocus
            />
            <p className="mt-1.5 text-xs font-bold text-ink/50">
              Kein Passwort nötig — du bekommst einen Code per Mail.
            </p>
          </div>
          {error && <p className="text-sm font-black text-coral">{error}</p>}
          <button className="btn-primary w-full" disabled={busy || !email.trim()}>
            {busy ? "Wird gesendet…" : "Code senden"}
          </button>
          <button
            type="button"
            onClick={() => switchStep("password")}
            className="block w-full pt-1 text-center text-xs font-black text-ink/55 transition hover:text-ink"
          >
            Lieber mit Name & Passwort anmelden
          </button>
        </form>
      )}

      {step === "code" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitCode(code);
          }}
          className="glass-panel space-y-3 p-5 animate-fade-up"
        >
          <div>
            <label className="label">Code aus der Mail</label>
            <p className="mb-2 text-xs font-bold text-ink/55">
              Wir haben einen 6-stelligen Code an <span className="text-ink">{email}</span> geschickt. Schau auch im Spam nach.
            </p>
            <input
              ref={codeRef}
              className="input text-center text-2xl font-black tracking-[0.4em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(digits);
                if (digits.length === 6) void submitCode(digits); // auto-submit
              }}
              placeholder="••••••"
              required
            />
          </div>
          {error && <p className="text-sm font-black text-coral">{error}</p>}
          <button className="btn-primary w-full" disabled={busy || code.length !== 6}>
            {busy ? "Wird geprüft…" : "Anmelden"}
          </button>
          <div className="flex items-center justify-between pt-1 text-xs font-black text-ink/55">
            <button type="button" onClick={() => switchStep("email")} className="transition hover:text-ink">
              Andere E-Mail
            </button>
            <button
              type="button"
              onClick={() => void sendCode()}
              disabled={cooldown > 0 || busy}
              className="transition hover:text-ink disabled:opacity-50"
            >
              {cooldown > 0 ? `Neuer Code in ${cooldown}s` : "Code nochmal senden"}
            </button>
          </div>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={submitPassword} className="glass-panel space-y-3 p-5 animate-fade-up">
          <div>
            <label className="label">Name oder E-Mail</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name oder E-Mail"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">Passwort</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Passwort" required />
          </div>
          {error && <p className="text-sm font-black text-coral">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Anmelden…" : "Anmelden"}
          </button>
          <button
            type="button"
            onClick={() => switchStep("email")}
            className="block w-full pt-1 text-center text-xs font-black text-ink/55 transition hover:text-ink"
          >
            Ohne Passwort per E-Mail-Code anmelden
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-xs font-bold text-ink/55">
        Noch kein Konto? <Link href="/register" className="text-ink underline">Registrieren</Link>
      </p>
    </div>
  );
}
