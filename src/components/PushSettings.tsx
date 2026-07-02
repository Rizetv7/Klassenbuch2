"use client";

import { useEffect, useState } from "react";
import { disablePush, enablePush, getPushStatus, isIos } from "@/lib/pushClient";

type PushState = "loading" | "unsupported" | "denied" | "off" | "on" | "busy";

export function PushSettings() {
  const [state, setState] = useState<PushState>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    getPushStatus().then(setState);
  }, []);

  async function enable() {
    setState("busy");
    setError("");
    try {
      setState(await enablePush());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aktivieren fehlgeschlagen.");
      setState("off");
    }
  }

  async function disable() {
    setState("busy");
    setError("");
    try {
      await disablePush();
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
