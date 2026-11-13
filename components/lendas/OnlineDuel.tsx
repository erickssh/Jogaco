"use client";

// Duelo online no modo Ação (movimento em tempo real).
// O anfitrião (quem criou a sala) roda a simulação a 60 passos/s e manda fotografias ~12x/s.
// O convidado manda os controles ~20x/s; golpes e trocas têm número de sequência e são
// reenviados até o anfitrião confirmar (assim nenhum golpe se perde na rede).

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase";
import { getNick } from "@/lib/chessOnline";
import { LENDAS } from "@/lib/lendas/data";
import { Lado } from "@/lib/lendas/engine";
import {
  AcaoBatalha, Comando, RetratoAcao, Vec, avancarVisualAcao, criarAcao, exportarAcao, importarAcao, passo, prontoParaGolpe,
} from "@/lib/lendas/acao";
import { LOBBY_CHANNEL, PresencaSala, lerTime, meuPid, souAnfitriao, timeValido } from "@/lib/lendas/online";
import { useRewards } from "../RewardsProvider";
import { Entrada, PainelGolpes, TimeStrip, ajustarCanvasArena, comandoLocal, desenharArena, miraDaEntrada, movimentoDaEntrada, novaEntrada, useControlesArena } from "./arenaShared";
import { possuiLenda } from "./LendasGame";
import { Aviso, EscolherTime } from "./OnlineRoom";

type Fase = "carregando" | "sem-time" | "esperando" | "batalha" | "fim" | "cheia" | "sem-anfitriao";

type Acao = { s: number; g?: number; t?: number };
type MsgEntrada = { pid: string; bid: string; mv: Vec; mi: Vec; at: boolean; acs: Acao[] };
type MsgEstado = { bid: string; r: RetratoAcao; nomes: [string, string]; guestPid: string; inicioEm: number; ack: number };

export const duelChannel = (codigo: string) => `lendas-duelo-${codigo}`;

const PASSO = 1 / 60;
const ENVIO_ESTADO_MS = 80;
const ENVIO_ENTRADA_MS = 50;
const ESPERA_SAIDA_MS = 8000;

export function OnlineDuel({ codigo }: { codigo: string }) {
  const sb = supabaseBrowser();
  const { state, ready, recordGame } = useRewards();

  const [pid, setPid] = useState("");
  const [host, setHost] = useState(false);
  const [meuTime, setMeuTime] = useState<string[] | null>(null);
  const [fase, setFase] = useState<Fase>("carregando");
  const [jogadores, setJogadores] = useState<PresencaSala[]>([]);
  const [nomes, setNomes] = useState<[string, string]>(["", ""]);
  const [premio, setPremio] = useState<number | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pedidoRevanche, setPedidoRevanche] = useState(false);
  const [, setHud] = useState(0);

  const canal = useRef<RealtimeChannel | null>(null);
  const lobby = useRef<RealtimeChannel | null>(null);
  const bat = useRef<AcaoBatalha | null>(null); // anfitrião: simulação; convidado: última fotografia
  const batId = useRef("");
  const guestPid = useRef("");
  const inicioEm = useRef(0);
  const faseRef = useRef<Fase>("carregando");
  const premiados = useRef(new Set<string>());
  const saidaDesde = useRef<number | null>(null);
  const jogadoresRef = useRef<PresencaSala[]>([]);
  const nomesRef = useRef<[string, string]>(["", ""]);
  const entrada = useRef<Entrada>(novaEntrada());
  const canvas = useRef<HTMLCanvasElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  // anfitrião: últimos controles do convidado
  const remoto = useRef<{ mv: Vec; mi: Vec; at: boolean; ultimaSeq: number; golpe: { i: number; t: number } | null; troca: number | null }>({
    mv: { x: 0, y: 0 }, mi: { x: 400, y: 690 }, at: false, ultimaSeq: 0, golpe: null, troca: null,
  });
  // convidado: ações ainda não confirmadas
  const pendentes = useRef<Acao[]>([]);
  const seqAcao = useRef(0);
  faseRef.current = fase;
  jogadoresRef.current = jogadores;
  nomesRef.current = nomes;

  const eu: Lado = host ? 0 : 1;
  const flip = !host;
  const meuNome = `${state.avatar} ${getNick() || "Jogador"}`;

  useControlesArena(canvas, entrada, flip, undefined, (fase === "batalha" || fase === "fim") && !!bat.current);

  // Identidade e time
  useEffect(() => {
    if (!ready) return;
    setPid(meuPid());
    setHost(souAnfitriao(codigo));
    const t = lerTime();
    if (timeValido(t, (id) => possuiLenda(state.owned, LENDAS.find((l) => l.id === id)!))) {
      setMeuTime(t);
      setFase((f) => (f === "carregando" ? "esperando" : f));
    } else setFase("sem-time");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, codigo]);

  const enviarEstado = useCallback(() => {
    const b = bat.current;
    if (!b || !canal.current) return;
    const msg: MsgEstado = {
      bid: batId.current,
      r: exportarAcao(b),
      nomes: nomesRef.current,
      guestPid: guestPid.current,
      inicioEm: Math.max(0, inicioEm.current - Date.now()),
      ack: remoto.current.ultimaSeq,
    };
    canal.current.send({ type: "broadcast", event: "estado", payload: msg });
  }, []);

  const comecar = useCallback(
    (convidado: PresencaSala) => {
      if (!meuTime) return;
      bat.current = criarAcao(meuTime, convidado.time);
      batId.current = crypto.randomUUID();
      guestPid.current = convidado.pid;
      inicioEm.current = Date.now() + 3500;
      saidaDesde.current = null;
      remoto.current = { mv: { x: 0, y: 0 }, mi: { x: 400, y: 690 }, at: false, ultimaSeq: 0, golpe: null, troca: null };
      const n: [string, string] = [meuNome, convidado.nome];
      nomesRef.current = n;
      setNomes(n);
      setPremio(null);
      setPedidoRevanche(false);
      setFase("batalha");
      lobby.current?.untrack();
    },
    [meuTime, meuNome],
  );

  // ---------- Canal da sala ----------
  useEffect(() => {
    if (!sb || !pid || !meuTime) return;
    const ch = sb.channel(duelChannel(codigo), { config: { broadcast: { self: false }, presence: { key: pid } } });
    canal.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const lista = Object.values(ch.presenceState<PresencaSala>()).flat();
      setJogadores(lista.map(({ pid, nome, host, time }) => ({ pid, nome, host, time })));
    });

    // Convidado: recebe a fotografia da arena
    ch.on("broadcast", { event: "estado" }, ({ payload }) => {
      if (host) return;
      const m = payload as MsgEstado;
      if (m.guestPid !== pid) {
        if (faseRef.current === "esperando") setFase("cheia");
        return;
      }
      if (m.bid !== batId.current) {
        batId.current = m.bid;
        pendentes.current = [];
        setPremio(null);
        setPedidoRevanche(false);
        saidaDesde.current = null;
      }
      bat.current = importarAcao(m.r);
      inicioEm.current = Date.now() + m.inicioEm;
      pendentes.current = pendentes.current.filter((a) => a.s > m.ack);
      nomesRef.current = m.nomes;
      setNomes(m.nomes);
      setFase(m.r.venc !== null ? "fim" : "batalha");
    });

    // Anfitrião: recebe os controles do convidado
    ch.on("broadcast", { event: "entrada" }, ({ payload }) => {
      if (!host) return;
      const m = payload as MsgEntrada;
      if (m.pid !== guestPid.current || m.bid !== batId.current) return;
      const r = remoto.current;
      r.mv = m.mv;
      r.mi = m.mi;
      r.at = m.at;
      for (const a of m.acs) {
        if (a.s <= r.ultimaSeq) continue;
        r.ultimaSeq = a.s;
        if (a.g !== undefined) r.golpe = { i: a.g, t: 0.35 };
        if (a.t !== undefined) r.troca = a.t;
      }
    });

    ch.on("broadcast", { event: "revanche" }, ({ payload }) => {
      if (!host || payload.pid !== guestPid.current) return;
      setPedidoRevanche(true);
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ pid, nome: meuNome, host, time: meuTime } satisfies PresencaSala);
    });

    if (host) {
      const lb = sb.channel(LOBBY_CHANNEL, { config: { presence: { key: pid } } });
      lobby.current = lb;
      lb.subscribe(async (status) => {
        if (status === "SUBSCRIBED" && faseRef.current === "esperando") await lb.track({ codigo, nome: meuNome, criado: Date.now(), modo: "acao" });
      });
    }

    return () => {
      sb.removeChannel(ch);
      if (lobby.current) sb.removeChannel(lobby.current);
      canal.current = null;
      lobby.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb, pid, host, meuTime, codigo]);

  // Anfitrião começa quando chega um convidado com time válido
  useEffect(() => {
    if (!host || fase !== "esperando") return;
    const convidado = jogadores.find((p) => !p.host && p.pid !== pid && timeValido(p.time, () => true));
    if (convidado) comecar(convidado);
  }, [host, fase, jogadores, pid, comecar]);

  // Convidado: sala sem anfitrião
  useEffect(() => {
    if (host || fase !== "esperando") return;
    const t = setTimeout(() => {
      if (faseRef.current === "esperando" && !jogadoresRef.current.some((p) => p.host)) setFase("sem-anfitriao");
    }, 7000);
    return () => clearTimeout(t);
  }, [host, fase]);

  // ---------- Laço do jogo ----------
  useEffect(() => {
    if (fase !== "batalha" && fase !== "fim") return;
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const ajustar = () => ajustarCanvasArena(cv, caixa.current);
    ajustar();
    window.addEventListener("resize", ajustar);
    let raf = 0;
    let ultimo = performance.now();
    let acumulado = 0;
    let ultimoEstado = 0;
    let ultimaEntrada = 0;
    let ultimoHud = 0;

    const comandoRemoto = (b: AcaoBatalha): Comando => {
      const r = remoto.current;
      let golpe: number | null = null;
      if (r.golpe) {
        if (prontoParaGolpe(b, 1, r.golpe.i)) {
          golpe = r.golpe.i;
          r.golpe = null;
        } else if ((r.golpe.t -= PASSO) <= 0) r.golpe = null;
      }
      if (golpe === null && r.at && prontoParaGolpe(b, 1, 0)) golpe = 0;
      const troca = r.troca;
      r.troca = null;
      return { mover: r.mv, mira: r.mi, golpe, troca };
    };

    const tick = (agora: number) => {
      // Aba em segundo plano: o navegador atrasa o relógio, então aceitamos passos maiores
      const dt = Math.min(host ? 0.5 : 0.1, (agora - ultimo) / 1000);
      if (dt <= 0) return;
      ultimo = agora;
      const b = bat.current;
      if (!b) return;
      const comecou = Date.now() >= inicioEm.current;

      // Saída do adversário
      const lista = jogadoresRef.current;
      const outroPid = host ? guestPid.current : lista.find((p) => p.host)?.pid;
      const presente = !!outroPid && lista.some((p) => p.pid === outroPid);
      if (!presente && b.vencedor === null) {
        saidaDesde.current ??= Date.now();
        if (Date.now() - saidaDesde.current > ESPERA_SAIDA_MS) {
          b.vencedor = eu;
          b.avisos.push({ id: ++b.seq, texto: "O adversário saiu da sala.", t: 0 });
        }
      } else saidaDesde.current = null;

      if (host) {
        if (comecou && b.vencedor === null) {
          acumulado += dt;
          while (acumulado >= PASSO) {
            acumulado -= PASSO;
            passo(b, PASSO, [comandoLocal(b, 0, entrada.current, false, PASSO), comandoRemoto(b)]);
          }
        } else if (b.vencedor !== null) {
          b.flut.forEach((f) => (f.t += dt));
        }
        if (agora - ultimoEstado > ENVIO_ESTADO_MS) {
          ultimoEstado = agora;
          enviarEstado();
        }
      } else {
        if (comecou) avancarVisualAcao(b, dt);
        // converte cliques/teclas em ações numeradas
        const e = entrada.current;
        if (e.pendente) {
          pendentes.current.push({ s: ++seqAcao.current, g: e.pendente.i });
          e.pendente = null;
        }
        if (e.troca !== null) {
          pendentes.current.push({ s: ++seqAcao.current, t: e.troca });
          e.troca = null;
        }
        if (agora - ultimaEntrada > ENVIO_ENTRADA_MS && canal.current && comecou && b.vencedor === null) {
          ultimaEntrada = agora;
          const msg: MsgEntrada = {
            pid,
            bid: batId.current,
            mv: movimentoDaEntrada(e, true),
            mi: miraDaEntrada(b, 1, e),
            at: e.atirando || e.teclas.has(" "),
            acs: pendentes.current.slice(-8),
          };
          canal.current.send({ type: "broadcast", event: "entrada", payload: msg });
        }
      }

      desenharArena(ctx, cv, b, entrada.current, Math.max(0, (inicioEm.current - Date.now()) / 1000), eu, flip);
      if (b.vencedor !== null && faseRef.current !== "fim") setFase("fim");
      if (agora - ultimoHud > 100) {
        ultimoHud = agora;
        setHud((n) => n + 1);
      }
    };
    const quadro = (agora: number) => {
      tick(agora);
      raf = requestAnimationFrame(quadro);
    };
    raf = requestAnimationFrame(quadro);
    const reserva = setInterval(() => {
      const agora = performance.now();
      if (agora - ultimo > 120) tick(agora);
    }, 50);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(reserva);
      window.removeEventListener("resize", ajustar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase === "batalha" || fase === "fim", host, pid]);

  // Anfitrião reenvia o resultado algumas vezes ao terminar
  useEffect(() => {
    if (!host || fase !== "fim") return;
    let n = 0;
    const t = setInterval(() => {
      enviarEstado();
      if (++n >= 6) clearInterval(t);
    }, 300);
    return () => clearInterval(t);
  }, [host, fase, enviarEstado]);

  // Moedas no fim (uma vez por batalha)
  useEffect(() => {
    const b = bat.current;
    if (fase !== "fim" || !b || b.vencedor === null || premiados.current.has(batId.current)) return;
    premiados.current.add(batId.current);
    setPremio(recordGame("arena-das-lendas", b.vencedor === eu ? 4 : 0).coins);
  }, [fase, eu, recordGame]);

  const revanche = () => {
    if (host) {
      const convidado = jogadores.find((p) => p.pid === guestPid.current);
      if (convidado) comecar(convidado);
    } else {
      canal.current?.send({ type: "broadcast", event: "revanche", payload: { pid } });
      setPedidoRevanche(true);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {}
  };

  // ---------- Telas ----------
  if (!sb) return <p className="muted center">Modo online não configurado.</p>;
  if (fase === "carregando") return <p className="muted center">Carregando…</p>;
  if (fase === "sem-time") return <EscolherTime owned={state.owned} onPronto={(t) => { setMeuTime(t); setFase("esperando"); }} />;
  if (fase === "cheia") return <Aviso emoji="🚪" titulo="Sala cheia" texto="Esse duelo já tem dois jogadores." />;
  if (fase === "sem-anfitriao") return <Aviso emoji="👻" titulo="Sala vazia" texto="Quem criou a sala não está mais nela. Crie uma nova!" />;

  if (fase === "esperando" || !bat.current) {
    const outros = jogadores.filter((p) => p.pid !== pid);
    return (
      <div className="card sala-espera">
        <div className="overlay-emoji">🎮</div>
        <h2>{host ? "Esperando adversário…" : "Entrando no duelo…"}</h2>
        <p className="sala-codigo">Duelo <strong>{codigo}</strong></p>
        <p className="muted small">Modo Ação: vocês dois se movem, miram e desviam ao vivo.</p>
        {host && (
          <>
            <p className="muted">Mande o link para um amigo, ou espere alguém entrar pela lista de salas.</p>
            <button className="btn gold" onClick={copiar}>{copiado ? "✓ Link copiado!" : "🔗 Copiar link do duelo"}</button>
          </>
        )}
        <p className="muted small">Na sala: {[meuNome + " (você)", ...outros.map((p) => p.nome)].join(" · ")}</p>
        <Link href="/lendas" className="btn small-btn">Cancelar</Link>
      </div>
    );
  }

  const b = bat.current;
  const ele: Lado = eu === 0 ? 1 : 0;
  const venceu = b.vencedor === eu;

  return (
    <div className="arena acao">
      <div className="arena-bar">
        <span className="small"><strong>Duelo {codigo}</strong></span>
        <span className="muted small">⏱ {Math.floor(b.tempo)}s{host ? " · não minimize esta aba" : ""}</span>
        <Link href="/lendas" className="btn small-btn">Sair</Link>
      </div>

      <TimeStrip b={b} lado={ele} eu={eu} nome={nomes[ele]} />

      <div className="acao-canvas-box" ref={caixa}>
        <canvas ref={canvas} className="acao-canvas" />
        {fase === "fim" && (
          <div className="overlay-full">
            <div className="overlay">
              <div className="overlay-emoji">{venceu ? "🏆" : "😵"}</div>
              <h2>{venceu ? "Vitória!" : "Derrota…"}</h2>
              <p className="muted">contra {nomes[ele]}</p>
              {premio !== null && <p className="earned">+{premio} 🪙</p>}
              <div className="row">
                {host ? (
                  <button className="btn gold" onClick={revanche} disabled={!jogadores.some((p) => p.pid === guestPid.current)}>
                    {pedidoRevanche ? "↻ Aceitar revanche" : "↻ Revanche"}
                  </button>
                ) : (
                  <button className="btn gold" onClick={revanche} disabled={pedidoRevanche}>
                    {pedidoRevanche ? "Pedido enviado…" : "↻ Pedir revanche"}
                  </button>
                )}
                <Link href="/lendas" className="btn">Sair</Link>
              </div>
            </div>
          </div>
        )}
        {fase === "batalha" && saidaDesde.current && (
          <div className="overlay-full">
            <div className="overlay"><h2>📡 Adversário desconectado</h2><p className="muted">Esperando ele voltar…</p></div>
          </div>
        )}
      </div>

      <TimeStrip b={b} lado={eu} eu={eu} nome={nomes[eu]} />
      <PainelGolpes b={b} eu={eu} entrada={entrada} />
    </div>
  );
}
