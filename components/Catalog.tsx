"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORIES, GAMES, Category, gameHref } from "@/lib/games";
import { useRewards } from "./RewardsProvider";

export function Catalog() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "Todos">("Todos");
  const { state, ready } = useRewards();

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return GAMES.filter(
      (g) =>
        (cat === "Todos" || g.category === cat) &&
        (!term || g.title.toLowerCase().includes(term) || g.description.toLowerCase().includes(term)),
    );
  }, [q, cat]);

  return (
    <section>
      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Buscar jogos…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar jogos"
        />
        <div className="chips" role="tablist">
          {(["Todos", ...CATEGORIES] as const).map((c) => (
            <button key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)} role="tab" aria-selected={cat === c}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="muted center">Nenhum jogo encontrado.</p>
      ) : (
        <div className="grid">
          {list.map((g) => (
            <Link key={g.slug} href={gameHref(g)} className="tile">
              <div className="thumb" style={{ background: g.gradient }}>
                <span className="thumb-emoji">{g.emoji}</span>
                {g.kind === "proprio" && <span className="tag">🪙 Vale moedas</span>}
                {g.online && <span className="tag tag-online">🌐 Online</span>}
              </div>
              <div className="tile-body">
                <div className="tile-title">{g.title}</div>
                <div className="tile-meta">
                  <span>{g.category}</span>
                  {ready && !g.hideRecord && state.bestScores[g.slug] ? <span>Recorde: {state.bestScores[g.slug]}</span> : null}
                </div>
              </div>
            </Link>
          ))}
          <div className="tile soon">
            <div className="thumb soon-thumb">
              <span className="thumb-emoji">➕</span>
            </div>
            <div className="tile-body">
              <div className="tile-title">Mais jogos em breve</div>
              <div className="tile-meta"><span>Catálogo de parceiros</span></div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
