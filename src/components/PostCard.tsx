"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "./Nav";

export type Post = {
  id: string;
  board: string;
  kind: string;
  text: string | null;
  context?: string | null;
  imageUrl: string | null;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null; accentColor?: string | null };
  class: { id: string; name: string };
  subject: { id: string; displayName: string; memberType: string } | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

type Comment = {
  id: string;
  text: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null; accentColor?: string | null };
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  return d < 7 ? `vor ${d} T.` : new Date(iso).toLocaleDateString("de-CH");
}

// "hat ein Zitat über Lena gepostet" etc.
function contextLine(post: Post): string {
  if (post.board === "POSTIT") return "hat ein Post-it gepinnt";
  if (post.kind === "IMAGE")
    return post.subject ? `hat ein Bild mit ${post.subject.displayName} gepostet` : "hat ein Bild gepostet";
  const isTeacher = post.subject?.memberType === "TEACHER";
  const verb = isTeacher ? "ein Lehrerzitat" : "ein Zitat";
  return post.subject ? `hat ${verb} über ${post.subject.displayName} gepostet` : `hat ${verb} gepostet`;
}

export function PostCard({
  post,
  onDeleted,
  showContext = true,
}: {
  post: Post;
  onDeleted?: (id: string) => void;
  showContext?: boolean;
}) {
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState(false);

  async function toggleLike() {
    setLiked((v) => !v);
    setLikeCount((c) => c + (liked ? -1 : 1));
    const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
    if (res.ok) {
      const d = await res.json();
      setLiked(d.liked);
      setLikeCount(d.likeCount);
    }
  }

  async function toggleComments() {
    const next = !open;
    setOpen(next);
    if (next && comments === null) {
      const res = await fetch(`/api/posts/${post.id}/comments`);
      if (res.ok) setComments((await res.json()).comments);
    }
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/posts/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: commentText }),
    });
    setBusy(false);
    if (res.ok) {
      const d = await res.json();
      setComments((c) => [...(c ?? []), d.comment]);
      setCommentCount((n) => n + 1);
      setCommentText("");
    }
  }

  async function deleteComment(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (res.ok) {
      setComments((c) => (c ?? []).filter((x) => x.id !== id));
      setCommentCount((n) => Math.max(0, n - 1));
    }
  }

  async function deletePost() {
    if (!confirm("Diesen Beitrag wirklich löschen?")) return;
    const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    if (res.ok) onDeleted?.(post.id);
  }

  return (
    <article className="card p-4 animate-fade-up">
      {/* header */}
      <div className="flex items-center gap-3">
        <Link href={`/profile`} className="shrink-0">
          <Avatar name={post.author.name} url={post.author.avatarUrl} accent={post.author.accentColor} size={42} />
        </Link>
        <div className="flex-1 min-w-0 leading-tight">
          <p className="text-sm">
            <span className="font-extrabold">{post.author.name}</span>{" "}
            <span className="text-muted">{contextLine(post)}</span>
          </p>
          <p className="text-xs text-muted">
            {showContext && (
              <>
                <Link href={`/classes/${post.class.id}`} className="hover:underline">
                  {post.class.name}
                </Link>
                {" · "}
              </>
            )}
            {timeAgo(post.createdAt)}
          </p>
        </div>
        <button onClick={deletePost} title="Löschen" className="text-black/20 hover:text-coral text-sm px-1">
          ✕
        </button>
      </div>

      {/* body */}
      <div className="mt-3">
        {post.text && post.kind !== "IMAGE" && (
          <p className={post.kind === "QUOTE" ? "quote-big" : "whitespace-pre-wrap text-[15px]"}>
            {post.kind === "QUOTE" ? `„${post.text}"` : post.text}
          </p>
        )}
        {post.context && <p className="text-xs text-muted mt-1 italic">{post.context}</p>}
        {post.imageUrl && (
          <div className="mt-1 flex justify-center">
            <div className="polaroid max-w-[85%]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.imageUrl} alt="" className="w-full max-h-96 object-cover" />
              {post.text && <p className="font-hand text-lg text-center mt-1 text-ink/80">{post.text}</p>}
            </div>
          </div>
        )}
        {post.subject && (
          <div className="mt-3">
            <Link href={`/classes/${post.class.id}/members/${post.subject.id}`} className="chip">
              {post.subject.memberType === "TEACHER" ? "🧑‍🏫" : "🎓"} {post.subject.displayName}
            </Link>
          </div>
        )}
      </div>

      {/* actions */}
      <div className="mt-3 flex items-center gap-5 text-sm font-bold">
        <button onClick={toggleLike} className="flex items-center gap-1.5 active:scale-90 transition">
          <span className={liked ? "animate-pop" : ""}>{liked ? "❤️" : "🤍"}</span>
          <span className="text-ink/70">{likeCount}</span>
        </button>
        <button onClick={toggleComments} className="flex items-center gap-1.5">
          💬 <span className="text-ink/70">{commentCount}</span>
        </button>
      </div>

      {/* comments */}
      {open && (
        <div className="mt-3 border-t border-black/5 pt-3 space-y-3">
          {comments === null ? (
            <p className="text-sm text-muted">Lädt…</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2 text-sm group">
                <Avatar name={c.author.name} url={c.author.avatarUrl} accent={c.author.accentColor} size={28} />
                <div className="flex-1 bg-paper/60 rounded-2xl px-3 py-2">
                  <span className="font-bold">{c.author.name}</span> <span>{c.text}</span>
                </div>
                <button
                  onClick={() => deleteComment(c.id)}
                  className="text-black/20 hover:text-coral opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            ))
          )}
          <form onSubmit={addComment} className="flex gap-2">
            <input
              className="input !py-2"
              placeholder="Kommentieren…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <button className="btn-primary" disabled={busy}>
              Senden
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
