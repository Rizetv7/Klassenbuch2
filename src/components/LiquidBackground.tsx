"use client";

import { useEffect, useRef } from "react";

// Full-screen animated liquid gradient. It renders only soft color fields:
// no bows, no text, no icons, no UI elements, no decorative objects.

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;

vec2 hash22(vec2 p){
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453) * 2.0 - 1.0;
}
float gnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = dot(hash22(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0));
  float b = dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.58;
  for (int i = 0; i < 4; i++){ v += a * gnoise(p); p = p * 2.0 + 17.3; a *= 0.5; }
  return v;
}

// gaussian-weighted color blob
void blob(inout vec3 col, inout float w, vec2 uv, vec2 c, float r, vec3 color, float strength){
  float d = distance(uv, c);
  float wi = exp(-(d * d) / (2.0 * r * r)) * strength;
  col += wi * color; w += wi;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = uv * vec2(uRes.x / uRes.y, 1.0);
  float t = uTime * 0.038;

  // organic domain warp (ink-in-water motion)
  vec2 q = vec2(fbm(p * 1.18 + vec2(0.0, t)), fbm(p * 1.18 + vec2(5.2, 1.3) - t * 0.82));
  vec2 r = vec2(fbm(p * 1.05 + 2.1 * q + vec2(1.7, 9.2) + t * 0.76),
                fbm(p * 1.05 + 2.1 * q + vec2(8.3, 2.8) - t * 0.68));
  vec2 wuv = uv + 0.19 * r + 0.06 * q;

  vec3 col = vec3(0.0); float w = 0.0;

  // upper-left: cyan / aqua
  blob(col, w, wuv, vec2(0.02, 0.94), 0.66, vec3(0.157, 0.851, 0.949), 2.28);
  blob(col, w, wuv, vec2(-0.07, 0.66), 0.56, vec3(0.447, 0.918, 0.875), 1.70);
  blob(col, w, wuv, vec2(0.30, 0.79), 0.46, vec3(0.725, 0.655, 1.000), 1.06);
  blob(col, w, wuv, vec2(0.12, 0.56), 0.44, vec3(0.447, 0.918, 0.875), 0.94);
  blob(col, w, wuv, vec2(0.16, 0.72), 0.62, vec3(0.157, 0.851, 0.949), 1.34);
  // upper-right: peach / cream / soft orange
  blob(col, w, wuv, vec2(0.94, 0.96), 0.64, vec3(0.973, 0.945, 0.875), 1.92);
  blob(col, w, wuv, vec2(0.78, 0.84), 0.54, vec3(1.000, 0.769, 0.639), 1.62);
  blob(col, w, wuv, vec2(1.04, 0.68), 0.50, vec3(1.000, 0.824, 0.631), 1.28);
  blob(col, w, wuv, vec2(0.88, 0.54), 0.46, vec3(1.000, 0.824, 0.631), 0.86);
  blob(col, w, wuv, vec2(0.70, 0.66), 0.56, vec3(0.973, 0.945, 0.875), 1.12);
  // middle: lavender + milky white + pink
  blob(col, w, wuv, vec2(0.48, 0.54), 0.48, vec3(0.725, 0.655, 1.000), 0.98);
  blob(col, w, wuv, vec2(0.48, 0.48), 0.32, vec3(0.973, 0.945, 0.875), 0.72);
  blob(col, w, wuv, vec2(0.55, 0.38), 0.42, vec3(1.000, 0.416, 0.835), 0.80);
  // bottom: dominant hot pink / magenta
  blob(col, w, wuv, vec2(0.50, -0.11), 0.48, vec3(1.000, 0.184, 0.749), 1.76);
  blob(col, w, wuv, vec2(0.16, 0.00), 0.36, vec3(0.925, 0.208, 0.839), 1.22);
  blob(col, w, wuv, vec2(0.86, 0.00), 0.38, vec3(1.000, 0.416, 0.835), 1.14);
  blob(col, w, wuv, vec2(0.56, 0.14), 0.28, vec3(1.000, 0.184, 0.749), 0.72);

  // soft base so nothing goes dark
  blob(col, w, wuv, vec2(0.5, 0.5), 1.4, vec3(0.97, 0.92, 0.93), 0.35);

  col /= max(w, 0.0001);

  // Wobbly regional color pressure keeps the composition intentional while
  // still behaving like liquid instead of a static multicolor split.
  float bandNoise = fbm(uv * 1.7 + r * 1.8 + vec2(t * 0.18, -t * 0.12));
  float topMask = smoothstep(0.20, 0.86, uv.y + bandNoise * 0.18);
  float bottomMask = smoothstep(0.52, 0.02, uv.y + bandNoise * 0.12);
  float sideMix = smoothstep(0.22, 0.82, uv.x + fbm(uv * 1.2 + vec2(4.0, t * 0.15)) * 0.14);
  vec3 topColor = mix(vec3(0.157, 0.851, 0.949), vec3(1.000, 0.824, 0.631), sideMix);
  topColor = mix(topColor, vec3(0.973, 0.945, 0.875), smoothstep(0.50, 0.92, sideMix) * 0.38);
  col = mix(col, topColor, topMask * 0.52);
  float leftPool = (1.0 - smoothstep(0.04, 0.64, uv.x + bandNoise * 0.13))
    * smoothstep(0.18, 0.82, uv.y + bandNoise * 0.16);
  float rightPool = smoothstep(0.42, 0.98, uv.x + bandNoise * 0.12)
    * smoothstep(0.28, 0.88, uv.y + bandNoise * 0.14);
  col = mix(col, vec3(0.560, 0.930, 0.900), leftPool * 0.76);
  col = mix(col, vec3(1.000, 0.835, 0.710), rightPool * 0.52);
  col = mix(col, vec3(1.000, 0.184, 0.749), bottomMask * 0.16);

  // candy saturation without crushing the cream highlights
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, 1.22);
  col = mix(col, smoothstep(0.0, 1.0, col), 0.18);

  // subtle film grain so it feels alive
  float g = fract(sin(dot(gl_FragCoord.xy + t, vec2(12.9898, 78.233))) * 43758.5453);
  col += (g - 0.5) * 0.025;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 0.74);
}
`;

const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export function LiquidBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: true, premultipliedAlpha: true });
    if (!gl) return; // CSS fallback gradient stays visible

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");

    const SCALE = 0.36; // low res creates the soft blur and keeps it smooth
    const resize = () => {
      const w = Math.max(1, Math.floor(window.innerWidth * SCALE));
      const h = Math.max(1, Math.floor(window.innerHeight * SCALE));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    const start = performance.now();
    let last = 0;
    const FRAME_MS = 1000 / 30; // cap at ~30 FPS to save GPU/battery
    let running = true;
    const loop = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      if (now - last < FRAME_MS) return;
      last = now;
      resize();
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(loop);

    const onVis = () => {
      running = !document.hidden;
      if (running) raf = requestAnimationFrame(loop);
      else cancelAnimationFrame(raf);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
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
