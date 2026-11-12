import Link from "next/link";
import { notFound } from "next/navigation";
import { GAMES, getGame } from "@/lib/games";
import { GamePlayer } from "@/components/GamePlayer";

export function generateStaticParams() {
  return GAMES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = getGame(slug);
  return { title: g ? `${g.title} — Jogaço` : "Jogo não encontrado — Jogaço" };
}

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) notFound();

  const others = GAMES.filter((g) => g.slug !== slug);

  return (
    <div className="game-page">
      <Link href="/" className="back">← Todos os jogos</Link>
      <h1 className="game-title">{game.emoji} {game.title}</h1>
      <GamePlayer slug={game.slug} />
      <div className="game-info">
        <div className="card">
          <h2>Como jogar</h2>
          <p>{game.howTo}</p>
          <p className="muted">{game.description}</p>
        </div>
        <div className="card">
          <h2>Outros jogos</h2>
          <ul className="others">
            {others.map((g) => (
              <li key={g.slug}>
                <Link href={`/jogo/${g.slug}`}>{g.emoji} {g.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
