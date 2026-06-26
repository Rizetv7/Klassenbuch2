"use client";

import type { CSSProperties, ReactNode } from "react";

export function PageReveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <div className="page-reveal" style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}

export function PageLoading({ label = "Lädt" }: { label?: string }) {
  return (
    <div className="page-loading mx-auto max-w-4xl space-y-4" aria-label={label} role="status">
      <div className="space-y-3">
        <div className="loading-mark h-4 w-32 rounded-full" />
        <div className="loading-mark h-11 w-56 max-w-full rounded-[24px]" />
      </div>
      <div className="loading-panel min-h-[210px] rounded-[34px] p-5">
        <div className="mt-16 max-w-lg space-y-3">
          <div className="loading-mark h-8 w-11/12 rounded-[24px]" />
          <div className="loading-mark h-8 w-7/12 rounded-[24px]" />
          <div className="mt-5 flex items-center gap-3">
            <div className="loading-mark h-9 w-9 rounded-full" />
            <div className="loading-mark h-4 w-36 rounded-full" />
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1].map((item) => (
          <div key={item} className="loading-panel flex min-h-[78px] items-center gap-3 rounded-[26px] p-3">
            <div className="loading-mark h-12 w-12 shrink-0 rounded-[18px]" />
            <div className="flex-1 space-y-2">
              <div className="loading-mark h-4 w-9/12 rounded-full" />
              <div className="loading-mark h-3 w-5/12 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InlineLoading({ label = "Lädt" }: { label?: string }) {
  return (
    <div className="loading-panel flex items-center gap-3 rounded-[26px] p-4" aria-label={label} role="status">
      <div className="loading-mark h-9 w-9 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="loading-mark h-4 w-36 rounded-full" />
        <div className="loading-mark h-3 w-24 rounded-full" />
      </div>
    </div>
  );
}
