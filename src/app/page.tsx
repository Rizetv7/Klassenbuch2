"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Nav";
import { PostCard, type Post } from "@/components/PostCard";

export default function HomePage() {
  const [me, setMe] = useState<{ name: string; avatarUrl?: string | null; accentColor?: string | null } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [memory, setMemory] = useState<Post | null>(null);
  const [hasClass, setHasClass] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/auth/me").then((r) => r.json());
      setMe(meRes.user);
      if (meRes.user) {
        const [feed, rnd, cls] = await Promise.all([
          fetch("/api/posts").then((r) => r.json()),
          fetch("/api/posts?random=1").then((r) => r.json()),
          fetch("/api/classes").then((r) => r.json()),
        ]);
        setPosts(feed.posts ?? []);
        setMemory(rnd.posts?.[0] ?? null);
        setHasClass((cls.classes ?? []).length > 0);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Skeleton />;

  if (!me) {
    return (
      <div className="grid min-h-[78vh] items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="max-w-xl">
          <p className="section-label mb-4">Digitales Erinnerungsbuch</p>
          <h1 className="hero-type">Klassenbuch</h1>
          <p className="mt-6 max-w-md text-lg font-bold leading-relaxed text-ink/70">
            Zitate, Bilder und Momente eurer Klasse, gesammelt in einem lebendigen, glasigen Jahrbuch.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary">Loslegen</Link>
            <Link href="/login" className="btn-soft">Anmelden</Link>
          </div>
        </section>

        <section className="hero-frame min-h-[460px] p-5 sm:p-7">
          <div className="relative z-10 flex h-full flex-col justify-between gap-5">
            <div className="space-y-5">
              <div className="inline-flex rounded-full border border-white/50 bg-white/20 px-4 py-2 text-sm font-black text-ink/80">
                Public class memory
              </div>
              <h2 className="display max-w-lg text-4xl leading-[0.88] sm:text-5xl">
                Die Sprüche, die niemand vergessen darf.
              </h2>
            </div>

            <div className="relative min-h-[220px]">
              <div className="polaroid absolute right-2 top-0 w-[56%] rotate-2">
                <div className="aspect-[4/3] rounded-[22px] bg-[radial-gradient(circle_at_18%_18%,#28d9f2,transparent_42%),radial-gradient(circle_at_82%_16%,#ffc4a3,transparent_44%),radial-gradient(circle_at_52%_92%,#ff2fbf,transparent_58%),#f8f1df]" />
                <p className="mt-2 hidden text-center font-hand text-2xl text-ink/80 sm:block">Pausenhof, kurz vor Chaos</p>
              </div>
              <div className="glass-card absolute bottom-0 left-0 max-w-[72%] p-4 sm:p-5">
                <p className="font-hand text-3xl leading-none text-hotpink">Zitat des Tages</p>
                <p className="mt-3 text-xl font-black leading-[0.95] sm:text-2xl">
                  “Das kommt sicher nicht an der Prüfung.”
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const heroPost = memory ?? posts[0] ?? null;
  const imagePosts = posts.filter((p) => p.imageUrl);
  const companionImage = imagePosts.find((p) => p.id !== heroPost?.id) ?? imagePosts[0] ?? null;
  const quotes = posts.filter((p) => p.kind === "QUOTE" && p.text);
  const todayQuotes = quotes.filter((p) => isToday(p.createdAt)).slice(0, 3);
  const quoteStrip = (todayQuotes.length ? todayQuotes : quotes).slice(0, 3);
  const feedPosts = posts.filter((p) => p.id !== heroPost?.id);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="section-label mb-2">Heute in deiner Klasse</p>
          <h1 className="display break-words text-6xl leading-[0.86] sm:text-7xl">
            Hey {me.name.split(" ")[0]}
          </h1>
        </div>
        <div className="hidden sm:block">
          <Avatar name={me.name} url={me.avatarUrl} accent={me.accentColor} size={72} />
        </div>
      </header>

      <MemoryHero post={heroPost} companionImage={companionImage} hasClass={hasClass} />

      {quoteStrip.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h2 className="section-label">{todayQuotes.length ? "Zitate von heute" : "Zitate aus der Klasse"}</h2>
            <span className="chip">{quoteStrip.length} gesammelt</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {quoteStrip.map((p, index) => (
              <Link
                key={p.id}
                href={p.subject ? `/classes/${p.class.id}/members/${p.subject.id}` : `/classes/${p.class.id}`}
                className={`postit block min-h-[150px] ${index === 1 ? "md:mt-6" : ""}`}
              >
                <p className="font-hand text-3xl leading-[0.98] text-ink/90">{p.text}</p>
                <p className="mt-4 text-xs font-black text-ink/60">{p.author.name}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="section-label">Neue Posts</h2>
        {posts.length === 0 ? (
          <div className="glass-panel p-8 text-center text-ink/70">
            {hasClass ? (
              <>
                <p className="mb-4 font-bold">Noch nichts in deiner Klasse. Mach den Anfang!</p>
                <Link href="/classes" className="btn-primary">Zur Klasse</Link>
              </>
            ) : (
              <>
                <p className="mb-4 font-bold">Du bist noch in keiner Klasse.</p>
                <Link href="/classes" className="btn-primary">Klasse beitreten</Link>
              </>
            )}
          </div>
        ) : (
          (feedPosts.length > 0 ? feedPosts : posts).map((p) => (
            <PostCard key={p.id} post={p} onDeleted={(id) => setPosts((ps) => ps.filter((x) => x.id !== id))} />
          ))
        )}
      </section>
    </div>
  );
}

function MemoryHero({
  post,
  companionImage,
  hasClass,
}: {
  post: Post | null;
  companionImage: Post | null;
  hasClass: boolean;
}) {
  if (!post) {
    return (
      <section className="hero-frame p-8 text-center">
        <p className="section-label mb-4">Noch leer</p>
        <h2 className="display mx-auto max-w-2xl text-5xl leading-[0.88] sm:text-6xl">
          Hier landet bald euer erstes Bild oder Zitat.
        </h2>
        <Link href="/classes" className="btn-primary mt-7">{hasClass ? "Zur Klasse" : "Klasse beitreten"}</Link>
      </section>
    );
  }

  const mainImage = post.imageUrl ? post : companionImage;
  const headline = post.kind === "IMAGE" ? post.text || "Ein Moment aus der Klasse" : post.text || "Erinnerung des Tages";

  return (
    <section className="hero-frame min-h-[500px] p-5 sm:p-7">
      <div className="relative z-10 grid h-full gap-7 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="space-y-5">
          <div className="inline-flex rounded-full bg-ink px-4 py-2 text-sm font-black text-white">{post.class.name}</div>
          <h2 className="display max-w-3xl break-words text-5xl leading-[0.86] sm:text-7xl">{headline}</h2>
          {post.context && <p className="font-hand text-4xl leading-none text-hotpink">{post.context}</p>}
          <div className="flex items-center gap-3 pt-2">
            <Avatar name={post.author.name} url={post.author.avatarUrl} accent={post.author.accentColor} size={52} />
            <div className="leading-tight">
              <p className="font-black">{post.author.name}</p>
              <p className="text-sm font-bold text-ink/60">
                {new Date(post.createdAt).toLocaleDateString("de-CH", { day: "2-digit", month: "short" })}
              </p>
            </div>
          </div>
        </div>

        <div className="relative min-h-[360px]">
          {mainImage?.imageUrl ? (
            <div className="polaroid absolute right-0 top-0 w-[82%] rotate-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mainImage.imageUrl} alt="" className="aspect-[4/3] w-full rounded-[22px] object-cover" />
              <p className="mt-2 text-center font-hand text-2xl leading-tight text-ink/75">
                {mainImage.text || mainImage.author.name}
              </p>
            </div>
          ) : (
            <div className="absolute right-0 top-0 grid aspect-square w-[72%] place-items-center rounded-full bg-white/30 blur-[0.2px]">
              <Avatar name={post.author.name} url={post.author.avatarUrl} accent={post.author.accentColor} size={190} />
            </div>
          )}
          <div className="glass-card absolute bottom-0 left-0 max-w-[76%] p-5">
            <p className="font-hand text-3xl leading-none text-hotpink">Preview</p>
            <p className="mt-3 text-2xl font-black leading-[0.95] sm:text-4xl">
              {post.kind === "QUOTE" ? post.text : post.topic?.name || post.subject?.displayName || post.class.name}
            </p>
          </div>
        </div>
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

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
