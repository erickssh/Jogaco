import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OnlineRoom } from "@/components/lendas/OnlineRoom";
import { codigoValido } from "@/lib/lendas/online";

export const metadata: Metadata = {
  title: "Batalha online — Arena das Lendas",
  description: "Você foi desafiado para uma batalha na Arena das Lendas do Jogaço!",
};

export default async function SalaPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const c = codigo.toUpperCase();
  if (!codigoValido(c)) notFound();
  return (
    <div className="game-page">
      <Link href="/lendas" className="back">← Arena das Lendas</Link>
      <h1 className="game-title">⚔️ Batalha online</h1>
      <OnlineRoom codigo={c} />
    </div>
  );
}
