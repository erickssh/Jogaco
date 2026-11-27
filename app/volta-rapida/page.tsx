import type { Metadata } from "next";
import Link from "next/link";
import { Racer } from "./Racer";

export const metadata: Metadata = {
  title: "Volta Rápida — Jogaço",
  description: "Corra no Circuito do Bosque contra a máquina ou com amigos.",
};

export default async function RacerPage({ searchParams }: { searchParams: Promise<{ sala?: string }> }) {
  const { sala } = await searchParams;
  return (
    <div className="game-page">
      <Link className="back" href="/">← Todos os jogos</Link>
      <h1 className="game-title">🏎️ Volta Rápida</h1>
      <Racer invite={typeof sala === "string" ? sala : ""} />
    </div>
  );
}
