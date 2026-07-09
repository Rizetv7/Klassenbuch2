"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "./Nav";
import { CommentThread } from "./CommentThread";
import { IconClose, IconComment, IconDownload, IconHeart, IconShare } from "./Icons";
import type { Post } from "./PostCard";
import { PageLoading, PageReveal } from "./LoadingState";
import { swrJson } from "@/lib/swr";

const FIRST_PAGE = "/api/images?limit=32";

type GalleryResponse = {
  posts?: Post[];
  nextCursor?: string | null;
  error?: string;
};

type SourceInfo = {
  title: string;
  label: string;
  href: string;
  avatarUrl: string | null;
  accentColor?: string | null;
};

function mergePosts(current: Post[], incoming: Post[], mode: "prepend" | "append") {
  const currentById = new Map(current.map((post) => [post.id, post]));
  const incomingById = new Map(incoming.map((post) => [post.id, post]));
  const seen = new Set<string>();
  const next: Post[] = [];

  const add = (post: Post) => {
    if (seen.has(post.id)) return;
    seen.add(post.id);
    next.push(post);
  };

  if (mode === "prepend") {
    for (const post of incoming) add({ ...(currentById.get(post.id) ?? {}), ...post });
    for (const post of current) if (!incomingById.has(post.id)) add(post);
    return next;
  }

  for (const post of current) add({ ...post, ...(incomingById.get(post.id) ?? {}) });
  for (const post of incoming) add(post);
  return next;
}

function cardVariant(post: Post, index: number) {
  let hash = index * 97;
  for (let i = 0; i < post.id.length; i++) hash = (hash * 31 + post.id.charCodeAt(i)) >>> 0;
  const shapes = ["portrait", "square", "landscape", "tall", "snapshot", "wide"];
  return {
    shape: shapes[hash % shapes.length],
    tilt: ((hash % 11) - 5) * 0.45,
    lift: hash % 4 === 0 ? 18 : hash % 5 === 0 ? 8 : 0,
  };
}

function postPath(post: Post) {
  if (post.topic) return `/classes/${post.class.id}/topics/${post.topic.id}`;
  if (post.teacher) return `/classes/${post.class.id}/teachers/${post.teacher.id}`;
  if (post.subject) return `/classes/${post.class.id}/members/${post.subject.id}`;
  return `/classes/${post.class.id}`;
}

function sourceInfo(post: Post): SourceInfo {
  if (post.subject) {
    return {
      title: post.subject.displayName,
      label: post.subject.memberType === "TEACHER" ? "Lehrperson" : "Person",
      href: `/classes/${post.class.id}/members/${post.subject.id}`,
      avatarUrl: post.subject.avatarUrl,
      accentColor: post.subject.accentColor,
    };
  }
  if (post.teacher) {
    return {
      title: post.teacher.name,
      label: post.teacher.subject || "Lehrperson",
      href: `/classes/${post.class.id}/teachers/${post.teacher.id}`,
      avatarUrl: post.teacher.avatarUrl,
      accentColor: post.teacher.accentColor,
    };
  }
  if (post.topic) {
    return {
      title: post.topic.name,
      label: "Projekt",
      href: `/classes/${post.class.id}/topics/${post.topic.id}`,
      avatarUrl: null,
      accentColor: null,
    };
  }
  return {
    title: post.class.name,
    label: "Klasse",
    href: `/classes/${post.class.id}`,
    avatarUrl: null,
    accentColor: null,
  };
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-CH", { day: "2-digit", month: "short" });
}

function useCompactGallery() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    // The vertical feed is for genuinely phone-shaped viewports. A narrow
    // desktop window stays an album instead of unexpectedly becoming TikTok.
    const query = window.matchMedia("(max-width: 1023px) and (max-aspect-ratio: 3 / 4)");
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return compact;
}

export function ImageGallery() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadedMoreRef = useRef(false);
  const compactGallery = useCompactGallery();

  useEffect(() => {
    const cancel = swrJson<GalleryResponse>(FIRST_PAGE, (data, meta) => {
      if (!data) {
        if (meta.status === 401) router.push("/login");
        if (!meta.fromCache) {
          setError("Bilder konnten nicht geladen werden.");
          setPosts([]);
        }
        return;
      }
      setPosts((current) => (current === null ? data.posts ?? [] : mergePosts(current, data.posts ?? [], "prepend")));
      setNextCursor((current) => (loadedMoreRef.current ? current : data.nextCursor ?? null));
      setError("");
    });
    return cancel;
  }, [router]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      fetch(FIRST_PAGE)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: GalleryResponse | null) => {
          if (!data?.posts) return;
          setPosts((current) => mergePosts(current ?? [], data.posts ?? [], "prepend"));
          setNextCursor((current) => (loadedMoreRef.current ? current : data.nextCursor ?? null));
        })
        .catch(() => null);
    }, 25_000);
    return () => window.clearInterval(interval);
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/images?limit=32&cursor=${encodeURIComponent(nextCursor)}`);
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await res.json().catch(() => null)) as GalleryResponse | null;
      if (!res.ok || !data) throw new Error(data?.error || "Laden fehlgeschlagen.");
      setPosts((current) => mergePosts(current ?? [], data.posts ?? [], "append"));
      loadedMoreRef.current = true;
      setNextCursor(data.nextCursor ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Bilder konnten nicht geladen werden.");
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, router]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "900px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const selectedIndex = useMemo(
    () => (selectedId && posts ? posts.findIndex((post) => post.id === selectedId) : -1),
    [posts, selectedId]
  );

  useEffect(() => {
    if (!posts || selectedIndex < 0) return;
    if (selectedIndex >= posts.length - 4) void loadMore();
  }, [loadMore, posts, selectedIndex]);

  function updatePost(id: string, update: Partial<Post>) {
    setPosts((current) => (current ?? []).map((post) => (post.id === id ? { ...post, ...update } : post)));
  }

  function removeSelected() {
    setSelectedId(null);
  }

  if (posts === null) return <PageLoading label="Bilder werden sortiert" />;

  if (error && posts.length === 0) {
    return <p className="text-coral font-black">{error}</p>;
  }

  return (
    <PageReveal>
      <div className="aq-gallery space-y-5">
        <header className="gallery-hero">
          <div>
            <p className="section-label mb-2">Fotoalbum</p>
            <h1 className="display text-6xl leading-[0.84] sm:text-7xl">Bilder</h1>
            <p className="mt-2 max-w-xl text-sm font-black text-ink/60">
              Alle Bildmomente aus deiner Maturaziitig, locker gemischt wie ein kleines Album.
            </p>
          </div>
          <span className="gallery-count">{posts.length} Bilder</span>
        </header>

        {posts.length === 0 ? (
          <section className="glass-panel p-6 text-center">
            <p className="section-label mb-2">Noch leer</p>
            <h2 className="display text-4xl leading-[0.9]">Noch keine Bilder gesammelt.</h2>
            <Link href="/classes" className="btn-primary mt-5">Zur Klasse</Link>
          </section>
        ) : (
          <section className="gallery-album" aria-label="Alle Bilder">
            {posts.map((post, index) => {
              const source = sourceInfo(post);
              const variant = cardVariant(post, index);
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => setSelectedId(post.id)}
                  className={`gallery-photo is-${variant.shape}`}
                  style={{
                    "--tilt": `${variant.tilt}deg`,
                    "--lift": `${variant.lift}px`,
                    "--stagger": `${Math.min(index, 12) * 28}ms`,
                  } as React.CSSProperties}
                >
                  <span className="gallery-photo-inner">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={post.imageUrl!} alt={post.text || source.title} loading="lazy" decoding="async" />
                    <span className="gallery-photo-gloss" />
                    <span className="gallery-photo-meta">
                      <span className="min-w-0">
                        <span className="block truncate font-black">{source.title}</span>
                        <span className="block truncate text-[11px] font-bold text-white/74">{post.class.name}</span>
                      </span>
                      <span className="gallery-photo-stats">{post.likeCount} ♥</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </section>
        )}

        <div ref={sentinelRef} className="flex justify-center py-3">
          {nextCursor ? (
            <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="btn-soft">
              {loadingMore ? "Lädt Bilder…" : "Mehr Bilder"}
            </button>
          ) : posts.length > 0 ? (
            <span className="chip">Album vollständig</span>
          ) : null}
        </div>

        {error && posts.length > 0 && <p className="text-center text-sm font-black text-coral">{error}</p>}

        {selectedIndex >= 0 && posts[selectedIndex] && (
          compactGallery ? (
            <MobileGalleryViewer
              posts={posts}
              index={selectedIndex}
              nextCursor={nextCursor}
              loadingMore={loadingMore}
              onClose={removeSelected}
              onSelect={(post) => setSelectedId(post.id)}
              onLoadMore={() => void loadMore()}
              onUpdatePost={updatePost}
            />
          ) : (
            <GalleryViewer
              posts={posts}
              index={selectedIndex}
              onClose={removeSelected}
              onSelect={(post) => setSelectedId(post.id)}
              onUpdatePost={updatePost}
            />
          )
        )}
      </div>
    </PageReveal>
  );
}

function MobileGalleryViewer({
  posts,
  index,
  nextCursor,
  loadingMore,
  onClose,
  onSelect,
  onLoadMore,
  onUpdatePost,
}: {
  posts: Post[];
  index: number;
  nextCursor: string | null;
  loadingMore: boolean;
  onClose: () => void;
  onSelect: (post: Post) => void;
  onLoadMore: () => void;
  onUpdatePost: (id: string, update: Partial<Post>) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(index);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);
  const [sharedPostId, setSharedPostId] = useState<string | null>(null);
  const [likeBurst, setLikeBurst] = useState<{ postId: string; x: number; y: number; key: number } | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const activeIndexRef = useRef(0);
  const tapStartRef = useRef<{ postId: string; x: number; y: number } | null>(null);
  const lastTapRef = useRef<{ postId: string; x: number; y: number; time: number } | null>(null);
  const lastImageLikeRef = useRef<{ postId: string; time: number } | null>(null);
  const burstTimerRef = useRef<number | null>(null);

  const commentsPost = commentsPostId ? posts.find((post) => post.id === commentsPostId) ?? null : null;

  useEffect(() => () => {
    if (burstTimerRef.current) window.clearTimeout(burstTimerRef.current);
  }, []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const feed = feedRef.current;
      if (!feed) return;
      activeIndexRef.current = index;
      setActiveIndex(index);
      feed.scrollTop = feed.clientHeight * index;
    });
    return () => window.cancelAnimationFrame(frame);
    // The selected image only determines the first frame of this viewer.
    // Subsequent changes come from its own vertical scroll position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  async function setLiked(post: Post, likedByMe: boolean) {
    if (busyPostId) return;
    if (post.likedByMe === likedByMe) return;
    onUpdatePost(post.id, { likedByMe, likeCount: Math.max(0, post.likeCount + (likedByMe ? 1 : -1)) });
    setBusyPostId(post.id);
    try {
      const response = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error();
      onUpdatePost(post.id, { likedByMe: !!data.liked, likeCount: Number(data.likeCount) || 0 });
    } catch {
      onUpdatePost(post.id, { likedByMe: post.likedByMe, likeCount: post.likeCount });
    } finally {
      setBusyPostId(null);
    }
  }

  function toggleLike(post: Post) {
    void setLiked(post, !post.likedByMe);
  }

  function likeFromImage(post: Post, target: HTMLElement, clientX?: number, clientY?: number) {
    const now = Date.now();
    const previousLike = lastImageLikeRef.current;
    if (previousLike && previousLike.postId === post.id && now - previousLike.time < 420) return;
    lastImageLikeRef.current = { postId: post.id, time: now };

    const rect = target.getBoundingClientRect();
    const x = clientX === undefined ? 50 : Math.max(8, Math.min(92, ((clientX - rect.left) / rect.width) * 100));
    const y = clientY === undefined ? 50 : Math.max(8, Math.min(92, ((clientY - rect.top) / rect.height) * 100));
    const key = now;

    setLikeBurst({ postId: post.id, x, y, key });
    if (burstTimerRef.current) window.clearTimeout(burstTimerRef.current);
    burstTimerRef.current = window.setTimeout(() => {
      setLikeBurst((current) => (current?.key === key ? null : current));
    }, 680);

    // A double tap only adds a like, like the native photo feeds. Unliking is
    // deliberately kept on the heart button so accidental double taps are safe.
    if (!post.likedByMe) void setLiked(post, true);
  }

  function handleTouchStart(post: Post, event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") return;
    tapStartRef.current = { postId: post.id, x: event.clientX, y: event.clientY };
  }

  function handleTouchEnd(post: Post, event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") return;
    const start = tapStartRef.current;
    tapStartRef.current = null;
    if (!start || start.postId !== post.id || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 18) return;

    const now = Date.now();
    const previous = lastTapRef.current;
    if (previous && previous.postId === post.id && now - previous.time < 330 && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 34) {
      lastTapRef.current = null;
      likeFromImage(post, event.currentTarget, event.clientX, event.clientY);
      return;
    }
    lastTapRef.current = { postId: post.id, x: event.clientX, y: event.clientY, time: now };
  }

  async function share(post: Post) {
    const url = `${window.location.origin}/bilder`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Bild aus der Maturaziitig", text: post.text || undefined, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setSharedPostId(post.id);
      window.setTimeout(() => setSharedPostId(null), 1400);
    } catch {}
  }

  if (!mounted) return null;

  return createPortal(
    <div className={`mobile-gallery mobile-gallery-viewer ${commentsPost ? "has-comments" : ""}`} role="dialog" aria-modal="true" aria-label="Bild ansehen">
      <div
        ref={feedRef}
        className="mobile-gallery-feed"
        onScroll={(event) => {
          const element = event.currentTarget;
          const next = Math.max(0, Math.min(posts.length - 1, Math.round(element.scrollTop / Math.max(element.clientHeight, 1))));
          if (next !== activeIndexRef.current) {
            activeIndexRef.current = next;
            setActiveIndex(next);
            onSelect(posts[next]);
          }
          if (next >= posts.length - 4 && nextCursor && !loadingMore) onLoadMore();
        }}
      >
        {posts.map((post, index) => {
          const source = sourceInfo(post);
          const author = post.anonymous || !post.author ? null : post.author;
          return (
            <article className="mobile-gallery-slide" key={post.id} aria-current={index === activeIndex ? "true" : undefined}>
              <div
                className="mobile-gallery-media"
                role="button"
                tabIndex={0}
                aria-label="Bild doppelt antippen, um es zu liken"
                onPointerDown={(event) => handleTouchStart(post, event)}
                onPointerUp={(event) => handleTouchEnd(post, event)}
                onPointerCancel={() => { tapStartRef.current = null; }}
                onDoubleClick={(event) => likeFromImage(post, event.currentTarget, event.clientX, event.clientY)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  likeFromImage(post, event.currentTarget);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.imageUrl!}
                  alt={post.text || source.title}
                  loading={index < 2 ? "eager" : "lazy"}
                  decoding="async"
                  className="mobile-gallery-image"
                />
              </div>
              <div className="mobile-gallery-shade" />
              {likeBurst?.postId === post.id ? (
                <span
                  key={likeBurst.key}
                  className="mobile-gallery-like-burst"
                  style={{ left: `${likeBurst.x}%`, top: `${likeBurst.y}%` }}
                  aria-hidden="true"
                >
                  <IconHeart size={92} filled />
                </span>
              ) : null}

              <div className="mobile-gallery-top">
                <Link href={source.href} className="mobile-gallery-source">
                  <Avatar name={source.title} url={source.avatarUrl} accent={source.accentColor} size={32} />
                  <span className="min-w-0"><span className="block truncate font-black">{source.title}</span><span className="block text-[10px] font-bold text-white/72">{source.label} · {shortDate(post.createdAt)}</span></span>
                </Link>
              </div>

              <div className="mobile-gallery-bottom">
                <div className="mobile-gallery-copy">
                  {post.text ? <p>{post.text}</p> : <p className="text-white/82">Ein Bild aus {post.class.name}</p>}
                  <span>{author ? `Eingereicht von ${author.name}` : "Anonym eingereicht"}</span>
                </div>
                <div className="mobile-gallery-actions" aria-label="Bildaktionen">
                  <Link href={source.href} className="mobile-gallery-subject" aria-label={`${source.title} ansehen`}>
                    <Avatar name={source.title} url={source.avatarUrl} accent={source.accentColor} size={42} />
                  </Link>
                  <button type="button" onClick={() => toggleLike(post)} disabled={busyPostId === post.id} className={`mobile-gallery-action ${post.likedByMe ? "is-liked" : ""}`} aria-label="Gefällt mir">
                    <IconHeart size={25} filled={post.likedByMe} />
                    <span>{post.likeCount}</span>
                  </button>
                  <button type="button" onClick={() => setCommentsPostId(post.id)} className="mobile-gallery-action" aria-label="Kommentare öffnen">
                    <IconComment size={24} />
                    <span>{post.commentCount}</span>
                  </button>
                  <button type="button" onClick={() => void share(post)} className="mobile-gallery-action" aria-label="Bild teilen">
                    <IconShare size={23} />
                    <span>{sharedPostId === post.id ? "Kopiert" : "Teilen"}</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        <div className="mobile-gallery-more">
          {nextCursor ? <button type="button" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? "Lädt Bilder…" : "Mehr Bilder laden"}</button> : <span>Album vollständig</span>}
        </div>
      </div>

      <button type="button" onClick={onClose} className="mobile-gallery-close" aria-label="Zurück zum Album"><IconClose size={20} /></button>
      <span className="sr-only">Aktives Bild {activeIndex + 1}</span>

      {commentsPost ? (
        <div className="mobile-comments-layer" role="dialog" aria-modal="true" aria-label="Kommentare">
          <button type="button" onClick={() => setCommentsPostId(null)} className="mobile-comments-backdrop" aria-label="Kommentare schliessen" />
          <div className="mobile-comments-preview" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={commentsPost.imageUrl!} alt="" />
          </div>
          <section className="mobile-comments-sheet">
            <div className="mobile-comments-head">
              <div><p className="section-label">Öffentlich</p><h2 className="display text-3xl leading-none">Kommentare</h2></div>
              <button type="button" onClick={() => setCommentsPostId(null)} className="quick-post-close" aria-label="Schliessen"><IconClose size={19} /></button>
            </div>
            <CommentThread
              commentsPath={`/api/posts/${commentsPost.id}/comments`}
              classId={commentsPost.class.id}
              onCountChange={(count) => onUpdatePost(commentsPost.id, { commentCount: count })}
            />
          </section>
        </div>
      ) : null}
    </div>,
    document.body
  );
}

function GalleryViewer({
  posts,
  index,
  onClose,
  onSelect,
  onUpdatePost,
}: {
  posts: Post[];
  index: number;
  onClose: () => void;
  onSelect: (post: Post) => void;
  onUpdatePost: (id: string, update: Partial<Post>) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [shared, setShared] = useState(false);
  const commentsRef = useRef<HTMLDivElement | null>(null);
  const post = posts[index];
  const source = sourceInfo(post);
  const author = post.anonymous || !post.author ? null : post.author;
  const previous = posts[(index - 1 + posts.length) % posts.length];
  const next = posts[(index + 1) % posts.length];

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onSelect(previous);
      if (event.key === "ArrowRight") onSelect(next);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [next, onClose, onSelect, previous]);

  async function toggleLike() {
    if (busy) return;
    setBusy(true);
    const nextLiked = !post.likedByMe;
    const optimisticCount = Math.max(0, post.likeCount + (nextLiked ? 1 : -1));
    onUpdatePost(post.id, { likedByMe: nextLiked, likeCount: optimisticCount });
    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error();
      onUpdatePost(post.id, { likedByMe: !!data.liked, likeCount: Number(data.likeCount) || 0 });
    } catch {
      onUpdatePost(post.id, { likedByMe: post.likedByMe, likeCount: post.likeCount });
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const url = `${window.location.origin}${postPath(post)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Bild aus der Maturaziitig", url });
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      window.setTimeout(() => setShared(false), 1600);
    } catch {}
  }

  async function download() {
    if (!post.imageUrl) return;
    setDownloading(true);
    try {
      const res = await fetch(post.imageUrl);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `maturaziitig-bild-${post.id}.jpg`;
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

  if (!mounted || !post.imageUrl) return null;

  return createPortal(
    <div className="gallery-viewer" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="gallery-viewer-top" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="gallery-round-button" onClick={() => onSelect(previous)} aria-label="Vorheriges Bild">
          ‹
        </button>
        <div className="gallery-viewer-counter">{index + 1} / {posts.length}</div>
        <button type="button" className="gallery-round-button" onClick={() => onSelect(next)} aria-label="Nächstes Bild">
          ›
        </button>
        <button type="button" className="gallery-round-button ml-auto" onClick={onClose} aria-label="Schliessen">
          <IconClose size={20} />
        </button>
      </div>

      <div className="gallery-viewer-shell" onClick={(event) => event.stopPropagation()}>
        <div className="gallery-viewer-stage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.imageUrl} alt={post.text || source.title} className="gallery-viewer-image" />
        </div>

        <aside className="gallery-viewer-panel">
          <div className="flex items-start gap-3">
            <Link href={source.href} className="shrink-0 transition hover:opacity-80">
              <Avatar name={source.title} url={source.avatarUrl} accent={source.accentColor} size={54} />
            </Link>
            <div className="min-w-0">
              <p className="section-label">{source.label}</p>
              <Link href={source.href} className="mt-1 block truncate text-2xl font-black leading-none text-ink hover:underline">
                {source.title}
              </Link>
              <p className="mt-1 text-xs font-black text-ink/50">{post.class.name} · {shortDate(post.createdAt)}</p>
            </div>
          </div>

          {post.text && <p className="gallery-caption">{post.text}</p>}

          <div className="gallery-actions">
            <button type="button" onClick={toggleLike} disabled={busy} className={`gallery-action ${post.likedByMe ? "is-liked" : ""}`}>
              <IconHeart size={19} filled={post.likedByMe} />
              <span>{post.likeCount}</span>
            </button>
            <button type="button" onClick={() => commentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="gallery-action">
              <IconComment size={19} />
              <span>{post.commentCount}</span>
            </button>
            <button type="button" onClick={() => void download()} disabled={downloading} className="gallery-action">
              <IconDownload size={18} />
              <span>{downloading ? "..." : "Save"}</span>
            </button>
            <button type="button" onClick={() => void share()} className="gallery-action">
              <IconShare size={18} />
              <span>{shared ? "Kopiert" : "Link"}</span>
            </button>
          </div>

          <div className="gallery-origin">
            <span>Von</span>
            {author ? (
              <span className="inline-flex min-w-0 items-center gap-2">
                <Avatar name={author.name} url={author.avatarUrl} accent={author.accentColor} size={24} ring={false} />
                <span className="truncate">{author.name}</span>
              </span>
            ) : (
              <span>Anonym</span>
            )}
            <Link href={postPath(post)} className="ml-auto underline decoration-ink/25 underline-offset-4">
              Zum Ort
            </Link>
          </div>

          <div ref={commentsRef} className="gallery-comments">
            <CommentThread
              commentsPath={`/api/posts/${post.id}/comments`}
              classId={post.class.id}
              onCountChange={(count) => onUpdatePost(post.id, { commentCount: count })}
            />
          </div>
        </aside>
      </div>
    </div>,
    document.body
  );
}
