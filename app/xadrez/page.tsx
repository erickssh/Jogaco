import type { Metadata } from "next";
import Link from "next/link";
import { ChessLobby } from "@/components/chess/ChessLobby";

export const metadata: Metadata = { title: "Xadrez — Jogaço" };

export default function ChessPage() {
  return (
    <div className="game-page">
      <Link href="/" className="back">← Todos os jogos</Link>
      <h1 className="game-title">♞ Xadrez</h1>
      <ChessLobby />
    </div>
  );
}
