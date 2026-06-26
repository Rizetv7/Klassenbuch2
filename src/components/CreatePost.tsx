"use client";

import { useState } from "react";
import type { Post } from "./PostCard";
import { uploadImageFile } from "@/lib/uploadImage";

type Kind = "QUOTE" | "IMAGE" | "TEXT";
type Person = { id: string; name: string };

// Target: a student (subjectMembershipId), a teacher (teacherId) OR a project (topicId).
export function CreatePost({
  classId,
  subjectMembershipId,
  teacherId,
  topicId,
  people,
  onCreated,
}: {
  classId: string;
  subjectMembershipId?: string;
  teacherId?: string;
  topicId?: string;
  people?: Person[]; // for project quotes: who said it
  onCreated: (post: Post) => void;
}) {
  const isTopic = !!topicId;
  const [kind, setKind] = useState<Kind>("QUOTE");
  const [text, setText] = useState("");
  const [context, setContext] = useState("");
  const [saidBy, setSaidBy] = useState("");
  const [anonymous, setAnonymous] = useState(false);
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
      body: JSON.stringify({ classId, subjectMembershipId, teacherId, topicId, anonymous, ...body }),
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
          context: !isTopic && kind === "QUOTE" ? context.trim() || null : null,
          saidByName: isTopic && kind === "QUOTE" ? saidBy.trim() || null : null,
        });
        onCreated(post);
      }
      setText("");
      setContext("");
      setSaidBy("");
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
    <form onSubmit={submit} className="glass-panel p-4 sm:p-5">
      <div className="relative z-10 mb-4 flex flex-wrap gap-2">
        <Btn k="QUOTE" label="Zitat" />
        <Btn k="IMAGE" label="Bild" />
        <Btn k="TEXT" label="Notiz" />
      </div>

      {kind === "IMAGE" ? (
        <div className="relative z-10 space-y-3">
          <label className="block">
            <span className="flex min-h-[130px] w-full cursor-pointer flex-col items-center justify-center rounded-[30px] border border-dashed border-white/50 bg-white/20 px-5 py-6 text-center transition hover:bg-white/30">
              <span className="display text-4xl leading-none">Bilder</span>
              <span className="mt-1 text-sm font-black text-ink/60">
                {files.length > 0 ? `${files.length} Bild(er) gewählt — ändern` : "Bilder auswählen"}
              </span>
            </span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => pickFiles(e.target.files)} />
          </label>
          {previews.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {previews.map((src, i) => (
                <div key={i} className={`polaroid w-28 ${i % 2 ? "rotate-2" : "-rotate-1"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" decoding="async" className="h-24 w-full rounded-[18px] object-cover" />
                </div>
              ))}
            </div>
          )}
          <input className="input" placeholder="Beschreibung (optional)" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      ) : (
        <div className="relative z-10">
          <textarea
            className="input min-h-[118px]"
            placeholder={kind === "TEXT" ? "Notiz / Post-it…" : "Zitat eingeben…"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {!isTopic && kind === "QUOTE" && (
            <input className="input mt-2" placeholder="Kontext (optional, z. B. vor der Prüfung)" value={context} onChange={(e) => setContext(e.target.value)} />
          )}
          {isTopic && kind === "QUOTE" && (
            <div className="mt-2">
              {people && people.length > 0 ? (
                <select className="input" value={saidBy} onChange={(e) => setSaidBy(e.target.value)}>
                  <option value="">Wer hat&apos;s gesagt? (optional)</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <input className="input" placeholder="Wer hat's gesagt? (optional)" value={saidBy} onChange={(e) => setSaidBy(e.target.value)} />
              )}
            </div>
          )}
        </div>
      )}

      {kind !== "IMAGE" && (
        <label className="relative z-10 mt-3 flex cursor-pointer select-none items-center gap-2 text-sm font-bold text-ink/70">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-4 w-4 accent-hotpink" />
          Anonym posten (dein Name wird nicht angezeigt)
        </label>
      )}

      {error && <p className="relative z-10 mt-2 break-words text-sm font-black text-coral">{error}</p>}

      <div className="relative z-10 mt-4 flex items-center justify-end gap-3">
        {progress && <span className="text-xs text-muted">{progress}</span>}
        <button className="btn-accent" disabled={busy}>{busy ? "Speichert…" : "Posten"}</button>
      </div>
    </form>
  );
}
