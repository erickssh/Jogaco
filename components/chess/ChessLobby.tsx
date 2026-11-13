"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LocalChess } from "./LocalChess";
import { onlineEnabled, supabaseBrowser, ChessGameRow } from "@/lib/supabase";
import { chessApi, getNick, saveNick, saveSeat, Seat } from "@/lib/chessOnline";
import { useRewards } from "../RewardsProvider";

type Mode = "ai" | "local" | "online";

export function ChessLobby() {
  const [mode, setMode] = useState<Mode>("ai");

  return (
    <div className="chess-page">
      <div className="chess-tabs" role="tablist">
        <button className={`chip ${mode === "ai" ? "on" : ""}`} onClick={() => setMode("ai")} role="tab" aria-selected={mode === "ai"}>🤖 Contra o computador</button>
        <button className={`chip ${mode === "online" ? "on" : ""}`} onClick={() => setMode("online")} role="tab" aria-selected={mode === "online"}>🌐 Online</button>
        <button className={`chip ${mode === "local" ? "on" : ""}`} onClick={() => setMode("local")} role="tab" aria-selected={mode === "local"}>👥 2 jogadores (mesmo aparelho)</button>
      </div>
      {mode === "ai" && <LocalChess key="ai" mode="ai" />}
      {mode === "local" && <LocalChess key="local" mode="local" />}
      {mode === "online" && <OnlinePanel />}
    </div>
  );
}

function OnlinePanel() {
  const router = useRouter();
  const { state } = useRewards();
  const [nick, setNick] = useState("");
  const [open, setOpen] = useState<ChessGameRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setNick(getNick()), []);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    let alive = true;
    const load = async () => {
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data } = await sb
        .from("chess_games")
        .select("*")
        .eq("status", "waiting")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10);
      if (alive && data) setOpen(data as ChessGameRow[]);
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!onlineEnabled) {
    return (
      <div className="card">
        <h2>🌐 Modo online ainda não ativado</h2>
        <p className="muted">
          Para jogar online é preciso ligar o site a um banco de dados Supabase (grátis). As instruções estão no README do
          projeto, na seção “Xadrez online”. Enquanto isso, jogue contra o computador ou com um amigo no mesmo aparelho.
        </p>
      </div>
    );
  }

  const name = () => `${state.avatar} ${nick.trim() || "Jogador"}`;

  const go = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      saveNick(nick.trim());
      const r = await chessApi<Seat & { id: string }>({ ...body, name: name() });
      saveSeat(r.id, { color: r.color, token: r.token });
      router.push(`/xadrez/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="two-col">
      <section className="card">
        <h2>Criar partida</h2>
        <p className="muted">Você joga de brancas. Depois é só mandar o link para o seu amigo, ou esperar alguém entrar pela lista.</p>
        <label className="field">
          Seu apelido
          <input className="search" value={nick} maxLength={20} placeholder="Ex.: Rei do Xadrez" onChange={(e) => setNick(e.target.value)} />
        </label>
        <button className="btn gold" disabled={busy} onClick={() => go({ action: "create" })}>
          {busy ? "Criando…" : "♟ Criar partida online"}
        </button>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card">
        <h2>Partidas esperando adversário</h2>
        {open.length === 0 ? (
          <p className="muted">Nenhuma partida aberta agora. Crie uma!</p>
        ) : (
          <ul className="records">
            {open.map((g) => (
              <li key={g.id}>
                <span>{g.white_name ?? "Jogador"}</span>
                <button className="btn small-btn gold" disabled={busy} onClick={() => go({ action: "join", id: g.id })}>
                  Jogar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
