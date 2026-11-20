// Susdoku — progresso do jogador (no navegador) e Caso do Dia.

import { hashTexto } from "./dados";
import { Caso, TipoPista, gerarCaso } from "./motor";
import FASES from "./fases.json";

export type Modo = "normal" | "dificil";

export type Progresso = {
  modo: Modo;
  /** melhor número de estrelas por fase */
  estrelas: Record<string, number>;
  /** selo "Detetive brilhante" por fase */
  selos: Record<string, boolean>;
  /** tutoriais já vistos */
  tutoriais: Record<string, boolean>;
  /** Caso do Dia: melhor tempo (segundos) por data */
  diario: Record<string, { tempo: number; estrelas: number }>;
};

const KEY = "jogaco:susdoku:v1";

const vazio = (): Progresso => ({ modo: "normal", estrelas: {}, selos: {}, tutoriais: {}, diario: {} });

export function lerProgresso(): Progresso {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...vazio(), ...JSON.parse(raw) } : vazio();
  } catch {
    return vazio();
  }
}

export function salvarProgresso(p: Progresso) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

export type Capitulo = { id: string; nome: string; emoji: string; fases: Caso[] };
export const CAPITULOS = (FASES as unknown as { capitulos: Capitulo[] }).capitulos;

export function faseDoId(id: string): { caso: Caso; capitulo: Capitulo; indice: number } | null {
  for (const capitulo of CAPITULOS) {
    const indice = capitulo.fases.findIndex((f) => f.id === id);
    if (indice >= 0) return { caso: capitulo.fases[indice], capitulo, indice };
  }
  return null;
}

/** Data local no formato AAAA-MM-DD. */
export function hoje(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const TODAS: TipoPista[] = ["sala", "obj", "salaNeg", "objNeg", "conta", "mesmaSala", "salaDiferente", "esq", "acima"];

/** Caso do Dia: 5×5, igual para todos os jogadores na mesma data. */
export function casoDoDia(data = hoje()): Caso | null {
  const semente = hashTexto(`susdoku-${data}`);
  const lugar = semente % 2 ? "casa" : "escola";
  const candidatos: Caso[] = [];
  for (let i = 0; i < 6; i++) {
    const c = gerarCaso({ id: `diario-${data}`, n: 5, lugar, semente: semente + i * 7919, tipos: TODAS, extras: 0, nivel: "relacoes" });
    if (c) candidatos.push(c);
  }
  if (!candidatos.length) return null;
  // dificuldade média entre os candidatos (nem o mais fácil, nem o mais difícil)
  candidatos.sort((a, b) => a.dificuldade - b.dificuldade);
  return candidatos[Math.floor(candidatos.length / 2)];
}

export function formatarTempo(seg: number) {
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
