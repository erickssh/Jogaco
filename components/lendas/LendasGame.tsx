"use client";

import { useEffect, useState } from "react";
import { ELEMENTOS, LENDAS, Lenda, VANTAGENS, Elemento } from "@/lib/lendas/data";
import { Nivel } from "@/lib/lendas/engine";
import { useRewards } from "../RewardsProvider";
import { Battle } from "./Battle";
import { ActionBattle } from "./ActionBattle";
import { OnlineLobby } from "./OnlineLobby";
import { TEAM_KEY } from "@/lib/lendas/online";

const TAMANHO_TIME = 3;

export const possuiLenda = (owned: string[], l: Lenda) => l.preco === 0 || owned.includes(`lenda:${l.id}`);

export function LendasGame() {
  const { state, ready, unlock } = useRewards();
  const [time, setTime] = useState<string[]>([]);
  const [nivel, setNivel] = useState<Nivel>(2);
  const [modo, setModo] = useState<"acao" | "tatica">("acao");
  const [batalha, setBatalha] = useState<{ meu: string[]; deles: string[]; nivel: Nivel; id: number; modo: "acao" | "tatica" } | null>(null);
  const [detalhe, setDetalhe] = useState<Lenda | null>(null);

  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(TEAM_KEY) ?? "[]");
      if (Array.isArray(salvo)) setTime(salvo.filter((x) => typeof x === "string").slice(0, TAMANHO_TIME));
    } catch {}
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (!carregado) return; // não sobrescreve o time salvo antes de carregá-lo
    try {
      localStorage.setItem(TEAM_KEY, JSON.stringify(time));
    } catch {}
  }, [time, carregado]);

  if (!ready) return <p className="muted center">Carregando…</p>;

  const minhas = LENDAS.filter((l) => possuiLenda(state.owned, l));
  const timeValido = time.filter((id) => minhas.some((l) => l.id === id));

  const alternar = (l: Lenda) => {
    if (!possuiLenda(state.owned, l)) return setDetalhe(l);
    setTime((t) => (t.includes(l.id) ? t.filter((x) => x !== l.id) : t.length >= TAMANHO_TIME ? t : [...t, l.id]));
  };

  const iniciar = () => {
    // Adversário: lendas aleatórias (no nível difícil, podem vir as raras)
    const pool = nivel === 3 ? LENDAS : LENDAS.filter((l) => l.preco <= (nivel === 2 ? 350 : 0));
    const deles = [...pool].sort(() => Math.random() - 0.5).slice(0, TAMANHO_TIME).map((l) => l.id);
    setBatalha({ meu: timeValido, deles, nivel, id: Date.now(), modo });
  };

  if (batalha) {
    const Comp = batalha.modo === "acao" ? ActionBattle : Battle;
    return (
      <Comp
        key={batalha.id}
        meu={batalha.meu}
        deles={batalha.deles}
        nivel={batalha.nivel}
        onRevanche={() => setBatalha({ ...batalha, id: Date.now() })}
        onSair={() => setBatalha(null)}
      />
    );
  }

  return (
    <div className="lendas-prep">
      <section className="card">
        <div className="prep-top">
          <div>
            <h2>Monte seu time ({timeValido.length}/{TAMANHO_TIME})</h2>
            <p className="muted small">Toque nas lendas para escolher. As com 🔒 podem ser liberadas com moedas.</p>
            <div className="modo-escolha" role="tablist" aria-label="Modo de batalha">
              <button className={`chip ${modo === "acao" ? "on" : ""}`} onClick={() => setModo("acao")} role="tab" aria-selected={modo === "acao"}>
                🎮 Ação — você move e mira
              </button>
              <button className={`chip ${modo === "tatica" ? "on" : ""}`} onClick={() => setModo("tatica")} role="tab" aria-selected={modo === "tatica"}>
                🎴 Tática — só os golpes
              </button>
            </div>
          </div>
          <div className="prep-actions">
            <select value={nivel} onChange={(e) => setNivel(Number(e.target.value) as Nivel)} aria-label="Dificuldade">
              <option value={1}>Fácil</option>
              <option value={2}>Médio</option>
              <option value={3}>Difícil</option>
            </select>
            <button className="btn gold big-btn" disabled={timeValido.length !== TAMANHO_TIME} onClick={iniciar}>
              ⚔️ Batalhar!
            </button>
          </div>
        </div>

        <div className="lenda-grid">
          {LENDAS.map((l) => {
            const tem = possuiLenda(state.owned, l);
            const pos = timeValido.indexOf(l.id);
            return (
              <button
                key={l.id}
                className={`lenda-card ${pos >= 0 ? "on" : ""} ${tem ? "" : "locked"}`}
                style={{ ["--el" as string]: ELEMENTOS[l.elemento].cor }}
                onClick={() => alternar(l)}
              >
                {pos >= 0 && <span className="lenda-pos">{pos + 1}</span>}
                <span className="lenda-emoji">{l.emoji}</span>
                <span className="lenda-nome">{l.nome}</span>
                <span className="el-badge">{ELEMENTOS[l.elemento].icone} {ELEMENTOS[l.elemento].nome}</span>
                {!tem && <span className="lenda-preco">🔒 {l.preco} 🪙</span>}
                <span
                  className="lenda-info"
                  role="button"
                  aria-label={`Detalhes de ${l.nome}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetalhe(l);
                  }}
                >
                  i
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <OnlineLobby timePronto={timeValido.length === TAMANHO_TIME} />

      <TabelaTipos />

      {detalhe && (
        <DetalheLenda
          lenda={detalhe}
          tem={possuiLenda(state.owned, detalhe)}
          moedas={state.coins}
          onLiberar={() => unlock(`lenda:${detalhe.id}`, detalhe.preco, detalhe.nome)}
          onFechar={() => setDetalhe(null)}
        />
      )}
    </div>
  );
}

function DetalheLenda({ lenda, tem, moedas, onLiberar, onFechar }: { lenda: Lenda; tem: boolean; moedas: number; onLiberar: () => void; onFechar: () => void }) {
  const el = ELEMENTOS[lenda.elemento];
  const stat = (nome: string, v: number, max: number) => (
    <div className="stat-row">
      <span>{nome}</span>
      <div className="bar"><span style={{ width: `${(v / max) * 100}%` }} /></div>
      <strong>{v}</strong>
    </div>
  );
  return (
    <div className="modal-bg" onClick={onFechar}>
      <div className="modal card" onClick={(e) => e.stopPropagation()} style={{ ["--el" as string]: el.cor }}>
        <button className="modal-x" onClick={onFechar} aria-label="Fechar">×</button>
        <div className="detalhe-top">
          <span className="detalhe-emoji">{lenda.emoji}</span>
          <div>
            <h2>{lenda.nome}</h2>
            <span className="el-badge">{el.icone} {el.nome}</span>
            <p className="muted small">{lenda.descricao}</p>
          </div>
        </div>
        {stat("Vida", lenda.vida, 140)}
        {stat("Ataque", lenda.ataque, 75)}
        {stat("Defesa", lenda.defesa, 60)}
        {stat("Velocidade", lenda.velocidade, 90)}
        <h3>Golpes</h3>
        <ul className="golpes-lista">
          {lenda.golpes.map((g, i) => (
            <li key={i}>
              <span>{ELEMENTOS[g.elemento].icone} <strong>{g.nome}</strong></span>
              <span className="muted small">
                {g.poder > 0 ? `Poder ${g.poder}` : "Suporte"} · {i === 0 ? "básico" : `${g.recarga}s`}
              </span>
            </li>
          ))}
        </ul>
        {!tem && (
          <button className="btn gold" disabled={moedas < lenda.preco} onClick={onLiberar}>
            {moedas < lenda.preco ? `Faltam ${lenda.preco - moedas} 🪙` : `Liberar por ${lenda.preco} 🪙`}
          </button>
        )}
      </div>
    </div>
  );
}

function TabelaTipos() {
  const els = Object.keys(ELEMENTOS) as Elemento[];
  return (
    <details className="card tipos">
      <summary><strong>📖 Tabela de vantagens</strong> <span className="muted small">(toque para ver)</span></summary>
      <ul className="tipos-lista">
        {els.map((e) => {
          const fortes = els.filter((x) => (VANTAGENS[e][x] ?? 1) > 1);
          const fracos = els.filter((x) => (VANTAGENS[e][x] ?? 1) < 1);
          return (
            <li key={e}>
              <strong>{ELEMENTOS[e].icone} {ELEMENTOS[e].nome}</strong>
              <span>💪 forte contra {fortes.map((x) => ELEMENTOS[x].nome).join(" e ")}</span>
              <span className="muted">😓 fraco contra {fracos.map((x) => ELEMENTOS[x].nome).join(" e ")}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
