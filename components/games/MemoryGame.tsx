"use client";

import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../GamePlayer";

const ICONS = ["🍕", "🎸", "🌵", "🐙", "⚽", "🍩", "🌈", "🎲"];

type Card = { id: number; icon: string; matched: boolean };

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** 100 pontos com jogada perfeita (8), perde 5 por jogada extra, mínimo 10. */
export function memoryScore(moves: number) {
  return Math.max(10, 100 - Math.max(0, moves - ICONS.length) * 5);
}

export function MemoryGame({ onGameOver }: GameProps) {
  const [cards, setCards] = useState<Card[]>(() =>
    shuffle([...ICONS, ...ICONS]).map((icon, id) => ({ id, icon, matched: false })),
  );
  const [open, setOpen] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const finished = useRef(false);
  const overRef = useRef(onGameOver);
  overRef.current = onGameOver;

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (open.length !== 2) return;
    const [a, b] = open;
    if (cards[a].icon === cards[b].icon) {
      setCards((cs) => cs.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c)));
      setOpen([]);
    } else {
      const t = setTimeout(() => setOpen([]), 700);
      return () => clearTimeout(t);
    }
  }, [open, cards]);

  useEffect(() => {
    if (!finished.current && cards.every((c) => c.matched)) {
      finished.current = true;
      const t = setTimeout(() => overRef.current(memoryScore(moves)), 600);
      return () => clearTimeout(t);
    }
  }, [cards, moves]);

  const flip = (i: number) => {
    if (open.length >= 2 || open.includes(i) || cards[i].matched) return;
    const next = [...open, i];
    setOpen(next);
    if (next.length === 2) setMoves((m) => m + 1);
  };

  return (
    <div className="game-wrap">
      <div className="hud">Jogadas: {moves} · ⏱ {seconds}s · Pontos: {memoryScore(moves)}</div>
      <div className="memory-grid">
        {cards.map((c, i) => {
          const up = c.matched || open.includes(i);
          return (
            <button
              key={c.id}
              className={`mem-card ${up ? "up" : ""} ${c.matched ? "matched" : ""}`}
              onClick={() => flip(i)}
              aria-label={up ? c.icon : "Carta virada"}
            >
              <span className="mem-inner">
                <span className="mem-front">{c.icon}</span>
                <span className="mem-back">?</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
