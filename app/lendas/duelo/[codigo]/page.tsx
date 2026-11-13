import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OnlineDuel } from "@/components/lendas/OnlineDuel";
import { codigoValido } from "@/lib/lendas/online";

export const metadata: Metadata = {
  title: "Duelo online — Arena das Lendas",
  description: "Você foi desafiado para um duelo ao vivo na Arena das Lendas do Jogaço!",
};

export default async function DueloPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const c = codigo.toUpperCase();
  if (!codigoValido(c)) notFound();
  return (
    <div className="game-page">
      <Link href="/lendas" className="back">← Arena das Lendas</Link>
      <h1 className="game-title">🎮 Duelo online</h1>
      <OnlineDuel codigo={c} />
    </div>
  );
}
