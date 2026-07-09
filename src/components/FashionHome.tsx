"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Post } from "./PostCard";
import { uploaderPerson } from "./HomeAttribution";

// The COUTURE home: an editorial magazine issue instead of the aquarell
// mosaic. Cover story, runway ticker, numbered quote index, lookbook grid.
// Same data, completely different presentation.

function postHref(post: Post) {
  if (post.topic) return `/classes/${post.class.id}/topics/${post.topic.id}`;
  if (post.teacher) return `/classes/${post.class.id}/teachers/${post.teacher.id}`;
  if (post.subject) return `/classes/${post.class.id}/members/${post.subject.id}`;
  return `/classes/${post.class.id}`;
}

function speakerName(post: Post): string | null {
  return (
    post.subject?.displayName ??
    post.teacher?.name ??
    (post.kind === "QUOTE" ? post.saidByName ?? null : null)
  );
}

function fxDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-CH", { day: "2-digit", month: "long" });
}

export function FashionHome({
  meName,
  posts,
  memory,
  hasClass,
  pollDeck,
}: {
  meName: string;
  posts: Post[];
  memory: Post | null;
  hasClass: boolean;
  pollDeck: ReactNode;
}) {
  const quotes = posts.filter((p) => p.kind === "QUOTE" && p.text);
  const images = posts.filter((p) => p.imageUrl);
  const cover = memory ?? images[0] ?? quotes[0] ?? posts[0] ?? null;
  const indexQuotes = quotes.filter((p) => p.id !== cover?.id).slice(0, 6);
  const looks = images.filter((p) => p.id !== cover?.id).slice(0, 6);
  const tickerQuotes = (quotes.length ? quotes : posts).slice(0, 8);

  if (posts.length === 0) {
    return (
      <div className="space-y-6 py-6">
        <div className="fx-rule" />
        <p className="fx-label text-center text-ink/55">Ausgabe in Arbeit</p>
        <h2 className="display mx-auto max-w-2xl text-center text-4xl italic leading-[1.02] sm:text-5xl">
          Die erste Ausgabe entsteht gerade — Bilder, Zitate und Beweise, dass diese Klasse existiert hat.
        </h2>
        <div className="text-center">
          <Link href="/classes" className="btn-primary">{hasClass ? "Zur Klasse" : "Klasse beitreten"}</Link>
        </div>
        <div className="fx-rule" />
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-6">
      {/* greeting strip */}
      <div className="flex items-baseline justify-between gap-3 pt-1">
        <p className="fx-label text-ink/55">Für {meName.split(" ")[0]}</p>
        <p className="fx-label text-ink/55">Erinnerungen · Zitate · Momente</p>
      </div>

      {/* cover story — a framed print behind double matting */}
      {cover && (
        <section>
          <Link href={postHref(cover)} className="fx-photo group block">
            <div className="fx-frame">
              {cover.imageUrl ? (
                <figure className="relative overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cover.imageUrl}
                    alt=""
                    fetchPriority="high"
                    decoding="async"
                    className="max-h-[62vh] min-h-[300px] w-full object-cover transition duration-[1.2s] group-hover:scale-[1.02]"
                  />
                  <figcaption className="absolute bottom-0 left-0 max-w-[88%] border-r border-t border-ink/85 bg-[#f3efe6] px-4 py-3 sm:px-6 sm:py-4">
                    <p className="fx-label text-hotpink">Cover Story</p>
                    <p className="display mt-1 text-2xl leading-[1.02] sm:text-4xl">
                      {cover.kind === "QUOTE" && cover.text ? <em>“{cover.text}”</em> : cover.text || speakerName(cover) || cover.class.name}
                    </p>
                  </figcaption>
                </figure>
              ) : (
                <div className="px-4 py-10 text-center sm:px-8 sm:py-16">
                  <p className="fx-label text-hotpink">Cover Story</p>
                  <p className="display mx-auto mt-3 max-w-3xl text-3xl italic leading-[1.04] sm:text-5xl">
                    “{cover.text}”
                  </p>
                  <p className="fx-label fx-gold mt-4">✦</p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-2.5">
              <p className="fx-label text-ink/60">
                {speakerName(cover) ? `Mit ${speakerName(cover)}` : cover.class.name}
              </p>
              <p className="fx-label text-ink/60">
                Eingereicht von {uploaderPerson(cover).name} · <span className="fx-gold">{fxDate(cover.createdAt)}</span>
              </p>
            </div>
          </Link>
        </section>
      )}

      {/* runway ticker */}
      {tickerQuotes.length > 0 && (
        <section className="fx-marquee -mx-4 sm:-mx-6" aria-hidden="true">
          <div className="fx-marquee-track">
            {[0, 1].map((copy) => (
              <span key={copy} className="inline-flex items-center gap-10">
                {tickerQuotes.map((p) => (
                  <span key={`${copy}-${p.id}`} className="fx-marquee-quote text-[#f3efe6]/95">
                    “{(p.text || "").slice(0, 80)}”&nbsp;&nbsp;<span className="fx-gold not-italic">✦</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* numbered quote index */}
      {indexQuotes.length > 0 && (
        <section>
          <h2 className="fx-sect fx-label mb-2 text-ink/85">
            <span><span className="fx-gold">✦</span>&nbsp;&nbsp;Zitate der Saison&nbsp;&nbsp;<span className="fx-gold">✦</span></span>
          </h2>
          <div>
            {indexQuotes.map((p, i) => (
              <Link key={p.id} href={postHref(p)} className="fx-row flex items-baseline gap-4 border-b border-ink/25 py-4 sm:gap-8">
                <span className="display fx-gold shrink-0 text-2xl italic sm:text-3xl">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="display block text-xl italic leading-[1.06] sm:text-3xl">“{p.text}”</span>
                  <span className="fx-label mt-2 block text-ink/50">
                    {speakerName(p) ? `— ${speakerName(p)}` : p.class.name}
                    <span className="text-ink/35"> · eingereicht von {uploaderPerson(p).name}</span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* lookbook */}
      {looks.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="fx-sect fx-label mb-1 flex-1 text-ink/85">
              <span><span className="fx-gold">✦</span>&nbsp;&nbsp;Lookbook&nbsp;&nbsp;<span className="fx-gold">✦</span></span>
            </h2>
            <Link href="/bilder" className="fx-link text-ink/55">Alle Bilder</Link>
          </div>
          <p className="fx-label mb-3 text-center text-ink/40">Berühren für Farbe</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {looks.map((p, i) => (
              <Link key={p.id} href={postHref(p)} className="fx-photo group block">
                <div className="fx-frame">
                  <div className="overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.imageUrl!}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="aspect-[3/4] w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between px-1 py-2">
                  <span className="fx-label text-ink/70">Look <span className="fx-gold">{String(i + 1).padStart(2, "0")}</span></span>
                  <span className="fx-label max-w-[55%] truncate text-ink/45">{speakerName(p) ?? uploaderPerson(p).name}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* polls, editorially framed */}
      {pollDeck && (
        <section>
          <h2 className="fx-sect fx-label mb-3 text-ink/85">
            <span><span className="fx-gold">✦</span>&nbsp;&nbsp;Leserwahl&nbsp;&nbsp;<span className="fx-gold">✦</span></span>
          </h2>
          {pollDeck}
        </section>
      )}

      {/* colophon */}
      <footer className="space-y-3 pt-2 text-center">
        <div className="fx-rule-double" />
        <p className="display text-4xl italic">
          <span className="fx-gold not-italic text-xl align-middle">✦</span>&nbsp;&nbsp;Fin.&nbsp;&nbsp;<span className="fx-gold not-italic text-xl align-middle">✦</span>
        </p>
        <p className="fx-label text-ink/45">Maturaziitig — das digitale Jahrbuch deiner Klasse</p>
      </footer>
    </div>
  );
}
