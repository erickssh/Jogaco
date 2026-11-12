"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getGame } from "@/lib/games";
import {
  DAILY_GAME_COIN_CAP,
  PlayerState,
  SHOP,
  initialState,
  loginBonus,
  missionsFor,
  rollDay,
} from "@/lib/rewards";

// MVP: o progresso fica no navegador (localStorage).
// Próximo passo: mover estas ações para uma API no servidor (ex.: Supabase) para evitar trapaça.
const KEY = "jogaco:player:v1";

type Ctx = {
  state: PlayerState;
  ready: boolean;
  recordGame: (slug: string, score: number) => { coins: number; capped: boolean; newBest: boolean };
  claimLogin: () => void;
  claimMission: (id: string) => void;
  buy: (id: string) => void;
  equip: (id: string) => void;
  toast: string | null;
};

const RewardsContext = createContext<Ctx | null>(null);

export function useRewards() {
  const ctx = useContext(RewardsContext);
  if (!ctx) throw new Error("useRewards fora do RewardsProvider");
  return ctx;
}

export function RewardsProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateRaw] = useState<PlayerState>(initialState);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const ref = useRef(state);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setState = useCallback((next: PlayerState) => {
    ref.current = next;
    setStateRaw(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    let loaded = initialState();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) loaded = { ...loaded, ...JSON.parse(raw) };
    } catch {}
    setState(rollDay(loaded));
    setReady(true);
  }, [setState]);

  const current = () => rollDay(ref.current);

  const recordGame: Ctx["recordGame"] = (slug, score) => {
    const game = getGame(slug);
    const s = current();
    const raw = game && game.kind === "proprio" ? game.coinsFor(Math.max(0, Math.floor(score))) : 0;
    const room = Math.max(0, DAILY_GAME_COIN_CAP - s.today.coinsFromGames);
    const coins = Math.min(raw, room);
    const prevDay = s.today.perGame[slug] ?? { plays: 0, best: 0 };
    const newBest = score > (s.bestScores[slug] ?? 0);
    setState({
      ...s,
      coins: s.coins + coins,
      xp: s.xp + coins + 5,
      totalPlays: s.totalPlays + 1,
      bestScores: { ...s.bestScores, [slug]: Math.max(score, s.bestScores[slug] ?? 0) },
      today: {
        ...s.today,
        plays: s.today.plays + 1,
        coinsFromGames: s.today.coinsFromGames + coins,
        coinsEarned: s.today.coinsEarned + coins,
        perGame: { ...s.today.perGame, [slug]: { plays: prevDay.plays + 1, best: Math.max(prevDay.best, score) } },
      },
    });
    if (coins > 0) notify(`+${coins} moedas 🪙`);
    return { coins, capped: raw > coins, newBest };
  };

  const claimLogin = () => {
    const s = current();
    if (s.today.loginBonusClaimed) return;
    const bonus = loginBonus(s.streak);
    setState({
      ...s,
      coins: s.coins + bonus,
      xp: s.xp + bonus,
      today: { ...s.today, loginBonusClaimed: true, coinsEarned: s.today.coinsEarned + bonus },
    });
    notify(`Bônus diário: +${bonus} moedas 🔥`);
  };

  const claimMission = (id: string) => {
    const s = current();
    const m = missionsFor(s.today.date).find((x) => x.id === id);
    if (!m || s.today.claimedMissions.includes(id) || m.progress(s.today) < m.target) return;
    setState({
      ...s,
      coins: s.coins + m.reward,
      xp: s.xp + m.reward,
      today: { ...s.today, claimedMissions: [...s.today.claimedMissions, id], coinsEarned: s.today.coinsEarned + m.reward },
    });
    notify(`Missão concluída: +${m.reward} moedas ✅`);
  };

  const buy = (id: string) => {
    const s = current();
    const item = SHOP.find((i) => i.id === id);
    if (!item || s.owned.includes(id) || s.coins < item.price) return;
    setState({ ...s, coins: s.coins - item.price, owned: [...s.owned, id], avatar: id });
    notify(`Você comprou: ${item.name} ${item.id}`);
  };

  const equip = (id: string) => {
    const s = current();
    if (!s.owned.includes(id)) return;
    setState({ ...s, avatar: id });
  };

  return (
    <RewardsContext.Provider value={{ state, ready, recordGame, claimLogin, claimMission, buy, equip, toast }}>
      {children}
      {toast && <div className="toast" role="status">{toast}</div>}
    </RewardsContext.Provider>
  );
}
