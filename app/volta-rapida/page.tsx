import type { Metadata } from "next";
import Link from "next/link";
import { Racer } from "./Racer";

export const metadata: Metadata = {
  title: "Overdrive — Jogaço",
  description: "Corra no circuito Whispering Woods contra a máquina ou com amigos.",
};

export default async function RacerPage({ searchParams }: { searchParams: Promise<{ sala?: string; play?: string }> }) {
  const { sala, play } = await searchParams;
  const invite = typeof sala === "string" ? sala : "";
  if (play === "1") return <Racer invite={invite} standalone />;
  return (
    <div className="game-page">
      <Link className="back" href="/">← Todos os jogos</Link>
      <h1 className="game-title">Overdrive</h1>
      <Racer invite={invite} standalone={false} />
    </div>
  );
}
