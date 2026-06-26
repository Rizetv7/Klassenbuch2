"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "./Nav";

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
  const [comments, setComments] = useState<CommentNode[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(commentsPath);
      if (cancelled) return;
      if (res.ok) {
        const list: CommentNode[] = (await res.json()).comments ?? [];
        setComments(list);
        onCountChange?.(list.length);
      } else {
        setComments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentsPath]);

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

  return (
    <div className="space-y-3">
      {comments === null ? (
        <p className="text-sm text-muted">Lädt…</p>
      ) : roots.length === 0 ? (
        <p className="text-sm font-bold text-ink/45">Noch keine Kommentare. Schreib den ersten!</p>
      ) : (
        <div className="space-y-3">{roots.map((r) => renderNode(r, 0))}</div>
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
