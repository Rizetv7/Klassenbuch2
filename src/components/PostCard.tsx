"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "./Nav";
import { IconHeart, IconComment, IconClose } from "./Icons";

export type Post = {
  id: string;
  board: string;
  kind: string;
  text: string | null;
  context?: string | null;
  saidByName?: string | null;
  anonymous?: boolean;
  imageUrl: string | null;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null; accentColor?: string | null } | null;
  class: { id: string; name: string };
  subject: { id: string; displayName: string; memberType: string; avatarUrl: string | null; accentColor?: string | null } | null;
  teacher: { id: string; name: string; subject: string | null; avatarUrl: string | null; accentColor?: string | null } | null;
  topic: { id: string; name: string } | null;
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

  // Who/what the post is about (shown prominently in the header).
  const about = post.subject
    ? {
        name: post.subject.displayName,
        avatarUrl: post.subject.avatarUrl,
        accent: post.subject.accentColor,
        label: post.subject.memberType === "TEACHER" ? "Lehrperson" : "Schüler:in",
        href: `/classes/${post.class.id}/members/${post.subject.id}`,
      }
    : post.teacher
      ? {
          name: post.teacher.name,
          avatarUrl: post.teacher.avatarUrl,
          accent: post.teacher.accentColor,
          label: post.teacher.subject || "Lehrperson",
          href: `/classes/${post.class.id}/teachers/${post.teacher.id}`,
        }
      : post.topic
        ? { name: post.topic.name, avatarUrl: null, accent: null, label: "Projekt", href: `/classes/${post.class.id}/topics/${post.topic.id}` }
        : null;

  const authorName = post.anonymous || !post.author ? "Anonym" : post.author.name;
  const saidBy = post.kind === "QUOTE" ? (post.subject?.displayName || post.teacher?.name || post.saidByName || null) : null;

  return (
    <article className="post-card animate-fade-up">
      {/* header: who/what it is about */}
      <div className="relative z-10 flex items-center gap-3">
        {about ? (
          <Link href={about.href} className="flex min-w-0 items-center gap-3 group/head">
            <Avatar name={about.name} url={about.avatarUrl} accent={about.accent} size={46} />
            <div className="min-w-0 leading-tight">
              <p className="font-black truncate group-hover/head:underline">{about.name}</p>
              <p className="text-xs font-bold text-muted">{about.label}</p>
            </div>
          </Link>
        ) : (
          <div className="font-black">Beitrag</div>
        )}
        <button onClick={deletePost} title="Löschen" className="ml-auto rounded-full bg-white/25 px-2 py-2 text-ink/25 transition hover:bg-white/50 hover:text-coral hover:rotate-90">
          <IconClose size={16} />
        </button>
      </div>

      {/* body */}
      <div className="relative z-10 mt-4">
        {post.kind === "QUOTE" && post.text && (
          <div className="rounded-[30px] border border-white/50 bg-white/30 p-5 sm:p-7">
            <p className="quote-big">“{post.text}”</p>
            {saidBy && <p className="mt-2 text-sm font-black text-ink/70">— {saidBy}</p>}
          </div>
        )}
        {post.kind === "TEXT" && post.text && (
          <div className="postit inline-block max-w-full whitespace-pre-wrap font-hand text-3xl leading-[0.98] text-ink/90">
            {post.text}
          </div>
        )}
        {post.context && <p className="mt-2 font-hand text-2xl leading-none text-hotpink">{post.context}</p>}
        {post.imageUrl && (
          <div className="mt-2 flex justify-center">
            <div className="polaroid w-full max-w-3xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.imageUrl} alt="" className="aspect-[4/3] w-full rounded-[22px] object-cover" />
              {post.text && <p className="mt-2 text-center font-hand text-3xl leading-tight text-ink/80">{post.text}</p>}
            </div>
          </div>
        )}
      </div>

      {/* footer: small attribution */}
      <p className="relative z-10 mt-3 text-xs font-bold text-muted">
        von <span className="text-ink/70">{authorName}</span>
        {showContext && (
          <>
            {" · "}
            <Link href={`/classes/${post.class.id}`} className="hover:underline">{post.class.name}</Link>
          </>
        )}
        {" · "}
        {timeAgo(post.createdAt)}
      </p>

      {/* actions */}
      <div className="soft-divider relative z-10 mt-3 flex items-center gap-5 pt-3 text-sm font-black">
        <button onClick={toggleLike} className="group/like flex items-center gap-1.5 rounded-full bg-white/25 px-2 py-1.5 transition active:scale-95">
          <IconHeart size={19} filled={liked} className={`${liked ? "text-coral animate-pop" : "text-ink/60"} group-hover/like:animate-wiggle`} />
          <span className="text-ink/70">{likeCount}</span>
        </button>
        <button onClick={toggleComments} className="flex items-center gap-1.5 rounded-full bg-white/25 px-2 py-1.5 text-ink/60 transition hover:text-ink">
          <IconComment size={19} />
          <span className="text-ink/70">{commentCount}</span>
        </button>
      </div>

      {/* comments */}
      {open && (
        <div className="soft-divider relative z-10 mt-3 space-y-3 pt-3">
          {comments === null ? (
            <p className="text-sm text-muted">Lädt…</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2 text-sm group">
                <Avatar name={c.author.name} url={c.author.avatarUrl} accent={c.author.accentColor} size={28} />
                <div className="flex-1 rounded-[20px] border border-white/40 bg-white/20 px-3 py-2">
                  <span className="font-black">{c.author.name}</span> <span>{c.text}</span>
                </div>
                <button
                  onClick={() => deleteComment(c.id)}
                  className="text-ink/20 opacity-0 transition hover:text-coral group-hover:opacity-100"
                >
                  <IconClose size={14} />
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
