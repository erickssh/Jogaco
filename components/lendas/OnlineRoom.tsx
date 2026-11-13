"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase";
import { getNick } from "@/lib/chessOnline";
import { LENDAS } from "@/lib/lendas/data";
import {
  Batalha, Lado, Retrato, TRAVA_ACAO, avancar, avancarVisual, criarBatalha, encerrar, exportar, importar,
  podeTrocar, podeUsar, trocar, usarGolpe,
} from "@/lib/lendas/engine";
import {
  LOBBY_CHANNEL, PresencaSala, TEAM_KEY, lerTime, meuPid, salaChannel, souAnfitriao, timeValido,
} from "@/lib/lendas/online";
import { useRewards } from "../RewardsProvider";
import { BattleView } from "./BattleView";
import { possuiLenda } from "./LendasGame";

type Fase = "carregando" | "sem-time" | "esperando" | "batalha" | "fim" | "cheia" | "sem-anfitriao";

type MsgEstado = {
  batalhaId: string;
  retrato: Retrato;
  nomes: [string, string];
  guestPid: string;
  inicioEm: number; // ms restantes até começar (contagem regressiva)
};

const ENVIO_MS = 150; // retratos ~7x por segundo
const ESPERA_SAIDA_MS = 8000;

export function OnlineRoom({ codigo }: { codigo: string }) {
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
  const [, setTick] = useState(0);

  const canal = useRef<RealtimeChannel | null>(null);
  const lobby = useRef<RealtimeChannel | null>(null);
  const bat = useRef<Batalha | null>(null);
  const batId = useRef("");
  const guestPid = useRef("");
  const inicioEm = useRef(0); // timestamp local
  const faseRef = useRef<Fase>("carregando");
  const premiados = useRef(new Set<string>());
  const saidaDesde = useRef<number | null>(null);
  faseRef.current = fase;

  const eu: Lado = host ? 0 : 1;
  const meuNome = `${state.avatar} ${getNick() || "Jogador"}`;

  // Identidade e time (só no navegador)
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

  // ---------- Anfitrião: começar batalha ----------
  const enviarEstado = useCallback(() => {
    const b = bat.current;
    if (!b || !canal.current) return;
    const msg: MsgEstado = {
      batalhaId: batId.current,
      retrato: exportar(b),
      nomes,
      guestPid: guestPid.current,
      inicioEm: Math.max(0, inicioEm.current - Date.now()),
    };
    canal.current.send({ type: "broadcast", event: "estado", payload: msg });
  }, [nomes]);

  const comecar = useCallback(
    (convidado: PresencaSala) => {
      if (!meuTime) return;
      bat.current = criarBatalha(meuTime, convidado.time);
      batId.current = crypto.randomUUID();
      guestPid.current = convidado.pid;
      inicioEm.current = Date.now() + 3000;
      saidaDesde.current = null;
      setNomes([meuNome, convidado.nome]);
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
    const ch = sb.channel(salaChannel(codigo), { config: { broadcast: { self: false }, presence: { key: pid } } });
    canal.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const lista = Object.values(ch.presenceState<PresencaSala>()).flat();
      setJogadores(lista.map(({ pid, nome, host, time }) => ({ pid, nome, host, time })));
    });

    // Convidado recebe o estado da batalha
    ch.on("broadcast", { event: "estado" }, ({ payload }) => {
      if (host) return;
      const m = payload as MsgEstado;
      if (m.guestPid !== pid) {
        if (faseRef.current === "esperando") setFase("cheia");
        return;
      }
      if (m.batalhaId !== batId.current) {
        batId.current = m.batalhaId;
        setPremio(null);
        setPedidoRevanche(false);
        saidaDesde.current = null;
      }
      bat.current = importar(m.retrato);
      inicioEm.current = Date.now() + m.inicioEm;
      setNomes(m.nomes);
      setFase(m.retrato.venc !== null ? "fim" : "batalha");
    });

    // Anfitrião recebe as ações do convidado
    ch.on("broadcast", { event: "acao" }, ({ payload }) => {
      if (!host || payload.pid !== guestPid.current || payload.batalhaId !== batId.current) return;
      const b = bat.current;
      if (!b || Date.now() < inicioEm.current) return;
      const i = Number(payload.i);
      if (payload.tipo === "golpe") usarGolpe(b, 1, i);
      if (payload.tipo === "troca") trocar(b, 1, i);
    });

    ch.on("broadcast", { event: "revanche" }, ({ payload }) => {
      if (!host || payload.pid !== guestPid.current) return;
      setPedidoRevanche(true);
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ pid, nome: meuNome, host, time: meuTime } satisfies PresencaSala);
    });

    // Anfitrião anuncia a sala no saguão enquanto espera
    if (host) {
      const lb = sb.channel(LOBBY_CHANNEL, { config: { presence: { key: pid } } });
      lobby.current = lb;
      lb.subscribe(async (status) => {
        if (status === "SUBSCRIBED" && faseRef.current === "esperando") await lb.track({ codigo, nome: meuNome, criado: Date.now(), modo: "tatica" });
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

  // Convidado: sem anfitrião na sala por muito tempo
  useEffect(() => {
    if (host || fase !== "esperando") return;
    const t = setTimeout(() => {
      if (faseRef.current === "esperando" && !jogadores.some((p) => p.host)) setFase("sem-anfitriao");
    }, 7000);
    return () => clearTimeout(t);
  }, [host, fase, jogadores]);

  // ---------- Laço do jogo ----------
  useEffect(() => {
    if (fase !== "batalha") return;
    let ultimo = performance.now();
    let ultimoEnvio = 0;
    const t = setInterval(() => {
      const agora = performance.now();
      // Aba em segundo plano: o navegador atrasa o relógio, então aceitamos passos maiores
      const dt = Math.min(1, (agora - ultimo) / 1000);
      ultimo = agora;
      const b = bat.current;
      if (!b) return;
      const comecou = Date.now() >= inicioEm.current;

      // Saída do adversário
      const outroPid = host ? guestPid.current : jogadores.find((p) => p.host)?.pid;
      const outroPresente = !!outroPid && jogadores.some((p) => p.pid === outroPid);
      if (!outroPresente && b.vencedor === null) {
        saidaDesde.current ??= Date.now();
        if (Date.now() - saidaDesde.current > ESPERA_SAIDA_MS) encerrar(b, eu, "O adversário saiu da sala.");
      } else saidaDesde.current = null;

      if (host) {
        if (comecou) avancar(b, dt);
        if (agora - ultimoEnvio > ENVIO_MS || b.vencedor !== null) {
          ultimoEnvio = agora;
          enviarEstado();
        }
      } else if (comecou) {
        avancarVisual(b, dt);
      }
      if (b.vencedor !== null) setFase("fim");
      setTick((n) => n + 1);
    }, 50);
    return () => clearInterval(t);
  }, [fase, host, jogadores, enviarEstado, eu]);

  // Anfitrião reenvia o resultado algumas vezes (caso o convidado perca uma mensagem)
  useEffect(() => {
    if (!host || fase !== "fim") return;
    let n = 0;
    const t = setInterval(() => {
      enviarEstado();
      if (++n >= 5) clearInterval(t);
    }, 400);
    return () => clearInterval(t);
  }, [host, fase, enviarEstado]);

  // Moedas no fim (uma vez por batalha)
  useEffect(() => {
    const b = bat.current;
    if (fase !== "fim" || !b || b.vencedor === null || premiados.current.has(batId.current)) return;
    premiados.current.add(batId.current);
    const venceu = b.vencedor === eu;
    setPremio(recordGame("arena-das-lendas", venceu ? 4 : 0).coins);
  }, [fase, eu, recordGame]);

  // ---------- Ações do usuário ----------
  const golpe = (i: number) => {
    const b = bat.current;
    if (!b || Date.now() < inicioEm.current || !podeUsar(b, eu, i)) return;
    if (host) usarGolpe(b, 0, i);
    else {
      b.trava[1] = TRAVA_ACAO; // evita clique duplo até o próximo retrato
      canal.current?.send({ type: "broadcast", event: "acao", payload: { pid, batalhaId: batId.current, tipo: "golpe", i } });
    }
  };

  const troca = (i: number) => {
    const b = bat.current;
    if (!b || Date.now() < inicioEm.current || !podeTrocar(b, eu, i)) return;
    if (host) trocar(b, 0, i);
    else {
      b.trava[1] = TRAVA_ACAO;
      canal.current?.send({ type: "broadcast", event: "acao", payload: { pid, batalhaId: batId.current, tipo: "troca", i } });
    }
  };

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
  if (fase === "cheia") return <Aviso emoji="🚪" titulo="Sala cheia" texto="Essa batalha já tem dois jogadores." />;
  if (fase === "sem-anfitriao") return <Aviso emoji="👻" titulo="Sala vazia" texto="Quem criou a sala não está mais nela. Crie uma nova!" />;

  if (fase === "esperando") {
    const outros = jogadores.filter((p) => p.pid !== pid);
    return (
      <div className="card sala-espera">
        <div className="overlay-emoji">⏳</div>
        <h2>{host ? "Esperando adversário…" : "Entrando na sala…"}</h2>
        <p className="sala-codigo">Sala <strong>{codigo}</strong></p>
        {host && (
          <>
            <p className="muted">Mande o link para um amigo, ou espere alguém entrar pela lista de salas.</p>
            <button className="btn gold" onClick={copiar}>{copiado ? "✓ Link copiado!" : "🔗 Copiar link da sala"}</button>
          </>
        )}
        <p className="muted small">Na sala: {[meuNome + " (você)", ...outros.map((p) => p.nome)].join(" · ")}</p>
        <Link href="/lendas" className="btn small-btn">Cancelar</Link>
      </div>
    );
  }

  const b = bat.current!;
  const contagem = Math.ceil((inicioEm.current - Date.now()) / 1000);
  const venceu = b.vencedor === eu;

  return (
    <BattleView
      key={batId.current}
      b={b}
      eu={eu}
      onGolpe={golpe}
      onTroca={troca}
      nomes={nomes}
      barra={
        <>
          <span className="small"><strong>Sala {codigo}</strong></span>
          <span className="muted small">⏱ {Math.floor(b.tempo)}s{host ? " · não minimize esta aba" : ""}</span>
          <Link href="/lendas" className="btn small-btn">Sair</Link>
        </>
      }
      sobreposicao={
        fase === "fim" ? (
          <div className="overlay">
            <div className="overlay-emoji">{venceu ? "🏆" : "😵"}</div>
            <h2>{venceu ? "Vitória!" : "Derrota…"}</h2>
            <p className="muted">contra {nomes[eu === 0 ? 1 : 0]}</p>
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
        ) : contagem > 0 ? (
          <div className="overlay contagem"><p className="muted">{nomes[0]} vs {nomes[1]}</p><div className="contagem-num">{contagem}</div></div>
        ) : saidaDesde.current ? (
          <div className="overlay"><h2>📡 Adversário desconectado</h2><p className="muted">Esperando ele voltar…</p></div>
        ) : null
      }
    />
  );
}

export function Aviso({ emoji, titulo, texto }: { emoji: string; titulo: string; texto: string }) {
  return (
    <div className="card sala-espera">
      <div className="overlay-emoji">{emoji}</div>
      <h2>{titulo}</h2>
      <p className="muted">{texto}</p>
      <Link href="/lendas" className="btn gold">Voltar para a Arena</Link>
    </div>
  );
}

export function EscolherTime({ owned, onPronto }: { owned: string[]; onPronto: (t: string[]) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const minhas = LENDAS.filter((l) => possuiLenda(owned, l));
  const ok = () => {
    try {
      localStorage.setItem(TEAM_KEY, JSON.stringify(sel));
    } catch {}
    onPronto(sel);
  };
  return (
    <div className="card">
      <h2>Escolha 3 lendas para a batalha ({sel.length}/3)</h2>
      <div className="lenda-grid">
        {minhas.map((l) => (
          <button
            key={l.id}
            className={`lenda-card ${sel.includes(l.id) ? "on" : ""}`}
            onClick={() => setSel((s) => (s.includes(l.id) ? s.filter((x) => x !== l.id) : s.length >= 3 ? s : [...s, l.id]))}
          >
            <span className="lenda-emoji">{l.emoji}</span>
            <span className="lenda-nome">{l.nome}</span>
          </button>
        ))}
      </div>
      <button className="btn gold" style={{ marginTop: 14 }} disabled={sel.length !== 3} onClick={ok}>Entrar na batalha</button>
    </div>
  );
}
