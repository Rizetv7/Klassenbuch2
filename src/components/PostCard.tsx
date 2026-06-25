"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "./Nav";

export type Post = {
  id: string;
  board: string;
  kind: string;
  text: string | null;
  imageUrl: string | null;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
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
  author: { id: string; name: string; avatarUrl: string | null };
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  return `vor ${d} T.`;
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

  async function loadComments() {
    const res = await fetch(`/api/posts/${post.id}/comments`);
    if (res.ok) setComments((await res.json()).comments);
  }

  function toggleComments() {
    const next = !open;
    setOpen(next);
    if (next && comments === null) loadComments();
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
    <article className="card p-4">
      <div className="flex items-center gap-3">
        <Avatar name={post.author.name} url={post.author.avatarUrl} size={40} />
        <div className="flex-1 min-w-0">
          <div className="text-sm">
            <span className="font-semibold">{post.author.name}</span>
            {post.subject && (
              <>
                <span className="text-gray-400"> → </span>
                <Link
                  href={`/classes/${post.class.id}/members/${post.subject.id}`}
                  className="font-medium text-brand-700 hover:underline"
                >
                  {post.subject.displayName}
                </Link>
              </>
            )}
          </div>
          <div className="text-xs text-gray-400">
            {showContext && (
              <>
                <Link href={`/classes/${post.class.id}`} className="hover:underline">
                  {post.class.name}
                </Link>
                {" · "}
              </>
            )}
            {post.board === "POSTIT" ? "Pinnwand" : "Steckbrief"} · {timeAgo(post.createdAt)}
          </div>
        </div>
        <button onClick={deletePost} title="Löschen" className="text-gray-300 hover:text-red-500 text-sm">
          ✕
        </button>
      </div>

      <div className="mt-3">
        {post.text && (
          <p className={post.kind === "QUOTE" ? "text-lg italic" : "whitespace-pre-wrap"}>
            {post.kind === "QUOTE" ? `„${post.text}“` : post.text}
          </p>
        )}
        {post.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.imageUrl}
            alt=""
            className="mt-2 rounded-xl max-h-96 w-full object-cover bg-gray-100"
          />
        )}
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm">
        <button onClick={toggleLike} className="flex items-center gap-1 hover:text-red-500">
          <span>{liked ? "❤️" : "🤍"}</span>
          <span>{likeCount}</span>
        </button>
        <button onClick={toggleComments} className="flex items-center gap-1 hover:text-brand-600">
          💬 <span>{commentCount}</span>
        </button>
      </div>

      {open && (
        <div className="mt-3 border-t border-gray-100 pt-3 space-y-3">
          {comments === null ? (
            <p className="text-sm text-gray-400">Lädt…</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2 text-sm group">
                <Avatar name={c.author.name} url={c.author.avatarUrl} size={28} />
                <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                  <span className="font-medium">{c.author.name}</span>{" "}
                  <span>{c.text}</span>
                </div>
                <button
                  onClick={() => deleteComment(c.id)}
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
                  title="Löschen"
                >
                  ✕
                </button>
              </div>
            ))
          )}
          <form onSubmit={addComment} className="flex gap-2">
            <input
              className="input"
              placeholder="Kommentieren…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <button className="btn-primary" disabled={busy}>Senden</button>
          </form>
        </div>
      )}
    </article>
  );
}
