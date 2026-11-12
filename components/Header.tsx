"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRewards } from "./RewardsProvider";
import { level } from "@/lib/rewards";

export function Header() {
  const { state, ready } = useRewards();
  const path = usePathname();
  const lv = level(state.xp);

  return (
    <header className="header">
      <div className="container header-inner">
        <Link href="/" className="logo">
          <span className="logo-mark">J</span>
          <span>Jogaço</span>
        </Link>
        <nav className="nav">
          <Link href="/" className={path === "/" ? "active" : ""}>Jogos</Link>
          <Link href="/recompensas" className={path === "/recompensas" ? "active" : ""}>
            Recompensas
            {ready && !state.today.loginBonusClaimed && <span className="dot" aria-label="bônus disponível" />}
          </Link>
        </nav>
        <Link href="/recompensas" className="wallet" title="Suas moedas e nível">
          <span className="pill coin">🪙 {ready ? state.coins : "–"}</span>
          <span className="pill streak" title="Dias seguidos">🔥 {ready ? state.streak : "–"}</span>
          <span className="avatar" title={`Nível ${lv}`}>
            {state.avatar}
            <span className="lv">{lv}</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
