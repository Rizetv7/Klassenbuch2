"use client";

import { useEffect } from "react";

// Registers the service worker (needed for push notifications).
// No fetch handler in the worker, so normal loading is unaffected.
export function PwaSetup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
