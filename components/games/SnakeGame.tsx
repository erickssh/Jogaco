"use client";

import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../GamePlayer";

const N = 20; // células por lado
const SIZE = 400;
const CELL = SIZE / N;

type P = { x: number; y: number };
type Dir = "up" | "down" | "left" | "right";
const VEC: Record<Dir, P> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPP: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
const KEYS: Record<string, Dir> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right",
};

function randomFood(snake: P[]): P {
  while (true) {
    const p = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) };
    if (!snake.some((s) => s.x === p.x && s.y === p.y)) return p;
  }
}

export function SnakeGame({ onGameOver }: GameProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const overRef = useRef(onGameOver);
  overRef.current = onGameOver;
  const queue = useRef<Dir[]>([]);

  const turn = (d: Dir) => {
    if (queue.current.length < 3) queue.current.push(d);
  };

  useEffect(() => {
    const ctx = canvas.current!.getContext("2d")!;
    let snake: P[] = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
    let dir: Dir = "right";
    let food = randomFood(snake);
    let pts = 0;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;

    const draw = () => {
      ctx.fillStyle = "#0b1030";
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      for (let i = 1; i < N; i++) {
        ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, SIZE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(SIZE, i * CELL); ctx.stroke();
      }
      ctx.shadowBlur = 14;
      ctx.shadowColor = "#ff3d81";
      ctx.fillStyle = "#ff3d81";
      ctx.beginPath();
      ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = "#00f5c4";
      snake.forEach((s, i) => {
        ctx.fillStyle = i === 0 ? "#b6fff0" : "#00f5c4";
        ctx.fillRect(s.x * CELL + 1.5, s.y * CELL + 1.5, CELL - 3, CELL - 3);
      });
      ctx.shadowBlur = 0;
    };

    const tick = () => {
      while (queue.current.length) {
        const d = queue.current.shift()!;
        if (d !== OPP[dir] && d !== dir) { dir = d; break; }
      }
      const head = { x: snake[0].x + VEC[dir].x, y: snake[0].y + VEC[dir].y };
      const ate = head.x === food.x && head.y === food.y;
      const body = ate ? snake : snake.slice(0, -1);
      if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N || body.some((s) => s.x === head.x && s.y === head.y)) {
        draw();
        timer = setTimeout(() => { if (!stopped) overRef.current(pts); }, 400);
        return;
      }
      snake = [head, ...body];
      if (ate) {
        pts++;
        setScore(pts);
        food = randomFood(snake);
      }
      draw();
      timer = setTimeout(tick, Math.max(60, 130 - pts * 3));
    };

    const onKey = (e: KeyboardEvent) => {
      const d = KEYS[e.key];
      if (d) { e.preventDefault(); turn(d); }
    };

    let touch: P | null = null;
    const el = canvas.current!;
    const onStart = (e: TouchEvent) => { touch = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!touch) return;
      const dx = e.touches[0].clientX - touch.x;
      const dy = e.touches[0].clientY - touch.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
      touch = null;
    };

    window.addEventListener("keydown", onKey);
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    draw();
    timer = setTimeout(tick, 400);

    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
    };
  }, []);

  return (
    <div className="game-wrap">
      <div className="hud">🍓 {score}</div>
      <canvas ref={canvas} width={SIZE} height={SIZE} className="game-canvas" />
      <div className="dpad">
        <button onClick={() => turn("up")} aria-label="Cima">▲</button>
        <div>
          <button onClick={() => turn("left")} aria-label="Esquerda">◀</button>
          <button onClick={() => turn("down")} aria-label="Baixo">▼</button>
          <button onClick={() => turn("right")} aria-label="Direita">▶</button>
        </div>
      </div>
    </div>
  );
}
