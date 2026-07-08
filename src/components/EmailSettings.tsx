"use client";

import { useEffect, useRef, useState } from "react";

// Profile section for the login e-mail. Changing it is verified with a
// 6-digit code sent to the NEW address, so nobody can claim someone
// else's mailbox.
export function EmailSettings({ initialEmail }: { initialEmail: string | null }) {
  const [savedEmail, setSavedEmail] = useState(initialEmail);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"idle" | "code">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => setSavedEmail(initialEmail), [initialEmail]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setError("");
    setOkMsg("");
    setBusy(true);
    try {
      const res = await fetch("/api/profile/email/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const msg = await res.json().catch(() => null);
      if (res.ok) {
        setStage("code");
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

  async function confirm(value: string) {
    if (busy || !/^\d{6}$/.test(value)) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/profile/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: value }),
      });
      const msg = await res.json().catch(() => null);
      if (res.ok) {
        setSavedEmail(msg?.email ?? email);
        setStage("idle");
        setEmail("");
        setCode("");
        setOkMsg("E-Mail gespeichert! Damit kannst du dich jetzt ohne Passwort anmelden.");
      } else {
        setError(msg?.error || `Bestätigen fehlgeschlagen (Fehler ${res.status}).`);
        setCode("");
        codeRef.current?.focus();
      }
    } catch {
      setError("Verbindung zum Server fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass-card space-y-3 p-5">
      <div>
        <p className="section-label mb-1">Anmeldung per E-Mail</p>
        {savedEmail ? (
          <p className="text-sm font-bold text-ink/70">
            Deine E-Mail: <span className="font-black text-ink">{savedEmail}</span>
            <span className="block text-xs font-bold text-ink/50">Du kannst dich damit ohne Passwort anmelden — Code kommt per Mail.</span>
          </p>
        ) : (
          <p className="text-sm font-bold text-coral">
            Noch keine E-Mail hinterlegt. Ohne E-Mail kannst du dich nur mit Name & Passwort anmelden — hinterlege sie jetzt, damit du nie ausgesperrt bist.
          </p>
        )}
      </div>

      {stage === "idle" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input !py-2"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={savedEmail ? "Neue E-Mail-Adresse" : "deine@mail.ch"}
            required
          />
          <button className="btn-primary shrink-0" disabled={busy || !email.trim()}>
            {busy ? "Sendet…" : "Code senden"}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void confirm(code);
          }}
          className="space-y-2"
        >
          <p className="text-xs font-bold text-ink/55">
            Code an <span className="text-ink">{email}</span> geschickt — auch im Spam nachschauen.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={codeRef}
              className="input !py-2 text-center text-xl font-black tracking-[0.4em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(digits);
                if (digits.length === 6) void confirm(digits);
              }}
              placeholder="••••••"
              required
            />
            <button className="btn-primary shrink-0" disabled={busy || code.length !== 6}>
              {busy ? "Prüft…" : "Bestätigen"}
            </button>
          </div>
          <div className="flex items-center justify-between text-xs font-black text-ink/55">
            <button type="button" onClick={() => { setStage("idle"); setError(""); }} className="transition hover:text-ink">
              Abbrechen
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

      {error && <p className="text-sm font-black text-coral">{error}</p>}
      {okMsg && <p className="text-sm font-black text-ink/70">{okMsg}</p>}
    </div>
  );
}
