"use client";

import { useEffect, useRef, useState } from "react";
import { EFEITOS, ELEMENTOS, EfeitoId } from "@/lib/lendas/data";
import {
  Batalha, Cerebro, Lado, Lutador, Nivel, atual, avancar, bloqueado, criarBatalha,
  jogarComputador, podeTrocar, podeUsar, recargaGolpe, trocar, usarGolpe, vantagem,
} from "@/lib/lendas/engine";
import { useRewards } from "../RewardsProvider";

type Props = { meu: string[]; deles: string[]; nivel: Nivel; onRevanche: () => void; onSair: () => void };

type Flutuante = { id: number; lado: Lado; texto: string; tipo: "dano" | "cura" | "super" | "fraco"; nasceu: number };

const VIDA_FLUT = 1100;

export function Battle({ meu, deles, nivel, onRevanche, onSair }: Props) {
  const ref = useRef<Batalha>(null as unknown as Batalha);
  if (!ref.current) ref.current = criarBatalha(meu, deles);
  const premiado = useRef(false);
  const cerebro = useRef<Cerebro>({ espera: 1.2 });
  const visto = useRef(0);
  const [, setTick] = useState(0);
  const [flut, setFlut] = useState<Flutuante[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [pausado, setPausado] = useState(false);
  const [premio, setPremio] = useState<number | null>(null);
  const { recordGame } = useRewards();
  const pausaRef = useRef(false);
  pausaRef.current = pausado;

  // Laço principal (~20 quadros por segundo)
  useEffect(() => {
    let ultimo = performance.now();
    const t = setInterval(() => {
      const agora = performance.now();
      const dt = Math.min(0.2, (agora - ultimo) / 1000);
      ultimo = agora;
      const b = ref.current;
      if (!pausaRef.current && b.vencedor === null) {
        avancar(b, dt);
        jogarComputador(b, 1, nivel, cerebro.current, dt);
      }
      // Eventos novos → números flutuantes e registro
      const novos = b.eventos.filter((e) => e.id > visto.current);
      if (novos.length) {
        visto.current = novos[novos.length - 1].id;
        const fl: Flutuante[] = [];
        const linhas: string[] = [];
        for (const e of novos) {
          if (e.dano) {
            const tipo = e.efetividade && e.efetividade > 1 ? "super" : e.efetividade && e.efetividade < 1 ? "fraco" : "dano";
            fl.push({ id: e.id, lado: e.lado, texto: `-${e.dano}`, tipo, nasceu: agora });
            if (tipo === "super") linhas.push("É super efetivo!");
            if (tipo === "fraco") linhas.push("Não foi muito efetivo…");
          }
          if (e.cura) fl.push({ id: e.id, lado: e.lado, texto: `+${e.cura}`, tipo: "cura", nasceu: agora });
          if (e.texto) linhas.push(`${e.lado === 0 ? "🔵" : "🔴"} ${e.texto}`);
        }
        if (fl.length) setFlut((f) => [...f.filter((x) => agora - x.nasceu < VIDA_FLUT), ...fl]);
        if (linhas.length) setLog((l) => [...linhas.reverse(), ...l].slice(0, 5));
      }
      setTick((n) => n + 1);
    }, 50);
    return () => clearInterval(t);
  }, [nivel]);

  // Atalhos de teclado: 1-4 golpes, Q/W/E trocar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const b = ref.current;
      if (["1", "2", "3", "4"].includes(e.key)) usarGolpe(b, 0, Number(e.key) - 1);
      const trocas: Record<string, number> = { q: 0, w: 1, e: 2 };
      if (e.key.toLowerCase() in trocas) trocar(b, 0, trocas[e.key.toLowerCase()]);
      if (e.key === "Escape") setPausado((p) => !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const b = ref.current;

  // Moedas no fim
  useEffect(() => {
    if (b.vencedor === null || premiado.current) return;
    premiado.current = true;
    const score = b.vencedor === 0 ? nivel + 1 : 0;
    setPremio(recordGame("arena-das-lendas", score).coins);
  });

  const eu = atual(b, 0);
  const ele = atual(b, 1);
  const agora = performance.now();

  return (
    <div className="arena">
      <div className="arena-bar">
        <button className="btn small-btn" onClick={() => setPausado((p) => !p)} disabled={b.vencedor !== null}>
          {pausado ? "▶ Continuar" : "⏸ Pausar"}
        </button>
        <span className="muted small">⏱ {Math.floor(b.tempo)}s · {["", "Fácil", "Médio", "Difícil"][nivel]}</span>
        <button className="btn small-btn" onClick={onSair}>Sair</button>
      </div>

      <div className="campo">
        <Painel l={ele} lado={1} time={b.times[1]} ativo={b.ativo[1]} flut={flut} agora={agora} contra={eu} />
        <div className="versus">VS</div>
        <Painel l={eu} lado={0} time={b.times[0]} ativo={b.ativo[0]} flut={flut} agora={agora} contra={ele} />
      </div>

      <div className="golpes">
        {eu.lenda.golpes.map((g, i) => {
          const rec = eu.recargas[i];
          const total = recargaGolpe(eu, i) || 1;
          const pronto = podeUsar(b, 0, i);
          const ef = g.poder > 0 ? vantagem(g.elemento, ele.lenda.elemento) : 1;
          return (
            <button
              key={i}
              className={`golpe ${pronto ? "pronto" : ""}`}
              style={{ ["--el" as string]: ELEMENTOS[g.elemento].cor, ["--rec" as string]: `${(rec / total) * 100}%` }}
              disabled={!pronto}
              onClick={() => usarGolpe(b, 0, i)}
            >
              <span className="golpe-nome">{ELEMENTOS[g.elemento].icone} {g.nome}</span>
              <span className="golpe-info">
                {g.poder > 0 ? `Poder ${g.poder}` : "Suporte"}
                {ef > 1 && <em className="ef-sup"> · forte!</em>}
                {ef < 1 && <em className="ef-fra"> · fraco</em>}
              </span>
              {rec > 0 && <span className="golpe-rec">{rec.toFixed(1)}s</span>}
              <kbd>{i + 1}</kbd>
            </button>
          );
        })}
      </div>

      <div className="reservas">
        <span className="muted small">
          Trocar{b.esperaTroca[0] > 0 ? ` (${b.esperaTroca[0].toFixed(1)}s)` : bloqueado(eu) ? " (bloqueado)" : ""}:
        </span>
        {b.times[0].map((l, i) => (
          <button
            key={i}
            className={`reserva ${i === b.ativo[0] ? "em-campo" : ""}`}
            disabled={!podeTrocar(b, 0, i)}
            onClick={() => trocar(b, 0, i)}
            title={l.lenda.nome}
          >
            <span>{l.vida > 0 ? l.lenda.emoji : "💀"}</span>
            <span className="mini-vida"><span style={{ width: `${(l.vida / l.vidaMax) * 100}%` }} /></span>
            <kbd>{"QWE"[i]}</kbd>
          </button>
        ))}
      </div>

      <ul className="arena-log" aria-live="polite">
        {log.map((linha, i) => <li key={i} style={{ opacity: 1 - i * 0.18 }}>{linha}</li>)}
      </ul>

      {pausado && b.vencedor === null && (
        <div className="overlay-full"><div className="overlay"><h2>⏸ Pausado</h2><button className="btn gold" onClick={() => setPausado(false)}>Continuar</button></div></div>
      )}

      {b.vencedor !== null && (
        <div className="overlay-full">
          <div className="overlay">
            <div className="overlay-emoji">{b.vencedor === 0 ? "🏆" : "😵"}</div>
            <h2>{b.vencedor === 0 ? "Vitória!" : "Derrota…"}</h2>
            <p className="muted">Batalha de {Math.floor(b.tempo)} segundos</p>
            {premio !== null && <p className="earned">+{premio} 🪙</p>}
            <div className="row">
              <button className="btn gold" onClick={onRevanche}>↻ Revanche</button>
              <button className="btn" onClick={onSair}>Trocar time</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Painel({ l, lado, time, ativo, flut, agora, contra }: {
  l: Lutador; lado: Lado; time: Lutador[]; ativo: number; flut: Flutuante[]; agora: number; contra: Lutador;
}) {
  const pct = (l.vida / l.vidaMax) * 100;
  const cor = pct > 50 ? "#3ddc97" : pct > 20 ? "#ffc83d" : "#ff5d5d";
  const el = ELEMENTOS[l.lenda.elemento];
  const ameaca = vantagem(contra.lenda.elemento, l.lenda.elemento);
  return (
    <div className={`painel ${lado === 0 ? "meu" : "dele"}`} style={{ ["--el" as string]: el.cor }}>
      <div className="painel-info">
        <div className="painel-nome">
          <strong>{l.lenda.nome}</strong>
          <span className="el-badge">{el.icone} {el.nome}</span>
          {ameaca > 1 && <span className="perigo" title="Em desvantagem de elemento">⚠️</span>}
        </div>
        <div className="vida-bar"><span style={{ width: `${pct}%`, background: cor }} /></div>
        <div className="painel-sub">
          <span className="small">{Math.ceil(l.vida)}/{l.vidaMax}</span>
          <span className="pontos">{time.map((x, i) => <i key={i} className={x.vida <= 0 ? "morto" : i === ativo ? "ativo" : ""} />)}</span>
        </div>
        <div className="efeitos">
          {(Object.keys(l.efeitos) as EfeitoId[]).map((k) => (
            <span key={k} className={`efeito ${EFEITOS[k].ruim ? "ruim" : "bom"}`} title={EFEITOS[k].nome}>
              {EFEITOS[k].icone} {Math.ceil(l.efeitos[k] ?? 0)}s
            </span>
          ))}
        </div>
      </div>
      <div className={`avatar-lenda ${l.vida <= 0 ? "caido" : ""} ${bloqueado(l) ? "travado" : ""}`}>
        <span key={l.lenda.id}>{l.lenda.emoji}</span>
        {flut
          .filter((f) => f.lado === lado && agora - f.nasceu < VIDA_FLUT)
          .map((f) => (
            <span key={f.id} className={`flut ${f.tipo}`}>{f.texto}</span>
          ))}
      </div>
    </div>
  );
}
