// Utilidades das salas online da Arena das Lendas (Supabase Realtime: Presence + Broadcast).
// Modelo: quem cria a sala (anfitrião) roda a batalha no navegador e transmite o estado;
// o convidado envia só as ações dele.

import { LENDAS } from "./data";

export const TEAM_KEY = "jogaco:lendas:time";
const PID_KEY = "jogaco:lendas:pid";
const hostKey = (codigo: string) => `jogaco:lendas:host:${codigo}`;

export const LOBBY_CHANNEL = "lendas-lobby";
export const salaChannel = (codigo: string) => `lendas-sala-${codigo}`;

export type PresencaSala = {
  pid: string;
  nome: string;
  host: boolean;
  time: string[];
};

export type ModoOnline = "acao" | "tatica";
export type PresencaLobby = { codigo: string; nome: string; criado: number; modo?: ModoOnline };

/** Endereço da sala conforme o modo. */
export const urlSala = (codigo: string, modo: ModoOnline = "tatica") => (modo === "acao" ? `/lendas/duelo/${codigo}` : `/lendas/sala/${codigo}`);

export function meuPid() {
  try {
    let id = localStorage.getItem(PID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(PID_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function novoCodigo() {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  const r = crypto.getRandomValues(new Uint8Array(6));
  for (const x of r) c += letras[x % letras.length];
  return c;
}

export function marcarAnfitriao(codigo: string) {
  try {
    localStorage.setItem(hostKey(codigo), meuPid());
  } catch {}
}

export function souAnfitriao(codigo: string) {
  try {
    return localStorage.getItem(hostKey(codigo)) === meuPid();
  } catch {
    return false;
  }
}

export function lerTime(): string[] {
  try {
    const t = JSON.parse(localStorage.getItem(TEAM_KEY) ?? "[]");
    return Array.isArray(t) ? t.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Time válido = 3 lendas diferentes que existem e que o jogador possui. */
export function timeValido(time: unknown, possui: (id: string) => boolean): time is string[] {
  return (
    Array.isArray(time) &&
    time.length === 3 &&
    new Set(time).size === 3 &&
    time.every((id) => typeof id === "string" && LENDAS.some((l) => l.id === id) && possui(id))
  );
}

export const codigoValido = (c: string) => /^[A-Z2-9]{6}$/.test(c);
