"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Nav";

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) return router.push("/login");
        setName(d.user.name);
        setEmail(d.user.email);
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

  return (
    <div className="max-w-md mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Mein Profil</h1>
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-4">
          <Avatar name={name || "?"} url={avatarUrl} size={72} />
          <label className="btn-ghost cursor-pointer">
            Profilbild ändern
            <input type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
          </label>
        </div>
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">E-Mail</label>
          <input className="input bg-gray-50" value={email} disabled />
        </div>
        {msg && <p className="text-sm text-gray-500">{msg}</p>}
        <button onClick={() => save()} className="btn-primary" disabled={busy}>
          {busy ? "Speichert…" : "Speichern"}
        </button>
      </div>
    </div>
  );
}
