// Scattered bow stickers (like the Partiful page), fixed behind the content.
// Purely decorative — never intercepts clicks.

const BOWS = [
  { top: "4%", left: "6%", size: 52, rot: -18 },
  { top: "10%", left: "82%", size: 40, rot: 14 },
  { top: "26%", left: "44%", size: 30, rot: -8 },
  { top: "40%", left: "88%", size: 46, rot: 20 },
  { top: "54%", left: "8%", size: 38, rot: -22 },
  { top: "70%", left: "78%", size: 50, rot: 10 },
  { top: "84%", left: "30%", size: 34, rot: -14 },
  { top: "92%", left: "62%", size: 44, rot: 18 },
];

export function Decorations() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-[1] overflow-hidden">
      {BOWS.map((b, i) => (
        <span
          key={i}
          className="absolute select-none"
          style={{
            top: b.top,
            left: b.left,
            fontSize: b.size,
            transform: `rotate(${b.rot}deg)`,
            filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.12))",
            opacity: 0.92,
          }}
        >
          🎀
        </span>
      ))}
    </div>
  );
}
