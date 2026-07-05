"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { InlineLoading } from "./LoadingState";
import { Avatar } from "./Nav";
import { peekCachedJson, swrJson, writeCachedJson } from "@/lib/swr";

export type CommentNode = {
  id: string;
  text: string;
  createdAt: string;
  parentId: string | null;
  author: { id: string; name: string; avatarUrl: string | null; accentColor?: string | null };
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

export function CommentThread({
  commentsPath,
  onCountChange,
}: {
  // collection endpoint, e.g. "/api/posts/{id}/comments" or "/api/polls/{id}/comments"
  commentsPath: string;
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
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
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

  async function submit(parentId: string | null, value: string): Promise<boolean> {
    if (!value.trim() || busy) return false;
    setBusy(true);
    const res = await fetch(commentsPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: value, parentId }),
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
    return (
      <div key={node.id} className={indented ? "mt-2 border-l-2 border-white/25 pl-3" : depth > 0 ? "mt-2" : ""}>
        <div className="group/c flex items-start gap-2 text-sm">
          <Avatar name={node.author.name} url={node.author.avatarUrl} accent={node.author.accentColor} size={28} />
          <div className="min-w-0 flex-1">
            <div className="rounded-[20px] border border-white/40 bg-white/20 px-3 py-2">
              <div className="mb-0.5 flex items-center gap-2">
                <span className="font-black">{node.author.name}</span>
                <span className="text-[11px] font-bold text-ink/40">{timeAgo(node.createdAt)}</span>
              </div>
              <CommentBody text={node.text} />
            </div>
            <div className="mt-1 flex items-center gap-3 pl-1">
              <button
                type="button"
                onClick={() => {
                  setReplyTo(isReplying ? null : node.id);
                  setReplyText("");
                }}
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
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const ok = await submit(node.id, replyText);
                  if (ok) {
                    setReplyText("");
                    setReplyTo(null);
                  }
                }}
                className="mt-2 flex gap-2"
              >
                <input
                  autoFocus
                  className="input !py-2"
                  placeholder={`Antwort an ${node.author.name.split(" ")[0]}…`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <button className="btn-primary" disabled={busy || !replyText.trim()}>Senden</button>
              </form>
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

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await submit(null, text);
          if (ok) setText("");
        }}
        className="flex gap-2"
      >
        <input
          className="input !py-2"
          placeholder="Kommentieren…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn-primary" disabled={busy || !text.trim()}>Senden</button>
      </form>
    </div>
  );
}
