"use client";

import { useEffect, useRef, useState } from "react";
import { ELEMENTOS, EFEITOS, EfeitoId } from "@/lib/lendas/data";
import { Lado, Nivel, recargaGolpe, vantagem } from "@/lib/lendas/engine";
import {
  ARENA, AcaoBatalha, CerebroAcao, Comando, PEDRAS, RAIO, ativoDe, comandoComputador, criarAcao, formaDe,
  miraAssistida, novoCerebro, passo, podeTrocarAcao, prontoParaGolpe, travado,
} from "@/lib/lendas/acao";
import { chanceCaptura } from "@/lib/lendas/mapa";
import { useRewards } from "../RewardsProvider";

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
const TECLAS_GOLPE: Record<string, number> = { q: 1, e: 2, r: 3 };
const ROTULO_GOLPE = ["Espaço", "Q", "E", "R"];
const CONTAGEM = 3;

type Entrada = {
  teclas: Set<string>;
  mouse: { x: number; y: number } | null; // em coordenadas da arena
  atirando: boolean;
  toque: boolean; // último controle usado foi toque
  joy: { id: number; ox: number; oy: number; x: number; y: number } | null;
  pendente: { i: number; t: number } | null;
  troca: number | null;
};

export function ActionBattle({ meu, deles, nivel, onRevanche, onSair, selvagem }: Props) {
  const bat = useRef<AcaoBatalha>(null as unknown as AcaoBatalha);
  // Lenda selvagem luta sozinha contra o seu time, então é mais resistente
  if (!bat.current) bat.current = criarAcao(meu, deles, [1, selvagem?.vidaMult ?? 1]);
  const [captura, setCaptura] = useState<Captura | null>(null);
  const capturou = useRef(false);
  const amuletoRef = useRef<() => void>(() => {});
  const cerebro = useRef<CerebroAcao>(novoCerebro());
  const entrada = useRef<Entrada>({ teclas: new Set(), mouse: null, atirando: false, toque: false, joy: null, pendente: null, troca: null });
  const canvas = useRef<HTMLCanvasElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const [, setHud] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [premio, setPremio] = useState<number | null>(null);
  const premiado = useRef(false);
  const pausaRef = useRef(false);
  const contagem = useRef(CONTAGEM);
  const { recordGame } = useRewards();
  pausaRef.current = pausado || captura !== null;

  // ---------- Laço principal ----------
  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext("2d")!;
    let raf = 0;
    let ultimo = performance.now();
    let acumulado = 0;
    let ultimoHud = 0;

    const ajustarTamanho = () => {
      const largura = caixa.current?.clientWidth ?? 600;
      // Cabe na tela junto com as barras e os botões
      const lado = Math.min(largura, Math.max(280, window.innerHeight - 330));
      const dpr = window.devicePixelRatio || 1;
      cv.style.width = `${lado}px`;
      cv.style.height = `${lado}px`;
      cv.width = Math.round(lado * dpr);
      cv.height = Math.round(lado * dpr);
    };
    ajustarTamanho();
    window.addEventListener("resize", ajustarTamanho);
    cv.closest(".arena")?.scrollIntoView({ block: "start", behavior: "smooth" });

    const comandoJogador = (): Comando => {
      const b = bat.current;
      const e = entrada.current;
      const t = e.teclas;
      let mx = (t.has("d") || t.has("arrowright") ? 1 : 0) - (t.has("a") || t.has("arrowleft") ? 1 : 0);
      let my = (t.has("s") || t.has("arrowdown") ? 1 : 0) - (t.has("w") || t.has("arrowup") ? 1 : 0);
      if (e.joy) {
        const dx = e.joy.x - e.joy.ox;
        const dy = e.joy.y - e.joy.oy;
        const d = Math.hypot(dx, dy);
        if (d > 8) {
          mx = dx / Math.max(d, 50);
          my = dy / Math.max(d, 50);
        }
      }
      // Mira: mouse no computador; no toque, mira automática (prevê o movimento do adversário)
      const mira = !e.toque && e.mouse ? e.mouse : miraAssistida(b, 0);
      let golpe: number | null = null;
      if (e.pendente) {
        if (prontoParaGolpe(b, 0, e.pendente.i)) {
          golpe = e.pendente.i;
          e.pendente = null;
        } else if ((e.pendente.t -= PASSO) <= 0) e.pendente = null;
      }
      if (golpe === null && (e.atirando || t.has(" ")) && prontoParaGolpe(b, 0, 0)) golpe = 0;
      const troca = e.troca;
      e.troca = null;
      return { mover: { x: mx, y: my }, mira, golpe, troca };
    };

    const quadro = (agora: number) => {
      tick(agora);
      raf = requestAnimationFrame(quadro);
    };

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
            const c0 = comandoJogador();
            const c1 = comandoComputador(b, 1, nivel, cerebro.current, PASSO);
            passo(b, PASSO, [c0, c1]);
          }
        }
      }
      desenhar(ctx, cv, b, entrada.current, contagem.current);
      if (agora - ultimoHud > 90 || b.vencedor !== null) {
        ultimoHud = agora;
        setHud((n) => n + 1);
      }
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
      window.removeEventListener("resize", ajustarTamanho);
    };
  }, [nivel]);

  // ---------- Teclado e mouse ----------
  useEffect(() => {
    const e = entrada.current;
    const baixo = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement) return;
      const k = ev.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) ev.preventDefault();
      if (k === "escape") return setPausado((p) => !p);
      e.toque = false;
      e.teclas.add(k);
      if (k in TECLAS_GOLPE) e.pendente = { i: TECLAS_GOLPE[k], t: 0.25 };
      if (["1", "2", "3"].includes(k)) e.troca = Number(k) - 1;
      if (k === "f" && !ev.repeat) amuletoRef.current();
    };
    const cima = (ev: KeyboardEvent) => e.teclas.delete(ev.key.toLowerCase());
    const perdeuFoco = () => {
      e.teclas.clear();
      e.atirando = false;
    };
    window.addEventListener("keydown", baixo);
    window.addEventListener("keyup", cima);
    window.addEventListener("blur", perdeuFoco);

    const cv = canvas.current!;
    const paraArena = (cx: number, cy: number) => {
      const r = cv.getBoundingClientRect();
      return { x: ((cx - r.left) / r.width) * ARENA, y: ((cy - r.top) / r.height) * ARENA };
    };
    const mover = (ev: PointerEvent) => {
      if (ev.pointerType === "mouse") {
        e.toque = false;
        e.mouse = paraArena(ev.clientX, ev.clientY);
      } else if (e.joy && ev.pointerId === e.joy.id) {
        e.joy.x = ev.clientX;
        e.joy.y = ev.clientY;
      }
    };
    const apertar = (ev: PointerEvent) => {
      if (ev.pointerType === "mouse") {
        e.toque = false;
        e.mouse = paraArena(ev.clientX, ev.clientY);
        if (ev.button === 0) e.atirando = true;
        if (ev.button === 2) e.pendente = { i: 1, t: 0.25 };
      } else {
        // Toque na arena = joystick virtual
        e.toque = true;
        e.joy = { id: ev.pointerId, ox: ev.clientX, oy: ev.clientY, x: ev.clientX, y: ev.clientY };
        cv.setPointerCapture(ev.pointerId);
      }
      ev.preventDefault();
    };
    const soltar = (ev: PointerEvent) => {
      if (ev.pointerType === "mouse") e.atirando = false;
      else if (e.joy && ev.pointerId === e.joy.id) e.joy = null;
    };
    const semMenu = (ev: Event) => ev.preventDefault();
    cv.addEventListener("pointermove", mover);
    cv.addEventListener("pointerdown", apertar);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
    cv.addEventListener("contextmenu", semMenu);
    return () => {
      window.removeEventListener("keydown", baixo);
      window.removeEventListener("keyup", cima);
      window.removeEventListener("blur", perdeuFoco);
      cv.removeEventListener("pointermove", mover);
      cv.removeEventListener("pointerdown", apertar);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      cv.removeEventListener("contextmenu", semMenu);
    };
  }, []);

  const b = bat.current;

  // Moedas no fim (uma vez) — no modo selvagem quem premia é a tela de exploração
  useEffect(() => {
    if (b.vencedor === null || premiado.current || selvagem) return;
    premiado.current = true;
    setPremio(recordGame("arena-das-lendas", b.vencedor === 0 ? nivel + 1 : 0).coins);
  });

  const eu = ativoDe(b, 0);
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
  const golpeToque = (i: number) => {
    entrada.current.toque = true;
    entrada.current.pendente = { i, t: 0.3 };
  };

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

      <TimeStrip b={b} lado={1} />

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

      <TimeStrip b={b} lado={0} />

      <div className="golpes">
        {eu.lenda.golpes.map((g, i) => {
          const rec = eu.recargas[i];
          const total = recargaGolpe(eu, i) || 1;
          const pronto = prontoParaGolpe(b, 0, i);
          const ef = g.poder > 0 ? vantagem(g.elemento, ele.lenda.elemento) : 1;
          const forma = formaDe(g, i);
          return (
            <button
              key={i}
              className={`golpe ${pronto ? "pronto" : ""}`}
              style={{ ["--el" as string]: ELEMENTOS[g.elemento].cor, ["--rec" as string]: `${Math.min(100, (rec / total) * 100)}%` }}
              onPointerDown={(ev) => {
                if (ev.pointerType !== "mouse") {
                  ev.preventDefault();
                  if (i === 0) entrada.current.atirando = true;
                  golpeToque(i);
                }
              }}
              onPointerUp={() => i === 0 && entrada.current.toque && (entrada.current.atirando = false)}
              onClick={() => !entrada.current.toque && (entrada.current.pendente = { i, t: 0.3 })}
            >
              <span className="golpe-nome">{ELEMENTOS[g.elemento].icone} {g.nome}</span>
              <span className="golpe-info">
                {FORMA_TXT[forma]}
                {g.poder > 0 ? ` · ${g.poder}` : ""}
                {ef > 1 && <em className="ef-sup"> · forte!</em>}
                {ef < 1 && <em className="ef-fra"> · fraco</em>}
              </span>
              {rec > 0 && <span className="golpe-rec">{rec.toFixed(1)}s</span>}
              <kbd>{ROTULO_GOLPE[i]}</kbd>
            </button>
          );
        })}
      </div>

      <div className="reservas">
        <span className="muted small">Trocar{b.esperaTroca[0] > 0 ? ` (${b.esperaTroca[0].toFixed(1)}s)` : ""}:</span>
        {b.times[0].map((l, i) => (
          <button key={i} className={`reserva ${i === b.ativo[0] ? "em-campo" : ""}`} disabled={!podeTrocarAcao(b, 0, i)} onClick={() => (entrada.current.troca = i)} title={l.lenda.nome}>
            <span>{l.vida > 0 ? l.lenda.emoji : "💀"}</span>
            <span className="mini-vida"><span style={{ width: `${(l.vida / l.vidaMax) * 100}%` }} /></span>
            <kbd>{i + 1}</kbd>
          </button>
        ))}
        {selvagem && (
          <button
            className={`btn amuleto-btn ${chance >= 0.5 ? "bom" : ""}`}
            onClick={lancarAmuleto}
            disabled={selvagem.amuletos <= 0 || captura !== null || b.vencedor !== null}
            title="Quanto menos vida a lenda tiver, maior a chance (tecla F)"
          >
            🔮 Amuleto ×{selvagem.amuletos}
            <small>{selvagem.amuletos > 0 ? `chance ${Math.round(chance * 100)}%` : "sem amuletos"}</small>
          </button>
        )}
      </div>

      <p className="muted small acao-ajuda">
        <span className="so-pc">🎮 <b>WASD</b> mover · <b>mouse</b> mira · <b>clique</b>/<b>Espaço</b> ataque · <b>Q E R</b> especiais (ou botão direito) · <b>1 2 3</b> trocar · <b>Esc</b> pausa</span>
        <span className="so-toque">👆 Arraste o dedo na arena para andar · toque nos golpes (mira automática)</span>
      </p>
    </div>
  );
}

const FORMA_TXT: Record<string, string> = {
  projetil: "Disparo", area: "Área", aoRedor: "Ao redor", investida: "Investida", feixe: "Raio", si: "Suporte",
};

function TimeStrip({ b, lado }: { b: AcaoBatalha; lado: Lado }) {
  const l = ativoDe(b, lado);
  const pct = (l.vida / l.vidaMax) * 100;
  return (
    <div className={`time-strip ${lado === 0 ? "meu" : "dele"}`} style={{ ["--el" as string]: ELEMENTOS[l.lenda.elemento].cor }}>
      <span className="ts-emoji">{l.lenda.emoji}</span>
      <div className="ts-info">
        <div className="ts-nome">
          <strong>{lado === 0 ? "🔵" : "🔴"} {l.lenda.nome}</strong>
          <span className="el-badge">{ELEMENTOS[l.lenda.elemento].icone} {ELEMENTOS[l.lenda.elemento].nome}</span>
          <span className="efeitos">
            {(Object.keys(l.efeitos) as EfeitoId[]).map((k) => (
              <span key={k} className={`efeito ${EFEITOS[k].ruim ? "ruim" : "bom"}`}>{EFEITOS[k].icone} {Math.ceil(l.efeitos[k] ?? 0)}s</span>
            ))}
          </span>
        </div>
        <div className="vida-bar"><span style={{ width: `${pct}%`, background: pct > 50 ? "#3ddc97" : pct > 20 ? "#ffc83d" : "#ff5d5d" }} /></div>
      </div>
      <span className="pontos">{b.times[lado].map((x, i) => <i key={i} className={x.vida <= 0 ? "morto" : i === b.ativo[lado] ? "ativo" : ""} />)}</span>
    </div>
  );
}

// ---------- Desenho da arena ----------
const COR_MEU = "#5ad1ff";
const COR_DELE = "#ff5d5d";
const FONTE_EMOJI = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

function desenhar(ctx: CanvasRenderingContext2D, cv: HTMLCanvasElement, b: AcaoBatalha, e: Entrada, contagem: number) {
  const s = cv.width / ARENA;
  ctx.setTransform(s, 0, 0, s, 0, 0);

  // Chão
  const chao = ctx.createRadialGradient(ARENA / 2, ARENA / 2, 50, ARENA / 2, ARENA / 2, ARENA * 0.75);
  chao.addColorStop(0, "#245a3a");
  chao.addColorStop(1, "#11291f");
  ctx.fillStyle = chao;
  ctx.fillRect(0, 0, ARENA, ARENA);
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let i = 50; i < ARENA; i += 50) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, ARENA); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(ARENA, i); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(ARENA / 2, ARENA / 2, 90, 0, Math.PI * 2); ctx.stroke();

  // Zonas (avisos no chão e explosões)
  for (const z of b.zonas) {
    const cor = z.lado === 0 ? COR_MEU : COR_DELE;
    const prog = z.explodiu > 0 ? 1 : 1 - z.t / z.total;
    ctx.save();
    if (z.tipo === "feixe") {
      ctx.translate(z.x, z.y);
      ctx.rotate(Math.atan2(z.dy!, z.dx!));
      ctx.globalAlpha = z.explodiu > 0 ? 0.85 * (z.explodiu / 0.25) : 0.15 + 0.25 * prog;
      ctx.fillStyle = z.explodiu > 0 ? ELEMENTOS[z.g.elemento].cor : cor;
      ctx.fillRect(RAIO * 0.5, -z.largura! / 2, z.comp!, z.largura!);
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = cor;
      ctx.lineWidth = 2;
      ctx.strokeRect(RAIO * 0.5, -z.largura! / 2, z.comp!, z.largura!);
    } else {
      ctx.globalAlpha = z.explodiu > 0 ? 0.8 * (z.explodiu / 0.25) : 0.12 + 0.2 * prog;
      ctx.fillStyle = z.explodiu > 0 ? ELEMENTOS[z.g.elemento].cor : cor;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = cor;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.stroke();
      if (z.explodiu <= 0) {
        // anel que fecha = tempo até explodir
        ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r * (1 - prog), 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Pedras
  for (const p of PEDRAS) {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(p.x + 6, p.y + 10, p.r, p.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(p.x - p.r / 3, p.y - p.r / 3, 4, p.x, p.y, p.r);
    g.addColorStop(0, "#9a8f84");
    g.addColorStop(1, "#4f4740");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }

  // Projéteis
  for (const p of b.proj) {
    const cor = ELEMENTOS[p.g.elemento].cor;
    ctx.save();
    ctx.shadowColor = cor;
    ctx.shadowBlur = 18;
    ctx.fillStyle = cor;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(p.x - p.vx * 0.03, p.y - p.vy * 0.03, p.r * 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = p.lado === 0 ? COR_MEU : COR_DELE;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
  }

  // Lendas
  for (const lado of [1, 0] as Lado[]) {
    const l = ativoDe(b, lado);
    if (l.vida <= 0) continue;
    const p = b.pos[lado];
    const cor = lado === 0 ? COR_MEU : COR_DELE;
    const elCor = ELEMENTOS[l.lenda.elemento].cor;
    // rastro da investida
    if (b.dash[lado]) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = elCor;
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath(); ctx.arc(p.x - b.dash[lado]!.vx * 0.02 * k, p.y - b.dash[lado]!.vy * 0.02 * k, RAIO, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(p.x, p.y + RAIO * 0.8, RAIO, RAIO * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(10,5,30,0.75)";
    ctx.beginPath(); ctx.arc(p.x, p.y, RAIO, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = l.efeitos.protegido ? "#fff6a0" : cor;
    ctx.beginPath(); ctx.arc(p.x, p.y, RAIO, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = elCor;
    ctx.beginPath(); ctx.arc(p.x, p.y, RAIO - 4, 0, Math.PI * 2); ctx.stroke();
    // direção da mira
    const m = b.mira[lado];
    const ang = Math.atan2(m.y - p.y, m.x - p.x);
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(ang) * (RAIO + 12), p.y + Math.sin(ang) * (RAIO + 12));
    ctx.lineTo(p.x + Math.cos(ang + 0.35) * (RAIO + 3), p.y + Math.sin(ang + 0.35) * (RAIO + 3));
    ctx.lineTo(p.x + Math.cos(ang - 0.35) * (RAIO + 3), p.y + Math.sin(ang - 0.35) * (RAIO + 3));
    ctx.fill();
    // emoji
    const tremor = travado(l) ? Math.sin(b.tempo * 30) * 3 : 0;
    ctx.font = `${RAIO * 1.35}px ${FONTE_EMOJI}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(l.lenda.emoji, p.x + tremor, p.y + 2);
    if (b.pisca[lado] > 0) {
      ctx.globalAlpha = b.pisca[lado] / 0.15 * 0.6;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(p.x, p.y, RAIO, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // vida
    const w = 64;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(p.x - w / 2, p.y - RAIO - 18, w, 8);
    const pct = l.vida / l.vidaMax;
    ctx.fillStyle = pct > 0.5 ? "#3ddc97" : pct > 0.2 ? "#ffc83d" : "#ff5d5d";
    ctx.fillRect(p.x - w / 2, p.y - RAIO - 18, w * pct, 8);
    // efeitos
    const efs = (Object.keys(l.efeitos) as EfeitoId[]).map((k) => EFEITOS[k].icone).join("");
    if (efs) {
      ctx.font = `14px ${FONTE_EMOJI}`;
      ctx.fillText(efs, p.x, p.y - RAIO - 30);
    }
  }

  // Números flutuantes
  ctx.textAlign = "center";
  for (const f of b.flut) {
    const a = 1 - f.t;
    ctx.globalAlpha = Math.max(0, a);
    const tam = f.tipo === "super" ? 30 : f.tipo === "info" ? 16 : 24;
    ctx.font = `900 ${tam}px system-ui, sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    const y = f.y - f.t * 45;
    ctx.strokeText(f.texto, f.x, y);
    ctx.fillStyle = f.tipo === "super" ? "#ffc83d" : f.tipo === "fraco" ? "#c9bdf0" : f.tipo === "cura" ? "#3ddc97" : f.tipo === "info" ? "#fff" : "#fff";
    ctx.fillText(f.texto, f.x, y);
  }
  ctx.globalAlpha = 1;

  // Avisos (golpes especiais, trocas)
  ctx.font = "700 18px system-ui, sans-serif";
  ctx.textAlign = "left";
  b.avisos.forEach((a, i) => {
    ctx.globalAlpha = Math.max(0, Math.min(1, (2.5 - a.t) / 0.5));
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    const w = ctx.measureText(a.texto).width + 16;
    ctx.fillRect(10, 10 + i * 30, w, 26);
    ctx.fillStyle = "#fff";
    ctx.fillText(a.texto, 18, 29 + i * 30);
  });
  ctx.globalAlpha = 1;

  // Mira do mouse
  if (!e.toque && e.mouse && b.vencedor === null) {
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(e.mouse.x, e.mouse.y, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(e.mouse.x - 18, e.mouse.y); ctx.lineTo(e.mouse.x + 18, e.mouse.y); ctx.moveTo(e.mouse.x, e.mouse.y - 18); ctx.lineTo(e.mouse.x, e.mouse.y + 18); ctx.stroke();
  }

  // Joystick virtual
  if (e.joy) {
    const r = cv.getBoundingClientRect();
    const k = ARENA / r.width;
    const ox = (e.joy.ox - r.left) * k, oy = (e.joy.oy - r.top) * k;
    let dx = (e.joy.x - e.joy.ox) * k, dy = (e.joy.y - e.joy.oy) * k;
    const d = Math.hypot(dx, dy);
    const max = 70;
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(ox, oy, max, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(ox + dx, oy + dy, 30, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Contagem inicial
  if (contagem > 0) {
    ctx.fillStyle = "rgba(5,2,15,0.45)";
    ctx.fillRect(0, 0, ARENA, ARENA);
    ctx.textAlign = "center";
    ctx.font = "900 140px system-ui, sans-serif";
    ctx.fillStyle = "#ffc83d";
    ctx.fillText(String(Math.ceil(contagem)), ARENA / 2, ARENA / 2);
    ctx.font = "700 26px system-ui, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText("Prepare-se!", ARENA / 2, ARENA / 2 + 100);
  }
}
