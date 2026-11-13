// Mundo da Arena das Lendas: mapa para explorar, regiões por elemento e lendas selvagens.

import { Elemento, LENDAS, Lenda } from "./data";
import { Nivel } from "./engine";

export const TILE = 48;
export const COLS = 64;
export const ROWS = 44;
export const MUNDO_L = COLS * TILE;
export const MUNDO_A = ROWS * TILE;
export const RAIO_JOGADOR = 16;

export type RegiaoId = Elemento | "vila";
export type Regiao = { id: RegiaoId; nome: string; cx: number; cy: number; chao: [string, string]; deco: string[] };

export const VILA = { cx: 32, cy: 22, raio: 6 };

export const REGIOES: Regiao[] = [
  { id: "vila", nome: "Vila do Jogaço", cx: VILA.cx, cy: VILA.cy, chao: ["#7a6a4f", "#86765a"], deco: ["🏠", "🏡"] },
  { id: "mata", nome: "Mata Fechada", cx: 13, cy: 10, chao: ["#2c6e3a", "#327a41"], deco: ["🌳", "🌲", "🌴"] },
  { id: "espirito", nome: "Bosque das Almas", cx: 32, cy: 5, chao: ["#3b2b5c", "#433266"], deco: ["🍄", "🪦", "🕯️"] },
  { id: "agua", nome: "Margem do Rio", cx: 51, cy: 10, chao: ["#2f6f8f", "#357a9c"], deco: ["🌊", "🪷", "🐚"] },
  { id: "vento", nome: "Campos do Vento", cx: 52, cy: 33, chao: ["#8c9a4a", "#97a653"], deco: ["🌾", "🌻", "🎋"] },
  { id: "fogo", nome: "Terra Queimada", cx: 32, cy: 39, chao: ["#6b3326", "#76392b"], deco: ["🌋", "🔥", "🪵"] },
  { id: "pedra", nome: "Serra de Pedra", cx: 12, cy: 33, chao: ["#5b5f66", "#656a72"], deco: ["🪨", "⛰️", "🗿"] },
];

// Gerador pseudoaleatório com semente (mapa igual para todos)
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Celula = { regiao: number; bloqueado: boolean; deco: string | null; tom: number; mato: boolean };

function regiaoDoTile(x: number, y: number): number {
  if (Math.hypot(x - VILA.cx, y - VILA.cy) < VILA.raio) return 0;
  let melhor = 1;
  let menor = Infinity;
  for (let i = 1; i < REGIOES.length; i++) {
    const r = REGIOES[i];
    const d = Math.hypot(x - r.cx, (y - r.cy) * 1.15);
    if (d < menor) {
      menor = d;
      melhor = i;
    }
  }
  return melhor;
}

let cache: Celula[][] | null = null;

/** Gera (uma vez) a grade do mapa. */
export function grade(): Celula[][] {
  if (cache) return cache;
  const rnd = mulberry32(20261112);
  const g: Celula[][] = [];
  for (let y = 0; y < ROWS; y++) {
    const linha: Celula[] = [];
    for (let x = 0; x < COLS; x++) {
      const regiao = regiaoDoTile(x, y);
      const borda = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
      const dVila = Math.hypot(x - VILA.cx, y - VILA.cy);
      // caminhos em cruz saindo da vila ficam livres
      const caminho = Math.abs(x - VILA.cx) <= 1 || Math.abs(y - VILA.cy) <= 1;
      let bloqueado = borda;
      let deco: string | null = null;
      const r = REGIOES[regiao];
      if (!borda && regiao === 0) {
        // casas da vila em posições fixas
        const casas = [[-3, -3], [3, -3], [-3, 3], [3, 3]];
        if (casas.some(([dx, dy]) => x === VILA.cx + dx && y === VILA.cy + dy)) {
          bloqueado = true;
          deco = r.deco[(x + y) % r.deco.length];
        }
      } else if (!borda && !caminho && dVila > VILA.raio + 1 && rnd() < 0.11) {
        bloqueado = true;
        deco = r.deco[Math.floor(rnd() * r.deco.length)];
      }
      if (borda) deco = REGIOES[regiao].deco[0];
      const mato = !bloqueado && regiao !== 0 && rnd() < 0.35;
      linha.push({ regiao, bloqueado, deco, tom: rnd(), mato });
    }
    g.push(linha);
  }
  // Bloqueia cantinhos isolados (inalcançáveis a partir da vila)
  const visto = new Set<number>([VILA.cy * COLS + VILA.cx]);
  const fila = [[VILA.cx, VILA.cy]];
  while (fila.length) {
    const [x, y] = fila.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || g[ny][nx].bloqueado || visto.has(ny * COLS + nx)) continue;
      visto.add(ny * COLS + nx);
      fila.push([nx, ny]);
    }
  }
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if (!g[y][x].bloqueado && !visto.has(y * COLS + x)) {
        g[y][x].bloqueado = true;
        g[y][x].mato = false;
      }
  cache = g;
  return g;
}

export function celulaEm(px: number, py: number): Celula | null {
  const x = Math.floor(px / TILE);
  const y = Math.floor(py / TILE);
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
  return grade()[y][x];
}

/** Um círculo pode ficar em (px, py)? */
export function livre(px: number, py: number, raio: number) {
  for (const [dx, dy] of [[-raio, -raio], [raio, -raio], [-raio, raio], [raio, raio], [0, 0]]) {
    const c = celulaEm(px + dx, py + dy);
    if (!c || c.bloqueado) return false;
  }
  return true;
}

export const regiaoEm = (px: number, py: number) => REGIOES[celulaEm(px, py)?.regiao ?? 0];
export const centroVila = () => ({ x: (VILA.cx + 0.5) * TILE, y: (VILA.cy + 0.5) * TILE });

// ---------- Lendas selvagens ----------
export type Selvagem = {
  uid: number;
  lenda: Lenda;
  nivel: Nivel;
  raro: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  muda: number;
};

/** Sorteia uma lenda para a região: a comum (grátis) é mais frequente; a rara (paga) aparece menos. */
export function sortearLenda(regiao: Regiao, distanciaVila: number): { lenda: Lenda; nivel: Nivel; raro: boolean } | null {
  if (regiao.id === "vila") return null;
  const daqui = LENDAS.filter((l) => l.elemento === regiao.id);
  const comuns = daqui.filter((l) => l.preco === 0);
  const raras = daqui.filter((l) => l.preco > 0);
  const raro = raras.length > 0 && (comuns.length === 0 || Math.random() < 0.28);
  const lista = raro ? raras : comuns;
  const lenda = lista[Math.floor(Math.random() * lista.length)];
  const longe = distanciaVila > 17;
  const nivel: Nivel = raro ? (longe ? 3 : 2) : longe ? 2 : 1;
  return { lenda, nivel, raro };
}

let uid = 0;

/** Cria uma lenda selvagem num ponto livre, longe do jogador e fora da vila. */
export function gerarSelvagem(longeDe: { x: number; y: number }): Selvagem | null {
  for (let tent = 0; tent < 40; tent++) {
    const x = (1 + Math.random() * (COLS - 2)) * TILE;
    const y = (1 + Math.random() * (ROWS - 2)) * TILE;
    if (Math.hypot(x - longeDe.x, y - longeDe.y) < 420) continue;
    if (!livre(x, y, 20)) continue;
    const reg = regiaoEm(x, y);
    const dVila = Math.hypot(x / TILE - VILA.cx, y / TILE - VILA.cy);
    const s = sortearLenda(reg, dVila);
    if (!s) continue;
    return { uid: ++uid, ...s, x, y, vx: 0, vy: 0, muda: 0 };
  }
  return null;
}

/** Movimento das lendas selvagens: passeiam, e as de nível alto vêm na direção do jogador. */
export function moverSelvagens(lista: Selvagem[], jogador: { x: number; y: number }, dt: number) {
  for (const s of lista) {
    s.muda -= dt;
    const d = Math.hypot(jogador.x - s.x, jogador.y - s.y);
    if (s.nivel >= 2 && d < 220) {
      const v = 70 + s.nivel * 25;
      s.vx = ((jogador.x - s.x) / d) * v;
      s.vy = ((jogador.y - s.y) / d) * v;
    } else if (s.muda <= 0) {
      const ang = Math.random() * Math.PI * 2;
      const parado = Math.random() < 0.35;
      const v = parado ? 0 : 40 + Math.random() * 40;
      s.vx = Math.cos(ang) * v;
      s.vy = Math.sin(ang) * v;
      s.muda = 1.5 + Math.random() * 2.5;
    }
    const nx = s.x + s.vx * dt;
    const ny = s.y + s.vy * dt;
    // não entram na vila
    const naVila = Math.hypot(nx / TILE - VILA.cx, ny / TILE - VILA.cy) < VILA.raio + 1;
    if (livre(nx, s.y, 18) && !naVila) s.x = nx;
    else s.vx *= -1;
    if (livre(s.x, ny, 18) && !naVila) s.y = ny;
    else s.vy *= -1;
  }
}

/** Chance de captura (0–1). Fica maior com pouca vida e com o alvo dormindo/atordoado. */
export function chanceCaptura(vidaPct: number, travado: boolean, raro: boolean) {
  let c = 0.12 + 0.75 * Math.pow(1 - vidaPct, 1.4);
  if (travado) c += 0.15;
  if (raro) c *= 0.7;
  return Math.max(0.05, Math.min(0.95, c));
}
