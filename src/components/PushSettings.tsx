"use client";

import { useEffect, useState } from "react";

type PushState =
  | "loading"
  | "unsupported" // browser can't do web push (e.g. iPhone Safari without installation)
  | "denied" // user blocked notifications in the browser
  | "off"
  | "on"
  | "busy";

function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return buffer;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function PushSettings() {
  const [state, setState] = useState<PushState>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("unsupported");
      }
    })();
  }, []);

  async function enable() {
    setState("busy");
    setError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/push/key");
      if (!keyRes.ok) throw new Error("Schlüssel konnte nicht geladen werden.");
      const { publicKey } = await keyRes.json();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(publicKey),
      });
      const save = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!save.ok) throw new Error("Speichern fehlgeschlagen.");
      setState("on");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aktivieren fehlgeschlagen.");
      setState("off");
    }
  }

  async function disable() {
    setState("busy");
    setError("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  }

  return (
    <section className="glass-card p-4">
      <p className="section-label mb-1">Mitteilungen</p>
      <h2 className="text-lg font-black">Push-Benachrichtigungen</h2>
      <p className="mt-1 text-sm font-bold text-ink/60">
        Erfahre sofort, wenn jemand etwas über dich postet, dein Beitrag viele Likes bekommt
        oder eine neue Umfrage startet.
      </p>

      {state === "loading" && <p className="mt-3 text-sm font-bold text-ink/45">Prüfe…</p>}

      {state === "unsupported" && (
        <div className="mt-3 rounded-[20px] border border-white/45 bg-white/20 p-3 text-sm font-bold text-ink/70">
          {isIos() ? (
            <>
              Auf dem iPhone/iPad zuerst die App installieren: In Safari unten auf{" "}
              <span className="font-black">Teilen</span> tippen →{" "}
              <span className="font-black">„Zum Home-Bildschirm“</span>. Danach die App vom
              Home-Bildschirm öffnen und hier Mitteilungen aktivieren.
            </>
          ) : (
            "Dieser Browser unterstützt leider keine Push-Benachrichtigungen."
          )}
        </div>
      )}

      {state === "denied" && (
        <p className="mt-3 rounded-[20px] border border-white/45 bg-white/20 p-3 text-sm font-bold text-ink/70">
          Mitteilungen sind für diese Seite blockiert. Erlaube sie in den
          Browser-/iOS-Einstellungen und lade die Seite neu.
        </p>
      )}

      {(state === "off" || state === "busy") && state !== "busy" && (
        <button onClick={enable} className="btn-accent mt-3">Benachrichtigungen aktivieren</button>
      )}
      {state === "busy" && (
        <button className="btn-accent mt-3" disabled>Einen Moment…</button>
      )}
      {state === "on" && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="chip bg-white/40">✓ Aktiv auf diesem Gerät</span>
          <button onClick={disable} className="btn-soft text-sm">Deaktivieren</button>
        </div>
      )}

      {error && <p className="mt-2 text-sm font-black text-coral">{error}</p>}
    </section>
  );
}
