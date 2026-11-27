"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { onlineEnabled, supabaseBrowser } from "@/lib/supabase";
import { Menu, MenuHeader, difficulties, type Difficulty, type MenuScreen } from "./Menu";
import { accessForCode, cleanCode, createRoomCode, playerLimit, roomTopic, usePublicRooms, type Access } from "./rooms";
import { usePreferences } from "./preferences";
import { text, type MessageKey } from "../../public/volta-rapida/i18n";
import { carModels, defaultModel, isCarModel, sampleCarModels } from "../../public/volta-rapida/car-models";
import { useSoundtrack } from "./soundtrack";
import { forestCircuit } from "./championship";
import { useFullscreen } from "./useFullscreen";
import styles from "./racer.module.css";

type Player = { pid: string; name: string; host: boolean; joinedAt: number; carModel: string; readyFor?: string };
type Room = { code: string; access: Access; topic: string; me: Player };
type Match = { id: string; startedAt: number; host: string; difficulty: Difficulty; fillBots: boolean; players: Player[]; botModels: string[] };
type Result = { id: number; name: string; place: number; time: number | null };
type Snapshot = {
  match: Match; frame: number; cars: unknown[]; raceClosed: boolean; remaining: number; elapsed: number; results: Result[] | null;
  startEpoch?: number;
};
type ClockProbe = { pid: string; raceId: string; sent: number; hostTime?: number };
const clockNow = () => performance.timeOrigin + performance.now();
type Input = {
  raceId: string; seq: number; controls: { throttle: number; steer: number; drift: boolean };
};

function playerList(channel: RealtimeChannel) {
  return Object.entries(channel.presenceState<Player>()).flatMap(([key, entries]) => {
    const player = entries.find(entry => entry.pid === key && typeof entry.name === "string"
      && typeof entry.host === "boolean" && Number.isFinite(entry.joinedAt));
    return player ? [{
      pid: key, name: player.name.slice(0, 24), host: player.host, joinedAt: player.joinedAt,
      carModel: isCarModel(player.carModel) ? player.carModel : defaultModel,
      readyFor: typeof player.readyFor === "string" ? player.readyFor : undefined,
    }] : [];
  }).sort((a, b) => Number(b.host) - Number(a.host) || a.joinedAt - b.joinedAt || a.pid.localeCompare(b.pid));
}

function validInput(input: Input) {
  const controls = input?.controls;
  return controls && Number.isSafeInteger(input.seq)
    && [-1, 0, 1].includes(controls.steer) && [-1, 0, 1].includes(controls.throttle)
    && typeof controls.drift === "boolean";
}

export function Racer({ invite, standalone }: { invite: string; standalone: boolean }) {
  const [screen, setScreen] = useState<MenuScreen>(invite ? "join" : "main");
  const [soloRace, setSoloRace] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const roomRef = useRef<Room | null>(null);
  const roomAttempt = useRef(0);
  const [joining, setJoining] = useState(false);
  const [admitted, setAdmitted] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [network, setNetwork] = useState<"connecting" | "connected" | "lost">("connecting");
  const [difficulty, setDifficulty] = useState<Difficulty>("medio");
  const [fillBots, setFillBots] = useState(true);
  const [active, setActive] = useState(false);
  const [parked, setParked] = useState(false);
  const [parkedComplete, setParkedComplete] = useState(false);
  const parkedRef = useRef(false);
  const exitRoomRef = useRef<(destination: MenuScreen) => void>(() => {});
  const copyRef = useRef<() => Promise<void>>(async () => {});
  const [frameReady, setFrameReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [noticeKey, setNotice] = useState<MessageKey | "">("");
  const [inviteLink, setInviteLink] = useState("");
  const { preferences, loaded, update } = usePreferences();
  const t = (key:MessageKey, values?:Record<string, number>) => text(preferences.language,key,values);
  const { shell, expanded, scale, toggleFullscreen } = useFullscreen();
  const raceVisible = soloRace || (active && !parked);
  const musicReady = useSoundtrack(preferences, frameReady && loaded, forestCircuit, raceVisible);
  const bootReady = frameReady && loaded && musicReady;
  const listing = useMemo(() => room?.me.host && room.access === "publica" && network === "connected"
    ? { code:room.code, host:room.me.name, seats:Math.max(1,Math.min(playerLimit,players.length)), racing:active }
    : null, [room, network, players.length, active]);
  const { rooms, directoryStatus } = usePublicRooms(Boolean(listing) || (screen === "join" && !admitted), listing);
  const iframe = useRef<HTMLIFrameElement>(null);
  const connectedDocument = useRef<Document | null>(null);
  const port = useRef<MessagePort | null>(null);
  const channel = useRef<RealtimeChannel | null>(null);
  const roster = useRef<Player[]>([]);
  const race = useRef<Match | null>(null);
  const pendingStart = useRef<{ id: string; mode: "solo" | "online"; timeout: number } | null>(null);
  const failedMatch = useRef("");
  const latest = useRef<Snapshot | null>(null);
  const readyFor = useRef<string | undefined>(undefined);
  const clock = useRef<{ raceId: string; sent: number; pending: Set<number>; rtt: number; offset: number }>({
    raceId: "", sent: -Infinity, pending: new Set(), rtt: Infinity, offset: 0,
  });

  const post = useCallback((type: string, payload: unknown) => {
    port.current?.postMessage({ type, payload });
  }, []);

  const clearStart = useCallback(() => {
    if (pendingStart.current) window.clearTimeout(pendingStart.current.timeout);
    pendingStart.current = null;
    setStarting(false);
  }, []);

  const startFailed = useCallback((id:string) => {
    const pending = pendingStart.current;
    if (pending?.id !== id) return;
    if (pending.mode === "online") {
      failedMatch.current = id;
      race.current = null;
      latest.current = null;
      setActive(false);
    }
    clearStart();
    post("return-menu",{});
    setNotice("startFailed");
  }, [clearStart, post]);

  const waitForStart = useCallback((id: string, mode: "solo" | "online") => {
    if (pendingStart.current) window.clearTimeout(pendingStart.current.timeout);
    pendingStart.current = { id, mode, timeout:window.setTimeout(()=>startFailed(id),8000) };
    setStarting(true);
  }, [startFailed]);

  const unlockFrame = useCallback(() => {
    iframe.current?.contentWindow?.dispatchEvent(new Event("race-audio-unlock"));
  }, []);

  const confirmRematch = useCallback(async (raceId: string, room: Room) => {
    const ch = channel.current;
    if (!room || !ch || race.current?.id !== raceId || readyFor.current === raceId) return;
    readyFor.current = raceId;
    const tracked = await ch.track({ ...room.me, readyFor: raceId });
    if (race.current?.id !== raceId || channel.current !== ch) return;
    if (tracked !== "ok") {
      readyFor.current = undefined;
      post("rematch-status", { accepted: false });
    }
  }, [post]);

  const connectFrame = useCallback(() => {
    const frame = iframe.current;
    const document = frame?.contentDocument;
    if (!frame?.contentWindow || !document || document.readyState !== "complete" ||
        !document.querySelector("#race-setup") || connectedDocument.current === document) return;
    connectedDocument.current = document;
    port.current?.close();
    const bus = new MessageChannel();
    port.current = bus.port1;
    bus.port1.onmessage = ({ data }) => {
      const room = roomRef.current;
      if (data.type === "loading-progress") setLoadProgress(data.payload.progress);
      if (data.type === "load-failed") setLoadFailed(true);
      if (data.type === "connected") {
        setFrameReady(true);
        if (room && race.current) {
          const i = race.current.players.findIndex(player => player.pid === room.me.pid);
          post("start", { match: race.current, host: room.me.host, id: 8 - i });
          if (latest.current && !room.me.host) post("snapshot", latest.current);
        }
      }
      if (data.type === "race-started" && data.payload?.id === pendingStart.current?.id) {
        const mode = pendingStart.current?.mode;
        clearStart();
        if (mode === "solo") setSoloRace(true);
        if (mode === "online") setActive(true);
      }
      if (data.type === "start-failed") startFailed(data.payload?.id);
      if (data.type === "menu" && !room) {
        setSoloRace(false);
        setScreen(data.payload?.screen === "quick" ? "quick" : "main");
      }
      if (data.type === "fullscreen") void toggleFullscreen();
      if (data.type === "snapshot" && room?.me.host && data.payload.match.id === race.current?.id) {
        if (data.payload.results && !latest.current?.results) setResults(data.payload.results);
        latest.current = data.payload;
        if (parkedRef.current && data.payload.raceClosed) setParkedComplete(true);
        void channel.current?.send({ type: "broadcast", event: "state", payload: data.payload });
      }
      if (data.type === "retire" && room && !room.me.host && data.payload.raceId === race.current?.id) {
        void channel.current?.send({ type:"broadcast", event:"retire", payload:{ raceId:data.payload.raceId, pid:room.me.pid } });
      }
      if (data.type === "race-home" && room && data.payload.raceId === race.current?.id) {
        if (room.me.host && !latest.current?.raceClosed) {
          parkedRef.current = true;
          setParked(true);
          setScreen("main");
        } else exitRoomRef.current("main");
      }
      if (data.type === "race-room-action" && room) {
        const {action, value} = data.payload;
        if (action === "copy") void copyRef.current();
        if (room.me.host && latest.current?.results) {
          if (action === "fillBots" && typeof value === "boolean") setFillBots(value);
          if (action === "difficulty" && difficulties.includes(value)) setDifficulty(value);
        }
      }
      if (data.type === "rematch" && room) void confirmRematch(data.payload.raceId, room);
      if (data.type === "input" && room && !room.me.host) {
        void channel.current?.send({ type: "broadcast", event: "input", payload: { ...data.payload, pid: room.me.pid } });
      }
    };
    frame.contentWindow.postMessage({ type: "vr-connect" }, location.origin, [bus.port2]);
    if (navigator.userActivation?.hasBeenActive) unlockFrame();
  }, [clearStart, confirmRematch, post, startFailed, toggleFullscreen, unlockFrame]);

  useEffect(() => {
    if (frameReady && loaded) post("preferences", { ...preferences, muted: preferences.muted || parked, expanded, scale });
  }, [expanded, scale, frameReady, loaded, parked, post, preferences]);

  useEffect(() => {
    const frame = iframe.current;
    frame?.addEventListener("load",connectFrame);
    let mounted = true;
    queueMicrotask(() => { if (mounted) connectFrame(); });
    return () => {
      mounted = false;
      frame?.removeEventListener("load",connectFrame);
      port.current?.close();
      if (pendingStart.current) window.clearTimeout(pendingStart.current.timeout);
    };
  }, [connectFrame]);

  useEffect(() => {
    const client = supabaseBrowser();
    if (!room || !client) return;
    const ch = client.channel(room.topic, {
      config: { presence: { key: room.me.pid }, broadcast: { self: false } },
    });
    let admittedHere = room.me.host;
    channel.current = ch;
    ch.on("presence", { event: "sync" }, () => {
      roster.current = playerList(ch);
      setPlayers(roster.current);
      if (roster.current.some(player => player.host)) {
        admittedHere = true;
        setAdmitted(true);
        setJoining(false);
      }
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
      if (match.id === failedMatch.current) return;
      if (match.id !== race.current?.id) {
        if (race.current && match.startedAt <= race.current.startedAt) return;
        const index = match.players.findIndex(player => player.pid === room.me.pid);
        if (index < 0) {
          setNotice("waitNext");
          return;
        }
        race.current = match;
        readyFor.current = undefined;
        latest.current = null;
        setNotice("");
        setInviteLink("");
        setResults(null);
        waitForStart(match.id,"online");
        post("start", { match, host: false, id: 8 - index });
      }
      if (latest.current && state.frame <= latest.current.frame) return;
      if (state.results && !latest.current?.results) setResults(state.results);
      latest.current = state;
      post("snapshot", state);
      if (state.remaining > 450 && Number.isFinite(state.startEpoch)) {
        if (clock.current.raceId !== match.id) {
          clock.current = { raceId: match.id, sent: -Infinity, pending: new Set(), rtt: Infinity, offset: 0 };
        }
        const sent = clockNow();
        if (sent - clock.current.sent >= 190 && clock.current.pending.size < 8) {
          clock.current.sent = sent;
          clock.current.pending.add(sent);
          void ch.send({ type: "broadcast", event: "clock-request", payload: { pid: room.me.pid, raceId: match.id, sent } });
        }
      }
    });
    ch.on("broadcast", { event: "clock-request" }, ({ payload }) => {
      const request = payload as ClockProbe;
      if (!room.me.host || !race.current || request?.raceId !== race.current.id
          || !race.current.players.some(player => player.pid === request.pid)
          || !Number.isFinite(request.sent)) return;
      void ch.send({ type: "broadcast", event: "clock-reply", payload: { ...request, hostTime: clockNow() } });
    });
    ch.on("broadcast", { event: "clock-reply" }, ({ payload }) => {
      const reply = payload as ClockProbe;
      const sample = clock.current;
      if (room.me.host || reply?.pid !== room.me.pid || sample.raceId !== reply.raceId
          || !sample.pending.delete(reply.sent) || typeof reply.hostTime !== "number"
          || !Number.isFinite(reply.hostTime)) return;
      const rtt = clockNow() - reply.sent;
      if (rtt >= sample.rtt || rtt > 1000) return;
      sample.rtt = rtt;
      sample.offset = reply.hostTime - reply.sent - rtt / 2;
      post("clock", { raceId: reply.raceId, offset: sample.offset });
    });
    ch.on("broadcast", { event: "retire" }, ({ payload }) => {
      if (!room.me.host || !race.current || payload?.raceId !== race.current.id) return;
      const index = race.current.players.findIndex(player => player.pid === payload.pid);
      if (index > 0) post("retire", { raceId:payload.raceId, id:8-index });
    });
    ch.on("broadcast", { event: "input" }, ({ payload }) => {
      if (!room.me.host || !race.current || payload?.raceId !== race.current.id || !validInput(payload)) return;
      const index = race.current.players.findIndex(player => player.pid === payload.pid);
      if (index > 0) post("input", { ...payload, id: 8 - index });
    });
    let current = true;
    function failJoin() {
      if (!current || admittedHere) return;
      roomRef.current = null;
      setRoom(null);
      setJoining(false);
      setPlayers([]);
      setNotice(room?.access === "privada"
        ? "privateFailed"
        : "roomUnavailable");
    }
    const deadline = window.setTimeout(failJoin, 3800);
    ch.subscribe(async status => {
      if (!current) return;
      if (status === "SUBSCRIBED") {
        const tracked = await ch.track({ ...room.me, readyFor: readyFor.current });
        if (current) {
          setNetwork(tracked === "ok" ? "connected" : "lost");
          if (room.me.host && tracked === "ok") {
            setAdmitted(true);
            setJoining(false);
          }
        }
      } else if (status === "TIMED_OUT" || status === "CHANNEL_ERROR" || status === "CLOSED") {
        setNetwork("lost");
      }
    });
    return () => {
      current = false;
      window.clearTimeout(deadline);
      channel.current = null;
      void client.removeChannel(ch);
    };
  }, [room, post, waitForStart]);

  useLayoutEffect(() => {
    if (!raceVisible) return;
    iframe.current?.focus();
    iframe.current?.contentDocument?.getElementById("game")?.focus({ preventScroll:true });
  }, [raceVisible]);

  async function enter({ name, password, code, access, host, carModel }: {
    name: string; password: string; code: string; access: Access; host: boolean; carModel: string;
  }) {
    if (!onlineEnabled || joining || roomRef.current || !isCarModel(carModel)) return;
    const value = host ? createRoomCode(access) : cleanCode(code);
    const kind = accessForCode(value);
    if (!kind) {
      setNotice("enterCode");
      return;
    }
    if (kind === "privada" && password.length < (host ? 8 : 1)) {
      setNotice(host ? "enterNewPassword" : "enterPassword");
      return;
    }
    const attempt = ++roomAttempt.current;
    const me = { pid: crypto.randomUUID(), name: name.trim().slice(0, 24) || (host ? t("host") : t("driver")), host, joinedAt: Date.now(), carModel };
    setNotice("");
    setInviteLink("");
    setJoining(true);
    setNetwork("connecting");
    try {
      const topic = await roomTopic(value,password);
      if (attempt !== roomAttempt.current) return;
      const nextRoom = { code:value, access:kind, topic, me };
      roomRef.current = nextRoom;
      setAdmitted(host);
      setRoom(nextRoom);
      const url = new URL(location.href);
      url.searchParams.set("sala",value);
      history.replaceState(null,"",url);
    } catch {
      if (attempt !== roomAttempt.current) return;
      setJoining(false);
      setNotice("roomFailed");
    }
  }

  const leave = useCallback((destination: MenuScreen = "online") => {
    clearStart();
    roomAttempt.current++;
    roomRef.current = null;
    setRoom(null);
    setAdmitted(false);
    setJoining(false);
    setScreen(destination);
    parkedRef.current = false;
    setParked(false);
    setParkedComplete(false);
    setActive(false);
    setPlayers([]);
    setResults(null);
    setNotice("");
    setInviteLink("");
    roster.current = [];
    race.current = null;
    readyFor.current = undefined;
    latest.current = null;
    post("return-menu",{});
    const url = new URL(location.href);
    url.searchParams.delete("sala");
    history.replaceState(null,"",url);
  }, [clearStart, post]);

  useLayoutEffect(() => { exitRoomRef.current = leave; }, [leave]);
  useEffect(() => {
    if (parkedComplete) leave(screen);
  }, [leave, parkedComplete, screen]);

  useEffect(() => {
    if (!raceVisible) return;
    const openMenu = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat) return;
      event.preventDefault();
      post("open-race-menu", {});
    };
    window.addEventListener("keydown",openMenu);
    return () => window.removeEventListener("keydown",openMenu);
  }, [post, raceVisible]);

  function navigate(next: MenuScreen) {
    if (pendingStart.current?.mode === "solo") {
      clearStart();
      post("return-menu",{});
    }
    if (joining) leave();
    if (parkedRef.current && next === "online") {
      parkedRef.current = false;
      setParked(false);
      return;
    }
    setNotice("");
    setInviteLink("");
    setScreen(next);
  }

  function startSolo(level: Difficulty, bots: number, carModel: string) {
    if (!bootReady || pendingStart.current || !isCarModel(carModel)) return;
    if (parkedRef.current) { setNotice("waitNext"); return; }
    const id = crypto.randomUUID();
    setNotice("");
    setInviteLink("");
    waitForStart(id,"solo");
    unlockFrame();
    post("solo-start",{ id, difficulty:level, bots, carModel });
  }

  function roomOptions() {
    return <>
      <label className={styles.checkbox}>
        <input type="checkbox" checked={fillBots} onChange={event=>setFillBots(event.target.checked)}/>
        {t("fillBots")}
      </label>
      <label>{t("botDifficulty")}
        <select value={difficulty} disabled={!fillBots} onChange={event=>setDifficulty(event.target.value as Difficulty)}>
          {difficulties.map(level=><option key={level} value={level}>{t(level)}</option>)}
        </select>
      </label>
    </>;
  }

  const start = useCallback((guests: Player[]) => {
    if (!room?.me.host || !bootReady || network !== "connected" || !guests.length || pendingStart.current) return;
    const players = [room.me, ...guests];
    const botModels = fillBots ? sampleCarModels(8 - players.length, players.map(player => player.carModel)) : [];
    const match = { id: crypto.randomUUID(), startedAt: Date.now(), host: room.me.pid,
      difficulty, fillBots, players, botModels };
    race.current = match;
    readyFor.current = undefined;
    latest.current = null;
    setResults(null);
    setNotice("");
    setInviteLink("");
    waitForStart(match.id,"online");
    unlockFrame();
    post("start", { match, host: true, id: 8 });
  }, [room, bootReady, network, difficulty, fillBots, post, unlockFrame, waitForStart]);

  const rematchId = race.current?.id;
  const rematchPlayers = players.filter(player => race.current?.players.some(racer => racer.pid === player.pid));
  const confirmed = rematchPlayers.filter(player => player.readyFor === rematchId);
  useEffect(() => {
    // Check the latest race as well as the rendered state, since Presence can
    // update again before React renders the new match.
    if (parkedRef.current || !room?.me.host || !results || !latest.current?.results || rematchPlayers.length < 2) return;
    if (confirmed.length === rematchPlayers.length) start(rematchPlayers.filter(player => !player.host));
  }, [room, results, confirmed, rematchPlayers, start]);

  async function copy() {
    if (!room) return;
    const url = new URL(location.href);
    url.searchParams.set("sala", room.code);
    try {
      await navigator.clipboard.writeText(url.href);
      setInviteLink("");
      setNotice("copied");
    } catch {
      setInviteLink(url.href);
      setNotice("");
    }
  }

  useLayoutEffect(() => { copyRef.current = copy; });

  const notice = noticeKey ? t(noticeKey) : inviteLink;
  const status = network === "connecting" ? t("roomConnecting")
    : network === "lost" ? t("connectionLost")
    : !players.some(player => player.host) ? t("hostOffline")
    : players.length > playerLimit && !players.slice(0, playerLimit).some(player => player.pid === room?.me.pid)
      ? t("roomFull")
      : "";
  const roomInfo = [status,notice,results && (rematchPlayers.length>=2
    ? t("rematchCount",{count:confirmed.length,total:rematchPlayers.length}) : t("rematchMinimum"))].filter(Boolean).join(" ");
  useEffect(() => {
    if (room && active) post("race-room-menu",{settings:room.me.host && Boolean(results),fillBots,difficulty,message:roomInfo});
  }, [room,active,results,fillBots,difficulty,roomInfo,post]);
  const showLobby = bootReady && room && admitted && !active;
  const showMenu = bootReady && !raceVisible && !showLobby;

  const menuControls = { preferences, update, expanded, toggleFullscreen };
  return <div className={standalone ? styles.standalone : undefined}><div ref={shell} lang={preferences.language} style={{"--fullscreen-scale":scale} as React.CSSProperties} className={styles.shell + (expanded ? " " + styles.fullscreen : "")}>
    <iframe ref={iframe} className={styles.game} title={forestCircuit.name}
      src="/volta-rapida/index.html?menu=1&v=77" allow="autoplay; fullscreen"
      data-visible={raceVisible} inert={!raceVisible} />
    <div hidden={!showMenu}>
      <Menu screen={screen} shown={showMenu} navigate={navigate} invite={invite} onlineAvailable={onlineEnabled}
        rooms={rooms} directoryStatus={directoryStatus} pending={joining} notice={notice}
        starting={starting} parkedRace={parked} onRace={startSolo} onRoom={enter} {...menuControls}/>
    </div>
    {showLobby && <div className={styles.menuShell}>
      <MenuHeader {...menuControls}/>
      <div className={styles.menuLayout}>
        <section className={styles.menuPanel + " " + styles.lobby} aria-label={t("onlineRoom")}>
          <button className={styles.back} onClick={()=>leave()}><span aria-hidden="true">‹&nbsp;</span>{t("leaveRoom")}</button>
          <h2>{t("onlineRoom")}</h2>
          <div className={styles.menuStack}>
            <p className={styles.detail}>{room.access==="privada"?t("privateRoom"):t("publicRoom")} · {Math.min(players.length,playerLimit)}/{playerLimit} {t("drivers")}</p>
            <ul className={styles.roomList}>{players.slice(0,playerLimit).map(player=>
              <li key={player.pid}><span>{player.name} · {carModels.find(car=>car.id===player.carModel)?.name}</span>
                <span>{player.host?t("host"):player.pid===room.me.pid?t("you"):t("driver")}</span></li>)}</ul>
            {room.me.host && <>{roomOptions()}
              <button className={styles.primary} disabled={starting || network!=="connected" || players.length<2}
                onClick={()=>start(roster.current.filter(player=>!player.host).slice(0,playerLimit-1))}>
                {starting?t("preparing"):t("startRace")}
              </button>
            </>}
            <button className={styles.secondary} onClick={copy}>{t("copyInvite")}</button>
            {status && <p className={styles.detail} role="status">{status}</p>}
            {notice && <p className={styles.notice} role="status">{notice}</p>}
          </div>
        </section>
      </div>
    </div>}
    <div className={styles.boot} data-complete={bootReady} aria-hidden={bootReady}>
      <div>
        <img src="/volta-rapida/overdrive-mark.webp" alt="Overdrive" width="1080" height="720" fetchPriority="high"/>
        {loadFailed && <p role="status">{t("loadFailed")}</p>}
        {loadFailed ? <button className={styles.secondary} onClick={()=>location.reload()}>{t("retry")}</button>
          : <progress max={1} value={loadProgress*.85+(musicReady ? .15 : 0)} aria-label={t("loading")}/>}
      </div>
    </div>
  </div></div>;
}
