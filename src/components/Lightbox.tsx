"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconClose, IconDownload } from "./Icons";

// Full-screen image viewer shared by posts and photo comments. Rendered into
// document.body via a portal so it escapes any transformed ancestor (cards use
// transforms for their reveal animation, which would otherwise break
// position:fixed). Optimised for both iPhone (safe-area, tap-to-dismiss) and
// desktop (ESC, roomy layout).
export function Lightbox({
  src,
  caption,
  downloadName,
  onClose,
}: {
  src: string;
  caption?: string | null;
  downloadName?: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  async function download() {
    setDownloading(true);
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = downloadName || "maturaziitig.jpg";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(src, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
        paddingRight: "max(0.75rem, env(safe-area-inset-right))",
      }}
    >
      <div className="flex shrink-0 justify-end gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void download();
          }}
          disabled={downloading}
          className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-black text-ink shadow-soft transition hover:bg-white active:scale-95"
        >
          <IconDownload size={18} />
          {downloading ? "Lädt…" : "Download"}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Schliessen"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow-soft transition hover:bg-white active:scale-95"
        >
          <IconClose size={18} />
        </button>
      </div>

      <div
        className="flex min-h-0 flex-1 items-center justify-center py-3"
        onClick={onClose}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={caption || ""}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-[22px] object-contain shadow-soft"
        />
      </div>

      {caption && (
        <p className="mx-auto max-w-3xl shrink-0 rounded-full bg-white/85 px-4 py-2 text-center font-hand text-2xl leading-tight text-ink/80">
          {caption}
        </p>
      )}
    </div>,
    document.body
  );
}
