"use client";

// Guarda no navegador o "lugar" (cor + token secreto) do jogador em cada partida online.

export type Seat = { color: "w" | "b"; token: string };

const seatKey = (id: string) => `jogaco:chess:seat:${id}`;
const NICK_KEY = "jogaco:nick";

export function getSeat(id: string): Seat | null {
  try {
    const raw = localStorage.getItem(seatKey(id));
    return raw ? (JSON.parse(raw) as Seat) : null;
  } catch {
    return null;
  }
}

export function saveSeat(id: string, seat: Seat) {
  try {
    localStorage.setItem(seatKey(id), JSON.stringify(seat));
  } catch {}
}

export function getNick() {
  try {
    return localStorage.getItem(NICK_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveNick(n: string) {
  try {
    localStorage.setItem(NICK_KEY, n);
  } catch {}
}

export function rewardedKey(id: string) {
  return `jogaco:chess:rewarded:${id}`;
}

export async function chessApi<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/xadrez", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Erro de conexão.");
  return data as T;
}
