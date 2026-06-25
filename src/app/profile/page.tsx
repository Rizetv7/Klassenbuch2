"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Nav";
import { IconPencil } from "@/components/Icons";
import { uploadImageFile } from "@/lib/uploadImage";

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [accent, setAccent] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) return router.push("/login");
        setName(d.user.name);
        setNickname(d.user.nickname ?? "");
        setAccent(d.user.accentColor);
        setAvatarUrl(d.user.avatarUrl);
      });
  }, []);

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
      body: JSON.stringify({ name, nickname, ...extra }),
    });
    setBusy(false);
    setMsg(res.ok ? "Gespeichert ✓" : "Fehler beim Speichern.");
    if (res.ok) router.refresh();
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

  return (
    <div className="space-y-4">
      <div className="hero-frame flex flex-col items-center p-6 text-center">
        <label className="cursor-pointer relative">
          <Avatar name={name || "?"} url={avatarUrl} accent={accent} size={100} />
          <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-ink text-white">
            <IconPencil size={16} />
          </span>
          <input type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
        </label>
        <h1 className="display relative z-10 mt-3 break-words text-6xl leading-[0.86]">{nickname || name}</h1>
        {nickname && <p className="mt-1 text-sm font-black text-ink/55">{name}</p>}
        {msg && <p className="text-sm text-muted mt-1">{msg}</p>}
      </div>

      <div className="glass-card p-5 space-y-3">
        <div>
          <label className="label">Anzeigename</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Spitzname</label>
          <input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={40} placeholder="optional" />
        </div>
        <button onClick={() => save()} className="btn-primary w-full" disabled={busy}>
          {busy ? "Speichert…" : "Speichern"}
        </button>
      </div>

      <Link href="/classes" className="glass-card p-4 flex items-center justify-between hover:shadow-soft transition">
        <span className="font-black">Meine Klasse</span>
        <span className="text-muted">›</span>
      </Link>

      <div className="flex gap-2">
        <button onClick={leaveClass} className="btn-soft flex-1 text-ink/70">Klasse verlassen</button>
        <button onClick={logout} className="btn-soft flex-1 text-coral">Abmelden</button>
      </div>
    </div>
  );
}
