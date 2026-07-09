"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { IconClose } from "./Icons";

const NEWS_VERSION = "2026-07-09-photo-feed-polish";
const NEWS_KEY = "mz-news-version";

const ITEMS = [
  {
    title: "Bilder neu gestaltet",
    text: "Auf dem iPhone sieht der Bilderfeed ruhiger aus. Doppeltippe ein Bild, um es direkt zu liken.",
  },
  {
    title: "Bilder immer griffbereit",
    text: "Der Bilder-Tab ist unten. Dein eigenes Profil findest du nun oben rechts.",
  },
  {
    title: "Besserer Überblick",
    text: "Der Hochformat-Feed startet nur auf wirklich telefonartigen Bildschirmen; sonst bleibt das Album sichtbar.",
  },
];

export function NewsPopup() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    if (pathname.startsWith("/amina") || pathname.startsWith("/archivzugang")) return;
    try {
      if (localStorage.getItem(NEWS_KEY) === NEWS_VERSION) return;
      const timer = window.setTimeout(() => setOpen(true), 650);
      return () => window.clearTimeout(timer);
    } catch {
      return;
    }
  }, [mounted, pathname]);

  function close() {
    try {
      localStorage.setItem(NEWS_KEY, NEWS_VERSION);
    } catch {}
    setOpen(false);
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div className="news-pop-layer" role="dialog" aria-modal="true" aria-label="Was ist neu" onClick={close}>
      <section className="news-pop" onClick={(event) => event.stopPropagation()}>
        <div className="news-pop-head">
          <div>
            <span className="news-pop-badge">Was ist neu</span>
            <h2 className="display mt-2 text-4xl leading-[0.9] sm:text-5xl">Update</h2>
          </div>
          <button type="button" className="news-pop-close" onClick={close} aria-label="Schliessen">
            <IconClose size={18} />
          </button>
        </div>

        <div className="news-pop-list">
          {ITEMS.map((item) => (
            <article key={item.title} className="news-pop-item">
              <span className="news-pop-dot" />
              <div>
                <h3 className="text-sm font-black text-ink">{item.title}</h3>
                <p className="mt-1 text-sm font-bold leading-snug text-ink/60">{item.text}</p>
              </div>
            </article>
          ))}
        </div>

        <button type="button" className="btn-primary relative z-10 mt-4 w-full" onClick={close}>
          Alles klar
        </button>
      </section>
    </div>,
    document.body
  );
}
