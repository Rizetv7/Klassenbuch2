"use client";

import { useEffect, useRef } from "react";

// Watercolor background, built from scratch.
//
// The look: pigments bleeding into wet paper. Pale sky blue and mint pool in
// the top left, soft lavender in the top right, a milky white haze through
// the middle, rose and saturated magenta flooding up from the bottom.
//
// The technique: every pigment is drawn as three stacked, slightly larger and
// fainter layers with irregular sine-wobbled edges — that layered feathering
// is what reads as watercolor instead of a plain gradient. Everything drifts
// very slowly. Rendered at low resolution and low FPS, paused while
// scrolling and while the tab is hidden.

type Pigment = {
  color: string;
  x: number; // 0..1 viewport space
  y: number;
  r: number; // radius relative to max(viewport)
  alpha: number;
  drift: number; // movement speed
  phase: number;
  sx?: number; // horizontal stretch
  sy?: number; // vertical stretch
  soft?: number; // 0..1 where the pigment starts feathering out
};

// Paint order matters (later = on top): milky haze and pinks first, the
// blue/mint/lavender pools last so nothing washes them out.
const PIGMENTS: Pigment[] = [
  // middle: milky haze + first soft pinks
  { color: "#fdf7f3", x: 0.52, y: 0.14, r: 0.44, alpha: 0.8, drift: 0.13, phase: 2.7, sx: 1.25, sy: 0.6 },
  { color: "#ffffff", x: 0.46, y: 0.36, r: 0.34, alpha: 0.42, drift: 0.12, phase: 3.6, sx: 1.25, sy: 0.7 },
  { color: "#f9c3de", x: 0.72, y: 0.44, r: 0.5, alpha: 0.75, drift: 0.16, phase: 2.2, sx: 1.2, sy: 0.9 },
  { color: "#f59ccb", x: 0.24, y: 0.52, r: 0.46, alpha: 0.7, drift: 0.18, phase: 1.2, sx: 1.05, sy: 0.95 },
  // bottom: rose into saturated magenta
  { color: "#f377bd", x: 0.88, y: 0.78, r: 0.5, alpha: 0.8, drift: 0.16, phase: 5.8, sx: 1.1, sy: 0.85, soft: 0.4 },
  { color: "#ee4fb3", x: 0.42, y: 0.86, r: 0.56, alpha: 0.85, drift: 0.14, phase: 0.9, sx: 1.35, sy: 0.7, soft: 0.4 },
  { color: "#e73dab", x: 0.06, y: 1.05, r: 0.55, alpha: 0.9, drift: 0.15, phase: 4.6, sx: 1.25, sy: 0.75, soft: 0.38 },
  // top right: lavender
  { color: "#d9cbfa", x: 0.84, y: 0.18, r: 0.36, alpha: 0.75, drift: 0.15, phase: 5.3, sx: 1.0, sy: 0.85 },
  { color: "#bda6f2", x: 1.04, y: 0.0, r: 0.46, alpha: 0.95, drift: 0.18, phase: 4.1, sx: 1.1, sy: 0.9, soft: 0.4 },
  // top left: sky blue into mint (painted last so they stay clearly visible)
  { color: "#9fe5cf", x: 0.24, y: -0.04, r: 0.4, alpha: 0.9, drift: 0.17, phase: 1.9, sx: 1.15, sy: 0.85, soft: 0.38 },
  { color: "#7cc7ee", x: -0.06, y: 0.04, r: 0.48, alpha: 1, drift: 0.2, phase: 0.3, sx: 1.05, sy: 1.0, soft: 0.4 },
];

// three feathering layers per pigment: core, bleed, outer wash
const LAYERS = [
  { scale: 1.0, alpha: 0.68 },
  { scale: 1.16, alpha: 0.26 },
  { scale: 1.34, alpha: 0.12 },
];

const EDGE_POINTS = 38;

function edgeWobble(angle: number, phase: number, t: number, layer: number) {
  return (
    1 +
    Math.sin(angle * 2.3 + t * 0.09 + phase + layer * 0.9) * 0.055 +
    Math.sin(angle * 4.7 - t * 0.07 + phase * 1.6 + layer) * 0.034 +
    Math.cos(angle * 7.9 + t * 0.05 + phase * 0.7 + layer * 1.4) * 0.02
  );
}

function drawPigment(ctx: CanvasRenderingContext2D, p: Pigment, w: number, h: number, t: number) {
  const size = Math.max(w, h);
  // three motion scales, all with incommensurate periods so the image
  // keeps flowing and effectively never repeats:
  // 1) a very slow wander (minutes-long loops, different per pigment)
  const wanderX = Math.cos(t * (0.021 + p.drift * 0.05) + p.phase * 2.3) * 0.07;
  const wanderY = Math.sin(t * (0.017 + p.drift * 0.04) + p.phase * 1.3) * 0.06;
  // 2) a gentle drift  3) fine ripple
  const x = (p.x + wanderX + Math.sin(t * p.drift + p.phase) * 0.035 + Math.sin(t * 0.11 + p.phase * 2.1) * 0.016) * w;
  const y = (p.y + wanderY + Math.cos(t * p.drift * 0.8 + p.phase) * 0.032 + Math.sin(t * 0.14 + p.phase * 1.7) * 0.015) * h;
  const r = p.r * size * (1 + Math.sin(t * 0.16 + p.phase) * 0.04 + Math.sin(t * 0.031 + p.phase * 1.9) * 0.05);
  const soft = p.soft ?? 0.32;
  // slow breathing of the pigment strength
  const breathe = 0.88 + 0.12 * Math.sin(t * 0.045 + p.phase * 1.6);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 0.06 + p.phase) * 0.06);
  ctx.scale(p.sx ?? 1, p.sy ?? 1);

  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.34);
  gradient.addColorStop(0, p.color);
  gradient.addColorStop(soft, p.color);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;

  for (let layer = 0; layer < LAYERS.length; layer++) {
    ctx.globalAlpha = p.alpha * breathe * LAYERS[layer].alpha;
    ctx.beginPath();
    for (let i = 0; i <= EDGE_POINTS; i++) {
      const angle = (i / EDGE_POINTS) * Math.PI * 2;
      const rr = r * LAYERS[layer].scale * edgeWobble(angle, p.phase, t, layer);
      const px = Math.cos(angle) * rr;
      const py = Math.sin(angle) * rr;
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
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Higher render resolution than before: at very low res the browser
    // dithers the smooth gradients, and upscaling magnified that dither into
    // a visible cross-hatch texture. A CSS blur on the element (below) then
    // removes any last faceting and reads as watercolor bleed.
    const scale = window.devicePixelRatio > 1.5 ? 0.36 : 0.44;
    let width = 1;
    let height = 1;

    const resize = () => {
      width = Math.max(1, Math.min(1080, Math.floor(window.innerWidth * scale)));
      height = Math.max(1, Math.min(720, Math.floor(window.innerHeight * scale)));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    const render = (time: number) => {
      resize();
      const t = time / 1000;

      // wet paper base: light blue-white up top, deep pink pooling below
      ctx.globalAlpha = 1;
      const base = ctx.createLinearGradient(0, 0, width * 0.4, height);
      base.addColorStop(0, "#bfe3f7");
      base.addColorStop(0.28, "#fdf5f7");
      base.addColorStop(0.55, "#f8c6e4");
      base.addColorStop(0.8, "#f172c0");
      base.addColorStop(1, "#e846ae");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, width, height);

      for (const pigment of PIGMENTS) drawPigment(ctx, pigment, width, height, t);

      // one broad white wash for the milky watercolor light
      ctx.globalAlpha = 0.12;
      const milk = ctx.createRadialGradient(width * 0.5, height * 0.26, 0, width * 0.5, height * 0.26, Math.max(width, height) * 0.7);
      milk.addColorStop(0, "#ffffff");
      milk.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = milk;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    };

    resize();
    let raf = 0;
    let running = true;
    let last = 0;
    let scrolling = false;
    let scrollTimer = 0;
    const frameMs = prefersReducedMotion.matches ? 1000 : 1000 / 14;

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

    // freeze the animation while scrolling — keeps scrolling perfectly smooth
    const onScroll = () => {
      scrolling = true;
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        scrolling = false;
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
      // oversized by 28px each side so the blur never reveals a hard edge
      className="pointer-events-none fixed -z-[2]"
      style={{
        top: -28,
        left: -28,
        width: "calc(100vw + 56px)",
        height: "calc(100vh + 56px)",
        filter: "blur(16px)",
      }}
    />
  );
}
