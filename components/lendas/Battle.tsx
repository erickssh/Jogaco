"use client";

import { useEffect, useRef, useState } from "react";
import { Batalha, Cerebro, Nivel, avancar, criarBatalha, jogarComputador, trocar, usarGolpe } from "@/lib/lendas/engine";
import { useRewards } from "../RewardsProvider";
import { BattleView } from "./BattleView";

type Props = { meu: string[]; deles: string[]; nivel: Nivel; onRevanche: () => void; onSair: () => void };

/** Batalha contra o computador. */
export function Battle({ meu, deles, nivel, onRevanche, onSair }: Props) {
  const ref = useRef<Batalha>(null as unknown as Batalha);
  if (!ref.current) ref.current = criarBatalha(meu, deles);
  const cerebro = useRef<Cerebro>({ espera: 1.2 });
  const premiado = useRef(false);
  const [, setTick] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [premio, setPremio] = useState<number | null>(null);
  const { recordGame } = useRewards();
  const pausaRef = useRef(false);
  pausaRef.current = pausado;

  // Laço principal (~20 quadros por segundo)
  useEffect(() => {
    let ultimo = performance.now();
    const t = setInterval(() => {
      const agora = performance.now();
      const dt = Math.min(0.2, (agora - ultimo) / 1000);
      ultimo = agora;
      const b = ref.current;
      if (!pausaRef.current && b.vencedor === null) {
        avancar(b, dt);
        jogarComputador(b, 1, nivel, cerebro.current, dt);
      }
      setTick((n) => n + 1);
    }, 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPausado((p) => !p);
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [nivel]);

  const b = ref.current;

  // Moedas no fim (uma vez)
  useEffect(() => {
    if (b.vencedor === null || premiado.current) return;
    premiado.current = true;
    setPremio(recordGame("arena-das-lendas", b.vencedor === 0 ? nivel + 1 : 0).coins);
  });

  return (
    <BattleView
      b={b}
      eu={0}
      onGolpe={(i) => !pausado && usarGolpe(b, 0, i)}
      onTroca={(i) => !pausado && trocar(b, 0, i)}
      barra={
        <>
          <button className="btn small-btn" onClick={() => setPausado((p) => !p)} disabled={b.vencedor !== null}>
            {pausado ? "▶ Continuar" : "⏸ Pausar"}
          </button>
          <span className="muted small">⏱ {Math.floor(b.tempo)}s · {["", "Fácil", "Médio", "Difícil"][nivel]}</span>
          <button className="btn small-btn" onClick={onSair}>Sair</button>
        </>
      }
      sobreposicao={
        b.vencedor !== null ? (
          <div className="overlay">
            <div className="overlay-emoji">{b.vencedor === 0 ? "🏆" : "😵"}</div>
            <h2>{b.vencedor === 0 ? "Vitória!" : "Derrota…"}</h2>
            <p className="muted">Batalha de {Math.floor(b.tempo)} segundos</p>
            {premio !== null && <p className="earned">+{premio} 🪙</p>}
            <div className="row">
              <button className="btn gold" onClick={onRevanche}>↻ Revanche</button>
              <button className="btn" onClick={onSair}>Trocar time</button>
            </div>
          </div>
        ) : pausado ? (
          <div className="overlay">
            <h2>⏸ Pausado</h2>
            <button className="btn gold" onClick={() => setPausado(false)}>Continuar</button>
          </div>
        ) : null
      }
    />
  );
}
