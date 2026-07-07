type BabySound = "tap" | "back" | "success" | "sparkle";

let audioContext: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext ??= new AudioContextClass();
  return audioContext;
}

function tone(ctx: AudioContext, frequency: number, start: number, duration: number, type: OscillatorType) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.12, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export function playBabySound(kind: BabySound = "tap") {
  const ctx = context();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const now = ctx.currentTime + 0.01;

  if (kind === "back") {
    tone(ctx, 420, now, 0.12, "sine");
    tone(ctx, 290, now + 0.08, 0.15, "sine");
    return;
  }
  if (kind === "success") {
    tone(ctx, 520, now, 0.14, "sine");
    tone(ctx, 660, now + 0.1, 0.14, "sine");
    tone(ctx, 880, now + 0.2, 0.2, "triangle");
    return;
  }
  if (kind === "sparkle") {
    tone(ctx, 780, now, 0.1, "triangle");
    tone(ctx, 1040, now + 0.07, 0.14, "triangle");
    return;
  }
  tone(ctx, 360, now, 0.1, "sine");
  tone(ctx, 560, now + 0.055, 0.13, "triangle");
}
