"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { onlineEnabled, supabaseBrowser } from "@/lib/supabase";
import styles from "./racer.module.css";

const roomCode = /^[a-z0-9]{16}$/;
const playerLimit = 4;
const difficulties = ["facil", "medio", "dificil"] as const;
type Difficulty = typeof difficulties[number];
type Player = { pid: string; name: string; host: boolean; joinedAt: number; readyFor?: string };
type Room = { code: string; me: Player };
type Match = { id: string; startedAt: number; host: string; difficulty: Difficulty; fillBots: boolean; players: Player[] };
type Result = { id: number; name: string; place: number; time: number | null };
type Snapshot = {
  match: Match; frame: number; cars: unknown[]; raceClosed: boolean; remaining: number; elapsed: number; results: Result[] | null;
};
type Input = {
  raceId: string; seq: number; controls: { throttle: number; steer: number; drift: boolean };
};

function cleanCode(raw: string) {
  const value = raw.trim().toLowerCase();
  try {
    return new URL(value).searchParams.get("sala") ?? "";
  } catch {
    return value;
  }
}

function playerList(channel: RealtimeChannel) {
  return Object.entries(channel.presenceState<Player>()).flatMap(([key, entries]) => {
    const player = entries.find(entry => entry.pid === key && typeof entry.name === "string"
      && typeof entry.host === "boolean" && Number.isFinite(entry.joinedAt));
    return player ? [{ pid: key, name: player.name.slice(0, 24), host: player.host, joinedAt: player.joinedAt, readyFor: typeof player.readyFor === "string" ? player.readyFor : undefined }] : [];
  }).sort((a, b) => Number(b.host) - Number(a.host) || a.joinedAt - b.joinedAt || a.pid.localeCompare(b.pid));
}

function validInput(input: Input) {
  const controls = input?.controls;
  return controls && Number.isSafeInteger(input.seq)
    && [-1, 0, 1].includes(controls.steer) && [-1, 0, 1].includes(controls.throttle)
    && typeof controls.drift === "boolean";
}

export function Racer({ invite }: { invite: string }) {
  const [online, setOnline] = useState(Boolean(invite));
  const [code, setCode] = useState(invite);
  const [name, setName] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [network, setNetwork] = useState<"connecting" | "connected" | "lost">("connecting");
  const [difficulty, setDifficulty] = useState<Difficulty>("medio");
  const [fillBots, setFillBots] = useState(true);
  const [active, setActive] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [notice, setNotice] = useState("");
  const iframe = useRef<HTMLIFrameElement>(null);
  const port = useRef<MessagePort | null>(null);
  const channel = useRef<RealtimeChannel | null>(null);
  const roster = useRef<Player[]>([]);
  const race = useRef<Match | null>(null);
  const latest = useRef<Snapshot | null>(null);
  const readyFor = useRef<string | undefined>(undefined);

  const post = useCallback((type: string, payload: unknown) => {
    port.current?.postMessage({ type, payload });
  }, []);

  async function confirmRematch(raceId: string) {
    const ch = channel.current;
    if (!room || !ch || race.current?.id !== raceId || readyFor.current === raceId) return;
    readyFor.current = raceId;
    const tracked = await ch.track({ ...room.me, readyFor: raceId });
    if (race.current?.id !== raceId || channel.current !== ch) return;
    if (tracked !== "ok") {
      readyFor.current = undefined;
      post("rematch-status", { accepted: false });
    }
  }

  function connectFrame() {
    if (!room || !iframe.current?.contentWindow) return;
    port.current?.close();
    const bus = new MessageChannel();
    port.current = bus.port1;
    bus.port1.onmessage = ({ data }) => {
      if (data.type === "connected") {
        setFrameReady(true);
        if (race.current) {
          const i = race.current.players.findIndex(player => player.pid === room.me.pid);
          post("start", { match: race.current, host: room.me.host, id: 8 - i });
          if (latest.current && !room.me.host) post("snapshot", latest.current);
        }
      }
      if (data.type === "snapshot" && room.me.host && data.payload.match.id === race.current?.id) {
        if (data.payload.results && !latest.current?.results) setResults(data.payload.results);
        latest.current = data.payload;
        void channel.current?.send({ type: "broadcast", event: "state", payload: data.payload });
      }
      if (data.type === "rematch") void confirmRematch(data.payload.raceId);
      if (data.type === "input" && !room.me.host) {
        void channel.current?.send({ type: "broadcast", event: "input", payload: { ...data.payload, pid: room.me.pid } });
      }
    };
    iframe.current.contentWindow.postMessage({ type: "vr-connect" }, location.origin, [bus.port2]);
  }

  useEffect(() => {
    const client = supabaseBrowser();
    if (!room || !client) return;
    const ch = client.channel("volta-rapida-v2-" + room.code, {
      config: { presence: { key: room.me.pid }, broadcast: { self: false } },
    });
    channel.current = ch;
    ch.on("presence", { event: "sync" }, () => {
      roster.current = playerList(ch);
      setPlayers(roster.current);
    });
    ch.on("broadcast", { event: "state" }, ({ payload }) => {
      if (room.me.host) return;
      const state = payload as Snapshot;
      const match = state?.match;
      if (!Array.isArray(match?.players) || !Array.isArray(state.cars)
          || !roster.current.some(player => player.host && player.pid === match.host)
          || !difficulties.includes(match.difficulty) || typeof match.fillBots !== "boolean"
          || match.players.length < 2 || match.players.length > playerLimit
          || state.cars.length !== (match.fillBots ? 8 : match.players.length)
          || !Number.isSafeInteger(state.frame) || !Number.isFinite(state.elapsed)
          || !Number.isFinite(state.remaining) || (state.results !== null && !Array.isArray(state.results))) return;
      if (match.id !== race.current?.id) {
        if (race.current && match.startedAt <= race.current.startedAt) return;
        const index = match.players.findIndex(player => player.pid === room.me.pid);
        if (index < 0) {
          setNotice("A corrida está em andamento. Aguarde a próxima largada.");
          return;
        }
        race.current = match;
        readyFor.current = undefined;
        latest.current = null;
        setNotice("");
        setResults(null);
        setActive(true);
        post("start", { match, host: false, id: 8 - index });
      }
      if (latest.current && state.frame <= latest.current.frame) return;
      if (state.results && !latest.current?.results) setResults(state.results);
      latest.current = state;
      post("snapshot", state);
    });
    ch.on("broadcast", { event: "input" }, ({ payload }) => {
      if (!room.me.host || !race.current || payload?.raceId !== race.current.id || !validInput(payload)) return;
      const index = race.current.players.findIndex(player => player.pid === payload.pid);
      if (index > 0) post("input", { ...payload, id: 8 - index });
    });
    let current = true;
    ch.subscribe(async status => {
      if (!current) return;
      if (status === "SUBSCRIBED") {
        const tracked = await ch.track({ ...room.me, readyFor: readyFor.current });
        if (current) setNetwork(tracked === "ok" ? "connected" : "lost");
      } else if (status === "TIMED_OUT" || status === "CHANNEL_ERROR" || status === "CLOSED") {
        setNetwork("lost");
      }
    });
    return () => {
      current = false;
      channel.current = null;
      port.current?.close();
      port.current = null;
      void client.removeChannel(ch);
    };
  }, [room, post]);

  useEffect(() => {
    if (active) iframe.current?.focus();
  }, [active]);

  function enter(host: boolean) {
    if (!onlineEnabled) return;
    const value = host ? Array.from(crypto.getRandomValues(new Uint8Array(8)), byte => byte.toString(16).padStart(2, "0")).join("") : cleanCode(code);
    if (!roomCode.test(value)) {
      setNotice("Digite o código da sala ou cole o link do convite.");
      return;
    }
    const me = { pid: crypto.randomUUID(), name: name.trim().slice(0, 24) || (host ? "Anfitrião" : "Piloto"), host, joinedAt: Date.now() };
    setNotice("");
    setNetwork("connecting");
    setRoom({ code: value, me });
    history.replaceState(null, "", "?sala=" + value);
  }

  function leave() {
    setRoom(null);
    setActive(false);
    setFrameReady(false);
    setPlayers([]);
    setResults(null);
    setNotice("");
    roster.current = [];
    race.current = null;
    readyFor.current = undefined;
    latest.current = null;
    history.replaceState(null, "", location.pathname);
  }

  const start = useCallback((guests: Player[]) => {
    if (!room?.me.host || !frameReady || network !== "connected" || !guests.length) return;
    const match = { id: crypto.randomUUID(), startedAt: Date.now(), host: room.me.pid,
      difficulty, fillBots, players: [room.me, ...guests] };
    race.current = match;
    readyFor.current = undefined;
    latest.current = null;
    setResults(null);
    setNotice("");
    setActive(true);
    post("start", { match, host: true, id: 8 });
  }, [room, frameReady, network, difficulty, fillBots, post]);

  const rematchId = race.current?.id;
  const rematchPlayers = players.filter(player => race.current?.players.some(racer => racer.pid === player.pid));
  const confirmed = rematchPlayers.filter(player => player.readyFor === rematchId);
  useEffect(() => {
    // Check the latest race as well as the rendered state, since Presence can
    // update again before React renders the new match.
    if (!room?.me.host || !results || !latest.current?.results || rematchPlayers.length < 2) return;
    if (confirmed.length === rematchPlayers.length) start(rematchPlayers.filter(player => !player.host));
  }, [room, results, confirmed, rematchPlayers, start]);

  async function copy() {
    if (!room) return;
    const url = new URL(location.pathname, location.origin);
    url.searchParams.set("sala", room.code);
    try {
      await navigator.clipboard.writeText(url.href);
      setNotice("Convite copiado.");
    } catch {
      setNotice(url.href);
    }
  }

  const status = network === "connecting" ? "Conectando à sala…"
    : network === "lost" ? "Conexão interrompida. Reconectando…"
    : !players.some(player => player.host) ? "O anfitrião não está conectado."
    : players.length > playerLimit && !players.slice(0, playerLimit).some(player => player.pid === room?.me.pid)
      ? "Sala cheia. Aguarde uma vaga."
      : "";
  const solo = !room && !online;

  return <>
    {!room && <div className={styles.actions}>
      <button className={"btn" + (!online ? " gold" : "")} aria-pressed={!online} onClick={() => { setOnline(false); setNotice(""); }}>Jogar solo</button>
      <button className={"btn" + (online ? " gold" : "")} aria-pressed={online} onClick={() => setOnline(true)}>Jogar com amigos</button>
    </div>}
    {!room && online && <div className={styles.lobby}>
      {onlineEnabled ? <>
        <p>De 2 a 4 jogadores, com bots opcionais.</p>
        <label>Seu nome<input value={name} maxLength={24} onChange={event => setName(event.target.value)} /></label>
        <button className="btn gold" onClick={() => enter(true)}>Criar sala</button>
        <form className={styles.join} onSubmit={event => { event.preventDefault(); enter(false); }}>
          <label>Código ou link da sala<input value={code} maxLength={240} onChange={event => setCode(event.target.value)} /></label>
          <button className="btn" type="submit">Entrar</button>
        </form>
      </> : <p>O modo online está indisponível neste servidor.</p>}
    </div>}
    {room && <section className={styles.lobby}>
      <div className={styles.actions}>
        <button className="btn" onClick={copy}>Copiar convite</button>
        <button className="btn" onClick={leave}>Sair da sala</button>
        {room.me.host && (!active || results) && <>
          <label>Dificuldade dos bots
            <select value={difficulty} disabled={!fillBots} onChange={event => setDifficulty(event.target.value as Difficulty)}>
              <option value="facil">Fácil</option><option value="medio">Médio</option><option value="dificil">Difícil</option>
            </select>
          </label>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={fillBots} onChange={event => setFillBots(event.target.checked)} />
            Completar grid com bots
          </label>
          {!active && <button className="btn gold" disabled={network !== "connected" || !frameReady || players.length < 2}
            onClick={() => start(roster.current.filter(player => !player.host).slice(0, playerLimit - 1))}>
            Iniciar corrida
          </button>}
        </>}
      </div>
      {!active && <p>{players.slice(0, playerLimit).map(player => player.name + (player.host ? " (anfitrião)" : "")).join(" · ")}</p>}
      {!active && players.length === 1 && room.me.host && <p>Envie o convite para começar.</p>}
      {status && <p role="status">{status}</p>}
      {results && rematchPlayers.length >= 2 && <p role="status">
        {confirmed.length} de {rematchPlayers.length} confirmaram a revanche.
      </p>}
      {results && rematchPlayers.length < 2 && <p>É preciso ter pelo menos dois pilotos na sala para jogar de novo.</p>}
      {results && <ol className={styles.results} aria-label="Resultado dos jogadores">
        {results.map(row => <li key={row.id}>{row.name} · {row.time === null ? "não concluiu" : row.place + "º lugar · " + row.time.toFixed(2).replace(".", ",") + " s"}</li>)}
      </ol>}
    </section>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {(solo || room) && <iframe
      key={room?.code ?? "solo"} ref={iframe} className={styles.game} hidden={!solo && !active}
      title="Volta Rápida — Circuito do Bosque" src="/volta-rapida/index.html?v=43" onLoad={connectFrame}
    />}
  </>;
}
