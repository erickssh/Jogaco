import type { Metadata } from "next";
import Link from "next/link";
import { Explorar } from "@/components/lendas/Explorar";

export const metadata: Metadata = {
  title: "Explorar — Arena das Lendas",
  description: "Explore o mundo das lendas brasileiras, enfrente lendas selvagens e capture-as com amuletos.",
};

export default function ExplorarPage() {
  return (
    <div className="game-page">
      <Link href="/lendas" className="back">← Arena das Lendas</Link>
      <h1 className="game-title">🗺️ Explorar</h1>
      <Explorar />
    </div>
  );
}
