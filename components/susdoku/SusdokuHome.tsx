"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CAPITULOS, Modo, Progresso, formatarTempo, hoje, lerProgresso, salvarProgresso } from "@/lib/susdoku/progresso";

export function SusdokuHome() {
  const [p, setP] = useState<Progresso | null>(null);

  useEffect(() => setP(lerProgresso()), []);

  if (!p) return <p className="muted center">Carregando…</p>;

  const trocarModo = (modo: Modo) => {
    const novo = { ...p, modo };
    salvarProgresso(novo);
    setP(novo);
  };

  const diaHoje = p.diario[hoje()];
  const total = CAPITULOS.reduce((s, c) => s + c.fases.length * 3, 0);
  const ganhas = Object.values(p.estrelas).reduce((s, x) => s + x, 0);

  return (
    <div className="sd-home">
      <section className="card sd-intro">
        <div>
          <h2>🕵️ Descubra quem foi!</h2>
          <p className="muted">
            Posicione cada pessoa na planta usando as pistas. Cada linha e cada coluna tem exatamente uma pessoa.
            Quem estava <b>sozinho</b> no cômodo do ocorrido é o culpado.
          </p>
        </div>
        <div className="sd-intro-lado">
          <div className="sd-total">★ {ganhas}/{total}</div>
          <div className="sd-modo">
            <button className={`chip ${p.modo === "normal" ? "on" : ""}`} onClick={() => trocarModo("normal")}>Normal</button>
            <button className={`chip ${p.modo === "dificil" ? "on" : ""}`} onClick={() => trocarModo("dificil")}>Difícil</button>
          </div>
          <p className="muted small">
            {p.modo === "normal" ? "Avisa na hora quando alguém é colocado errado." : "Só confere quando você pedir."}
          </p>
        </div>
      </section>

      <Link href="/susdoku/diario" className="card sd-diario">
        <span className="sd-diario-emoji">📅</span>
        <div>
          <h3>Caso do Dia</h3>
          <p className="muted small">Um mistério novo por dia, igual para todos. Quanto tempo você leva?</p>
        </div>
        <span className="pill">{diaHoje ? `✓ ${formatarTempo(diaHoje.tempo)}` : "Jogar"}</span>
      </Link>

      {CAPITULOS.map((cap) => (
        <section key={cap.id} className="card">
          <h2>{cap.emoji} Capítulo 1 · {cap.nome}</h2>
          <div className="sd-fases">
            {cap.fases.map((f, i) => {
              const estrelas = p.estrelas[f.id] ?? 0;
              const liberada = i === 0 || (p.estrelas[cap.fases[i - 1].id] ?? 0) > 0;
              const conteudo = (
                <>
                  <span className="sd-fase-num">{liberada ? i + 1 : "🔒"}</span>
                  <span className="sd-fase-titulo">{f.titulo}</span>
                  <span className="sd-fase-estrelas">
                    {[1, 2, 3].map((k) => <span key={k} className={k <= estrelas ? "on" : ""}>★</span>)}
                    {p.selos[f.id] && <span title="Detetive Brilhante"> 🔎</span>}
                  </span>
                </>
              );
              return liberada ? (
                <Link key={f.id} href={`/susdoku/${f.id}`} className={`sd-fase ${estrelas ? "feita" : ""}`}>{conteudo}</Link>
              ) : (
                <div key={f.id} className="sd-fase bloqueada" title="Resolva o caso anterior para liberar">{conteudo}</div>
              );
            })}
          </div>
        </section>
      ))}

      <p className="muted small center">Novos capítulos em breve: Casa, Restaurante, Hospital e Prédio comercial.</p>
    </div>
  );
}
