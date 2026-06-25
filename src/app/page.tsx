"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoginCard } from "@/components/LoginCard";
import type { Post } from "@/components/PostCard";

export default function HomePage() {
  const router = useRouter();
  const [me, setMe] = useState<{ name: string; nickname?: string | null } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [memory, setMemory] = useState<Post | null>(null);
  const [hasClass, setHasClass] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const home = await fetch("/api/home").then((r) => r.json());
      if (!home.user) {
        router.replace("/login");
        setLoading(false);
        return;
      }
      setMe(home.user);
      setPosts(home.posts ?? []);
      setMemory(home.memory ?? null);
      setHasClass(!!home.hasClass);
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <Skeleton />;

  if (!me) {
    return <LoginCard />;
  }

  const imagePosts = posts.filter((p) => p.imageUrl);
  const quotes = posts.filter((p) => p.kind === "QUOTE" && p.text);
  const seed = `${new Date().toDateString()}-${me.name}-${posts.length}`;
  const popularPool = posts.filter((p) => postScore(p) > 0).sort((a, b) => postScore(b) - postScore(a)).slice(0, 12);
  const popular = variedList(popularPool.length ? popularPool : posts, `${seed}-popular`).slice(0, 4);
  const featured = memory ?? popular[0] ?? imagePosts[0] ?? posts[0] ?? null;
  const sideTiles = uniquePosts([
    ...variedList(imagePosts, `${seed}-images`),
    ...popular,
    ...variedList(quotes, `${seed}-quotes-side`),
    ...posts,
  ]).filter((p) => p.id !== featured?.id).slice(0, 3);
  const usedTop = new Set([featured?.id, ...sideTiles.map((p) => p.id)].filter(Boolean) as string[]);
  const fresh = variedList(posts.filter((p) => !usedTop.has(p.id)).length ? posts.filter((p) => !usedTop.has(p.id)) : posts, `${seed}-fresh`).slice(0, 6);
  const gallery = variedList(imagePosts, `${seed}-gallery`).slice(0, 6);
  const quoteStrip = variedList(quotes, `${seed}-quote-strip`).slice(0, 5);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="section-label mb-2">Aus deiner Maturaziitig</p>
          <h1 className="display break-words text-5xl leading-[0.86] sm:text-6xl">
            Hey {me.nickname || me.name.split(" ")[0]}
          </h1>
          <p className="mt-2 max-w-xl text-sm font-black text-ink/60">
            Ein wechselnder Mix aus neuen Bildern, lauten Zitaten und Momenten, die gerade auffallen.
          </p>
        </div>
      </header>

      {posts.length === 0 ? (
        <EmptyHome hasClass={hasClass} />
      ) : (
        <>
          <HomeBoard featured={featured} sideTiles={sideTiles} />

          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="space-y-3">
              <SectionHead title="Interessant gerade" meta={popular.length ? `${popular.length} Fundstücke` : ""} />
              <div className="grid gap-3 sm:grid-cols-2">
                {(popular.length ? popular : fresh).slice(0, 4).map((p) => (
                  <MiniPostCard key={p.id} post={p} />
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <SectionHead title="Frisch gesammelt" meta={fresh.length ? "neu & gemischt" : ""} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
                {fresh.slice(0, 6).map((p) => (
                  <MiniPostCard key={p.id} post={p} compact />
                ))}
              </div>
            </section>
          </div>

          {gallery.length > 0 && <PhotoStrip posts={gallery} />}
          {quoteStrip.length > 0 && <QuoteStrip posts={quoteStrip} />}
        </>
      )}
    </div>
  );
}

function EmptyHome({ hasClass }: { hasClass: boolean }) {
  return (
    <section className="hero-frame p-6 text-center sm:p-8">
      <p className="section-label mb-3">Noch leer</p>
      <h2 className="display mx-auto max-w-2xl text-4xl leading-[0.9] sm:text-5xl">
        Hier landen bald Bilder, Zitate und kleine Beweise, dass diese Klasse existiert hat.
      </h2>
      <Link href="/classes" className="btn-primary mt-6">{hasClass ? "Zur Klasse" : "Klasse beitreten"}</Link>
    </section>
  );
}

function HomeBoard({ featured, sideTiles }: { featured: Post | null; sideTiles: Post[] }) {
  if (!featured) return null;
  return (
    <section className="grid gap-3 lg:grid-cols-[1.18fr_0.82fr]">
      <Link href={postHref(featured)} className="group relative min-h-[310px] overflow-hidden rounded-[34px] border border-white/40 bg-white/10 p-5 shadow-soft transition hover:-translate-y-0.5">
        {featured.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={featured.imageUrl} alt="" fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_16%,rgba(40,217,242,0.42),transparent_38%),radial-gradient(circle_at_80%_8%,rgba(255,196,163,0.62),transparent_42%),radial-gradient(circle_at_44%_95%,rgba(255,47,191,0.68),transparent_58%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-white/20 to-hotpink/35" />
        <div className="relative z-10 flex h-full max-w-2xl flex-col justify-between gap-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-white/30">{postKicker(featured)}</span>
            <span className="chip bg-white/30">{featured.class.name}</span>
          </div>
          <div>
            <h2 className="display max-w-3xl break-words text-4xl leading-[0.88] sm:text-5xl">{postHeadline(featured)}</h2>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-black text-ink/60">
              <span>{featured.likeCount} Likes</span>
              <span>{featured.commentCount} Kommentare</span>
              <span>{shortDate(featured.createdAt)}</span>
            </div>
          </div>
        </div>
      </Link>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        {sideTiles.map((p) => (
          <MiniPostCard key={p.id} post={p} horizontal />
        ))}
      </div>
    </section>
  );
}

function SectionHead({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="section-label">{title}</h2>
      {meta && <span className="chip">{meta}</span>}
    </div>
  );
}

function MiniPostCard({ post, compact = false, horizontal = false }: { post: Post; compact?: boolean; horizontal?: boolean }) {
  const image = post.imageUrl;
  return (
    <Link
      href={postHref(post)}
      className={`glass-card group grid overflow-hidden p-2 transition hover:-translate-y-0.5 ${
        horizontal ? "min-h-[96px] grid-cols-[86px_1fr]" : compact ? "min-h-[126px] grid-cols-[82px_1fr]" : "min-h-[142px] grid-cols-[96px_1fr]"
      } gap-3`}
    >
      <div className="relative overflow-hidden rounded-[24px] bg-white/20">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]" />
        ) : (
          <div className="grid h-full min-h-[84px] place-items-center bg-[radial-gradient(circle_at_30%_24%,rgba(255,255,255,0.54),transparent_36%),radial-gradient(circle_at_72%_80%,rgba(255,47,191,0.42),transparent_55%)]">
            <span className="font-hand text-4xl leading-none text-hotpink">{post.kind === "QUOTE" ? "“" : "✦"}</span>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-col justify-between py-1 pr-1">
        <div>
          <p className="text-[10px] font-black uppercase text-ink/50">{postKicker(post)}</p>
          <p className={`${compact || horizontal ? "text-lg" : "text-xl"} mt-1 line-clamp-3 font-black leading-[0.98] text-ink`}>
            {postHeadline(post)}
          </p>
        </div>
        <p className="mt-2 truncate text-[11px] font-black text-ink/50">
          {post.likeCount} ♥ · {post.commentCount} · {shortDate(post.createdAt)}
        </p>
      </div>
    </Link>
  );
}

function PhotoStrip({ posts }: { posts: Post[] }) {
  return (
    <section className="space-y-3">
      <SectionHead title="Bilder im Umlauf" meta={`${posts.length} gezeigt`} />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {posts.map((p, index) => (
          <Link
            key={p.id}
            href={postHref(p)}
            className={`group relative overflow-hidden rounded-[24px] border border-white/40 bg-white/10 transition hover:-translate-y-0.5 ${index % 3 === 1 ? "sm:mt-5" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.imageUrl!} alt="" loading="lazy" decoding="async" className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-[1.05]" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function QuoteStrip({ posts }: { posts: Post[] }) {
  return (
    <section className="space-y-3">
      <SectionHead title="Zitate, die kleben bleiben" meta={`${posts.length} Stück`} />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {posts.map((p, index) => (
          <Link
            key={p.id}
            href={postHref(p)}
            className={`postit block min-h-[104px] p-4 ${index % 2 ? "sm:mt-4" : ""}`}
          >
            <p className="line-clamp-4 font-hand text-2xl leading-[0.96] text-ink/90">{p.text}</p>
            <p className="mt-3 truncate text-[11px] font-black text-ink/50">{p.author?.name ?? "Anonym"}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-16 w-52 rounded-full bg-white/40" />
      <div className="h-80 rounded-[38px] bg-white/40" />
      <div className="h-48 rounded-[30px] bg-white/40" />
    </div>
  );
}

function postHref(post: Post) {
  if (post.topic) return `/classes/${post.class.id}/topics/${post.topic.id}`;
  if (post.teacher) return `/classes/${post.class.id}/teachers/${post.teacher.id}`;
  if (post.subject) return `/classes/${post.class.id}/members/${post.subject.id}`;
  return `/classes/${post.class.id}`;
}

function postKicker(post: Post) {
  if (post.imageUrl) return "Bild";
  if (post.kind === "QUOTE") return "Zitat";
  if (post.topic) return "Projekt";
  return "Notiz";
}

function postHeadline(post: Post) {
  return post.text || post.topic?.name || post.subject?.displayName || post.teacher?.name || post.class.name;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-CH", { day: "2-digit", month: "short" });
}

function postScore(post: Post) {
  return post.likeCount * 3 + post.commentCount * 2 + (post.imageUrl ? 1 : 0);
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function variedList<T extends { id: string }>(items: T[], seed: string) {
  return [...items].sort((a, b) => hashText(`${seed}-${a.id}`) - hashText(`${seed}-${b.id}`));
}

function uniquePosts(items: Post[]) {
  const seen = new Set<string>();
  return items.filter((post) => {
    if (seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
}
