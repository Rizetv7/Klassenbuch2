"use client";

import { useState } from "react";
import type { Post } from "./PostCard";
import { uploadImageFile } from "@/lib/uploadImage";

type Kind = "QUOTE" | "IMAGE" | "TEXT";

// Target: a person (subjectMembershipId) OR a project/topic (topicId).
export function CreatePost({
  classId,
  subjectMembershipId,
  topicId,
  onCreated,
}: {
  classId: string;
  subjectMembershipId?: string;
  topicId?: string;
  onCreated: (post: Post) => void;
}) {
  const isTopic = !!topicId;
  const [kind, setKind] = useState<Kind>("QUOTE");
  const [text, setText] = useState("");
  const [context, setContext] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  function pickFiles(list: FileList | null) {
    const arr = list ? Array.from(list) : [];
    setFiles(arr);
    setPreviews(arr.map((f) => URL.createObjectURL(f)));
  }

  async function createPost(body: Record<string, unknown>): Promise<Post> {
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, subjectMembershipId, topicId, ...body }),
    });
    const d = await res.json().catch(() => null);
    if (!res.ok) throw new Error(d?.error || `Fehler beim Speichern (Status ${res.status}).`);
    return d.post as Post;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (kind === "IMAGE") {
        if (files.length === 0) throw new Error("Bitte mindestens ein Bild auswählen.");
        for (let i = 0; i < files.length; i++) {
          setProgress(files.length > 1 ? `Lädt ${i + 1}/${files.length}…` : "Lädt…");
          const url = await uploadImageFile(files[i]);
          const post = await createPost({ kind: "IMAGE", text: text.trim() || null, imageUrl: url });
          onCreated(post);
        }
      } else {
        if (!text.trim()) throw new Error("Bitte etwas schreiben.");
        const post = await createPost({
          kind,
          text,
          context: !isTopic ? context.trim() || null : null,
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

  const Btn = ({ k, label }: { k: Kind; label: string }) => (
    <button type="button" onClick={() => setKind(k)} className={kind === k ? "btn-primary" : "btn-soft"}>
      {label}
    </button>
  );

  return (
    <form onSubmit={submit} className="card p-4">
      <div className="flex gap-2 mb-3 flex-wrap">
        <Btn k="QUOTE" label="Zitat" />
        <Btn k="IMAGE" label="Bild" />
        {isTopic && <Btn k="TEXT" label="Notiz" />}
      </div>

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
            placeholder={kind === "TEXT" ? "Notiz / Post-it…" : "Zitat eingeben…"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {!isTopic && kind === "QUOTE" && (
            <input className="input mt-2" placeholder="Kontext (optional, z. B. vor der Prüfung)" value={context} onChange={(e) => setContext(e.target.value)} />
          )}
        </>
      )}

      {error && <p className="text-sm text-coral font-bold mt-2 break-words">{error}</p>}

      <div className="mt-3 flex items-center justify-end gap-3">
        {progress && <span className="text-xs text-muted">{progress}</span>}
        <button className="btn-accent" disabled={busy}>{busy ? "Speichert…" : "Posten"}</button>
      </div>
    </form>
  );
}
