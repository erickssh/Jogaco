"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onlineEnabled, supabaseBrowser } from "@/lib/supabase";
import { getNick, saveNick } from "@/lib/chessOnline";
import { LOBBY_CHANNEL, ModoOnline, PresencaLobby, marcarAnfitriao, meuPid, novoCodigo, urlSala } from "@/lib/lendas/online";

/** Painel "Batalhar online": criar sala (Ação ou Tática) ou entrar numa sala aberta. */
export function OnlineLobby({ timePronto }: { timePronto: boolean }) {
  const router = useRouter();
  const [salas, setSalas] = useState<PresencaLobby[]>([]);
  const [nick, setNick] = useState("");
  const [modo, setModo] = useState<ModoOnline>("acao");

  useEffect(() => setNick(getNick()), []);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const eu = meuPid();
    // Só escuta o saguão (sem anunciar nada)
    const ch = sb.channel(LOBBY_CHANNEL, { config: { presence: { key: `ouvinte-${eu}` } } });
    ch.on("presence", { event: "sync" }, () => {
      const lista = Object.values(ch.presenceState<PresencaLobby>())
        .flat()
        .filter((p) => p.codigo)
        .map(({ codigo, nome, criado, modo }) => ({ codigo, nome, criado, modo }))
        .sort((a, b) => b.criado - a.criado);
      setSalas(lista.slice(0, 10));
    });
    ch.subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, []);

  if (!onlineEnabled) return null;

  const criar = () => {
    saveNick(nick.trim());
    const c = novoCodigo();
    marcarAnfitriao(c);
    router.push(urlSala(c, modo));
  };

  const entrar = (s: PresencaLobby) => {
    saveNick(nick.trim());
    router.push(urlSala(s.codigo, s.modo ?? "tatica"));
  };

  return (
    <section className="card online-lobby">
      <h2>🌐 Batalhar online</h2>
      <div className="modo-escolha" role="tablist" aria-label="Modo do duelo online">
        <button className={`chip ${modo === "acao" ? "on" : ""}`} onClick={() => setModo("acao")} role="tab" aria-selected={modo === "acao"}>
          🎮 Ação — ao vivo, com movimento
        </button>
        <button className={`chip ${modo === "tatica" ? "on" : ""}`} onClick={() => setModo("tatica")} role="tab" aria-selected={modo === "tatica"}>
          🎴 Tática — só os golpes
        </button>
      </div>
      <div className="online-row">
        <label className="field">
          Seu apelido
          <input className="search" value={nick} maxLength={20} placeholder="Ex.: Mestre das Lendas" onChange={(e) => setNick(e.target.value)} />
        </label>
        <button className="btn gold" disabled={!timePronto} onClick={criar} title={timePronto ? "" : "Escolha 3 lendas primeiro"}>
          ⚔️ Criar sala
        </button>
      </div>
      {!timePronto && <p className="muted small">Escolha 3 lendas acima para poder batalhar online.</p>}

      <h3>Salas esperando adversário</h3>
      {salas.length === 0 ? (
        <p className="muted small">Nenhuma sala aberta agora. Crie uma e chame um amigo!</p>
      ) : (
        <ul className="records">
          {salas.map((s) => (
            <li key={s.codigo}>
              <span>
                {s.nome} <span className="muted small">· {s.modo === "acao" ? "🎮 Ação" : "🎴 Tática"} · {s.codigo}</span>
              </span>
              <button className="btn small-btn gold" disabled={!timePronto} onClick={() => entrar(s)}>Desafiar</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
