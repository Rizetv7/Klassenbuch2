"use client";

import { useEffect, useRef } from "react";

type Blob = {
  color: string;
  colors?: string[];
  x: number;
  y: number;
  radius: number;
  alpha: number;
  drift: number;
  phase: number;
  scaleX?: number;
  scaleY?: number;
};

const POINTS = 46;
const LAYER_ALPHA = [0.36, 0.15, 0.08];

const BLOBS: Blob[] = [
  { color: "#ff2fbf", colors: ["#ff2fbf", "#ec35d6", "#ff6ad5"], x: 0.54, y: 1.17, radius: 0.58, alpha: 0.88, drift: 0.14, phase: 0.9, scaleX: 1.58, scaleY: 0.62 },
  { color: "#ec35d6", colors: ["#ec35d6", "#ff2fbf", "#ff6ad5"], x: 0.12, y: 0.88, radius: 0.54, alpha: 0.62, drift: 0.16, phase: 4.8, scaleX: 1.12, scaleY: 0.78 },
  { color: "#ff6ad5", colors: ["#ff6ad5", "#ec35d6", "#ffc4a3"], x: 0.86, y: 0.82, radius: 0.58, alpha: 0.54, drift: 0.17, phase: 5.6, scaleX: 1.08, scaleY: 0.82 },
  { color: "#b9a7ff", colors: ["#b9a7ff", "#ff6ad5", "#72eadf"], x: 0.22, y: 0.62, radius: 0.50, alpha: 0.42, drift: 0.18, phase: 1.1, scaleX: 0.94, scaleY: 1.02 },
  { color: "#ff6ad5", colors: ["#ff6ad5", "#ff2fbf", "#b9a7ff"], x: 0.32, y: 0.58, radius: 0.46, alpha: 0.45, drift: 0.17, phase: 2.8, scaleX: 1.06, scaleY: 0.96 },
  { color: "#ff2fbf", colors: ["#ff2fbf", "#ff6ad5", "#b9a7ff"], x: 0.47, y: 0.44, radius: 0.48, alpha: 0.52, drift: 0.15, phase: 2.0, scaleX: 1.02, scaleY: 1.08 },
  { color: "#ffc4a3", colors: ["#ffc4a3", "#ffd2a1", "#ff6ad5"], x: 0.78, y: 0.36, radius: 0.56, alpha: 0.52, drift: 0.16, phase: 5.1, scaleX: 1.18, scaleY: 0.90 },
  { color: "#ffd2a1", colors: ["#ffd2a1", "#ffc4a3", "#f8f1df"], x: 1.00, y: 0.24, radius: 0.55, alpha: 0.62, drift: 0.17, phase: 4.2, scaleX: 1.06, scaleY: 0.94 },
  { color: "#f8f1df", colors: ["#f8f1df", "#ffd2a1", "#ffc4a3"], x: 0.82, y: 0.05, radius: 0.64, alpha: 0.50, drift: 0.18, phase: 2.6, scaleX: 1.30, scaleY: 0.48 },
  { color: "#f8f1df", colors: ["#f8f1df", "#ffc4a3", "#b9a7ff"], x: 0.50, y: 0.12, radius: 0.62, alpha: 0.40, drift: 0.15, phase: 3.3, scaleX: 1.42, scaleY: 0.46 },
  { color: "#72eadf", colors: ["#72eadf", "#28d9f2", "#b9a7ff"], x: 0.10, y: 0.24, radius: 0.42, alpha: 0.60, drift: 0.19, phase: 1.7, scaleX: 0.92, scaleY: 1.02 },
  { color: "#28d9f2", colors: ["#28d9f2", "#72eadf", "#b9a7ff"], x: -0.08, y: 0.20, radius: 0.44, alpha: 0.68, drift: 0.20, phase: 0.2, scaleX: 0.82, scaleY: 1.02 },
  { color: "#f8f1df", colors: ["#f8f1df", "#72eadf", "#ffc4a3"], x: 0.25, y: 0.14, radius: 0.32, alpha: 0.22, drift: 0.12, phase: 4.7, scaleX: 0.96, scaleY: 0.72 },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function makePaintBlobs(seed: number) {
  const random = seededRandom(seed);
  return BLOBS.map((blob) => {
    const colors = blob.colors ?? [blob.color];
    return {
      ...blob,
      color: colors[Math.floor(random() * colors.length)] ?? blob.color,
      x: blob.x + (random() - 0.5) * 0.075,
      y: blob.y + (random() - 0.5) * 0.070,
      radius: blob.radius * (0.88 + random() * 0.26),
      alpha: clamp(blob.alpha * (0.78 + random() * 0.42), 0.12, 0.90),
      drift: blob.drift * (0.78 + random() * 0.42),
      phase: blob.phase + random() * Math.PI * 2,
      scaleX: (blob.scaleX ?? 1) * (0.90 + random() * 0.22),
      scaleY: (blob.scaleY ?? 1) * (0.90 + random() * 0.22),
    };
  });
}

function edgeNoise(angle: number, blob: Blob, t: number, layer: number) {
  return (
    Math.sin(angle * 2.15 + t * 0.08 + blob.phase + layer * 0.8) * 0.045 +
    Math.sin(angle * 4.55 - t * 0.10 + blob.phase * 1.7 + layer) * 0.032 +
    Math.cos(angle * 7.4 + t * 0.06 + blob.phase * 0.6 + layer * 1.4) * 0.018
  );
}

function drawBlob(ctx: CanvasRenderingContext2D, blob: Blob, w: number, h: number, t: number) {
  const size = Math.max(w, h);
  const wobbleX = Math.sin(t * blob.drift + blob.phase) * 0.024 + Math.sin(t * 0.08 + blob.phase * 2.1) * 0.011;
  const wobbleY = Math.cos(t * blob.drift * 0.82 + blob.phase) * 0.022 + Math.sin(t * 0.09 + blob.phase * 1.7) * 0.010;
  const pulse = 1 + Math.sin(t * 0.14 + blob.phase) * 0.024 + Math.cos(t * 0.08 + blob.phase * 1.9) * 0.014;
  const x = (blob.x + wobbleX) * w;
  const y = (blob.y + wobbleY) * h;
  const r = blob.radius * size * pulse;
  const scaleX = (blob.scaleX ?? 1) * (1 + Math.sin(t * 0.08 + blob.phase) * 0.018);
  const scaleY = (blob.scaleY ?? 1) * (1 + Math.cos(t * 0.07 + blob.phase * 1.3) * 0.018);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 0.055 + blob.phase) * 0.035);
  ctx.scale(scaleX, scaleY);

  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  gradient.addColorStop(0, blob.color);
  gradient.addColorStop(0.34, `${blob.color}e8`);
  gradient.addColorStop(0.68, `${blob.color}7a`);
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = gradient;
  for (let layer = 0; layer < LAYER_ALPHA.length; layer++) {
    const layerScale = 1 + layer * 0.11 + Math.sin(t * 0.05 + blob.phase + layer) * 0.018;
    const offsetX = Math.sin(t * 0.045 + blob.phase * 1.4 + layer) * r * 0.016;
    const offsetY = Math.cos(t * 0.04 + blob.phase * 1.1 + layer) * r * 0.014;
    ctx.globalAlpha = blob.alpha * LAYER_ALPHA[layer];
    ctx.beginPath();
    for (let i = 0; i <= POINTS; i++) {
      const angle = (i / POINTS) * Math.PI * 2;
      const jitter = 1 + edgeNoise(angle, blob, t, layer);
      const px = Math.cos(angle) * r * layerScale * jitter + offsetX;
      const py = Math.sin(angle) * r * layerScale * jitter + offsetY;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function LiquidBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const scale = window.devicePixelRatio > 1.5 ? 0.42 : 0.48;
    const paintBlobs = makePaintBlobs(
      Math.floor(performance.timeOrigin + performance.now() + window.innerWidth * 17 + window.innerHeight * 31)
    );
    let width = 1;
    let height = 1;

    const resize = () => {
      width = Math.max(1, Math.min(760, Math.floor(window.innerWidth * scale)));
      height = Math.max(1, Math.min(430, Math.floor(window.innerHeight * scale)));
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
      ctx.clearRect(0, 0, width, height);

      ctx.globalCompositeOperation = "source-over";
      for (const blob of paintBlobs) drawBlob(ctx, blob, width, height, t);

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.035;
      for (let i = 0; i < 2; i++) {
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
    let scrolling = false;
    let scrollTimer = 0;
    const frameMs = prefersReducedMotion.matches ? 1000 : 1000 / 10;

    const loop = (now: number) => {
      if (!running) return;
      raf = window.requestAnimationFrame(loop);
      if (scrolling) return;
      if (now - last < frameMs) return;
      last = now;
      render(now);
    };

    render(performance.now());
    raf = window.requestAnimationFrame(loop);
    window.addEventListener("resize", resize);
    const onScroll = () => {
      scrolling = true;
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        scrolling = false;
        render(performance.now());
      }, 160);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const onVisibility = () => {
      running = !document.hidden;
      if (running) raf = window.requestAnimationFrame(loop);
      else window.cancelAnimationFrame(raf);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(scrollTimer);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-[2] h-full w-full"
      style={{ width: "100vw", height: "100vh", opacity: 0.38 }}
    />
  );
}
