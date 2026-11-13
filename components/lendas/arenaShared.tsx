"use client";

// Peças compartilhadas do modo Ação: controles, desenho da arena e painéis.
// Usadas pela batalha local (computador / selvagem) e pelo duelo online.

import { ReactNode, RefObject, useEffect } from "react";
import { ELEMENTOS, EFEITOS, EfeitoId } from "@/lib/lendas/data";
import { Lado, recargaGolpe, vantagem } from "@/lib/lendas/engine";
import {
  ARENA, AcaoBatalha, Comando, PEDRAS, RAIO, Vec, ativoDe, formaDe, miraAssistida, podeTrocarAcao, prontoParaGolpe, travado,
} from "@/lib/lendas/acao";

export const TECLAS_GOLPE: Record<string, number> = { q: 1, e: 2, r: 3 };
const ROTULO_GOLPE = ["Espaço", "Q", "E", "R"];

export type Entrada = {
  teclas: Set<string>;
  mouse: Vec | null; // em coordenadas do mundo (já desvirado)
  atirando: boolean;
  toque: boolean; // último controle usado foi toque
  joy: { id: number; ox: number; oy: number; x: number; y: number } | null;
  pendente: { i: number; t: number } | null;
  troca: number | null;
};

export const novaEntrada = (): Entrada => ({ teclas: new Set(), mouse: null, atirando: false, toque: false, joy: null, pendente: null, troca: null });

/** Converte ponto da arena para a tela (o convidado vê a arena virada, com a lenda dele embaixo). */
const virar = (flip: boolean) => (x: number, y: number): [number, number] => (flip ? [ARENA - x, ARENA - y] : [x, y]);

/** Direção de movimento a partir do teclado/joystick, já no sistema do mundo. */
export function movimentoDaEntrada(e: Entrada, flip: boolean): Vec {
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
  return flip ? { x: -mx, y: -my } : { x: mx, y: my };
}

/** Mira: mouse no computador; no toque, mira automática prevendo o movimento do adversário. */
export const miraDaEntrada = (b: AcaoBatalha, eu: Lado, e: Entrada): Vec => (!e.toque && e.mouse ? e.mouse : miraAssistida(b, eu));

/** Comando do jogador para uma simulação local (consome o golpe pendente quando ele sai). */
export function comandoLocal(b: AcaoBatalha, eu: Lado, e: Entrada, flip: boolean, dt: number): Comando {
  let golpe: number | null = null;
  if (e.pendente) {
    if (prontoParaGolpe(b, eu, e.pendente.i)) {
      golpe = e.pendente.i;
      e.pendente = null;
    } else if ((e.pendente.t -= dt) <= 0) e.pendente = null;
  }
  if (golpe === null && (e.atirando || e.teclas.has(" ")) && prontoParaGolpe(b, eu, 0)) golpe = 0;
  const troca = e.troca;
  e.troca = null;
  return { mover: movimentoDaEntrada(e, flip), mira: miraDaEntrada(b, eu, e), golpe, troca };
}

/** Teclado, mouse e toque na arena. onTecla recebe teclas especiais (Esc, F). */
export function useControlesArena(
  canvas: RefObject<HTMLCanvasElement | null>,
  entrada: RefObject<Entrada>,
  flip: boolean,
  onTecla?: (k: string) => void,
  /** Mude este valor quando o canvas aparecer/sumir da tela (para religar os controles). */
  canvasVisivel: boolean = true,
) {
  useEffect(() => {
    const e = entrada.current;
    const cv = canvas.current;
    if (!cv) return;
    const baixo = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement) return;
      const k = ev.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) ev.preventDefault();
      if (!ev.repeat) onTecla?.(k);
      e.toque = false;
      e.teclas.add(k);
      if (k in TECLAS_GOLPE) e.pendente = { i: TECLAS_GOLPE[k], t: 0.3 };
      if (["1", "2", "3"].includes(k)) e.troca = Number(k) - 1;
    };
    const cima = (ev: KeyboardEvent) => e.teclas.delete(ev.key.toLowerCase());
    const perdeuFoco = () => {
      e.teclas.clear();
      e.atirando = false;
      e.joy = null;
    };
    const paraMundo = (cx: number, cy: number): Vec => {
      const r = cv.getBoundingClientRect();
      const x = ((cx - r.left) / r.width) * ARENA;
      const y = ((cy - r.top) / r.height) * ARENA;
      return flip ? { x: ARENA - x, y: ARENA - y } : { x, y };
    };
    const mover = (ev: PointerEvent) => {
      if (ev.pointerType === "mouse") {
        e.toque = false;
        e.mouse = paraMundo(ev.clientX, ev.clientY);
      } else if (e.joy && ev.pointerId === e.joy.id) {
        e.joy.x = ev.clientX;
        e.joy.y = ev.clientY;
      }
    };
    const apertar = (ev: PointerEvent) => {
      if (ev.pointerType === "mouse") {
        e.toque = false;
        e.mouse = paraMundo(ev.clientX, ev.clientY);
        if (ev.button === 0) e.atirando = true;
        if (ev.button === 2) e.pendente = { i: 1, t: 0.3 };
      } else {
        e.toque = true;
        e.joy = { id: ev.pointerId, ox: ev.clientX, oy: ev.clientY, x: ev.clientX, y: ev.clientY };
        try {
          cv.setPointerCapture(ev.pointerId);
        } catch {}
      }
      ev.preventDefault();
    };
    const soltar = (ev: PointerEvent) => {
      if (ev.pointerType === "mouse") e.atirando = false;
      else if (e.joy && ev.pointerId === e.joy.id) e.joy = null;
    };
    const semMenu = (ev: Event) => ev.preventDefault();
    window.addEventListener("keydown", baixo);
    window.addEventListener("keyup", cima);
    window.addEventListener("blur", perdeuFoco);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flip, canvasVisivel]);
}

/** Ajusta o canvas quadrado para caber na tela com as barras e botões. */
export function ajustarCanvasArena(cv: HTMLCanvasElement, caixa: HTMLElement | null) {
  const largura = caixa?.clientWidth ?? 600;
  const lado = Math.min(largura, Math.max(280, window.innerHeight - 330));
  const dpr = window.devicePixelRatio || 1;
  cv.style.width = `${lado}px`;
  cv.style.height = `${lado}px`;
  cv.width = Math.round(lado * dpr);
  cv.height = Math.round(lado * dpr);
}

// ---------- Painéis ----------
const FORMA_TXT: Record<string, string> = {
  projetil: "Disparo", area: "Área", aoRedor: "Ao redor", investida: "Investida", feixe: "Raio", si: "Suporte",
};

export function TimeStrip({ b, lado, eu, nome }: { b: AcaoBatalha; lado: Lado; eu: Lado; nome?: string }) {
  const l = ativoDe(b, lado);
  const pct = (l.vida / l.vidaMax) * 100;
  const meu = lado === eu;
  return (
    <div className={`time-strip ${meu ? "meu" : "dele"}`} style={{ ["--el" as string]: ELEMENTOS[l.lenda.elemento].cor }}>
      <span className="ts-emoji">{l.lenda.emoji}</span>
      <div className="ts-info">
        <div className="ts-nome">
          <strong>{meu ? "🔵" : "🔴"} {l.lenda.nome}</strong>
          <span className="el-badge">{ELEMENTOS[l.lenda.elemento].icone} {ELEMENTOS[l.lenda.elemento].nome}</span>
          {nome && <span className="muted small">{nome}</span>}
          <span className="efeitos">
            {(Object.keys(l.efeitos) as EfeitoId[]).filter((k) => (l.efeitos[k] ?? 0) > 0).map((k) => (
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

/** Botões dos golpes, trocas e ajuda. `extra` entra na linha das trocas (ex.: amuleto). */
export function PainelGolpes({ b, eu, entrada, extra }: { b: AcaoBatalha; eu: Lado; entrada: RefObject<Entrada>; extra?: ReactNode }) {
  const ele: Lado = eu === 0 ? 1 : 0;
  const meu = ativoDe(b, eu);
  const dele = ativoDe(b, ele);
  const e = () => entrada.current;
  return (
    <>
      <div className="golpes">
        {meu.lenda.golpes.map((g, i) => {
          const rec = meu.recargas[i];
          const total = recargaGolpe(meu, i) || 1;
          const pronto = prontoParaGolpe(b, eu, i);
          const ef = g.poder > 0 ? vantagem(g.elemento, dele.lenda.elemento) : 1;
          return (
            <button
              key={i}
              className={`golpe ${pronto ? "pronto" : ""}`}
              style={{ ["--el" as string]: ELEMENTOS[g.elemento].cor, ["--rec" as string]: `${Math.min(100, (rec / total) * 100)}%` }}
              onPointerDown={(ev) => {
                if (ev.pointerType !== "mouse") {
                  ev.preventDefault();
                  e().toque = true;
                  if (i === 0) e().atirando = true;
                  e().pendente = { i, t: 0.35 };
                }
              }}
              onPointerUp={() => i === 0 && e().toque && (e().atirando = false)}
              onClick={() => !e().toque && (e().pendente = { i, t: 0.35 })}
            >
              <span className="golpe-nome">{ELEMENTOS[g.elemento].icone} {g.nome}</span>
              <span className="golpe-info">
                {FORMA_TXT[formaDe(g, i)]}
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
        <span className="muted small">Trocar{b.esperaTroca[eu] > 0 ? ` (${b.esperaTroca[eu].toFixed(1)}s)` : ""}:</span>
        {b.times[eu].map((l, i) => (
          <button key={i} className={`reserva ${i === b.ativo[eu] ? "em-campo" : ""}`} disabled={!podeTrocarAcao(b, eu, i)} onClick={() => (e().troca = i)} title={l.lenda.nome}>
            <span>{l.vida > 0 ? l.lenda.emoji : "💀"}</span>
            <span className="mini-vida"><span style={{ width: `${(l.vida / l.vidaMax) * 100}%` }} /></span>
            <kbd>{i + 1}</kbd>
          </button>
        ))}
        {extra}
      </div>

      <p className="muted small acao-ajuda">
        <span className="so-pc">🎮 <b>WASD</b> mover · <b>mouse</b> mira · <b>clique</b>/<b>Espaço</b> ataque · <b>Q E R</b> especiais (ou botão direito) · <b>1 2 3</b> trocar</span>
        <span className="so-toque">👆 Arraste o dedo na arena para andar · toque nos golpes (mira automática)</span>
      </p>
    </>
  );
}

// ---------- Desenho ----------
const COR_MEU = "#5ad1ff";
const COR_DELE = "#ff5d5d";
const FONTE_EMOJI = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

/** Desenha a arena do ponto de vista de `eu`. Com flip, a arena aparece virada (180°). */
export function desenharArena(ctx: CanvasRenderingContext2D, cv: HTMLCanvasElement, b: AcaoBatalha, e: Entrada, contagem: number, eu: Lado, flip: boolean) {
  const s = cv.width / ARENA;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  const V = virar(flip);
  const sinal = flip ? -1 : 1;
  const corDe = (lado: Lado) => (lado === eu ? COR_MEU : COR_DELE);

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
    const cor = corDe(z.lado);
    const prog = z.explodiu > 0 ? 1 : 1 - z.t / z.total;
    const [zx, zy] = V(z.x, z.y);
    ctx.save();
    if (z.tipo === "feixe") {
      ctx.translate(zx, zy);
      ctx.rotate(Math.atan2(z.dy! * sinal, z.dx! * sinal));
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
      ctx.beginPath(); ctx.arc(zx, zy, z.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = cor;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(zx, zy, z.r, 0, Math.PI * 2); ctx.stroke();
      if (z.explodiu <= 0) {
        ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.arc(zx, zy, Math.max(0, z.r * (1 - prog)), 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Pedras
  for (const p of PEDRAS) {
    const [px, py] = V(p.x, p.y);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(px + 6, py + 10, p.r, p.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(px - p.r / 3, py - p.r / 3, 4, px, py, p.r);
    g.addColorStop(0, "#9a8f84");
    g.addColorStop(1, "#4f4740");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, p.r, 0, Math.PI * 2); ctx.fill();
  }

  // Projéteis
  for (const p of b.proj) {
    const cor = ELEMENTOS[p.g.elemento].cor;
    const [px, py] = V(p.x, p.y);
    ctx.save();
    ctx.shadowColor = cor;
    ctx.shadowBlur = 18;
    ctx.fillStyle = cor;
    ctx.beginPath(); ctx.arc(px, py, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(px - p.vx * 0.03 * sinal, py - p.vy * 0.03 * sinal, p.r * 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = corDe(p.lado);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, py, p.r, 0, Math.PI * 2); ctx.stroke();
  }

  // Lendas (a minha por cima)
  const ordem: Lado[] = eu === 0 ? [1, 0] : [0, 1];
  for (const lado of ordem) {
    const l = ativoDe(b, lado);
    if (l.vida <= 0) continue;
    const [x, y] = V(b.pos[lado].x, b.pos[lado].y);
    const cor = corDe(lado);
    const elCor = ELEMENTOS[l.lenda.elemento].cor;
    const dash = b.dash[lado];
    if (dash) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = elCor;
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath(); ctx.arc(x - dash.vx * 0.02 * k * sinal, y - dash.vy * 0.02 * k * sinal, RAIO, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(x, y + RAIO * 0.8, RAIO, RAIO * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(10,5,30,0.75)";
    ctx.beginPath(); ctx.arc(x, y, RAIO, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = l.efeitos.protegido ? "#fff6a0" : cor;
    ctx.beginPath(); ctx.arc(x, y, RAIO, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = elCor;
    ctx.beginPath(); ctx.arc(x, y, RAIO - 4, 0, Math.PI * 2); ctx.stroke();
    // direção da mira
    const [mx, my] = V(b.mira[lado].x, b.mira[lado].y);
    const ang = Math.atan2(my - y, mx - x);
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(ang) * (RAIO + 12), y + Math.sin(ang) * (RAIO + 12));
    ctx.lineTo(x + Math.cos(ang + 0.35) * (RAIO + 3), y + Math.sin(ang + 0.35) * (RAIO + 3));
    ctx.lineTo(x + Math.cos(ang - 0.35) * (RAIO + 3), y + Math.sin(ang - 0.35) * (RAIO + 3));
    ctx.fill();
    const tremor = travado(l) ? Math.sin(b.tempo * 30) * 3 : 0;
    ctx.font = `${RAIO * 1.35}px ${FONTE_EMOJI}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(l.lenda.emoji, x + tremor, y + 2);
    if (b.pisca[lado] > 0) {
      ctx.globalAlpha = (b.pisca[lado] / 0.15) * 0.6;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(x, y, RAIO, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    const w = 64;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x - w / 2, y - RAIO - 18, w, 8);
    const pct = l.vida / l.vidaMax;
    ctx.fillStyle = pct > 0.5 ? "#3ddc97" : pct > 0.2 ? "#ffc83d" : "#ff5d5d";
    ctx.fillRect(x - w / 2, y - RAIO - 18, w * pct, 8);
    const efs = (Object.keys(l.efeitos) as EfeitoId[]).filter((k) => (l.efeitos[k] ?? 0) > 0).map((k) => EFEITOS[k].icone).join("");
    if (efs) {
      ctx.font = `14px ${FONTE_EMOJI}`;
      ctx.fillText(efs, x, y - RAIO - 30);
    }
  }

  // Números flutuantes
  ctx.textAlign = "center";
  for (const f of b.flut) {
    if (f.t >= 1) continue;
    const [fx, fy0] = V(f.x, f.y);
    // com a arena virada, o texto continua "acima" da lenda
    const fy = flip ? fy0 - RAIO * 2 - 20 : fy0;
    ctx.globalAlpha = Math.max(0, 1 - f.t);
    const tam = f.tipo === "super" ? 30 : f.tipo === "info" ? 16 : 24;
    ctx.font = `900 ${tam}px system-ui, sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    const y = fy - f.t * 45;
    ctx.strokeText(f.texto, fx, y);
    ctx.fillStyle = f.tipo === "super" ? "#ffc83d" : f.tipo === "fraco" ? "#c9bdf0" : f.tipo === "cura" ? "#3ddc97" : "#fff";
    ctx.fillText(f.texto, fx, y);
  }
  ctx.globalAlpha = 1;

  // Avisos (golpes especiais, trocas) — o 🔵/🔴 do motor é do ponto de vista do lado 0
  ctx.font = "700 18px system-ui, sans-serif";
  ctx.textAlign = "left";
  b.avisos.filter((a) => a.t < 2.5).forEach((a, i) => {
    const texto = eu === 1 ? a.texto.replace(/^🔵/, "§").replace(/^🔴/, "🔵").replace(/^§/, "🔴") : a.texto;
    ctx.globalAlpha = Math.max(0, Math.min(1, (2.5 - a.t) / 0.5));
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    const w = ctx.measureText(texto).width + 16;
    ctx.fillRect(10, 10 + i * 30, w, 26);
    ctx.fillStyle = "#fff";
    ctx.fillText(texto, 18, 29 + i * 30);
  });
  ctx.globalAlpha = 1;

  // Mira do mouse
  if (!e.toque && e.mouse && b.vencedor === null) {
    const [cx, cy] = V(e.mouse.x, e.mouse.y);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 18, cy); ctx.lineTo(cx + 18, cy); ctx.moveTo(cx, cy - 18); ctx.lineTo(cx, cy + 18); ctx.stroke();
  }

  // Joystick virtual (em coordenadas de tela)
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
