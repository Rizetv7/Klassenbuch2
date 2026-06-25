"use client";

import { useState } from "react";
import type { Post } from "./PostCard";

type Member = { id: string; displayName: string; memberType: string };

async function uploadOne(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const text = await res.text();
  let data: { url?: string; error?: string } | null = null;
  try {
    data = JSON.parse(text);
  } catch {
    // non-JSON response (e.g. platform error)
  }
  if (!res.ok) {
    throw new Error(data?.error || `Upload fehlgeschlagen (Status ${res.status}). ${text.slice(0, 140)}`);
  }
  if (!data?.url) throw new Error("Upload: keine Bild-URL erhalten.");
  return data.url;
}

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
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const needsSubject = board === "YEARBOOK" && !defaultSubjectId;

  function pickFiles(list: FileList | null) {
    const arr = list ? Array.from(list) : [];
    setFiles(arr);
    setPreviews(arr.map((f) => URL.createObjectURL(f)));
  }

  async function createPost(body: Record<string, unknown>): Promise<Post> {
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => null);
    if (!res.ok) throw new Error(d?.error || `Fehler beim Speichern (Status ${res.status}).`);
    return d.post as Post;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (needsSubject && !subjectId) return setError("Bitte eine Person auswählen.");
    const subjectMembershipId = board === "YEARBOOK" ? defaultSubjectId ?? subjectId : null;
    setBusy(true);
    try {
      if (kind === "IMAGE") {
        if (files.length === 0) throw new Error("Bitte mindestens ein Bild auswählen.");
        // one post per image (multi-upload)
        for (let i = 0; i < files.length; i++) {
          setProgress(files.length > 1 ? `Lädt ${i + 1}/${files.length}…` : "Lädt…");
          const url = await uploadOne(files[i]);
          const post = await createPost({
            classId,
            board,
            kind: "IMAGE",
            text: text.trim() || null,
            context: context.trim() || null,
            imageUrl: url,
            subjectMembershipId,
          });
          onCreated(post);
        }
      } else {
        if (!text.trim()) throw new Error("Bitte etwas schreiben.");
        const post = await createPost({
          classId,
          board,
          kind: "QUOTE",
          text,
          context: context.trim() || null,
          subjectMembershipId,
        });
        onCreated(post);
      }
      setText("");
      setContext("");
      pickFiles(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <form onSubmit={submit} className={board === "POSTIT" ? "postit relative" : "card p-4"}>
      <div className="flex gap-2 mb-3">
        <button type="button" onClick={() => setKind("QUOTE")} className={kind === "QUOTE" ? "btn-primary" : "btn-soft"}>
          {board === "POSTIT" ? "Notiz" : "Zitat"}
        </button>
        <button type="button" onClick={() => setKind("IMAGE")} className={kind === "IMAGE" ? "btn-primary" : "btn-soft"}>
          Bild
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
            <span className="btn-soft cursor-pointer w-full">
              {files.length > 0 ? `${files.length} Bild(er) gewählt — ändern` : "Bilder auswählen"}
            </span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => pickFiles(e.target.files)} />
          </label>
          {previews.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {previews.map((src, i) => (
                <div key={i} className="polaroid w-28">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="w-full h-24 object-cover" />
                </div>
              ))}
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

      {error && <p className="text-sm text-coral font-bold mt-2 break-words">{error}</p>}

      <div className="mt-3 flex items-center justify-end gap-3">
        {progress && <span className="text-xs text-muted">{progress}</span>}
        <button className="btn-accent" disabled={busy}>
          {busy ? "Speichert…" : "Posten"}
        </button>
      </div>
    </form>
  );
}
