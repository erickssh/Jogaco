"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ELEMENTOS, LENDAS } from "@/lib/lendas/data";
import {
  COLS, MUNDO_A, MUNDO_L, RAIO_JOGADOR, REGIOES, ROWS, Selvagem, TILE, VILA, centroVila, gerarSelvagem, grade,
  livre, moverSelvagens, regiaoEm,
} from "@/lib/lendas/mapa";
import { lerTime, timeValido } from "@/lib/lendas/online";
import { useRewards } from "../RewardsProvider";
import { ActionBattle, ResultadoSelvagem } from "./ActionBattle";
import { possuiLenda } from "./LendasGame";

const POS_KEY = "jogaco:lendas:pos";
const MAX_SELVAGENS = 14;
const VEL_JOGADOR = 250;
const AMULETO = "amuleto";
const PACOTES = [
  { qtd: 1, preco: 25 },
  { qtd: 5, preco: 110 },
  { qtd: 12, preco: 240 },
];

type Entrada = {
  teclas: Set<string>;
  joy: { id: number; ox: number; oy: number; x: number; y: number } | null;
  destino: { x: number; y: number } | null; // mouse segurado
};

export function Explorar() {
  const { state, ready, consumeItem, buyItem, grantLenda, recordCustom, claimGift } = useRewards();
  const canvas = useRef<HTMLCanvasElement>(null);
  const jogador = useRef(centroVila());
  const selvagens = useRef<Selvagem[]>([]);
  const entrada = useRef<Entrada>({ teclas: new Set(), joy: null, destino: null });
  const imune = useRef(1.5);
  const regiaoAtual = useRef("vila");
  const faixa = useRef<{ texto: string; t: number } | null>(null);
  const pausado = useRef(false);
  const [time, setTime] = useState<string[] | null>(null);
  const [encontro, setEncontro] = useState<Selvagem | null>(null);
  const [batalha, setBatalha] = useState<{ s: Selvagem; id: number } | null>(null);
  const [loja, setLoja] = useState(false);
  const [regiaoNome, setRegiaoNome] = useState(REGIOES[0].nome);
  const [aviso, setAviso] = useState<string | null>(null);
  pausado.current = !!encontro || !!batalha || loja;

  const amuletos = state.itens?.[AMULETO] ?? 0;
  const capturadas = LENDAS.filter((l) => possuiLenda(state.owned, l)).length;

  // Time salvo + presente inicial + posição salva
  useEffect(() => {
    if (!ready) return;
    const t = lerTime();
    setTime(timeValido(t, (id) => possuiLenda(state.owned, LENDAS.find((l) => l.id === id)!)) ? t : null);
    claimGift("explorar-inicio", AMULETO, 5, "Presente de boas-vindas: 5 amuletos 🔮");
    try {
      const p = JSON.parse(localStorage.getItem(POS_KEY) ?? "null");
      if (p && typeof p.x === "number" && livre(p.x, p.y, RAIO_JOGADOR)) jogador.current = p;
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ---------- Laço do mapa ----------
  useEffect(() => {
    if (!time || batalha) return;
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const mini = criarMiniMapa();
    let raf = 0;
    let ultimo = performance.now();
    let salvar = 0;
    let hud = 0;

    const ajustar = () => {
      const largura = cv.parentElement?.clientWidth ?? 800;
      const altura = Math.min(Math.max(320, window.innerHeight - 260), 680);
      const dpr = window.devicePixelRatio || 1;
      cv.style.width = `${largura}px`;
      cv.style.height = `${altura}px`;
      cv.width = Math.round(largura * dpr);
      cv.height = Math.round(altura * dpr);
    };
    ajustar();
    window.addEventListener("resize", ajustar);

    const tick = (agora: number) => {
      const dt = Math.min(0.1, (agora - ultimo) / 1000);
      if (dt <= 0) return;
      ultimo = agora;
      if (!pausado.current) atualizar(dt);
      desenharMapa(ctx, cv, mini);
      if ((salvar += dt) > 2) {
        salvar = 0;
        try {
          localStorage.setItem(POS_KEY, JSON.stringify(jogador.current));
        } catch {}
      }
      if ((hud += dt) > 0.3) {
        hud = 0;
        const r = regiaoEm(jogador.current.x, jogador.current.y);
        if (r.id !== regiaoAtual.current) {
          regiaoAtual.current = r.id;
          faixa.current = { texto: r.nome, t: 0 };
          setRegiaoNome(r.nome);
        }
      }
    };

    const atualizar = (dt: number) => {
      const p = jogador.current;
      const e = entrada.current;
      const t = e.teclas;
      let mx = (t.has("d") || t.has("arrowright") ? 1 : 0) - (t.has("a") || t.has("arrowleft") ? 1 : 0);
      let my = (t.has("s") || t.has("arrowdown") ? 1 : 0) - (t.has("w") || t.has("arrowup") ? 1 : 0);
      if (e.joy) {
        const dx = e.joy.x - e.joy.ox, dy = e.joy.y - e.joy.oy;
        const d = Math.hypot(dx, dy);
        if (d > 8) { mx = dx / Math.max(d, 50); my = dy / Math.max(d, 50); }
      } else if (e.destino) {
        const dx = e.destino.x - p.x, dy = e.destino.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d > 12) { mx = dx / d; my = dy / d; }
      }
      const d = Math.hypot(mx, my);
      if (d > 1) { mx /= d; my /= d; }
      const nx = p.x + mx * VEL_JOGADOR * dt;
      const ny = p.y + my * VEL_JOGADOR * dt;
      if (livre(nx, p.y, RAIO_JOGADOR)) p.x = nx;
      if (livre(p.x, ny, RAIO_JOGADOR)) p.y = ny;

      // Lendas selvagens
      const lista = selvagens.current;
      while (lista.length < MAX_SELVAGENS) {
        const s = gerarSelvagem(p);
        if (!s) break;
        lista.push(s);
      }
      moverSelvagens(lista, p, dt);
      imune.current = Math.max(0, imune.current - dt);
      if (imune.current <= 0) {
        const toque = lista.find((s) => Math.hypot(s.x - p.x, s.y - p.y) < RAIO_JOGADOR + 22);
        if (toque) {
          entrada.current.teclas.clear();
          entrada.current.joy = null;
          entrada.current.destino = null;
          setEncontro(toque);
        }
      }
      if (faixa.current && (faixa.current.t += dt) > 3) faixa.current = null;
    };

    const quadro = (agora: number) => {
      tick(agora);
      raf = requestAnimationFrame(quadro);
    };
    raf = requestAnimationFrame(quadro);
    const reserva = setInterval(() => {
      const agora = performance.now();
      if (agora - ultimo > 120) tick(agora);
    }, 50);

    // ---------- Desenho ----------
    function desenharMapa(c: CanvasRenderingContext2D, el: HTMLCanvasElement, miniMapa: HTMLCanvasElement) {
      const dpr = window.devicePixelRatio || 1;
      const larguraCss = el.width / dpr;
      const alturaCss = el.height / dpr;
      const zoom = Math.max(0.65, Math.min(1, larguraCss / 900));
      const vw = larguraCss / zoom, vh = alturaCss / zoom;
      const p = jogador.current;
      const camX = Math.max(0, Math.min(MUNDO_L - vw, p.x - vw / 2));
      const camY = Math.max(0, Math.min(MUNDO_A - vh, p.y - vh / 2));
      c.setTransform(dpr * zoom, 0, 0, dpr * zoom, -camX * dpr * zoom, -camY * dpr * zoom);

      const g = grade();
      const x0 = Math.max(0, Math.floor(camX / TILE)), x1 = Math.min(COLS - 1, Math.ceil((camX + vw) / TILE));
      const y0 = Math.max(0, Math.floor(camY / TILE)), y1 = Math.min(ROWS - 1, Math.ceil((camY + vh) / TILE));
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const cel = g[y][x];
          const r = REGIOES[cel.regiao];
          c.fillStyle = r.chao[cel.tom > 0.5 ? 1 : 0];
          c.fillRect(x * TILE, y * TILE, TILE + 1, TILE + 1);
          const caminho = cel.regiao === 0 || Math.abs(x - VILA.cx) <= 1 || Math.abs(y - VILA.cy) <= 1;
          if (caminho && !cel.bloqueado && cel.regiao !== 0) {
            c.fillStyle = "rgba(255,230,180,0.10)";
            c.fillRect(x * TILE, y * TILE, TILE, TILE);
          }
          if (cel.mato && !caminho) {
            c.strokeStyle = "rgba(0,0,0,0.18)";
            c.lineWidth = 2;
            const bx = x * TILE + 10 + cel.tom * 20, by = y * TILE + 30;
            c.beginPath();
            c.moveTo(bx, by); c.lineTo(bx - 4, by - 10);
            c.moveTo(bx + 5, by); c.lineTo(bx + 5, by - 12);
            c.moveTo(bx + 10, by); c.lineTo(bx + 14, by - 9);
            c.stroke();
          }
        }
      // Decorações (obstáculos)
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = `36px ${FONTE}`;
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const cel = g[y][x];
          if (cel.deco) c.fillText(cel.deco, x * TILE + TILE / 2, y * TILE + TILE / 2 + 2);
        }

      // Lendas selvagens
      for (const s of selvagens.current) {
        if (s.x < camX - 60 || s.x > camX + vw + 60 || s.y < camY - 60 || s.y > camY + vh + 60) continue;
        const cor = ELEMENTOS[s.lenda.elemento].cor;
        c.fillStyle = "rgba(0,0,0,0.3)";
        c.beginPath(); c.ellipse(s.x, s.y + 18, 20, 7, 0, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 0.35;
        c.fillStyle = cor;
        c.beginPath(); c.arc(s.x, s.y, 24, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
        const pulo = Math.abs(Math.sin(performance.now() / 300 + s.uid)) * 4;
        c.font = `32px ${FONTE}`;
        c.fillText(s.lenda.emoji, s.x, s.y - pulo);
        c.font = "800 11px system-ui, sans-serif";
        c.fillStyle = s.nivel === 3 ? "#ff8080" : s.nivel === 2 ? "#ffc83d" : "#e0ffe9";
        c.fillText(`Nv${s.nivel}${s.raro ? " ✨" : ""}`, s.x, s.y - 34);
      }

      // Jogador
      c.fillStyle = "rgba(0,0,0,0.35)";
      c.beginPath(); c.ellipse(p.x, p.y + 16, 18, 6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#fff";
      c.beginPath(); c.arc(p.x, p.y, RAIO_JOGADOR + 4, 0, Math.PI * 2); c.fill();
      c.strokeStyle = imune.current > 0 && Math.floor(performance.now() / 150) % 2 ? "#ffc83d" : "#5ad1ff";
      c.lineWidth = 4;
      c.beginPath(); c.arc(p.x, p.y, RAIO_JOGADOR + 4, 0, Math.PI * 2); c.stroke();
      c.font = `26px ${FONTE}`;
      c.fillText(state.avatar, p.x, p.y + 1);

      // Interface fixa na tela
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      // minimapa
      const mw = Math.min(180, larguraCss * 0.3), mh = mw * (MUNDO_A / MUNDO_L);
      const mx = larguraCss - mw - 10, my = 10;
      c.globalAlpha = 0.85;
      c.drawImage(miniMapa, mx, my, mw, mh);
      c.globalAlpha = 1;
      c.strokeStyle = "rgba(255,255,255,0.6)";
      c.lineWidth = 1.5;
      c.strokeRect(mx, my, mw, mh);
      const k = mw / MUNDO_L;
      for (const s of selvagens.current) {
        c.fillStyle = s.raro ? "#ffc83d" : "rgba(255,255,255,0.8)";
        c.fillRect(mx + s.x * k - 1.5, my + s.y * k - 1.5, 3, 3);
      }
      c.fillStyle = "#5ad1ff";
      c.beginPath(); c.arc(mx + p.x * k, my + p.y * k, 4, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "rgba(255,255,255,0.5)";
      c.strokeRect(mx + camX * k, my + camY * k, vw * k, vh * k);

      // faixa com o nome da região
      if (faixa.current) {
        const a = Math.min(1, (3 - faixa.current.t) / 0.6, faixa.current.t / 0.3);
        c.globalAlpha = Math.max(0, a);
        c.font = "900 26px system-ui, sans-serif";
        c.textAlign = "center";
        const w = c.measureText(faixa.current.texto).width + 40;
        c.fillStyle = "rgba(0,0,0,0.55)";
        c.fillRect(larguraCss / 2 - w / 2, 18, w, 42);
        c.fillStyle = "#fff";
        c.fillText(faixa.current.texto, larguraCss / 2, 40);
        c.globalAlpha = 1;
      }

      // joystick
      const e = entrada.current;
      if (e.joy) {
        const r = el.getBoundingClientRect();
        const ox = e.joy.ox - r.left, oy = e.joy.oy - r.top;
        let dx = e.joy.x - e.joy.ox, dy = e.joy.y - e.joy.oy;
        const d = Math.hypot(dx, dy);
        if (d > 50) { dx = (dx / d) * 50; dy = (dy / d) * 50; }
        c.globalAlpha = 0.35; c.fillStyle = "#fff";
        c.beginPath(); c.arc(ox, oy, 50, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 0.75;
        c.beginPath(); c.arc(ox + dx, oy + dy, 22, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
      }
    }

    // ---------- Controles ----------
    const e = entrada.current;
    const baixo = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement) return;
      const k = ev.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) ev.preventDefault();
      e.teclas.add(k);
    };
    const cima = (ev: KeyboardEvent) => e.teclas.delete(ev.key.toLowerCase());
    const foco = () => { e.teclas.clear(); e.destino = null; };
    const paraMundo = (cx: number, cy: number) => {
      const r = cv.getBoundingClientRect();
      const zoom = Math.max(0.65, Math.min(1, r.width / 900));
      const vw = r.width / zoom, vh = r.height / zoom;
      const p = jogador.current;
      const camX = Math.max(0, Math.min(MUNDO_L - vw, p.x - vw / 2));
      const camY = Math.max(0, Math.min(MUNDO_A - vh, p.y - vh / 2));
      return { x: camX + (cx - r.left) / zoom, y: camY + (cy - r.top) / zoom };
    };
    const apertar = (ev: PointerEvent) => {
      if (ev.pointerType === "mouse") e.destino = paraMundo(ev.clientX, ev.clientY);
      else e.joy = { id: ev.pointerId, ox: ev.clientX, oy: ev.clientY, x: ev.clientX, y: ev.clientY };
      cv.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    };
    const mover = (ev: PointerEvent) => {
      if (ev.pointerType === "mouse" && e.destino) e.destino = paraMundo(ev.clientX, ev.clientY);
      else if (e.joy && ev.pointerId === e.joy.id) { e.joy.x = ev.clientX; e.joy.y = ev.clientY; }
    };
    const soltar = (ev: PointerEvent) => {
      if (ev.pointerType === "mouse") e.destino = null;
      else if (e.joy && ev.pointerId === e.joy.id) e.joy = null;
    };
    window.addEventListener("keydown", baixo);
    window.addEventListener("keyup", cima);
    window.addEventListener("blur", foco);
    cv.addEventListener("pointerdown", apertar);
    cv.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(reserva);
      window.removeEventListener("resize", ajustar);
      window.removeEventListener("keydown", baixo);
      window.removeEventListener("keyup", cima);
      window.removeEventListener("blur", foco);
      cv.removeEventListener("pointerdown", apertar);
      cv.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, batalha]);

  // ---------- Fim da batalha selvagem ----------
  const fimBatalha = (s: Selvagem, r: ResultadoSelvagem) => {
    const remover = () => (selvagens.current = selvagens.current.filter((x) => x.uid !== s.uid));
    if (r === "capturou") {
      remover();
      const nova = grantLenda(s.lenda.id, s.lenda.nome);
      // lenda repetida vira moedas
      const moedas = nova ? 15 : 30;
      recordCustom("captura", 1, moedas);
      setAviso(nova ? `${s.lenda.emoji} ${s.lenda.nome} entrou para a sua coleção! Monte seu time na Arena para usá-la.` : `Você já tinha ${s.lenda.nome}. Ela virou +${moedas} 🪙.`);
    } else if (r === "venceu") {
      remover();
      recordCustom("selvagem", 1, 6 + s.nivel * 4);
    } else if (r === "perdeu") {
      jogador.current = centroVila();
      setAviso("Seu time foi derrotado e voltou para a Vila para descansar.");
    }
    imune.current = 2.5;
    setBatalha(null);
  };

  const fugir = () => {
    if (encontro) {
      const p = jogador.current;
      const d = Math.hypot(p.x - encontro.x, p.y - encontro.y) || 1;
      for (let k = 60; k > 0; k -= 10) {
        const nx = p.x + ((p.x - encontro.x) / d) * k, ny = p.y + ((p.y - encontro.y) / d) * k;
        if (livre(nx, ny, RAIO_JOGADOR)) { p.x = nx; p.y = ny; break; }
      }
    }
    imune.current = 2.5;
    setEncontro(null);
  };

  // ---------- Telas ----------
  if (!ready) return <p className="muted center">Carregando…</p>;
  if (!time) {
    return (
      <div className="card sala-espera">
        <div className="overlay-emoji">🧭</div>
        <h2>Monte seu time antes de explorar</h2>
        <p className="muted">Escolha 3 lendas na Arena. Elas vão com você para enfrentar e capturar lendas selvagens.</p>
        <Link href="/lendas" className="btn gold">Escolher time</Link>
      </div>
    );
  }

  if (batalha) {
    const s = batalha.s;
    return (
      <ActionBattle
        key={batalha.id}
        meu={time}
        deles={[s.lenda.id]}
        nivel={s.nivel}
        onRevanche={() => {}}
        onSair={() => fimBatalha(s, "fugiu")}
        selvagem={{ raro: s.raro, vidaMult: 0.9 + 0.3 * s.nivel, amuletos, usarAmuleto: () => consumeItem(AMULETO), onFim: (r) => fimBatalha(s, r) }}
      />
    );
  }

  return (
    <div className="explorar">
      <div className="explorar-bar">
        <span className="regiao-nome">📍 {regiaoNome}</span>
        <span className="pill">🔮 {amuletos}</span>
        <span className="pill">📖 {capturadas}/{LENDAS.length}</span>
        <button className="btn small-btn gold" onClick={() => setLoja(true)}>🛒 Loja</button>
        <Link href="/lendas" className="btn small-btn">Time</Link>
      </div>

      <div className="explorar-canvas-box">
        <canvas ref={canvas} className="explorar-canvas" />

        {encontro && (
          <div className="overlay-full">
            <div className="overlay encontro" style={{ ["--el" as string]: ELEMENTOS[encontro.lenda.elemento].cor }}>
              <div className="overlay-emoji">{encontro.lenda.emoji}</div>
              <h2>{encontro.raro ? "✨ " : ""}{encontro.lenda.nome} selvagem!</h2>
              <p>
                <span className="el-badge">{ELEMENTOS[encontro.lenda.elemento].icone} {ELEMENTOS[encontro.lenda.elemento].nome}</span>{" "}
                <span className="muted">Nível {encontro.nivel}{encontro.raro ? " · rara" : ""}</span>
              </p>
              <p className="muted small">
                {possuiLenda(state.owned, encontro.lenda) ? "Você já tem esta lenda." : "Você ainda não tem esta lenda!"} Enfraqueça e use um amuleto 🔮 para capturar.
              </p>
              <div className="row">
                <button className="btn gold" onClick={() => { setBatalha({ s: encontro, id: Date.now() }); setEncontro(null); }}>⚔️ Lutar</button>
                <button className="btn" onClick={fugir}>🏃 Fugir</button>
              </div>
            </div>
          </div>
        )}

        {aviso && !encontro && (
          <div className="explorar-aviso" onClick={() => setAviso(null)}>
            {aviso} <span className="muted small">(toque para fechar)</span>
          </div>
        )}
      </div>

      <p className="muted small acao-ajuda">
        <span className="so-pc">🎮 <b>WASD</b>/setas ou <b>segure o mouse</b> para andar · encoste numa lenda para enfrentá-la · <b>Nv</b> = força</span>
        <span className="so-toque">👆 Arraste o dedo no mapa para andar · encoste numa lenda para enfrentá-la</span>
      </p>

      {loja && (
        <div className="modal-bg" onClick={() => setLoja(false)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()} style={{ ["--el" as string]: "#b04cf0" }}>
            <button className="modal-x" onClick={() => setLoja(false)} aria-label="Fechar">×</button>
            <h2>🛒 Loja da Vila</h2>
            <p className="muted small">Você tem {state.coins} 🪙 e {amuletos} 🔮.</p>
            <ul className="golpes-lista">
              {PACOTES.map((p) => (
                <li key={p.qtd}>
                  <span>🔮 <strong>{p.qtd} amuleto{p.qtd > 1 ? "s" : ""}</strong></span>
                  <button className="btn small-btn gold" disabled={state.coins < p.preco} onClick={() => buyItem(AMULETO, p.preco, p.qtd, `${p.qtd} amuleto(s) 🔮`)}>
                    {p.preco} 🪙
                  </button>
                </li>
              ))}
            </ul>
            <p className="muted small">Dica: amuletos funcionam melhor com a lenda quase sem vida, dormindo ou atordoada.</p>
          </div>
        </div>
      )}
    </div>
  );
}

const FONTE = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

/** Desenha o mapa inteiro em miniatura (uma vez). */
function criarMiniMapa() {
  const c = document.createElement("canvas");
  c.width = COLS * 3;
  c.height = ROWS * 3;
  const ctx = c.getContext("2d")!;
  const g = grade();
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const cel = g[y][x];
      ctx.fillStyle = cel.bloqueado ? "rgba(0,0,0,0.55)" : REGIOES[cel.regiao].chao[1];
      ctx.fillRect(x * 3, y * 3, 3, 3);
    }
  return c;
}
