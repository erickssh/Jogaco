"use client";

import { Chess, Color } from "chess.js";
import { useEffect, useRef, useState } from "react";
import { ChessBoard, MoveInput, resultFor, statusText } from "./ChessBoard";
import { bestMove, Level } from "@/lib/chessAi";
import { useRewards } from "../RewardsProvider";
import { MoveList } from "./MoveList";

type Props = { mode: "ai" | "local" };

export function LocalChess({ mode }: Props) {
  const game = useRef(new Chess());
  const [fen, setFen] = useState(game.current.fen());
  const [last, setLast] = useState<{ from: string; to: string } | null>(null);
  const [myColor, setMyColor] = useState<Color>("w");
  const [level, setLevel] = useState<Level>(2);
  const [thinking, setThinking] = useState(false);
  const [rewarded, setRewarded] = useState(false);
  const [earned, setEarned] = useState<number | null>(null);
  const { recordGame } = useRewards();

  const chess = game.current;
  const over = chess.isGameOver();
  const aiTurn = mode === "ai" && !over && chess.turn() !== myColor;

  const sync = () => {
    setFen(chess.fen());
    const h = chess.history({ verbose: true });
    const lm = h[h.length - 1];
    setLast(lm ? { from: lm.from, to: lm.to } : null);
  };

  const play = (m: MoveInput) => {
    try {
      chess.move(m);
      sync();
    } catch {
      /* lance ilegal: ignora */
    }
  };

  // Vez do computador
  useEffect(() => {
    if (!aiTurn) return;
    setThinking(true);
    const t = setTimeout(() => {
      const m = bestMove(chess.fen(), level);
      if (m) chess.move(m);
      sync();
      setThinking(false);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, aiTurn, level]);

  // Moedas ao terminar contra o computador
  useEffect(() => {
    if (mode !== "ai" || !over || rewarded) return;
    const res = resultFor(chess);
    const won = (res === "1-0" && myColor === "w") || (res === "0-1" && myColor === "b");
    const score = won ? level + 1 : res === "1/2-1/2" ? 1 : 0; // 0 derrota, 1 empate, 2-4 vitória por nível
    if (chess.history().length >= 10) setEarned(recordGame("xadrez", score).coins);
    else setEarned(0);
    setRewarded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);

  const restart = (color: Color = myColor) => {
    chess.reset();
    setMyColor(color);
    setRewarded(false);
    setEarned(null);
    sync();
  };

  const undo = () => {
    if (thinking) return;
    chess.undo();
    if (mode === "ai" && chess.turn() !== myColor) chess.undo();
    sync();
  };

  const orientation: Color = mode === "ai" ? myColor : "w";

  return (
    <div className="chess-layout">
      <ChessBoard
        fen={fen}
        orientation={orientation}
        movable={over || thinking ? null : mode === "local" ? "both" : myColor}
        onMove={play}
        lastMove={last}
      />
      <aside className="chess-side card">
        <div className={`chess-status ${over ? "over" : ""}`}>
          {thinking ? "🤖 Computador pensando…" : statusText(chess)}
        </div>

        {over && mode === "ai" && earned !== null && (
          <p className="earned-line">
            {earned > 0 ? `+${earned} 🪙` : "Sem moedas nesta partida (mínimo de 10 lances)."}
          </p>
        )}

        {mode === "ai" && (
          <div className="chess-opts">
            <label>
              Dificuldade
              <select value={level} onChange={(e) => setLevel(Number(e.target.value) as Level)} disabled={chess.history().length > 0 && !over}>
                <option value={1}>Fácil</option>
                <option value={2}>Médio</option>
                <option value={3}>Difícil</option>
              </select>
            </label>
            <div className="row">
              <button className="btn small-btn" onClick={() => restart("w")}>Jogar de brancas</button>
              <button className="btn small-btn" onClick={() => restart("b")}>Jogar de pretas</button>
            </div>
          </div>
        )}

        <MoveList history={chess.history()} />

        <div className="row">
          <button className="btn small-btn" onClick={undo} disabled={!chess.history().length || over}>↶ Desfazer</button>
          <button className="btn small-btn gold" onClick={() => restart()}>Nova partida</button>
        </div>
      </aside>
    </div>
  );
}
