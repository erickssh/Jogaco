"use client";

import { useEffect, useRef, useState } from "react";
import type { GameProps } from "../GamePlayer";

const W = 400;
const H = 520;
const PY = H - 50; // altura da nave
const PR = 16; // raio da nave

type Rock = { x: number; y: number; r: number; vy: number; rot: number; vr: number };
type Star = { x: number; y: number; s: number };

export function DodgeGame({ onGameOver }: GameProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [time, setTime] = useState(0);
  const overRef = useRef(onGameOver);
  overRef.current = onGameOver;

  useEffect(() => {
    const el = canvas.current!;
    const ctx = el.getContext("2d")!;
    let px = W / 2;
    let target: number | null = null;
    const keys = { left: false, right: false };
    let rocks: Rock[] = [];
    const stars: Star[] = Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 2 + 0.5 }));
    let elapsed = 0;
    let spawn = 0;
    let last = performance.now();
    let raf = 0;
    let stopped = false;
    let shown = 0;

    const toCanvasX = (clientX: number) => {
      const rect = el.getBoundingClientRect();
      return ((clientX - rect.left) / rect.width) * W;
    };

    const draw = (hit = false) => {
      ctx.fillStyle = "#070417";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      stars.forEach((s) => ctx.fillRect(s.x, s.y, s.s, s.s));

      rocks.forEach((r) => {
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(r.rot);
        ctx.fillStyle = "#8a6a5a";
        ctx.strokeStyle = "#c79a7f";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const rr = r.r * (0.8 + ((i * 37) % 5) * 0.06);
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });

      // nave
      ctx.save();
      ctx.translate(px, PY);
      ctx.shadowBlur = 16;
      ctx.shadowColor = hit ? "#ff3d3d" : "#5ad1ff";
      ctx.fillStyle = hit ? "#ff3d3d" : "#e8f6ff";
      ctx.beginPath();
      ctx.moveTo(0, -PR - 4);
      ctx.lineTo(PR, PR);
      ctx.lineTo(0, PR - 6);
      ctx.lineTo(-PR, PR);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ff9a3c";
      ctx.fillRect(-4, PR - 4, 8, 6 + Math.random() * 6);
      ctx.restore();
    };

    const loop = (now: number) => {
      if (stopped) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;

      // movimento
      const speed = 320;
      if (keys.left) px -= speed * dt;
      if (keys.right) px += speed * dt;
      if (target !== null && !keys.left && !keys.right) px += (target - px) * Math.min(1, dt * 12);
      px = Math.max(PR, Math.min(W - PR, px));

      // dificuldade cresce com o tempo
      const difficulty = 1 + elapsed / 15;
      spawn -= dt;
      if (spawn <= 0) {
        const r = 12 + Math.random() * 20;
        rocks.push({ x: r + Math.random() * (W - 2 * r), y: -r, r, vy: (110 + Math.random() * 90) * difficulty, rot: 0, vr: (Math.random() - 0.5) * 3 });
        spawn = Math.max(0.18, 0.7 / difficulty);
      }
      rocks.forEach((r) => { r.y += r.vy * dt; r.rot += r.vr * dt; });
      rocks = rocks.filter((r) => r.y - r.r < H);
      stars.forEach((s) => { s.y += s.s * 40 * dt * difficulty; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });

      const hit = rocks.some((r) => Math.hypot(r.x - px, r.y - PY) < r.r * 0.8 + PR * 0.7);
      draw(hit);

      const secs = Math.floor(elapsed);
      if (secs !== shown) { shown = secs; setTime(secs); }

      if (hit) {
        stopped = true;
        setTimeout(() => overRef.current(secs), 500);
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { keys.left = down; e.preventDefault(); }
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { keys.right = down; e.preventDefault(); }
    };
    const kd = onKey(true);
    const ku = onKey(false);
    const onMouse = (e: MouseEvent) => { target = toCanvasX(e.clientX); };
    const onTouch = (e: TouchEvent) => { e.preventDefault(); target = toCanvasX(e.touches[0].clientX); };

    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    el.addEventListener("mousemove", onMouse);
    el.addEventListener("touchstart", onTouch, { passive: false });
    el.addEventListener("touchmove", onTouch, { passive: false });
    raf = requestAnimationFrame(loop);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      el.removeEventListener("mousemove", onMouse);
      el.removeEventListener("touchstart", onTouch);
      el.removeEventListener("touchmove", onTouch);
    };
  }, []);

  return (
    <div className="game-wrap">
      <div className="hud">⏱ {time}s</div>
      <canvas ref={canvas} width={W} height={H} className="game-canvas tall" />
    </div>
  );
}
