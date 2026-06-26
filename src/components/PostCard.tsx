"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "./Nav";
import { CommentThread } from "./CommentThread";
import { IconHeart, IconComment, IconClose, IconDownload } from "./Icons";

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

type CardPerson = {
  name: string;
  avatarUrl: string | null;
  accent?: string | null;
  label: string;
  href?: string | null;
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
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [imageOpen, setImageOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!imageOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImageOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [imageOpen]);

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

  function toggleComments() {
    setOpen((v) => !v);
  }

  async function deletePost() {
    if (!confirm("Diesen Beitrag wirklich löschen?")) return;
    const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    if (res.ok) onDeleted?.(post.id);
  }

  async function downloadImage() {
    if (!post.imageUrl) return;
    setDownloading(true);
    try {
      const res = await fetch(post.imageUrl);
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `maturaziitig-${post.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(post.imageUrl, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  // Who/what the post is about (shown prominently in the header).
  const about: CardPerson | null = post.subject
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
  const authorAvatar = post.anonymous || !post.author ? null : post.author.avatarUrl;
  const authorAccent = post.anonymous || !post.author ? null : post.author.accentColor;
  const displayTarget: CardPerson | null = about ?? (post.kind === "QUOTE" && post.saidByName
    ? { name: post.saidByName, avatarUrl: null, accent: null, label: "Zitat", href: null }
    : null);
  const saidBy = post.kind === "QUOTE" && !displayTarget ? post.saidByName || null : null;
  const kindLabel = post.kind === "QUOTE" ? "Zitat" : post.kind === "IMAGE" ? "Bild" : post.kind === "TEXT" ? "Notiz" : "Beitrag";

  return (
    <article className="post-card">
      <div className="relative z-10 grid grid-cols-[76px_minmax(0,1fr)_auto] items-start gap-3">
        {displayTarget ? (
          displayTarget.href ? (
            <Link href={displayTarget.href} className="group/head">
              <Avatar name={displayTarget.name} url={displayTarget.avatarUrl} accent={displayTarget.accent} size={76} />
            </Link>
          ) : (
            <Avatar name={displayTarget.name} url={displayTarget.avatarUrl} accent={displayTarget.accent} size={76} />
          )
        ) : (
          <div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-white/35 font-hand text-4xl text-hotpink">✦</div>
        )}
        <div className="min-w-0">
          <p className="section-label">{kindLabel}</p>
          {displayTarget ? (
            displayTarget.href ? (
              <Link href={displayTarget.href} className="mt-1 block truncate text-xl font-black leading-none text-ink hover:underline">
                {displayTarget.name}
              </Link>
            ) : (
              <p className="mt-1 truncate text-xl font-black leading-none text-ink">{displayTarget.name}</p>
            )
          ) : (
            <p className="mt-1 truncate text-xl font-black leading-none text-ink">{post.class.name}</p>
          )}
          <div className="mt-3 flex min-w-0 items-center gap-2">
            <Avatar name={authorName} url={authorAvatar} accent={authorAccent} size={25} ring={false} />
            <p className="truncate text-xs font-black text-ink/60">{authorName}</p>
          </div>
        </div>
        <button onClick={deletePost} title="Löschen" className="ml-auto rounded-full bg-white/25 px-2 py-2 text-ink/25 transition hover:bg-white/50 hover:text-coral hover:rotate-90">
          <IconClose size={16} />
        </button>
      </div>

      {/* body */}
      <div className="relative z-10 mt-4">
        {post.kind === "QUOTE" && post.text && (
          <div className="rounded-[26px] border border-white/50 bg-white/25 p-4">
            <p className="quote-big">“{post.text}”</p>
            {saidBy && <p className="mt-2 text-sm font-black text-ink/70">— {saidBy}</p>}
          </div>
        )}
        {post.kind === "TEXT" && post.text && (
          <div className="postit inline-block max-w-full whitespace-pre-wrap font-hand text-2xl leading-[0.98] text-ink/90">
            {post.text}
          </div>
        )}
        {post.context && <p className="mt-2 font-hand text-2xl leading-none text-hotpink">{post.context}</p>}
        {post.imageUrl && (
          <div className="mt-2 flex justify-center">
            <div className="polaroid w-full max-w-xl">
              <button
                type="button"
                onClick={() => setImageOpen(true)}
                className="group relative block w-full overflow-hidden rounded-[22px] text-left"
                title="Bild gross anzeigen"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.imageUrl} alt="" loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                <span className="absolute bottom-3 right-3 rounded-full bg-white/78 px-3 py-1.5 text-[11px] font-black text-ink/70 opacity-0 shadow-soft backdrop-blur-md transition group-hover:opacity-100">
                  Gross anzeigen
                </span>
              </button>
              {post.text && <p className="mt-2 text-center font-hand text-2xl leading-tight text-ink/80">{post.text}</p>}
            </div>
          </div>
        )}
      </div>

      {/* footer: small attribution */}
      <p className="relative z-10 mt-3 text-xs font-bold text-muted">
        {showContext && (
          <>
            <Link href={`/classes/${post.class.id}`} className="hover:underline">{post.class.name}</Link>
            {" · "}
          </>
        )}
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
        <div className="soft-divider relative z-10 mt-3 pt-3">
          <CommentThread commentsPath={`/api/posts/${post.id}/comments`} onCountChange={setCommentCount} />
        </div>
      )}

      {imageOpen && post.imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/72 p-3 backdrop-blur-md sm:p-6"
          onClick={() => setImageOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-full w-full max-w-6xl flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={downloadImage}
                className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-black text-ink shadow-soft transition hover:bg-white"
                disabled={downloading}
              >
                <IconDownload size={18} />
                {downloading ? "Lädt..." : "Download"}
              </button>
              <button
                type="button"
                onClick={() => setImageOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow-soft transition hover:bg-white"
                aria-label="Schliessen"
              >
                <IconClose size={18} />
              </button>
            </div>
            <div className="grid min-h-0 place-items-center overflow-hidden rounded-[30px] border border-white/35 bg-white/16 p-2 shadow-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.imageUrl} alt="" className="max-h-[78vh] w-auto max-w-full rounded-[22px] object-contain" />
            </div>
            {post.text && <p className="mx-auto max-w-3xl rounded-full bg-white/80 px-4 py-2 text-center font-hand text-2xl leading-tight text-ink/80">{post.text}</p>}
          </div>
        </div>
      )}
    </article>
  );
}
