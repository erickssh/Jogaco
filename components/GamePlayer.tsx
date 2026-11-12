"use client";

import { useState } from "react";
import { getGame } from "@/lib/games";
import { DAILY_GAME_COIN_CAP } from "@/lib/rewards";
import { useRewards } from "./RewardsProvider";
import { SnakeGame } from "./games/SnakeGame";
import { MemoryGame } from "./games/MemoryGame";
import { DodgeGame } from "./games/DodgeGame";

export type GameProps = { onGameOver: (score: number) => void };

const COMPONENTS: Record<string, React.ComponentType<GameProps>> = {
  "serpente-neon": SnakeGame,
  "memoria-magica": MemoryGame,
  "esquiva-espacial": DodgeGame,
};

type Result = { score: number; coins: number; capped: boolean; newBest: boolean };

export function GamePlayer({ slug }: { slug: string }) {
  const game = getGame(slug)!;
  const Comp = COMPONENTS[slug];
  const { recordGame, state } = useRewards();
  const [phase, setPhase] = useState<"menu" | "playing" | "over">("menu");
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  const start = () => {
    setResult(null);
    setRun((r) => r + 1);
    setPhase("playing");
  };

  const handleOver = (score: number) => {
    const r = recordGame(slug, score);
    setResult({ score, ...r });
    setPhase("over");
  };

  return (
    <div className="stage" style={{ background: game.gradient }}>
      {phase === "playing" && Comp && <Comp key={run} onGameOver={handleOver} />}

      {phase === "menu" && (
        <div className="overlay">
          <div className="overlay-emoji">{game.emoji}</div>
          <h2>{game.title}</h2>
          <p>{game.howTo}</p>
          {state.bestScores[slug] ? <p className="muted">Seu recorde: {state.bestScores[slug]} {game.scoreLabel}</p> : null}
          <button className="btn gold big-btn" onClick={start}>▶ Jogar</button>
        </div>
      )}

      {phase === "over" && result && (
        <div className="overlay">
          <h2>Fim de jogo!</h2>
          <p className="score">{result.score} {game.scoreLabel}</p>
          {result.newBest && <p className="badge ok">🏆 Novo recorde!</p>}
          <p className="earned">+{result.coins} 🪙</p>
          {result.capped && (
            <p className="muted small">Você atingiu o limite diário de {DAILY_GAME_COIN_CAP} moedas por partidas. Missões e bônus continuam valendo!</p>
          )}
          <div className="row">
            <button className="btn gold big-btn" onClick={start}>↻ Jogar de novo</button>
          </div>
        </div>
      )}
    </div>
  );
}
