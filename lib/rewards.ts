// Regras do sistema de recompensas (puro, sem React) — fácil de mover para o servidor depois.

export const DAILY_GAME_COIN_CAP = 300; // anti-farm: limite de moedas vindas de partidas por dia

export type DayStats = {
  date: string;
  plays: number;
  coinsFromGames: number;
  coinsEarned: number;
  perGame: Record<string, { plays: number; best: number }>;
  claimedMissions: string[];
  loginBonusClaimed: boolean;
};

export type PlayerState = {
  coins: number;
  xp: number;
  streak: number;
  lastVisit: string | null;
  avatar: string;
  owned: string[];
  bestScores: Record<string, number>;
  totalPlays: number;
  today: DayStats;
};

/** Data local (não UTC), para o dia virar à meia-noite do jogador. */
export function todayStr(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayStr(d);
}

export function emptyDay(date = todayStr()): DayStats {
  return { date, plays: 0, coinsFromGames: 0, coinsEarned: 0, perGame: {}, claimedMissions: [], loginBonusClaimed: false };
}

export function initialState(): PlayerState {
  return {
    coins: 0,
    xp: 0,
    streak: 0,
    lastVisit: null,
    avatar: "🙂",
    owned: ["🙂"],
    bestScores: {},
    totalPlays: 0,
    today: emptyDay(),
  };
}

/** Atualiza a sequência de dias e zera as estatísticas diárias quando muda o dia. */
export function rollDay(s: PlayerState): PlayerState {
  const today = todayStr();
  if (s.lastVisit === today) return s;
  const streak = s.lastVisit === yesterdayStr() ? s.streak + 1 : 1;
  return { ...s, streak, lastVisit: today, today: emptyDay(today) };
}

export function level(xp: number) {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

export function xpForLevel(lv: number) {
  return (lv - 1) * (lv - 1) * 50;
}

export function loginBonus(streak: number) {
  return 10 * Math.min(Math.max(streak, 1), 7);
}

// ---------- Missões diárias ----------

export type Mission = {
  id: string;
  title: string;
  reward: number;
  target: number;
  progress: (d: DayStats) => number;
};

const POOL: Mission[] = [
  { id: "play3", title: "Jogue 3 partidas", reward: 30, target: 3, progress: (d) => d.plays },
  { id: "play6", title: "Jogue 6 partidas", reward: 60, target: 6, progress: (d) => d.plays },
  { id: "snake10", title: "Coma 10 frutas em Serpente Neon", reward: 40, target: 10, progress: (d) => d.perGame["serpente-neon"]?.best ?? 0 },
  { id: "memory1", title: "Complete uma Memória Mágica", reward: 30, target: 1, progress: (d) => d.perGame["memoria-magica"]?.plays ?? 0 },
  { id: "memory80", title: "Faça 80 pontos em Memória Mágica", reward: 50, target: 80, progress: (d) => d.perGame["memoria-magica"]?.best ?? 0 },
  { id: "dodge30", title: "Sobreviva 30s em Esquiva Espacial", reward: 40, target: 30, progress: (d) => d.perGame["esquiva-espacial"]?.best ?? 0 },
  { id: "earn50", title: "Ganhe 50 moedas jogando", reward: 25, target: 50, progress: (d) => d.coinsFromGames },
  { id: "all3", title: "Jogue 3 jogos diferentes hoje", reward: 50, target: 3, progress: (d) => Object.keys(d.perGame).length },
  { id: "chess1", title: "Termine uma partida de xadrez", reward: 30, target: 1, progress: (d) => d.perGame["xadrez"]?.plays ?? 0 },
  { id: "chesswin", title: "Vença uma partida de xadrez", reward: 60, target: 1, progress: (d) => ((d.perGame["xadrez"]?.best ?? 0) >= 2 ? 1 : 0) },
];

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 3 missões por dia, iguais para todos os jogadores naquela data. */
export function missionsFor(date: string): Mission[] {
  return [...POOL]
    .map((m) => ({ m, k: hash(date + m.id) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, 3)
    .map((x) => x.m);
}

// ---------- Loja ----------

export type ShopItem = { id: string; name: string; price: number };

export const SHOP: ShopItem[] = [
  { id: "🙂", name: "Sorriso", price: 0 },
  { id: "🐱", name: "Gatinho", price: 80 },
  { id: "🦊", name: "Raposa", price: 150 },
  { id: "🤖", name: "Robô", price: 250 },
  { id: "🐲", name: "Dragão", price: 400 },
  { id: "🦄", name: "Unicórnio", price: 600 },
  { id: "👑", name: "Coroa", price: 1000 },
  { id: "💎", name: "Diamante", price: 2500 },
];
