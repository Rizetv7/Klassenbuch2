"use client";

import { useState } from "react";
import type { Post } from "./PostCard";

type Member = { id: string; displayName: string; memberType: string };

export function CreatePost({
  classId,
  board,
  members,
  defaultSubjectId,
  defaultKind = "QUOTE",
  onCreated,
}: {
  classId: string;
  board: "YEARBOOK" | "POSTIT";
  members?: Member[];
  defaultSubjectId?: string;
  defaultKind?: "QUOTE" | "IMAGE";
  onCreated: (post: Post) => void;
}) {
  const [kind, setKind] = useState<"QUOTE" | "IMAGE">(defaultKind);
  const [text, setText] = useState("");
  const [context, setContext] = useState("");
  const [subjectId, setSubjectId] = useState(defaultSubjectId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const needsSubject = board === "YEARBOOK" && !defaultSubjectId;

  function pickFile(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function uploadImage(): Promise<string | null> {
    if (!file) return null;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Upload fehlgeschlagen.");
    return d.url;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (needsSubject && !subjectId) return setError("Bitte eine Person auswählen.");
    setBusy(true);
    try {
      let imageUrl: string | null = null;
      if (kind === "IMAGE") {
        imageUrl = await uploadImage();
        if (!imageUrl) throw new Error("Bitte ein Bild auswählen.");
      } else if (!text.trim()) {
        throw new Error("Bitte etwas schreiben.");
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          board,
          kind,
          text: kind === "IMAGE" ? text.trim() || null : text,
          context: context.trim() || null,
          imageUrl,
          subjectMembershipId: board === "YEARBOOK" ? defaultSubjectId ?? subjectId : null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Fehler beim Speichern.");
      onCreated(d.post);
      setText("");
      setContext("");
      pickFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={board === "POSTIT" ? "postit relative" : "card p-4"}>
      <div className="flex gap-2 mb-3">
        <button type="button" onClick={() => setKind("QUOTE")} className={kind === "QUOTE" ? "btn-primary" : "btn-soft"}>
          {board === "POSTIT" ? "📝 Notiz" : "💬 Zitat"}
        </button>
        <button type="button" onClick={() => setKind("IMAGE")} className={kind === "IMAGE" ? "btn-primary" : "btn-soft"}>
          🖼️ Bild
        </button>
      </div>

      {needsSubject && members && (
        <div className="mb-3">
          <label className="label">Über wen?</label>
          <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">— Person wählen —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName} {m.memberType === "TEACHER" ? "(Lehrer:in)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {kind === "IMAGE" ? (
        <div className="space-y-2">
          <label className="block">
            <span className="btn-soft cursor-pointer w-full">{file ? "Bild ändern" : "📷 Bild auswählen"}</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          </label>
          {preview && (
            <div className="polaroid w-40 mx-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="" className="w-full h-32 object-cover" />
            </div>
          )}
          <input className="input" placeholder="Beschreibung (optional)" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      ) : (
        <>
          <textarea
            className="input min-h-[80px]"
            placeholder={board === "POSTIT" ? "Schreibe etwas auf den Zettel…" : "Zitat eingeben…"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {board === "YEARBOOK" && (
            <input className="input mt-2" placeholder="Kontext (optional, z. B. vor der Prüfung)" value={context} onChange={(e) => setContext(e.target.value)} />
          )}
        </>
      )}

      {error && <p className="text-sm text-coral font-bold mt-2">{error}</p>}

      <div className="mt-3 flex justify-end">
        <button className="btn-accent" disabled={busy}>
          {busy ? "Speichert…" : "Posten ✨"}
        </button>
      </div>
    </form>
  );
}
