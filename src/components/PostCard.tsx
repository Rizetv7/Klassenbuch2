"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "./Nav";
import { CommentThread } from "./CommentThread";
import { Lightbox } from "./Lightbox";
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
  author: { id: string; name: string; avatarUrl: string | null; accentColor?: string | null; membershipId?: string | null } | null;
  class: { id: string; name: string };
  subject: { id: string; displayName: string; memberType: string; avatarUrl: string | null; accentColor?: string | null } | null;
  teacher: { id: string; name: string; subject: string | null; avatarUrl: string | null; accentColor?: string | null } | null;
  topic: { id: string; name: string } | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  deletableByMe?: boolean;
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
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [imageOpen, setImageOpen] = useState(false);
  const commentsRef = useRef<HTMLDivElement>(null);

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

  function jumpToComments() {
    commentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function deletePost() {
    if (!confirm("Diesen Beitrag wirklich löschen?")) return;
    const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    if (res.ok) onDeleted?.(post.id);
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
  const authorHref = !post.anonymous && post.author?.membershipId
    ? `/classes/${post.class.id}/members/${post.author.membershipId}`
    : null;
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
          <div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-white/35 text-3xl text-hotpink">✦</div>
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
          {authorHref ? (
            <Link href={authorHref} className="mt-3 flex min-w-0 items-center gap-2 transition hover:opacity-80">
              <Avatar name={authorName} url={authorAvatar} accent={authorAccent} size={25} ring={false} />
              <p className="truncate text-xs font-black text-ink/60 hover:underline">{authorName}</p>
            </Link>
          ) : (
            <div className="mt-3 flex min-w-0 items-center gap-2">
              <Avatar name={authorName} url={authorAvatar} accent={authorAccent} size={25} ring={false} />
              <p className="truncate text-xs font-black text-ink/60">{authorName}</p>
            </div>
          )}
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
          <div className="postit block max-w-full">
            <p className="section-label mb-1.5 !text-ink/40">Notiz</p>
            <p className="whitespace-pre-wrap break-words text-lg font-bold leading-snug text-ink/90">{post.text}</p>
          </div>
        )}
        {post.context && (
          <p className="mt-2 inline-flex max-w-full items-center rounded-full bg-hotpink/12 px-3 py-1 text-xs font-black text-hotpink">
            <span className="truncate">{post.context}</span>
          </p>
        )}
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
              {post.text && <p className="px-2 pb-1 pt-2 text-center text-sm font-bold leading-snug text-ink/75">{post.text}</p>}
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
        <button onClick={toggleLike} className="group/like flex items-center gap-1.5 rounded-full bg-white/25 px-2 py-1.5 transition-all duration-150 hover:bg-white/45 active:scale-90">
          <IconHeart size={19} filled={liked} className={`${liked ? "text-coral animate-pop" : "text-ink/60"} group-hover/like:animate-wiggle`} />
          <span className="text-ink/70">{likeCount}</span>
        </button>
        <button onClick={jumpToComments} className="flex items-center gap-1.5 rounded-full bg-white/25 px-2 py-1.5 text-ink/60 transition-all duration-150 hover:bg-white/45 hover:text-ink active:scale-90">
          <IconComment size={19} />
          <span className="text-ink/70">{commentCount}</span>
        </button>
      </div>

      {/* comments: always visible, lazily loaded once scrolled near */}
      <div ref={commentsRef} className="soft-divider relative z-10 mt-3 pt-3">
        <CommentThread commentsPath={`/api/posts/${post.id}/comments`} classId={post.class.id} onCountChange={setCommentCount} />
      </div>

      {imageOpen && post.imageUrl && (
        <Lightbox
          src={post.imageUrl}
          caption={post.text}
          downloadName={`maturaziitig-${post.id}.jpg`}
          onClose={() => setImageOpen(false)}
        />
      )}
    </article>
  );
}
