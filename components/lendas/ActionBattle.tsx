"use client";

import { useEffect, useRef, useState } from "react";
import { Nivel } from "@/lib/lendas/engine";
import { AcaoBatalha, CerebroAcao, ativoDe, comandoComputador, criarAcao, novoCerebro, passo, travado } from "@/lib/lendas/acao";
import { chanceCaptura } from "@/lib/lendas/mapa";
import { useRewards } from "../RewardsProvider";
import { Entrada, PainelGolpes, TimeStrip, ajustarCanvasArena, comandoLocal, desenharArena, novaEntrada, useControlesArena } from "./arenaShared";

export type ResultadoSelvagem = "capturou" | "venceu" | "perdeu" | "fugiu";

/** Batalha contra uma lenda selvagem (exploração). */
export type ModoSelvagem = {
  raro: boolean;
  /** Multiplicador de vida da lenda selvagem (ela luta sozinha contra o seu time). */
  vidaMult: number;
  amuletos: number;
  usarAmuleto: () => boolean;
  onFim: (r: ResultadoSelvagem) => void;
};

type Props = {
  meu: string[];
  deles: string[];
  nivel: Nivel;
  onRevanche: () => void;
  onSair: () => void;
  selvagem?: ModoSelvagem;
};

type Captura = { fase: "tremendo" | "ok" | "falhou"; chance: number };

const PASSO = 1 / 60;
const CONTAGEM = 3;

/** Batalha do modo Ação contra o computador (ou contra uma lenda selvagem). */
export function ActionBattle({ meu, deles, nivel, onRevanche, onSair, selvagem }: Props) {
  const bat = useRef<AcaoBatalha>(null as unknown as AcaoBatalha);
  if (!bat.current) bat.current = criarAcao(meu, deles, [1, selvagem?.vidaMult ?? 1]);
  const cerebro = useRef<CerebroAcao>(novoCerebro());
  const entrada = useRef<Entrada>(novaEntrada());
  const canvas = useRef<HTMLCanvasElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const [, setHud] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [premio, setPremio] = useState<number | null>(null);
  const [captura, setCaptura] = useState<Captura | null>(null);
  const capturou = useRef(false);
  const amuletoRef = useRef<() => void>(() => {});
  const premiado = useRef(false);
  const pausaRef = useRef(false);
  const contagem = useRef(CONTAGEM);
  const { recordGame } = useRewards();
  pausaRef.current = pausado || captura !== null;

  useControlesArena(canvas, entrada, false, (k) => {
    if (k === "escape") setPausado((p) => !p);
    if (k === "f") amuletoRef.current();
  });

  // ---------- Laço principal ----------
  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext("2d")!;
    let raf = 0;
    let ultimo = performance.now();
    let acumulado = 0;
    let ultimoHud = 0;
    const ajustar = () => ajustarCanvasArena(cv, caixa.current);
    ajustar();
    window.addEventListener("resize", ajustar);
    cv.closest(".arena")?.scrollIntoView({ block: "start", behavior: "smooth" });

    const tick = (agora: number) => {
      const dt = Math.min(0.1, (agora - ultimo) / 1000);
      if (dt <= 0) return;
      ultimo = agora;
      const b = bat.current;
      if (!pausaRef.current) {
        if (contagem.current > 0) contagem.current = Math.max(0, contagem.current - dt);
        else {
          acumulado += dt;
          while (acumulado >= PASSO) {
            acumulado -= PASSO;
            const c0 = comandoLocal(b, 0, entrada.current, false, PASSO);
            const c1 = comandoComputador(b, 1, nivel, cerebro.current, PASSO);
            passo(b, PASSO, [c0, c1]);
          }
        }
      }
      desenharArena(ctx, cv, b, entrada.current, contagem.current, 0, false);
      if (agora - ultimoHud > 90 || b.vencedor !== null) {
        ultimoHud = agora;
        setHud((n) => n + 1);
      }
    };
    const quadro = (agora: number) => {
      tick(agora);
      raf = requestAnimationFrame(quadro);
    };
    raf = requestAnimationFrame(quadro);
    // Reserva: se o navegador parar de chamar requestAnimationFrame, o jogo continua
    const reserva = setInterval(() => {
      const agora = performance.now();
      if (agora - ultimo > 120) tick(agora);
    }, 50);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(reserva);
      window.removeEventListener("resize", ajustar);
    };
  }, [nivel]);

  const b = bat.current;

  // Moedas no fim (uma vez) — no modo selvagem quem premia é a tela de exploração
  useEffect(() => {
    if (b.vencedor === null || premiado.current || selvagem) return;
    premiado.current = true;
    setPremio(recordGame("arena-das-lendas", b.vencedor === 0 ? nivel + 1 : 0).coins);
  });

  const ele = ativoDe(b, 1);
  const chance = chanceCaptura(ele.vida / ele.vidaMax, travado(ele), !!selvagem?.raro);

  const lancarAmuleto = () => {
    if (!selvagem || captura || b.vencedor !== null || contagem.current > 0) return;
    if (!selvagem.usarAmuleto()) return;
    setCaptura({ fase: "tremendo", chance });
    setTimeout(() => {
      if (Math.random() < chance) {
        capturou.current = true;
        b.vencedor = 0;
        setCaptura({ fase: "ok", chance });
      } else {
        setCaptura({ fase: "falhou", chance });
        setTimeout(() => setCaptura(null), 900);
      }
    }, 1600);
  };
  amuletoRef.current = lancarAmuleto;

  const fimSelvagem = (): ResultadoSelvagem => (capturou.current ? "capturou" : b.vencedor === 0 ? "venceu" : "perdeu");

  return (
    <div className="arena acao">
      <div className="arena-bar">
        <button className="btn small-btn" onClick={() => setPausado((p) => !p)} disabled={b.vencedor !== null}>
          {pausado ? "▶ Continuar" : "⏸ Pausar"}
        </button>
        <span className="muted small">⏱ {Math.floor(b.tempo)}s · {selvagem ? `Selvagem · Nv ${nivel}` : ["", "Fácil", "Médio", "Difícil"][nivel]}</span>
        {selvagem ? (
          <button className="btn small-btn" onClick={() => selvagem.onFim("fugiu")} disabled={b.vencedor !== null || captura !== null}>🏃 Fugir</button>
        ) : (
          <button className="btn small-btn" onClick={onSair}>Sair</button>
        )}
      </div>

      <TimeStrip b={b} lado={1} eu={0} />

      <div className="acao-canvas-box" ref={caixa}>
        <canvas ref={canvas} className="acao-canvas" />
        {captura && captura.fase !== "ok" && (
          <div className="overlay-full captura-overlay">
            <div className={`captura-amuleto ${captura.fase}`}>🔮</div>
            <p className="captura-texto">
              {captura.fase === "tremendo" ? `Capturando ${ele.lenda.nome}… (${Math.round(captura.chance * 100)}%)` : `${ele.lenda.nome} escapou!`}
            </p>
          </div>
        )}
        {selvagem && b.vencedor !== null && (
          <div className="overlay-full">
            <div className="overlay">
              <div className="overlay-emoji">{capturou.current ? ele.lenda.emoji : b.vencedor === 0 ? "🏆" : "😵"}</div>
              <h2>{capturou.current ? `Capturou ${ele.lenda.nome}!` : b.vencedor === 0 ? `Venceu ${ele.lenda.nome}!` : "Seu time foi derrotado…"}</h2>
              <p className="muted">
                {capturou.current
                  ? "Ela agora faz parte da sua coleção."
                  : b.vencedor === 0
                    ? "Ela fugiu ferida. Da próxima vez, use um amuleto antes!"
                    : "Volte para a vila e tente de novo."}
              </p>
              <button className="btn gold" onClick={() => selvagem.onFim(fimSelvagem())}>🗺️ Voltar ao mapa</button>
            </div>
          </div>
        )}
        {!selvagem && b.vencedor !== null && (
          <div className="overlay-full">
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
          </div>
        )}
        {pausado && b.vencedor === null && (
          <div className="overlay-full">
            <div className="overlay">
              <h2>⏸ Pausado</h2>
              <button className="btn gold" onClick={() => setPausado(false)}>Continuar</button>
            </div>
          </div>
        )}
      </div>

      <TimeStrip b={b} lado={0} eu={0} />

      <PainelGolpes
        b={b}
        eu={0}
        entrada={entrada}
        extra={
          selvagem && (
            <button
              className={`btn amuleto-btn ${chance >= 0.5 ? "bom" : ""}`}
              onClick={lancarAmuleto}
              disabled={selvagem.amuletos <= 0 || captura !== null || b.vencedor !== null}
              title="Quanto menos vida a lenda tiver, maior a chance (tecla F)"
            >
              🔮 Amuleto ×{selvagem.amuletos}
              <small>{selvagem.amuletos > 0 ? `chance ${Math.round(chance * 100)}%` : "sem amuletos"}</small>
            </button>
          )
        }
      />
    </div>
  );
}
