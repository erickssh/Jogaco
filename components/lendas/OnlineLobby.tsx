"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onlineEnabled, supabaseBrowser } from "@/lib/supabase";
import { getNick, saveNick } from "@/lib/chessOnline";
import { LOBBY_CHANNEL, PresencaLobby, marcarAnfitriao, meuPid, novoCodigo } from "@/lib/lendas/online";

/** Painel "Batalhar online": criar sala ou entrar numa sala aberta. */
export function OnlineLobby({ timePronto }: { timePronto: boolean }) {
  const router = useRouter();
  const [salas, setSalas] = useState<PresencaLobby[]>([]);
  const [nick, setNick] = useState("");

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
        .map(({ codigo, nome, criado }) => ({ codigo, nome, criado }))
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
    router.push(`/lendas/sala/${c}`);
  };

  const entrar = (c: string) => {
    saveNick(nick.trim());
    router.push(`/lendas/sala/${c}`);
  };

  return (
    <section className="card online-lobby">
      <h2>🌐 Batalhar online</h2>
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
              <span>{s.nome} <span className="muted small">· sala {s.codigo}</span></span>
              <button className="btn small-btn gold" disabled={!timePronto} onClick={() => entrar(s.codigo)}>Desafiar</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
