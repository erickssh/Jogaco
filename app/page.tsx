import { Catalog } from "@/components/Catalog";
import { DailyBanner } from "@/components/DailyBanner";

export default function Home() {
  return (
    <>
      <section className="hero">
        <div>
          <h1>Jogue grátis. Ganhe moedas. Troque por recompensas.</h1>
          <p>Cada partida rende moedas. Complete missões diárias, mantenha sua sequência e desbloqueie itens.</p>
        </div>
        <DailyBanner />
      </section>
      <Catalog />
    </>
  );
}
