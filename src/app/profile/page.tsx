"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Nav";
import { IconPencil } from "@/components/Icons";

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
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
        setAccent(d.user.accentColor);
        setAvatarUrl(d.user.avatarUrl);
      });
  }, []);

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg("");
    const fd = new FormData();
    fd.append("file", file);
    const up = await fetch("/api/upload", { method: "POST", body: fd });
    const upData = await up.json();
    if (up.ok) {
      setAvatarUrl(upData.url);
      await save({ avatarUrl: upData.url });
    } else {
      setMsg(upData.error || "Upload fehlgeschlagen.");
    }
    setBusy(false);
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

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card p-6 flex flex-col items-center text-center">
        <label className="cursor-pointer relative">
          <Avatar name={name || "?"} url={avatarUrl} accent={accent} size={100} />
          <span className="absolute -bottom-1 -right-1 bg-ink text-white rounded-full w-8 h-8 grid place-items-center">
            <IconPencil size={16} />
          </span>
          <input type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
        </label>
        <h1 className="display text-4xl mt-3">{name}</h1>
        {msg && <p className="text-sm text-muted mt-1">{msg}</p>}
      </div>

      <div className="card p-5 space-y-3">
        <div>
          <label className="label">Anzeigename</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button onClick={() => save()} className="btn-primary w-full" disabled={busy}>
          {busy ? "Speichert…" : "Speichern"}
        </button>
      </div>

      <Link href="/classes" className="card p-4 flex items-center justify-between hover:shadow-soft transition">
        <span className="font-bold">Meine Klassen</span>
        <span className="text-muted">›</span>
      </Link>

      <button onClick={logout} className="btn-soft w-full text-coral">Abmelden</button>
    </div>
  );
}
