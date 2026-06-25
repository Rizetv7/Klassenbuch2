"use client";

import { useEffect, useRef } from "react";

type Blob = {
  color: string;
  x: number;
  y: number;
  radius: number;
  alpha: number;
  drift: number;
  phase: number;
};

const BLOBS: Blob[] = [
  { color: "#ec35d6", x: 0.22, y: 0.90, radius: 0.58, alpha: 0.76, drift: 0.31, phase: 4.8 },
  { color: "#ff2fbf", x: 0.56, y: 1.00, radius: 0.68, alpha: 0.84, drift: 0.26, phase: 0.9 },
  { color: "#ff6ad5", x: 0.92, y: 0.88, radius: 0.54, alpha: 0.58, drift: 0.35, phase: 5.6 },
  { color: "#ff6ad5", x: 0.56, y: 0.58, radius: 0.46, alpha: 0.42, drift: 0.30, phase: 2.1 },
  { color: "#b9a7ff", x: 0.44, y: 0.48, radius: 0.66, alpha: 0.66, drift: 0.36, phase: 1.1 },
  { color: "#f8f1df", x: 0.50, y: 0.38, radius: 0.54, alpha: 0.58, drift: 0.28, phase: 3.3 },
  { color: "#ffc4a3", x: 0.68, y: 0.30, radius: 0.48, alpha: 0.50, drift: 0.34, phase: 5.1 },
  { color: "#ffd2a1", x: 0.94, y: 0.24, radius: 0.64, alpha: 0.72, drift: 0.38, phase: 4.2 },
  { color: "#f8f1df", x: 0.82, y: 0.08, radius: 0.66, alpha: 0.78, drift: 0.42, phase: 2.6 },
  { color: "#72eadf", x: 0.22, y: 0.22, radius: 0.64, alpha: 0.70, drift: 0.46, phase: 1.7 },
  { color: "#28d9f2", x: 0.04, y: 0.12, radius: 0.78, alpha: 0.92, drift: 0.55, phase: 0.2 },
];

function drawBlob(ctx: CanvasRenderingContext2D, blob: Blob, w: number, h: number, t: number) {
  const size = Math.max(w, h);
  const wobbleX = Math.sin(t * blob.drift + blob.phase) * 0.055 + Math.sin(t * 0.13 + blob.phase * 2.1) * 0.026;
  const wobbleY = Math.cos(t * blob.drift * 0.82 + blob.phase) * 0.050 + Math.sin(t * 0.17 + blob.phase * 1.7) * 0.024;
  const pulse = 1 + Math.sin(t * 0.22 + blob.phase) * 0.045 + Math.cos(t * 0.11 + blob.phase * 1.9) * 0.025;
  const x = (blob.x + wobbleX) * w;
  const y = (blob.y + wobbleY) * h;
  const r = blob.radius * size * pulse;

  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, blob.color);
  gradient.addColorStop(0.42, blob.color);
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  ctx.globalAlpha = blob.alpha;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function LiquidBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const scale = window.devicePixelRatio > 1.5 ? 0.24 : 0.30;
    let width = 1;
    let height = 1;

    const resize = () => {
      width = Math.max(1, Math.floor(window.innerWidth * scale));
      height = Math.max(1, Math.floor(window.innerHeight * scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    const render = (time: number) => {
      resize();
      const t = time / 1000;

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      const base = ctx.createLinearGradient(0, 0, width, height);
      base.addColorStop(0, "#72eadf");
      base.addColorStop(0.26, "#f8f1df");
      base.addColorStop(0.52, "#b9a7ff");
      base.addColorStop(0.76, "#ff6ad5");
      base.addColorStop(1, "#ff2fbf");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = "source-over";
      for (const blob of BLOBS) drawBlob(ctx, blob, width, height, t);

      ctx.globalCompositeOperation = "soft-light";
      ctx.globalAlpha = 0.18;
      for (let i = 0; i < 5; i++) {
        const y = (Math.sin(t * 0.08 + i * 1.7) * 0.16 + 0.46 + i * 0.06) * height;
        const grd = ctx.createLinearGradient(0, y - height * 0.12, width, y + height * 0.12);
        grd.addColorStop(0, "rgba(255,255,255,0)");
        grd.addColorStop(0.5, i % 2 ? "#f8f1df" : "#b9a7ff");
        grd.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grd;
        ctx.fillRect(0, y - height * 0.18, width, height * 0.36);
      }
    };

    resize();
    let raf = 0;
    let running = true;
    let last = 0;
    const frameMs = prefersReducedMotion.matches ? 1000 : 1000 / 18;

    const loop = (now: number) => {
      if (!running) return;
      raf = window.requestAnimationFrame(loop);
      if (now - last < frameMs) return;
      last = now;
      render(now);
    };

    render(performance.now());
    raf = window.requestAnimationFrame(loop);
    window.addEventListener("resize", resize);

    const onVisibility = () => {
      running = !document.hidden;
      if (running) raf = window.requestAnimationFrame(loop);
      else window.cancelAnimationFrame(raf);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-[2] h-full w-full"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}
