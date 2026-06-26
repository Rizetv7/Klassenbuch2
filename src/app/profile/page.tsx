"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageLoading, PageReveal } from "@/components/LoadingState";
import { Avatar } from "@/components/Nav";
import { IconPencil } from "@/components/Icons";
import { uploadImageFile } from "@/lib/uploadImage";

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
    <div className="space-y-4">
      <div className="hero-frame flex flex-col items-center p-6 text-center">
        <label className="cursor-pointer relative">
          <Avatar name={name || "?"} url={avatarUrl} accent={accent} size={100} />
          <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-ink text-white">
            <IconPencil size={16} />
          </span>
          <input type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
        </label>
        <h1 className="display relative z-10 mt-3 break-words text-6xl leading-[0.86]">{name}</h1>
        {msg && <p className="text-sm text-muted mt-1">{msg}</p>}
      </div>

      <div className="glass-card p-5 space-y-3">
        <div>
          <label className="label">Anzeigename</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button onClick={() => save()} className="btn-primary w-full" disabled={busy}>
          {busy ? "Speichert…" : "Speichern"}
        </button>
      </div>

      <form onSubmit={changePassword} className="glass-card p-5 space-y-3">
        <div>
          <p className="section-label mb-2">Passwort ändern</p>
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
          {passwordBusy ? "Ändert..." : "Passwort ändern"}
        </button>
      </form>

      <Link href="/classes" className="glass-card p-4 flex items-center justify-between hover:shadow-soft transition">
        <span className="font-black">Meine Klasse</span>
        <span className="text-muted">›</span>
      </Link>

      <div className="flex gap-2">
        <button onClick={leaveClass} className="btn-soft flex-1 text-ink/70">Klasse verlassen</button>
        <button onClick={logout} className="btn-soft flex-1 text-coral">Abmelden</button>
      </div>
    </div>
    </PageReveal>
  );
}
