"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { deviceKind, enablePush, getPushStatus, isStandalone, pushSupported } from "@/lib/pushClient";
import { swrJson } from "@/lib/swr";

const DISMISS_KEY = "kb-notify-banner-dismissed";

type Mode = "enable" | "install-iphone" | "install-ipad";

// Slim banner at the top of every logged-in page that nudges the user to
// either install the app (iPhone/iPad, needed for push) or turn on
// notifications (installed app / desktop). Hidden once done or dismissed
// for the session.
export function NotifyBanner() {
  const path = usePathname();
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<Mode>("enable");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const hiddenPath = path === "/login" || path === "/register" || path.startsWith("/archivzugang");

  useEffect(() => {
    if (hiddenPath) {
      setShow(false);
      return;
    }
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {}

    let active = true;
    const cancel = swrJson<{ user?: unknown }>("/api/auth/me", async (d) => {
      if (!active || !d?.user) return;
      const kind = deviceKind();
      // iOS needs the app installed before push can be enabled at all
      if ((kind === "iphone" || kind === "ipad") && !isStandalone()) {
        setMode(kind === "ipad" ? "install-ipad" : "install-iphone");
        setShow(true);
        return;
      }
      if (!pushSupported()) return;
      const status = await getPushStatus();
      if (active && status === "off") {
        setMode("enable");
        setShow(true);
      }
    });
    return () => {
      active = false;
      cancel();
    };
  }, [path, hiddenPath]);

  if (!show || hiddenPath) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setShow(false);
  }

  async function activate() {
    setBusy(true);
    setMsg("");
    try {
      const status = await enablePush();
      if (status === "on") {
        setMsg("✓ Aktiviert!");
        setTimeout(() => setShow(false), 1200);
      } else if (status === "denied") {
        setMsg("In den Einstellungen blockiert.");
      }
    } catch {
      setMsg("Aktivieren fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 animate-fade-up rounded-[24px] border border-white/60 bg-white/85 p-3 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="text-2xl leading-none" aria-hidden>
          {mode === "enable" ? "🔔" : "📲"}
        </span>
        <div className="min-w-0 flex-1">
          {mode === "enable" ? (
            <p className="text-sm font-black leading-tight">Aktiviere Mitteilungen, um nichts zu verpassen.</p>
          ) : (
            <p className="text-sm font-black leading-tight">
              Für Mitteilungen die App installieren: in Safari{" "}
              <span className="whitespace-nowrap">{mode === "install-ipad" ? "oben" : "unten"} auf „Teilen"</span>{" "}
              → <span className="whitespace-nowrap">„Zum Home-Bildschirm"</span>.
            </p>
          )}
          {msg && <p className="mt-0.5 text-xs font-bold text-ink/55">{msg}</p>}
        </div>
        {mode === "enable" && (
          <button onClick={activate} disabled={busy} className="btn-accent shrink-0 text-sm">
            {busy ? "…" : "Aktivieren"}
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Schliessen"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/50 text-ink/40 transition hover:text-coral"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
