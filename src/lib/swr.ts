"use client";

// Tiny stale-while-revalidate helper for the client pages.
//
// swrJson(url, onData) calls onData twice: synchronously with the cached
// value from sessionStorage (if any), then again with the fresh server
// response. Repeat visits render instantly while the network catches up.

const PREFIX = "kb-cache:";

export type SwrMeta = { fromCache: boolean; status: number };

function readCache<T>(url: string): T | undefined {
  try {
    const raw = sessionStorage.getItem(PREFIX + url);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(url: string, data: unknown) {
  try {
    sessionStorage.setItem(PREFIX + url, JSON.stringify(data));
  } catch {
    // storage full or unavailable — caching is best-effort
  }
}

// Fetch with cache-first delivery. Returns a cancel function for effects.
export function swrJson<T>(url: string, onData: (data: T | null, meta: SwrMeta) => void): () => void {
  let cancelled = false;

  const cached = readCache<T>(url);
  if (cached !== undefined) onData(cached, { fromCache: true, status: 200 });

  (async () => {
    try {
      const res = await fetch(url);
      const data = res.ok ? ((await res.json()) as T) : null;
      if (cancelled) return;
      if (res.ok) writeCache(url, data);
      onData(data, { fromCache: false, status: res.status });
    } catch {
      // network error: keep showing the cached value if we had one
      if (!cancelled && cached === undefined) onData(null, { fromCache: false, status: 0 });
    }
  })();

  return () => {
    cancelled = true;
  };
}

// Warm the cache for a page the user is likely to open next.
export function prefetchJson(url: string) {
  try {
    if (readCache(url) !== undefined) return;
    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) writeCache(url, data);
      })
      .catch(() => {});
  } catch {
    // best-effort
  }
}

// Drop everything — call on login/logout so no data leaks between accounts.
export function clearApiCache() {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(PREFIX)) doomed.push(key);
    }
    doomed.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // best-effort
  }
}
