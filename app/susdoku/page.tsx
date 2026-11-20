import type { Metadata } from "next";
import Link from "next/link";
import { SusdokuHome } from "@/components/susdoku/SusdokuHome";

export const metadata: Metadata = {
  title: "Susdoku — o sudoku de detetive | Jogaço",
  description: "Quebra-cabeça de lógica: descubra onde cada pessoa estava e quem foi o culpado. Um caso novo todo dia.",
};

export default function SusdokuPage() {
  return (
    <div className="game-page">
      <Link href="/" className="back">← Todos os jogos</Link>
      <h1 className="game-title">🔎 Susdoku</h1>
      <SusdokuHome />
    </div>
  );
}
