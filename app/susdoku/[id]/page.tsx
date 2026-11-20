import type { Metadata } from "next";
import { SusdokuFase } from "@/components/susdoku/SusdokuFase";

export const metadata: Metadata = {
  title: "Susdoku — caso | Jogaço",
  description: "Descubra onde cada pessoa estava e quem foi o culpado.",
};

export default async function SusdokuCasoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="game-page">
      <SusdokuFase id={id} />
    </div>
  );
}
