"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { EFEITOS, ELEMENTOS, EfeitoId } from "@/lib/lendas/data";
import { Batalha, Lado, Lutador, atual, bloqueado, podeTrocar, podeUsar, recargaGolpe, vantagem } from "@/lib/lendas/engine";

type Flutuante = { id: number; lado: Lado; texto: string; tipo: "dano" | "cura" | "super" | "fraco"; nasceu: number };
const VIDA_FLUT = 1100;

type Props = {
  b: Batalha;
  /** De que lado o usuário está (a tela sempre mostra "eu" embaixo). */
  eu: Lado;
  onGolpe: (i: number) => void;
  onTroca: (idx: number) => void;
  barra: ReactNode;
  /** Conteúdo sobreposto (pausa, fim de jogo…). */
  sobreposicao?: ReactNode;
  nomes?: [string, string];
};

/** Tela de batalha — só desenha. Quem anda o tempo é o componente pai. */
export function BattleView({ b, eu, onGolpe, onTroca, barra, sobreposicao, nomes }: Props) {
  const ele: Lado = eu === 0 ? 1 : 0;
  const visto = useRef(0);
  const [flut, setFlut] = useState<Flutuante[]>([]);
  const [log, setLog] = useState<string[]>([]);

  // Eventos novos → números flutuantes e registro (roda após cada quadro)
  useEffect(() => {
    const novos = b.eventos.filter((e) => e.id > visto.current);
    if (!novos.length) return;
    visto.current = novos[novos.length - 1].id;
    const agora = performance.now();
    const fl: Flutuante[] = [];
    const linhas: string[] = [];
    for (const e of novos) {
      if (e.dano) {
        const tipo = e.efetividade && e.efetividade > 1 ? "super" : e.efetividade && e.efetividade < 1 ? "fraco" : "dano";
        fl.push({ id: e.id, lado: e.lado, texto: `-${e.dano}`, tipo, nasceu: agora });
        if (tipo === "super") linhas.push("É super efetivo!");
        if (tipo === "fraco") linhas.push("Não foi muito efetivo…");
      }
      if (e.cura) fl.push({ id: e.id + 0.5, lado: e.lado, texto: `+${e.cura}`, tipo: "cura", nasceu: agora });
      if (e.texto) linhas.push(`${e.lado === eu ? "🔵" : "🔴"} ${e.texto}`);
    }
    if (fl.length) setFlut((f) => [...f.filter((x) => agora - x.nasceu < VIDA_FLUT), ...fl]);
    if (linhas.length) setLog((l) => [...linhas.reverse(), ...l].slice(0, 5));
  });

  // Atalhos de teclado: 1-4 golpes, Q/W/E trocar
  const cb = useRef({ onGolpe, onTroca });
  cb.current = { onGolpe, onTroca };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (["1", "2", "3", "4"].includes(e.key)) cb.current.onGolpe(Number(e.key) - 1);
      const trocas: Record<string, number> = { q: 0, w: 1, e: 2 };
      const k = e.key.toLowerCase();
      if (k in trocas) cb.current.onTroca(trocas[k]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const meu = atual(b, eu);
  const dele = atual(b, ele);
  const agora = performance.now();

  return (
    <div className="arena">
      <div className="arena-bar">{barra}</div>

      <div className="campo">
        <Painel l={dele} lado={ele} time={b.times[ele]} ativo={b.ativo[ele]} flut={flut} agora={agora} contra={meu} rotulo={nomes?.[ele]} topo />
        <div className="versus">VS</div>
        <Painel l={meu} lado={eu} time={b.times[eu]} ativo={b.ativo[eu]} flut={flut} agora={agora} contra={dele} rotulo={nomes?.[eu]} />
      </div>

      <div className="golpes">
        {meu.lenda.golpes.map((g, i) => {
          const rec = meu.recargas[i];
          const total = recargaGolpe(meu, i) || 1;
          const pronto = podeUsar(b, eu, i);
          const ef = g.poder > 0 ? vantagem(g.elemento, dele.lenda.elemento) : 1;
          return (
            <button
              key={i}
              className={`golpe ${pronto ? "pronto" : ""}`}
              style={{ ["--el" as string]: ELEMENTOS[g.elemento].cor, ["--rec" as string]: `${Math.min(100, (rec / total) * 100)}%` }}
              disabled={!pronto}
              onClick={() => onGolpe(i)}
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
          Trocar{b.esperaTroca[eu] > 0 ? ` (${b.esperaTroca[eu].toFixed(1)}s)` : bloqueado(meu) ? " (bloqueado)" : ""}:
        </span>
        {b.times[eu].map((l, i) => (
          <button
            key={i}
            className={`reserva ${i === b.ativo[eu] ? "em-campo" : ""}`}
            disabled={!podeTrocar(b, eu, i)}
            onClick={() => onTroca(i)}
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

      {sobreposicao && <div className="overlay-full">{sobreposicao}</div>}
    </div>
  );
}

function Painel({ l, lado, time, ativo, flut, agora, contra, rotulo, topo }: {
  l: Lutador; lado: Lado; time: Lutador[]; ativo: number; flut: Flutuante[]; agora: number; contra: Lutador; rotulo?: string; topo?: boolean;
}) {
  const pct = (l.vida / l.vidaMax) * 100;
  const cor = pct > 50 ? "#3ddc97" : pct > 20 ? "#ffc83d" : "#ff5d5d";
  const el = ELEMENTOS[l.lenda.elemento];
  const ameaca = vantagem(contra.lenda.elemento, l.lenda.elemento);
  return (
    <div className={`painel ${topo ? "dele" : "meu"}`} style={{ ["--el" as string]: el.cor }}>
      <div className="painel-info">
        {rotulo && <span className="painel-rotulo">{rotulo}</span>}
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
          {(Object.keys(l.efeitos) as EfeitoId[]).filter((k) => (l.efeitos[k] ?? 0) > 0).map((k) => (
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
