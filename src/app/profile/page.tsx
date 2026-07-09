"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageLoading, PageReveal } from "@/components/LoadingState";
import { Avatar } from "@/components/Nav";
import { IconPencil } from "@/components/Icons";
import { uploadImageFile } from "@/lib/uploadImage";
import { clearApiCache } from "@/lib/swr";
import { PushSettings } from "@/components/PushSettings";
import { ThemeMenu } from "@/components/ThemeMenu";

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [accent, setAccent] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (!d.user) return router.push("/login");
        setName(d.user.name);
        setAccent(d.user.accentColor);
        setAvatarUrl(d.user.avatarUrl);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg("");
    try {
      const url = await uploadImageFile(file);
      setAvatarUrl(url);
      await save({ avatarUrl: url });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function save(extra?: Record<string, string>) {
    setBusy(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ...extra }),
    });
    setBusy(false);
    setMsg(res.ok ? "Gespeichert ✓" : "Fehler beim Speichern.");
    if (res.ok) router.refresh();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg("");
    if (newPassword.length < 6) {
      setPasswordMsg("Das neue Passwort muss mindestens 6 Zeichen lang sein.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg("Die neuen Passwörter stimmen nicht überein.");
      return;
    }
    setPasswordBusy(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const d = await res.json().catch(() => null);
    setPasswordBusy(false);
    if (res.ok) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg("Passwort geändert ✓");
    } else {
      setPasswordMsg(d?.error || "Passwort konnte nicht geändert werden.");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearApiCache(); // drop this account's cached pages
    router.push("/login");
    router.refresh();
  }

  async function leaveClass() {
    if (!confirm("Deine Klasse verlassen?")) return;
    const res = await fetch("/api/classes/leave", { method: "POST" });
    const d = await res.json().catch(() => null);
    if (res.ok) {
      router.push("/classes");
      router.refresh();
    } else {
      setMsg(d?.error || "Konnte Klasse nicht verlassen.");
    }
  }

  if (loading) return <PageLoading />;

  return (
    <PageReveal>
    <div className="mx-auto max-w-xl space-y-4">
      {/* identity card: avatar, name, inline rename */}
      <section className="hero-frame overflow-hidden">
        <div className="relative z-10 flex items-center gap-4 p-4 sm:gap-6 sm:p-6">
          <label className="relative shrink-0 cursor-pointer transition-transform duration-150 hover:scale-[1.02] active:scale-95">
            <Avatar name={name || "?"} url={avatarUrl} accent={accent} size={96} />
            <span className="absolute -bottom-0.5 -right-0.5 grid h-8 w-8 place-items-center rounded-full bg-ink text-oncolor shadow-soft">
              <IconPencil size={14} />
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
          </label>
          <div className="min-w-0 flex-1">
            <p className="section-label">Dein Profil</p>
            <h1 className="display mt-1 break-words text-4xl leading-[0.9] sm:text-5xl">{name}</h1>
            {msg && <p className="mt-1 text-xs font-black text-ink/55">{msg}</p>}
          </div>
        </div>
        <div className="soft-divider relative z-10 flex gap-2 p-4 pt-3 sm:px-6">
          <input className="input !py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Anzeigename" />
          <button onClick={() => save()} className="btn-primary shrink-0" disabled={busy}>
            {busy ? "Speichert…" : "Speichern"}
          </button>
        </div>
      </section>

      {/* appearance */}
      <section className="glass-card flex items-center justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="section-label">Erscheinungsbild</p>
          <p className="mt-1 text-sm font-bold text-ink/55">Design & Hell/Dunkel — nur für dich, auf diesem Gerät.</p>
        </div>
        <ThemeMenu label="Wählen" className="btn-primary shrink-0 text-sm" />
      </section>

      <PushSettings />

      {/* security: collapsed by default — the page stays calm */}
      <section className="glass-card p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span>
            <span className="section-label block">Sicherheit</span>
            <span className="mt-1 block text-sm font-bold text-ink/55">Passwort ändern</span>
          </span>
          <span className={`text-lg font-black text-ink/45 transition-transform duration-200 ${showPassword ? "rotate-90" : ""}`}>›</span>
        </button>
        {showPassword && (
          <form onSubmit={changePassword} className="mt-4 animate-fade-up space-y-3">
            <div>
              <label className="label">Aktuelles Passwort</label>
              <input
                className="input"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div>
              <label className="label">Neues Passwort</label>
              <input
                className="input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <div>
              <label className="label">Neues Passwort wiederholen</label>
              <input
                className="input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            {passwordMsg && <p className="text-sm font-black text-ink/60">{passwordMsg}</p>}
            <button className="btn-primary w-full" disabled={passwordBusy}>
              {passwordBusy ? "Ändert…" : "Passwort ändern"}
            </button>
          </form>
        )}
      </section>

      {/* class + session */}
      <Link href="/classes" className="glass-card flex items-center justify-between p-4 transition hover:-translate-y-0.5">
        <span>
          <span className="section-label block">Klasse</span>
          <span className="mt-1 block text-sm font-bold text-ink/70">Meine Klasse öffnen</span>
        </span>
        <span className="text-lg font-black text-ink/45">›</span>
      </Link>

      <div className="flex gap-2">
        <button onClick={leaveClass} className="btn-soft flex-1 text-ink/70">Klasse verlassen</button>
        <button onClick={logout} className="btn-soft flex-1 text-coral">Abmelden</button>
      </div>
    </div>
    </PageReveal>
  );
}
