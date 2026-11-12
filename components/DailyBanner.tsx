"use client";

import Link from "next/link";
import { useRewards } from "./RewardsProvider";
import { loginBonus, missionsFor } from "@/lib/rewards";

export function DailyBanner() {
  const { state, ready, claimLogin } = useRewards();
  if (!ready) return <div className="daily card skeleton" />;

  const missions = missionsFor(state.today.date);
  const done = missions.filter((m) => state.today.claimedMissions.includes(m.id)).length;

  return (
    <div className="daily card">
      <div className="daily-row">
        <div>
          <div className="muted">Sequência</div>
          <div className="big">🔥 {state.streak} {state.streak === 1 ? "dia" : "dias"}</div>
        </div>
        {state.today.loginBonusClaimed ? (
          <span className="badge ok">Bônus de hoje coletado</span>
        ) : (
          <button className="btn gold" onClick={claimLogin}>
            Coletar +{loginBonus(state.streak)} 🪙
          </button>
        )}
      </div>
      <Link href="/recompensas" className="daily-missions">
        Missões de hoje: <strong>{done}/{missions.length}</strong> concluídas →
      </Link>
    </div>
  );
}
