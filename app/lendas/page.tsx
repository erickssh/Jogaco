import type { Metadata } from "next";
import Link from "next/link";
import { LendasGame } from "@/components/lendas/LendasGame";

export const metadata: Metadata = {
  title: "Arena das Lendas — Jogaço",
  description: "Batalhas em tempo real com as lendas do folclore brasileiro.",
};

export default function LendasPage() {
  return (
    <div className="game-page">
      <Link href="/" className="back">← Todos os jogos</Link>
      <h1 className="game-title">⚔️ Arena das Lendas</h1>
      <LendasGame />
    </div>
  );
}
