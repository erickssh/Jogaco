// Modo AÇÃO da Arena das Lendas: o jogador move a lenda, mira e desvia.
// Lógica pura (sem React), pronta para rodar no navegador ou num servidor no futuro.

import { EFEITOS, EfeitoId, Golpe, IMUNIDADES } from "./data";
import { Lado, Lutador, Nivel, calcularDano, novoLutador, recargaGolpe, vantagem } from "./engine";

// ---------- Arena ----------
export const ARENA = 800;
export const RAIO = 28;
export const PEDRAS = [
  { x: 250, y: 260, r: 42 },
  { x: 550, y: 540, r: 42 },
  { x: 560, y: 250, r: 30 },
  { x: 240, y: 550, r: 30 },
];
const NASCER: [Vec, Vec] = [{ x: 400, y: 690 }, { x: 400, y: 110 }];
const TROCA_ESPERA = 4;

export type Vec = { x: number; y: number };
export type Forma = "projetil" | "area" | "aoRedor" | "investida" | "feixe" | "si";

/** Como cada golpe especial funciona no modo ação. */
const FORMAS: Record<string, Forma> = {
  "Olhos de Fogo": "feixe", "Serpente Flamejante": "investida",
  "Pés Virados": "area", "Espinhos": "projetil", "Fúria da Mata": "area",
  "Canto Encantado": "projetil", "Correnteza": "feixe", "Maré Alta": "area",
  "Redemoinho": "aoRedor", "Travessura": "projetil",
  "Grito da Floresta": "aoRedor", "Avalanche": "area",
  "Encanto": "projetil", "Onda": "feixe",
  "Coice em Chamas": "aoRedor", "Labareda": "feixe",
  "Urtiga": "projetil", "Tronco Caído": "area",
  "Voo Rasante": "investida", "Ventania": "aoRedor",
  "Feitiço do Sono": "projetil", "Caldeirão": "area", "Pesadelo": "projetil",
  "Focinhada": "investida", "Tremor": "aoRedor",
  "Garras da Lua": "investida", "Lua Cheia": "area",
};

export function formaDe(g: Golpe, i: number): Forma {
  if (i === 0) return "projetil";
  if (g.poder === 0 && !g.noAlvo) return "si";
  return FORMAS[g.nome] ?? "projetil";
}

/** Alcance aproximado (usado pela IA e pela mira). */
export function alcanceDe(g: Golpe, i: number): number {
  const f = formaDe(g, i);
  return f === "projetil" ? (i === 0 ? 430 : 560) : f === "feixe" ? 460 : f === "area" ? 340 : f === "investida" ? 260 : f === "aoRedor" ? raioAoRedor(g) : 9999;
}
const raioArea = (g: Golpe) => 85 + g.poder / 3;
const raioAoRedor = (g: Golpe) => 115 + g.poder / 4;
const raioProj = (g: Golpe, i: number) => (i === 0 ? 9 : 12 + g.poder / 12);

// ---------- Estado ----------
export type Proj = { id: number; lado: Lado; x: number; y: number; vx: number; vy: number; r: number; resta: number; g: Golpe };
export type Zona = {
  id: number; lado: Lado; tipo: "area" | "aoRedor" | "feixe"; x: number; y: number; r: number;
  dx?: number; dy?: number; comp?: number; largura?: number; t: number; total: number; g: Golpe; explodiu: number; segue: boolean;
};
export type Dash = { vx: number; vy: number; t: number; g: Golpe; acertou: boolean };
export type Flut = { id: number; x: number; y: number; texto: string; tipo: "dano" | "super" | "fraco" | "cura" | "info"; t: number };

export type AcaoBatalha = {
  times: [Lutador[], Lutador[]];
  ativo: [number, number];
  pos: [Vec, Vec];
  vel: [Vec, Vec];
  mira: [Vec, Vec];
  dash: [Dash | null, Dash | null];
  proj: Proj[];
  zonas: Zona[];
  flut: Flut[];
  avisos: { id: number; texto: string; t: number }[];
  esperaTroca: [number, number];
  trava: [number, number];
  pisca: [number, number];
  tempo: number;
  vencedor: Lado | null;
  seq: number;
};

export type Comando = { mover: Vec; mira: Vec; golpe: number | null; troca: number | null };
export const comandoVazio = (mira: Vec): Comando => ({ mover: { x: 0, y: 0 }, mira, golpe: null, troca: null });

/** No modo ação parte dos golpes erra, então as lendas têm menos vida que no modo tática. */
export const VIDA_ACAO = 0.5;
export const CURA_ACAO = 0.6;

function lutadorAcao(id: string, mult = 1) {
  const l = novoLutador(id);
  l.vidaMax = Math.round(l.vidaMax * VIDA_ACAO * mult);
  l.vida = l.vidaMax;
  return l;
}

/** vidaMult: multiplicador de vida por lado (ex.: lenda selvagem sozinha é mais resistente). */
export function criarAcao(timeA: string[], timeB: string[], vidaMult: [number, number] = [1, 1]): AcaoBatalha {
  return {
    times: [timeA.map((id) => lutadorAcao(id, vidaMult[0])), timeB.map((id) => lutadorAcao(id, vidaMult[1]))],
    ativo: [0, 0],
    pos: [{ ...NASCER[0] }, { ...NASCER[1] }],
    vel: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
    mira: [{ ...NASCER[1] }, { ...NASCER[0] }],
    dash: [null, null],
    proj: [],
    zonas: [],
    flut: [],
    avisos: [],
    esperaTroca: [0, 0],
    trava: [0, 0],
    pisca: [0, 0],
    tempo: 0,
    vencedor: null,
    seq: 0,
  };
}

export const ativoDe = (b: AcaoBatalha, lado: Lado) => b.times[lado][b.ativo[lado]];
const outroLado = (l: Lado): Lado => (l === 0 ? 1 : 0);
export const travado = (l: Lutador) => !!(l.efeitos.sono || l.efeitos.atordoado);

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const norm = (v: Vec): Vec => {
  const d = Math.hypot(v.x, v.y);
  return d > 1e-6 ? { x: v.x / d, y: v.y / d } : { x: 0, y: 0 };
};
function distSegmento(p: Vec, a: Vec, dx: number, dy: number, comp: number) {
  const t = Math.max(0, Math.min(comp, (p.x - a.x) * dx + (p.y - a.y) * dy));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

function flut(b: AcaoBatalha, p: Vec, texto: string, tipo: Flut["tipo"]) {
  b.flut.push({ id: ++b.seq, x: p.x + (Math.random() - 0.5) * 20, y: p.y - RAIO - 10, texto, tipo, t: 0 });
}
function aviso(b: AcaoBatalha, texto: string) {
  b.avisos.push({ id: ++b.seq, texto, t: 0 });
  if (b.avisos.length > 4) b.avisos.shift();
}

export function velocidadeDe(l: Lutador) {
  let v = 195 + l.lenda.velocidade * 1.2;
  if (l.efeitos.lento) v *= 0.6;
  if (l.efeitos.acelerado) v *= 1.3;
  return v;
}

function aplicarEfeito(b: AcaoBatalha, lado: Lado, ef: EfeitoId) {
  const l = ativoDe(b, lado);
  if (IMUNIDADES[ef] === l.lenda.elemento) return flut(b, b.pos[lado], "imune", "info");
  l.efeitos[ef] = EFEITOS[ef].duracao;
  flut(b, b.pos[lado], `${EFEITOS[ef].icone} ${EFEITOS[ef].nome}`, "info");
}

function curar(b: AcaoBatalha, lado: Lado, qtd: number) {
  const l = ativoDe(b, lado);
  const real = Math.min(l.vidaMax - l.vida, qtd * CURA_ACAO);
  if (real <= 0) return;
  l.vida += real;
  flut(b, b.pos[lado], `+${Math.round(real)}`, "cura");
}

/** O golpe g de `lado` acertou o adversário. */
function acertar(b: AcaoBatalha, lado: Lado, g: Golpe) {
  const outro = outroLado(lado);
  const eu = ativoDe(b, lado);
  const alvo = ativoDe(b, outro);
  if (alvo.vida <= 0) return;
  if (alvo.efeitos.protegido) return flut(b, b.pos[outro], "✨ bloqueou", "info");
  if (g.poder > 0) {
    const { dano, efetividade } = calcularDano(eu, alvo, g);
    alvo.vida = Math.max(0, alvo.vida - dano);
    b.pisca[outro] = 0.15;
    flut(b, b.pos[outro], `-${dano}`, efetividade > 1 ? "super" : efetividade < 1 ? "fraco" : "dano");
    if (g.dreno) curar(b, lado, dano * g.dreno);
    if (g.recuo) {
      eu.vida = Math.max(0, eu.vida - dano * g.recuo);
      flut(b, b.pos[lado], `-${Math.round(dano * g.recuo)}`, "dano");
    }
  }
  if (g.noAlvo && alvo.vida > 0 && Math.random() < g.noAlvo.chance) aplicarEfeito(b, outro, g.noAlvo.efeito);
}

// ---------- Ações ----------
export function prontoParaGolpe(b: AcaoBatalha, lado: Lado, i: number) {
  const l = ativoDe(b, lado);
  return b.vencedor === null && l.vida > 0 && !travado(l) && !b.dash[lado] && b.trava[lado] <= 0 && l.recargas[i] <= 0;
}

function usar(b: AcaoBatalha, lado: Lado, i: number) {
  if (!prontoParaGolpe(b, lado, i)) return;
  const eu = ativoDe(b, lado);
  const g = eu.lenda.golpes[i];
  const forma = formaDe(g, i);
  eu.recargas[i] = recargaGolpe(eu, i);
  b.trava[lado] = i === 0 ? 0.12 : 0.3;
  const p = b.pos[lado];
  const dir = norm({ x: b.mira[lado].x - p.x, y: b.mira[lado].y - p.y });
  const d = dir.x === 0 && dir.y === 0 ? { x: 0, y: lado === 0 ? -1 : 1 } : dir;
  if (i !== 0) aviso(b, `${lado === 0 ? "🔵" : "🔴"} ${eu.lenda.nome}: ${g.nome}`);

  switch (forma) {
    case "si":
      break;
    case "projetil": {
      const r = raioProj(g, i);
      const v = i === 0 ? 640 : 500;
      b.proj.push({ id: ++b.seq, lado, x: p.x + d.x * (RAIO + r), y: p.y + d.y * (RAIO + r), vx: d.x * v, vy: d.y * v, r, resta: alcanceDe(g, i), g });
      break;
    }
    case "feixe":
      b.zonas.push({ id: ++b.seq, lado, tipo: "feixe", x: p.x, y: p.y, r: 0, dx: d.x, dy: d.y, comp: 460, largura: 38, t: 0.45, total: 0.45, g, explodiu: 0, segue: false });
      break;
    case "area": {
      const alvo = b.mira[lado];
      const a = Math.min(dist(p, alvo), 340);
      b.zonas.push({ id: ++b.seq, lado, tipo: "area", x: p.x + d.x * a, y: p.y + d.y * a, r: raioArea(g), t: 0.75, total: 0.75, g, explodiu: 0, segue: false });
      break;
    }
    case "aoRedor":
      b.zonas.push({ id: ++b.seq, lado, tipo: "aoRedor", x: p.x, y: p.y, r: raioAoRedor(g), t: 0.3, total: 0.3, g, explodiu: 0, segue: true });
      break;
    case "investida":
      b.dash[lado] = { vx: d.x * 950, vy: d.y * 950, t: 0.28, g, acertou: false };
      break;
  }
  g.emSi?.forEach((ef) => aplicarEfeito(b, lado, ef));
  if (g.cura) curar(b, lado, eu.vidaMax * g.cura);
}

export function podeTrocarAcao(b: AcaoBatalha, lado: Lado, idx: number) {
  const l = b.times[lado][idx];
  return b.vencedor === null && idx !== b.ativo[lado] && !!l && l.vida > 0 && b.esperaTroca[lado] <= 0 && !travado(ativoDe(b, lado)) && !b.dash[lado];
}

function trocar(b: AcaoBatalha, lado: Lado, idx: number, forcado = false) {
  if (!forcado && !podeTrocarAcao(b, lado, idx)) return;
  b.ativo[lado] = idx;
  b.esperaTroca[lado] = forcado ? 0 : TROCA_ESPERA;
  b.trava[lado] = 0.3;
  aviso(b, `${lado === 0 ? "🔵" : "🔴"} ${b.times[lado][idx].lenda.nome} entrou!`);
}

function verificarDerrotas(b: AcaoBatalha) {
  for (const lado of [0, 1] as Lado[]) {
    const l = ativoDe(b, lado);
    if (l.vida > 0 || l.caiu) continue;
    l.caiu = true;
    l.efeitos = {};
    b.dash[lado] = null;
    aviso(b, `${lado === 0 ? "🔵" : "🔴"} ${l.lenda.nome} caiu!`);
    const prox = b.times[lado].findIndex((x) => x.vida > 0);
    if (prox >= 0) trocar(b, lado, prox, true);
  }
  const v0 = b.times[0].some((l) => l.vida > 0);
  const v1 = b.times[1].some((l) => l.vida > 0);
  if (!v0 || !v1) b.vencedor = v0 && !v1 ? 0 : 1;
}

function limitar(p: Vec) {
  p.x = Math.max(RAIO, Math.min(ARENA - RAIO, p.x));
  p.y = Math.max(RAIO, Math.min(ARENA - RAIO, p.y));
  for (const r of PEDRAS) {
    const d = dist(p, r);
    const min = r.r + RAIO;
    if (d < min && d > 0.01) {
      p.x = r.x + ((p.x - r.x) / d) * min;
      p.y = r.y + ((p.y - r.y) / d) * min;
    }
  }
}

// ---------- Passo da simulação ----------
export function passo(b: AcaoBatalha, dt: number, cmds: [Comando, Comando]) {
  if (dt <= 0) return;
  b.flut = b.flut.filter((f) => (f.t += dt) < 1);
  b.avisos = b.avisos.filter((a) => (a.t += dt) < 2.5);
  if (b.vencedor !== null) return;
  b.tempo += dt;

  for (const lado of [0, 1] as Lado[]) {
    b.esperaTroca[lado] = Math.max(0, b.esperaTroca[lado] - dt);
    b.trava[lado] = Math.max(0, b.trava[lado] - dt);
    b.pisca[lado] = Math.max(0, b.pisca[lado] - dt);
    for (const l of b.times[lado]) {
      if (l.vida <= 0) continue;
      const emCampo = l === ativoDe(b, lado);
      const ritmo = emCampo && l.efeitos.acelerado ? 1.3 : 1;
      l.recargas = l.recargas.map((r) => Math.max(0, r - dt * ritmo)) as Lutador["recargas"];
      for (const k of Object.keys(l.efeitos) as EfeitoId[]) {
        l.efeitos[k] = (l.efeitos[k] ?? 0) - dt;
        if ((l.efeitos[k] ?? 0) <= 0) delete l.efeitos[k];
      }
      if (emCampo && (l.efeitos.queimado || l.efeitos.envenenado)) {
        const taxa = (l.efeitos.queimado ? 0.012 : 0) + (l.efeitos.envenenado ? 0.016 : 0);
        l.vida = Math.max(0, l.vida - l.vidaMax * taxa * dt);
      }
    }

    const l = ativoDe(b, lado);
    const c = cmds[lado];
    b.mira[lado] = c.mira;
    const p = b.pos[lado];
    const antes = { ...p };
    const dash = b.dash[lado];
    if (dash) {
      p.x += dash.vx * dt;
      p.y += dash.vy * dt;
      dash.t -= dt;
      const outro = outroLado(lado);
      if (!dash.acertou && dist(p, b.pos[outro]) < RAIO * 2 + 8) {
        dash.acertou = true;
        acertar(b, lado, dash.g);
      }
      if (dash.t <= 0) b.dash[lado] = null;
    } else if (!travado(l) && l.vida > 0) {
      const m = norm(c.mover);
      const v = velocidadeDe(l);
      p.x += m.x * v * dt;
      p.y += m.y * v * dt;
      if (c.troca !== null) trocar(b, lado, c.troca);
      if (c.golpe !== null) usar(b, lado, c.golpe);
    }
    limitar(p);
    b.vel[lado] = { x: (p.x - antes.x) / dt, y: (p.y - antes.y) / dt };
  }

  // Lendas não se atravessam
  const [a, c] = b.pos;
  const d = dist(a, c);
  if (d < RAIO * 2 && d > 0.01) {
    const empurra = (RAIO * 2 - d) / 2;
    const n = { x: (a.x - c.x) / d, y: (a.y - c.y) / d };
    a.x += n.x * empurra; a.y += n.y * empurra;
    c.x -= n.x * empurra; c.y -= n.y * empurra;
    limitar(a); limitar(c);
  }

  // Projéteis
  for (const pr of b.proj) {
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.resta -= Math.hypot(pr.vx, pr.vy) * dt;
    const alvo = b.pos[outroLado(pr.lado)];
    if (dist(pr, alvo) < pr.r + RAIO) {
      acertar(b, pr.lado, pr.g);
      pr.resta = -1;
    } else if (PEDRAS.some((r) => dist(pr, r) < r.r + pr.r) || pr.x < 0 || pr.y < 0 || pr.x > ARENA || pr.y > ARENA) {
      pr.resta = -1;
    }
  }
  b.proj = b.proj.filter((p) => p.resta > 0);

  // Zonas (aviso no chão → explosão)
  for (const z of b.zonas) {
    if (z.explodiu > 0) {
      z.explodiu -= dt;
      continue;
    }
    if (z.segue) {
      z.x = b.pos[z.lado].x;
      z.y = b.pos[z.lado].y;
    }
    z.t -= dt;
    if (z.t <= 0) {
      z.explodiu = 0.25;
      const alvo = b.pos[outroLado(z.lado)];
      const pega =
        z.tipo === "feixe"
          ? distSegmento(alvo, z, z.dx!, z.dy!, z.comp!) < z.largura! / 2 + RAIO * 0.7
          : dist(alvo, z) < z.r + RAIO * 0.6;
      if (pega) acertar(b, z.lado, z.g);
    }
  }
  b.zonas = b.zonas.filter((z) => z.t > 0 || z.explodiu > 0);

  verificarDerrotas(b);
}

// ---------- Computador ----------
export type CerebroAcao = { reacao: number; lado: number; trocaLado: number; desvio: Vec | null; desvioT: number };
export const novoCerebro = (): CerebroAcao => ({ reacao: 1, lado: 1, trocaLado: 2, desvio: null, desvioT: 0 });

const PERFIL: Record<Nivel, { reacao: number; desvia: number; previsao: number; distancia: number; zigue: number }> = {
  1: { reacao: 0.7, desvia: 0.1, previsao: 0.2, distancia: 280, zigue: 0.35 },
  2: { reacao: 0.6, desvia: 0.25, previsao: 0.4, distancia: 270, zigue: 0.55 },
  3: { reacao: 0.35, desvia: 0.5, previsao: 0.8, distancia: 250, zigue: 0.8 },
};

/** Mira assistida (usada no toque): mira onde o alvo vai estar, não onde está. */
export function miraAssistida(b: AcaoBatalha, lado: Lado, fator = 0.7): Vec {
  const outro = outroLado(lado);
  const q = b.pos[outro];
  const voo = dist(b.pos[lado], q) / 520;
  return { x: q.x + b.vel[outro].x * voo * fator, y: q.y + b.vel[outro].y * voo * fator };
}

export function comandoComputador(b: AcaoBatalha, lado: Lado, nivel: Nivel, c: CerebroAcao, dt: number): Comando {
  const outro = outroLado(lado);
  const eu = ativoDe(b, lado);
  const ele = ativoDe(b, outro);
  const p = b.pos[lado];
  const q = b.pos[outro];
  const perfil = PERFIL[nivel];
  const cmd = comandoVazio({ ...q });
  if (b.vencedor !== null || eu.vida <= 0) return cmd;

  // ----- Movimento -----
  const paraEle = norm({ x: q.x - p.x, y: q.y - p.y });
  const d = dist(p, q);
  let mv = { x: 0, y: 0 };
  if (d > perfil.distancia + 50) mv = { ...paraEle };
  else if (d < perfil.distancia - 70) mv = { x: -paraEle.x, y: -paraEle.y };
  c.trocaLado -= dt;
  if (c.trocaLado <= 0) {
    c.lado *= -1;
    c.trocaLado = 1.2 + Math.random() * 2;
  }
  mv.x += -paraEle.y * c.lado * perfil.zigue;
  mv.y += paraEle.x * c.lado * perfil.zigue;
  // afasta das bordas
  const margem = 90;
  if (p.x < margem) mv.x += 1;
  if (p.x > ARENA - margem) mv.x -= 1;
  if (p.y < margem) mv.y += 1;
  if (p.y > ARENA - margem) mv.y -= 1;

  // ----- Desviar de perigos -----
  c.desvioT -= dt;
  if (c.desvioT <= 0) c.desvio = null;
  if (!c.desvio) {
    for (const z of b.zonas) {
      if (z.lado === lado || z.explodiu > 0) continue;
      const dentro = z.tipo === "feixe" ? distSegmento(p, z, z.dx!, z.dy!, z.comp!) < z.largura! / 2 + RAIO + 10 : dist(p, z) < z.r + RAIO + 10;
      if (dentro && Math.random() < perfil.desvia) {
        c.desvio = z.tipo === "feixe" ? { x: -z.dy! * (Math.random() < 0.5 ? 1 : -1), y: z.dx! } : norm({ x: p.x - z.x, y: p.y - z.y });
        c.desvioT = 0.5;
        break;
      }
    }
    for (const pr of b.proj) {
      if (pr.lado === lado || c.desvio) continue;
      const rel = { x: p.x - pr.x, y: p.y - pr.y };
      const v = norm({ x: pr.vx, y: pr.vy });
      const frente = rel.x * v.x + rel.y * v.y;
      const lateral = Math.abs(rel.x * -v.y + rel.y * v.x);
      if (frente > 0 && frente < 220 && lateral < RAIO + pr.r + 6 && Math.random() < perfil.desvia * dt * 8) {
        const s = rel.x * -v.y + rel.y * v.x >= 0 ? 1 : -1;
        c.desvio = { x: -v.y * s, y: v.x * s };
        c.desvioT = 0.35;
      }
    }
  }
  if (c.desvio) mv = { x: c.desvio.x * 2 + mv.x * 0.3, y: c.desvio.y * 2 + mv.y * 0.3 };
  cmd.mover = norm(mv);

  // ----- Mira com previsão -----
  const voo = d / 480;
  cmd.mira = { x: q.x + b.vel[outro].x * voo * perfil.previsao, y: q.y + b.vel[outro].y * voo * perfil.previsao };

  // ----- Golpes e trocas -----
  c.reacao -= dt;
  if (c.reacao > 0 || travado(eu) || b.dash[lado]) return cmd;

  if (nivel >= 2 && b.esperaTroca[lado] <= 0 && vantagem(ele.lenda.elemento, eu.lenda.elemento) > 1 && eu.vida / eu.vidaMax < (nivel === 3 ? 0.55 : 0.3)) {
    const melhor = b.times[lado].findIndex((l, i) => i !== b.ativo[lado] && l.vida > 0 && vantagem(ele.lenda.elemento, l.lenda.elemento) <= 1);
    if (melhor >= 0) {
      cmd.troca = melhor;
      c.reacao = perfil.reacao;
      return cmd;
    }
  }

  let melhor = -1;
  let nota = 0;
  eu.lenda.golpes.forEach((g, i) => {
    if (!prontoParaGolpe(b, lado, i)) return;
    const f = formaDe(g, i);
    if (f !== "si" && d > alcanceDe(g, i) + (f === "aoRedor" ? 0 : 40)) return;
    let n = g.poder > 0 ? calcularDano(eu, ele, g, 0.5).dano : 0;
    if (g.noAlvo && !ele.efeitos[g.noAlvo.efeito]) n += 25 * g.noAlvo.chance;
    if (g.emSi?.some((ef) => !eu.efeitos[ef])) n += 30;
    if (g.cura) n += (1 - eu.vida / eu.vidaMax) * 360 * g.cura;
    if (ele.efeitos.protegido && g.poder > 0) n *= 0.1;
    if (nivel === 1) n *= 0.5 + Math.random();
    if (n > nota) {
      nota = n;
      melhor = i;
    }
  });
  if (melhor >= 0) {
    cmd.golpe = melhor;
    c.reacao = perfil.reacao * (0.6 + Math.random() * 0.8);
  }
  return cmd;
}
