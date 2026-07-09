"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { InlineLoading } from "./LoadingState";
import { Avatar } from "./Nav";
import { Lightbox } from "./Lightbox";
import { IconClose } from "./Icons";
import { peekCachedJson, swrJson, writeCachedJson } from "@/lib/swr";
import { uploadImageFile } from "@/lib/uploadImage";

export type CommentNode = {
  id: string;
  text: string | null;
  imageUrl?: string | null;
  createdAt: string;
  parentId: string | null;
  author: { id: string; name: string; avatarUrl: string | null; accentColor?: string | null; membershipId?: string | null };
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "jetzt";
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} Std.`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d} T.` : new Date(iso).toLocaleDateString("de-CH");
}

const COLLAPSE_AT = 240; // characters before a comment is folded
const MAX_INDENT = 4; // stop indenting deeper than this
const PREVIEW_ROOTS = 3; // root comments shown before "show all" kicks in

// Long comments fold to a preview with a "mehr"/"weniger" toggle.
function CommentBody({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > COLLAPSE_AT;
  if (!long) return <span className="whitespace-pre-wrap break-words">{text}</span>;
  return (
    <span className="whitespace-pre-wrap break-words">
      {expanded ? text : text.slice(0, COLLAPSE_AT).trimEnd() + "… "}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="align-baseline font-black text-hotpink hover:underline"
      >
        {expanded ? "weniger" : "mehr"}
      </button>
    </span>
  );
}

// Paperclip / photo icon for the attach button.
function IconPhoto({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M21 16l-5-5-8 8" />
    </svg>
  );
}

// Composer with text + optional photo attachment. Self-contained state so its
// input keeps focus across the thread's re-renders. Returns true from onSubmit
// on success, at which point it clears itself.
function Composer({
  placeholder,
  autoFocus,
  busy,
  onSubmit,
  onView,
}: {
  placeholder: string;
  autoFocus?: boolean;
  busy: boolean;
  onSubmit: (text: string, imageUrl: string | null) => Promise<boolean>;
  onView: (src: string) => void;
}) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSend = !busy && !uploading && !sending && (text.trim().length > 0 || !!image);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImageFile(file);
      setImage(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Bild-Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setSending(true);
    const ok = await onSubmit(text.trim(), image);
    setSending(false);
    if (ok) {
      setText("");
      setImage(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 animate-fade-up">
      {(image || uploading) && (
        <div className="mb-2 flex items-center gap-2">
          {uploading ? (
            <span className="text-xs font-black text-ink/50">Bild wird geladen…</span>
          ) : image ? (
            <div className="relative">
              <button type="button" onClick={() => onView(image)} className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="" className="h-20 w-20 rounded-2xl border border-white/50 object-cover" />
              </button>
              <button
                type="button"
                onClick={() => setImage(null)}
                aria-label="Bild entfernen"
                className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink/80 text-oncolor shadow-soft transition hover:bg-ink"
              >
                <IconClose size={13} />
              </button>
            </div>
          ) : null}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || sending}
          aria-label="Foto anhängen"
          title="Foto anhängen"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/30 text-ink/60 transition hover:bg-white/55 hover:text-hotpink active:scale-90 disabled:opacity-50"
        >
          <IconPhoto size={19} />
        </button>
        <input
          autoFocus={autoFocus}
          className="input !py-2"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn-primary shrink-0" disabled={!canSend}>Senden</button>
      </div>
    </form>
  );
}

export function CommentThread({
  commentsPath,
  classId,
  onCountChange,
}: {
  // collection endpoint, e.g. "/api/posts/{id}/comments" or "/api/polls/{id}/comments"
  commentsPath: string;
  // class the thread lives in -> lets author avatars link to profiles
  classId?: string;
  onCountChange?: (n: number) => void;
}) {
  // Comments are always shown (no click-to-open), but a feed can hold dozens
  // of posts at once — fetching every thread's comments the instant the feed
  // mounts would be wasteful. So: paint instantly from cache if we have one
  // (like every other page in the app), and only hit the network once this
  // thread scrolls near the viewport, same as the rest of the app's
  // stale-while-revalidate caching.
  const [comments, setComments] = useState<CommentNode[] | null>(() => peekCachedJson<{ comments?: CommentNode[] }>(commentsPath)?.comments ?? null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "480px 0px" } // start loading well before it's scrolled into view
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!nearViewport) return;
    return swrJson<{ comments?: CommentNode[] }>(commentsPath, (data, meta) => {
      if (!data) {
        if (!meta.fromCache && comments === null) setComments([]);
        return;
      }
      const list = data.comments ?? [];
      setComments(list);
      onCountChange?.(list.length);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearViewport, commentsPath]);

  // children grouped by parent id (null = top level)
  const childrenOf = useMemo(() => {
    const map = new Map<string | null, CommentNode[]>();
    for (const c of comments ?? []) {
      const key = c.parentId ?? null;
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return map;
  }, [comments]);

  async function submit(parentId: string | null, value: string, imageUrl: string | null): Promise<boolean> {
    if ((!value.trim() && !imageUrl) || busy) return false;
    setBusy(true);
    const res = await fetch(commentsPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: value, parentId, imageUrl }),
    });
    setBusy(false);
    if (!res.ok) return false;
    const d = await res.json();
    setComments((current) => {
      const next = [...(current ?? []), d.comment as CommentNode];
      onCountChange?.(next.length);
      writeCachedJson(commentsPath, { comments: next });
      return next;
    });
    return true;
  }

  async function remove(id: string) {
    if (!window.confirm("Diesen Kommentar (und Antworten darauf) löschen?")) return;
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setComments((current) => {
      const list = current ?? [];
      // the server cascades; mirror that locally by dropping all descendants
      const doomed = new Set<string>([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const item of list) {
          if (item.parentId && doomed.has(item.parentId) && !doomed.has(item.id)) {
            doomed.add(item.id);
            grew = true;
          }
        }
      }
      const next = list.filter((x) => !doomed.has(x.id));
      onCountChange?.(next.length);
      writeCachedJson(commentsPath, { comments: next });
      return next;
    });
  }

  // Recursive render as a plain function (not a component) so nested reply
  // inputs keep focus across re-renders.
  const renderNode = (node: CommentNode, depth: number) => {
    const kids = childrenOf.get(node.id) ?? [];
    const isReplying = replyTo === node.id;
    const indented = depth > 0 && depth <= MAX_INDENT;
    const authorHref = classId && node.author.membershipId
      ? `/classes/${classId}/members/${node.author.membershipId}`
      : null;
    return (
      <div key={node.id} className={indented ? "mt-2 border-l-2 border-white/25 pl-3" : depth > 0 ? "mt-2" : ""}>
        <div className="group/c flex items-start gap-2 text-sm">
          {authorHref ? (
            <Link href={authorHref} className="shrink-0 transition hover:opacity-80">
              <Avatar name={node.author.name} url={node.author.avatarUrl} accent={node.author.accentColor} size={28} />
            </Link>
          ) : (
            <Avatar name={node.author.name} url={node.author.avatarUrl} accent={node.author.accentColor} size={28} />
          )}
          <div className="min-w-0 flex-1">
            <div className="rounded-[20px] border border-white/40 bg-white/20 px-3 py-2">
              <div className="mb-0.5 flex items-center gap-2">
                {authorHref ? (
                  <Link href={authorHref} className="font-black hover:underline">{node.author.name}</Link>
                ) : (
                  <span className="font-black">{node.author.name}</span>
                )}
                <span className="text-[11px] font-bold text-ink/40">{timeAgo(node.createdAt)}</span>
              </div>
              {node.text && <CommentBody text={node.text} />}
              {node.imageUrl && (
                <button
                  type="button"
                  onClick={() => setLightboxSrc(node.imageUrl!)}
                  className={`group/img block overflow-hidden rounded-2xl border border-white/50 ${node.text ? "mt-2" : ""}`}
                  title="Foto gross anzeigen"
                >
                  {/* Compact but clearly visible: capped height, tap to enlarge. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={node.imageUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="max-h-48 w-auto max-w-full object-cover transition duration-300 group-hover/img:scale-[1.03]"
                  />
                </button>
              )}
            </div>
            <div className="mt-1 flex items-center gap-3 pl-1">
              <button
                type="button"
                onClick={() => setReplyTo(isReplying ? null : node.id)}
                className="text-[11px] font-black text-ink/55 transition hover:text-ink"
              >
                {isReplying ? "Abbrechen" : "Antworten"}
              </button>
              <button
                type="button"
                onClick={() => remove(node.id)}
                className="text-[11px] font-black text-ink/35 opacity-0 transition hover:text-coral group-hover/c:opacity-100"
              >
                Löschen
              </button>
            </div>
            {isReplying && (
              <Composer
                autoFocus
                busy={busy}
                placeholder={`Antwort an ${node.author.name.split(" ")[0]}…`}
                onView={setLightboxSrc}
                onSubmit={async (value, imageUrl) => {
                  const ok = await submit(node.id, value, imageUrl);
                  if (ok) setReplyTo(null);
                  return ok;
                }}
              />
            )}
          </div>
        </div>
        {kids.map((k) => renderNode(k, depth + 1))}
      </div>
    );
  };

  const roots = childrenOf.get(null) ?? [];
  // Too many top-level comments to show at once -> preview the first few
  // and let the reader opt into the full thread.
  const hiddenCount = roots.length - PREVIEW_ROOTS;
  const showPreviewToggle = !expanded && hiddenCount > 0;
  const visibleRoots = showPreviewToggle ? roots.slice(0, PREVIEW_ROOTS) : roots;

  return (
    <div ref={containerRef} className="space-y-3">
      {comments === null ? (
        <InlineLoading />
      ) : roots.length === 0 ? (
        <p className="text-sm font-bold text-ink/45">Noch keine Kommentare. Schreib den ersten!</p>
      ) : (
        <div className="space-y-3">
          {visibleRoots.map((r) => renderNode(r, 0))}
          {showPreviewToggle && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-sm font-black text-hotpink hover:underline"
            >
              {hiddenCount === 1 ? "1 weiteren Kommentar anzeigen" : `${hiddenCount} weitere Kommentare anzeigen`}
            </button>
          )}
        </div>
      )}

      <Composer
        busy={busy}
        placeholder="Kommentieren…"
        onView={setLightboxSrc}
        onSubmit={(value, imageUrl) => submit(null, value, imageUrl)}
      />

      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
