"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "kb-install-tip-dismissed";

// One-time bottom sheet that explains how to install the app on the home
// screen. Only shows on phones/tablets in the browser (not when already
// installed), and never again after "Alles klar".
export function InstallTip() {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(true);

  useEffect(() => {
    try {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      const isIos =
        /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const mobile = isIos || /android/i.test(navigator.userAgent);
      if (standalone || !mobile || localStorage.getItem(DISMISS_KEY)) return;
      setIos(isIos);
      const t = window.setTimeout(() => setShow(true), 1500);
      return () => window.clearTimeout(t);
    } catch {
      // never block the app because of the tip
    }
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setShow(false);
  }

  return (
    <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md animate-fade-up lg:bottom-6">
      <div className="rounded-[28px] border border-white/60 bg-white/90 p-4 shadow-soft">
        <p className="section-label mb-1">Tipp</p>
        <h3 className="text-lg font-black leading-tight">Installiere Maturaziitig als App 📲</h3>
        <ol className="mt-2 space-y-1.5 text-sm font-bold text-ink/75">
          {ios ? (
            <>
              <li>1. Tippe in Safari unten auf <span className="font-black">Teilen</span> (Quadrat mit Pfeil)</li>
              <li>2. Wähle <span className="font-black">„Zum Home-Bildschirm“</span></li>
              <li>3. Öffne die App vom Home-Bildschirm — nur so funktionieren Push-Mitteilungen!</li>
            </>
          ) : (
            <>
              <li>1. Tippe oben rechts auf das <span className="font-black">⋮ Menü</span></li>
              <li>2. Wähle <span className="font-black">„App installieren“</span> bzw. „Zum Startbildschirm“</li>
              <li>3. Öffne die App vom Startbildschirm — dann gibt’s auch Push-Mitteilungen!</li>
            </>
          )}
        </ol>
        <button onClick={dismiss} className="btn-primary mt-3 w-full">Alles klar</button>
      </div>
    </div>
  );
}
