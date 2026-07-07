"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

// After the 3-second hold, the baby must finish this ~30s game before the
// grown-up area opens. Deliberately baby-easy: just keep tapping the big
// bubbles until Bubu has climbed all the way up.
const BUBBLE_EMOJIS = ["🫧", "⭐️", "🎈", "🐣", "🍭", "🌈", "🐤", "💛"];
const BUBBLE_COLORS = ["#ff9ac9", "#77dbff", "#ffe15a", "#9bf0a6", "#c9a7ff", "#ffb08a"];
const GAME_PRAISE = ["JAAA!", "SUPER!", "NOCH MEHR!", "BUBU LACHT!", "TOLL GEMACHT!", "WOW!", "WEITER SO!", "HIHI!"];
const GAME_MS = 30000;

type Bubble = { id: number; x: number; y: number; emoji: string; color: string; popping: boolean };

export function AminaBabyGame({
  sound,
  onWin,
  onCancel,
}: {
  sound: (tone?: "tap" | "back" | "success" | "sparkle") => void;
  onWin: () => void;
  onCancel: () => void;
}) {
  const idRef = useRef(0);
  const wonRef = useRef(false);

  const makeBubble = (): Bubble => ({
    id: idRef.current++,
    x: 12 + Math.random() * 76,
    y: 16 + Math.random() * 68,
    emoji: BUBBLE_EMOJIS[Math.floor(Math.random() * BUBBLE_EMOJIS.length)],
    color: BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)],
    popping: false,
  });

  // seeded on mount (client only) — keeps the random layout out of SSR
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [popped, setPopped] = useState(0);
  const [praise, setPraise] = useState("DRÜCK DIE BLASEN!");
  const [progress, setProgress] = useState(0);
  const [won, setWon] = useState(false);

  useEffect(() => {
    setBubbles([makeBubble(), makeBubble(), makeBubble()]);
    const start = Date.now();
    const iv = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / GAME_MS);
      setProgress(p);
      if (p >= 1) {
        clearInterval(iv);
        if (!wonRef.current) {
          wonRef.current = true;
          setWon(true);
          sound("success");
        }
      }
    }, 120);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pop(bubble: Bubble) {
    if (bubble.popping || wonRef.current) return;
    sound("sparkle");
    setPopped((n) => n + 1);
    setPraise(GAME_PRAISE[Math.floor(Math.random() * GAME_PRAISE.length)]);
    setBubbles((bs) => bs.map((b) => (b.id === bubble.id ? { ...b, popping: true } : b)));
    window.setTimeout(() => {
      setBubbles((bs) => bs.map((b) => (b.id === bubble.id ? makeBubble() : b)));
    }, 230);
  }

  return (
    <div className="amina-game-layer" role="dialog" aria-modal="true" aria-label="Bubu-Spiel">
      <div className="amina-game-box">
        <button type="button" className="amina-back-button" onClick={onCancel} aria-label="Spiel schliessen">←</button>
        <h2>BUBU-SPIEL!</h2>
        <p className="amina-game-explain">DRÜCK GANZ VIELE BLASEN KAPUTT! WENN BUBU OBEN ANKOMMT, BIST DU FERTIG.</p>

        <div className="amina-game-track" aria-hidden="true">
          <div className="amina-game-fill" style={{ width: `${progress * 100}%` }} />
          <Image src="/amina-mascot.png" alt="" width={46} height={46} className="amina-game-bubu" style={{ left: `${progress * 100}%` }} />
        </div>
        <p className="amina-game-count">BLASEN KAPUTT: {popped}</p>

        {!won ? <div className="amina-game-speech" role="status">{praise}</div> : null}

        <div className="amina-game-field">
          {bubbles.map((b) => (
            <span key={b.id} className="amina-bubble-slot" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
              <button
                type="button"
                className={`amina-bubble ${b.popping ? "is-pop" : ""}`}
                style={{ background: b.color }}
                onClick={() => pop(b)}
                aria-label="Blase kaputt machen"
              >
                {b.emoji}
              </button>
            </span>
          ))}

          {won ? (
            <div className="amina-game-win">
              <div>
                <Image src="/amina-mascot.png" width={150} height={150} alt="Bubu freut sich" />
                <h2>GESCHAFFT!</h2>
                <p className="amina-game-explain">DU HAST SO TOLL GESPIELT! JETZT DARFST DU WEITER.</p>
                <button type="button" className="amina-finish-button" onClick={() => { sound("tap"); onWin(); }}>WEITER!</button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
