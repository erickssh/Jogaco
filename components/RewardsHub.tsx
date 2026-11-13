"use client";

import Link from "next/link";
import { useRewards } from "./RewardsProvider";
import { GAMES, gameHref } from "@/lib/games";
import { DAILY_GAME_COIN_CAP, SHOP, level, loginBonus, missionsFor, xpForLevel } from "@/lib/rewards";

export function RewardsHub() {
  const { state, ready, claimLogin, claimMission, buy, equip } = useRewards();
  if (!ready) return <p className="muted center">Carregando…</p>;

  const lv = level(state.xp);
  const from = xpForLevel(lv);
  const to = xpForLevel(lv + 1);
  const pct = Math.round(((state.xp - from) / (to - from)) * 100);
  const missions = missionsFor(state.today.date);

  return (
    <div className="rewards">
      <section className="card profile">
        <div className="profile-avatar">{state.avatar}</div>
        <div className="profile-main">
          <div className="big">Nível {lv}</div>
          <div className="bar"><span style={{ width: `${pct}%` }} /></div>
          <div className="muted small">{state.xp - from} / {to - from} XP para o nível {lv + 1}</div>
        </div>
        <div className="stats">
          <div><strong>🪙 {state.coins}</strong><span>moedas</span></div>
          <div><strong>🔥 {state.streak}</strong><span>dias seguidos</span></div>
          <div><strong>🎮 {state.totalPlays}</strong><span>partidas</span></div>
        </div>
      </section>

      <div className="two-col">
        <section className="card">
          <h2>Bônus diário</h2>
          <p className="muted">Volte todo dia para aumentar sua sequência. O bônus cresce até o 7º dia.</p>
          <div className="streak-days">
            {Array.from({ length: 7 }, (_, i) => {
              const day = i + 1;
              const reached = Math.min(state.streak, 7) >= day;
              return (
                <div key={day} className={`sday ${reached ? "on" : ""}`}>
                  <span>Dia {day}</span>
                  <strong>{loginBonus(day)}</strong>
                </div>
              );
            })}
          </div>
          {state.today.loginBonusClaimed ? (
            <p className="badge ok">✓ Coletado hoje. Volte amanhã!</p>
          ) : (
            <button className="btn gold" onClick={claimLogin}>Coletar +{loginBonus(state.streak)} 🪙</button>
          )}
        </section>

        <section className="card">
          <h2>Missões de hoje</h2>
          <ul className="missions">
            {missions.map((m) => {
              const prog = Math.min(m.progress(state.today), m.target);
              const done = prog >= m.target;
              const claimed = state.today.claimedMissions.includes(m.id);
              return (
                <li key={m.id} className="mission">
                  <div className="mission-top">
                    <span>{m.title}</span>
                    <span className="muted">+{m.reward} 🪙</span>
                  </div>
                  <div className="bar"><span style={{ width: `${(prog / m.target) * 100}%` }} /></div>
                  <div className="mission-bottom">
                    <span className="muted small">{prog}/{m.target}</span>
                    {claimed ? (
                      <span className="badge ok">Resgatada</span>
                    ) : (
                      <button className="btn small-btn gold" disabled={!done} onClick={() => claimMission(m.id)}>
                        Resgatar
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="muted small">
            Moedas de partidas hoje: {state.today.coinsFromGames}/{DAILY_GAME_COIN_CAP}. Novas missões à meia-noite.
          </p>
        </section>
      </div>

      <section className="card">
        <h2>Loja de avatares</h2>
        <div className="shop">
          {SHOP.map((item) => {
            const owned = state.owned.includes(item.id);
            const equipped = state.avatar === item.id;
            const afford = state.coins >= item.price;
            return (
              <div key={item.id} className={`shop-item ${equipped ? "equipped" : ""}`}>
                <div className="shop-emoji">{item.id}</div>
                <div className="shop-name">{item.name}</div>
                {owned ? (
                  <button className="btn small-btn" disabled={equipped} onClick={() => equip(item.id)}>
                    {equipped ? "Em uso" : "Usar"}
                  </button>
                ) : (
                  <button className="btn small-btn gold" disabled={!afford} onClick={() => buy(item.id)}>
                    🪙 {item.price}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Seus recordes</h2>
        <ul className="records">
          {GAMES.filter((g) => !g.hideRecord).map((g) => (
            <li key={g.slug}>
              <Link href={gameHref(g)}>{g.emoji} {g.title}</Link>
              <strong>{state.bestScores[g.slug] ?? 0} {g.scoreLabel}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="card coming">
        <h2>🎁 Em breve: troque moedas por cupons</h2>
        <p className="muted">Estamos fechando parcerias para você trocar suas moedas por cupons de desconto e vale-presentes.</p>
      </section>
    </div>
  );
}
