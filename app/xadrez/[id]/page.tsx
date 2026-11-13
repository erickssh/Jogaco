import type { Metadata } from "next";
import Link from "next/link";
import { OnlineMatch } from "@/components/chess/OnlineMatch";

export const metadata: Metadata = {
  title: "Partida de xadrez — Jogaço",
  description: "Você foi convidado para uma partida de xadrez online no Jogaço!",
};

export default async function OnlineChessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="game-page">
      <Link href="/xadrez" className="back">← Xadrez</Link>
      <h1 className="game-title">♞ Xadrez online</h1>
      <OnlineMatch id={id} />
    </div>
  );
}
