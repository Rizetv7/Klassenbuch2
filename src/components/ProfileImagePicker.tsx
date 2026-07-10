"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { uploadImageFile } from "@/lib/uploadImage";
import { Avatar } from "./Nav";
import { IconPencil } from "./Icons";

export function ProfileImagePicker({
  name,
  accent,
  manualUrl,
  fallbackUrl,
  images,
  onChange,
}: {
  name: string;
  accent?: string | null;
  manualUrl: string | null;
  fallbackUrl?: string | null;
  images: string[];
  onChange: (url: string | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shownUrl = manualUrl || fallbackUrl || null;

  async function setAvatar(url: string | null) {
    setBusy(true);
    setError("");
    try {
      await onChange(url);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profilbild konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const url = await uploadImageFile(file);
      await onChange(url);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={manualUrl ? "Profilbild ändern" : "Profilbild wählen"}
        className="relative block shrink-0 transition-transform duration-150 hover:scale-[1.02] active:scale-95"
      >
        <Avatar name={name} url={shownUrl} accent={accent} size={104} />
        <span className="absolute -bottom-0.5 -right-0.5 grid h-8 w-8 place-items-center rounded-full bg-ink text-oncolor shadow-soft">
          <IconPencil size={14} />
        </span>
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center sm:p-6"
            role="dialog"
            aria-modal="true"
            onClick={() => setOpen(false)}
          >
            <div className="absolute inset-0 animate-fade-in bg-black/55 backdrop-blur-sm" />
            <div
              className="lightbox-in relative max-h-[85dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[28px] p-4 sm:rounded-[28px]"
              style={{ background: "linear-gradient(180deg, rgb(var(--c-surface) / 0.35), rgb(var(--c-surface) / 0.2)), var(--page-bg)" }}
              onClick={(event) => event.stopPropagation()}
            >
              <p className="section-label mb-3">Profilbild</p>
          <div className="flex flex-wrap gap-2">
            <label className="btn-soft cursor-pointer text-sm">
              Bild hochladen
              <input type="file" accept="image/*" className="hidden" onChange={upload} disabled={busy} />
            </label>
            {manualUrl && (
              <button type="button" onClick={() => setAvatar(null)} className="btn-soft text-sm text-coral" disabled={busy}>
                Entfernen
              </button>
            )}
          </div>

          {images.length > 0 && (
            <div className="mt-3">
              <p className="section-label mb-2">Aus Posts</p>
              <div className="grid grid-cols-4 gap-2">
                {images.slice(0, 12).map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setAvatar(url)}
                    className={`overflow-hidden rounded-[18px] border transition hover:scale-[1.03] ${manualUrl === url ? "border-ink" : "border-white/45"}`}
                    disabled={busy}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {!manualUrl && fallbackUrl && (
            <p className="mt-3 text-xs font-bold text-ink/50">Ohne manuelle Auswahl wird automatisch das erste gepostete Bild verwendet.</p>
          )}
          {error && <p className="mt-2 text-xs font-black text-coral">{error}</p>}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-4 w-full text-center text-xs font-black text-ink/50 underline"
              >
                Schliessen
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
