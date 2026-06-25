"use client";

import { useState } from "react";
import type { Post } from "./PostCard";

type Member = { id: string; displayName: string; memberType: string };

export function CreatePost({
  classId,
  board,
  members,
  defaultSubjectId,
  onCreated,
}: {
  classId: string;
  board: "YEARBOOK" | "POSTIT";
  members?: Member[];
  defaultSubjectId?: string;
  onCreated: (post: Post) => void;
}) {
  const [kind, setKind] = useState<"QUOTE" | "IMAGE">(board === "POSTIT" ? "QUOTE" : "QUOTE");
  const [text, setText] = useState("");
  const [subjectId, setSubjectId] = useState(defaultSubjectId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const needsSubject = board === "YEARBOOK" && !defaultSubjectId;

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
    if (needsSubject && !subjectId) {
      setError("Bitte eine Person auswählen.");
      return;
    }
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
          text: kind === "IMAGE" ? null : text,
          imageUrl,
          subjectMembershipId: board === "YEARBOOK" ? (defaultSubjectId ?? subjectId) : null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Fehler beim Speichern.");
      onCreated(d.post);
      setText("");
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={board === "POSTIT" ? "postit" : "card p-4"}>
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setKind("QUOTE")}
          className={kind === "QUOTE" ? "btn-primary" : "btn-ghost"}
        >
          {board === "POSTIT" ? "📝 Notiz" : "💬 Zitat"}
        </button>
        <button
          type="button"
          onClick={() => setKind("IMAGE")}
          className={kind === "IMAGE" ? "btn-primary" : "btn-ghost"}
        >
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
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm"
        />
      ) : (
        <textarea
          className="input min-h-[80px]"
          placeholder={board === "POSTIT" ? "Schreibe etwas auf den Zettel…" : "Zitat eingeben…"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      )}

      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}

      <div className="mt-3 flex justify-end">
        <button className="btn-primary" disabled={busy}>
          {busy ? "Speichert…" : "Posten"}
        </button>
      </div>
    </form>
  );
}
