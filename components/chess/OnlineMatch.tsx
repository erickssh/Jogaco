"use client";

import Link from "next/link";
import { Chess } from "chess.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChessBoard, MoveInput, statusText } from "./ChessBoard";
import { MoveList } from "./MoveList";
import { supabaseBrowser, ChessGameRow } from "@/lib/supabase";
import { chessApi, getNick, getSeat, rewardedKey, saveSeat, Seat } from "@/lib/chessOnline";
import { useRewards } from "../RewardsProvider";

const RESULT_TEXT: Record<string, string> = { "1-0": "Brancas vencem", "0-1": "Pretas vencem", "1/2-1/2": "Empate" };

export function OnlineMatch({ id }: { id: string }) {
  const sb = supabaseBrowser();
  const { recordGame, state } = useRewards();
  const [row, setRow] = useState<ChessGameRow | null>(null);
  const [missing, setMissing] = useState(false);
  const [seat, setSeat] = useState<Seat | null>(null);
  const [optimistic, setOptimistic] = useState<{ fen: string; last: { from: string; to: string } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [earned, setEarned] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data } = await sb.from("chess_games").select("*").eq("id", id).maybeSingle();
    if (data) setRow(data as ChessGameRow);
    else setMissing(true);
  }, [sb, id]);

  useEffect(() => setSeat(getSeat(id)), [id]);

  // Carrega a partida e escuta as mudanças em tempo real
  useEffect(() => {
    if (!sb) return;
    load();
    const channel = sb
      .channel(`chess-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chess_games", filter: `id=eq.${id}` }, (payload) => {
        setRow(payload.new as ChessGameRow);
        setOptimistic(null);
      })
      .subscribe();
    // Rede de segurança caso o tempo real caia
    const t = setInterval(load, 15000);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      sb.removeChannel(channel);
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [sb, id, load]);

  const history = useMemo(() => {
    const c = new Chess();
    if (row?.pgn) c.loadPgn(row.pgn);
    return c;
  }, [row?.pgn]);

  // Moedas no fim da partida (uma vez por partida)
  useEffect(() => {
    if (!row || row.status !== "finished" || !seat) return;
    try {
      if (localStorage.getItem(rewardedKey(id))) return;
      localStorage.setItem(rewardedKey(id), "1");
    } catch {
      return;
    }
    const won = (row.result === "1-0" && seat.color === "w") || (row.result === "0-1" && seat.color === "b");
    const score = won ? 4 : row.result === "1/2-1/2" ? 1 : 0;
    setEarned(history.history().length >= 10 ? recordGame("xadrez", score).coins : 0);
  }, [row, seat, id, history, recordGame]);

  if (!sb) return <p className="muted center">Modo online não configurado.</p>;
  if (missing) return <p className="muted center">Partida não encontrada. <Link href="/xadrez">Voltar</Link></p>;
  if (!row) return <p className="muted center">Carregando partida…</p>;

  const fen = optimistic?.fen ?? row.fen;
  const last = optimistic?.last ?? row.last_move;
  const live = new Chess(fen);
  const myTurn = row.status === "active" && seat && live.turn() === seat.color && !optimistic;

  const move = async (m: MoveInput) => {
    if (!seat) return;
    const c = new Chess();
    if (row.pgn) c.loadPgn(row.pgn);
    try {
      c.move(m);
    } catch {
      return;
    }
    setOptimistic({ fen: c.fen(), last: { from: m.from, to: m.to } });
    setError(null);
    try {
      await chessApi({ action: "move", id, token: seat.token, ...m });
      load(); // garante a atualização mesmo sem tempo real
    } catch (e) {
      setOptimistic(null);
      setError((e as Error).message);
      load();
    }
  };

  const join = async () => {
    setError(null);
    try {
      const r = await chessApi<Seat & { id: string }>({ action: "join", id, name: `${state.avatar} ${getNick() || "Jogador"}` });
      const s = { color: r.color, token: r.token };
      saveSeat(id, s);
      setSeat(s);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const resign = async () => {
    if (!seat || !confirm("Tem certeza que quer desistir?")) return;
    try {
      await chessApi({ action: "resign", id, token: seat.token });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  let status: string;
  if (row.status === "waiting") status = seat ? "Aguardando adversário… envie o link!" : "Esta partida está esperando um adversário.";
  else if (row.status === "finished") status = `${RESULT_TEXT[row.result ?? ""] ?? "Fim"}${row.reason ? ` por ${row.reason}` : ""}.`;
  else if (!seat) status = `Assistindo · ${statusText(live)}`;
  else status = live.isCheck() ? (myTurn ? "Você está em xeque! Sua vez." : "Xeque! Vez do adversário.") : myTurn ? "Sua vez!" : "Vez do adversário…";

  const orientation = seat?.color ?? "w";
  const top = orientation === "w" ? row.black_name : row.white_name;
  const bottom = orientation === "w" ? row.white_name : row.black_name;

  return (
    <div className="chess-layout">
      <div>
        <div className="player-tag">{top ?? "⏳ Aguardando…"}</div>
        <ChessBoard fen={fen} orientation={orientation} movable={myTurn ? seat!.color : null} onMove={move} lastMove={last} />
        <div className="player-tag me">{bottom ?? "⏳ Aguardando…"}{seat ? " (você)" : ""}</div>
      </div>
      <aside className="chess-side card">
        <div className={`chess-status ${row.status === "finished" ? "over" : myTurn ? "turn" : ""}`}>{status}</div>
        {earned !== null && (
          <p className="earned-line">{earned > 0 ? `+${earned} 🪙` : "Sem moedas nesta partida (mínimo de 10 lances)."}</p>
        )}
        {error && <p className="error">{error}</p>}

        {row.status === "waiting" && !seat && (
          <button className="btn gold" onClick={join}>♟ Entrar como pretas</button>
        )}
        {row.status === "waiting" && seat && (
          <button className="btn gold" onClick={copy}>{copied ? "✓ Link copiado!" : "🔗 Copiar link do convite"}</button>
        )}

        <MoveList history={history.history()} />

        <div className="row">
          {row.status === "active" && seat && <button className="btn small-btn" onClick={resign}>🏳 Desistir</button>}
          <Link href="/xadrez" className="btn small-btn gold">Nova partida</Link>
        </div>
      </aside>
    </div>
  );
}
