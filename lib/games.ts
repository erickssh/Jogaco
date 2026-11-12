export type Category = "Arcade" | "Puzzle" | "Ação";

export type Game = {
  slug: string;
  title: string;
  description: string;
  howTo: string;
  category: Category;
  emoji: string;
  gradient: string;
  /** "proprio" = jogo nosso, pontuação validada e vale moedas.
   *  "parceiro" = jogo de distribuidora (iframe), sem pontuação confiável. */
  kind: "proprio" | "parceiro";
  embedUrl?: string;
  scoreLabel: string;
  /** Converte a pontuação de uma partida em moedas. */
  coinsFor: (score: number) => number;
};

export const GAMES: Game[] = [
  {
    slug: "serpente-neon",
    title: "Serpente Neon",
    description: "Guie a serpente, coma as frutas e não bata em si mesma.",
    howTo: "Setas ou WASD no computador. No celular, deslize o dedo ou use os botões.",
    category: "Arcade",
    emoji: "🐍",
    gradient: "linear-gradient(135deg,#00c6a7,#1e4bd8)",
    kind: "proprio",
    scoreLabel: "frutas",
    coinsFor: (s) => Math.min(s * 2, 120),
  },
  {
    slug: "memoria-magica",
    title: "Memória Mágica",
    description: "Encontre todos os pares com o menor número de jogadas.",
    howTo: "Toque em duas cartas. Se forem iguais, ficam viradas. Menos jogadas = mais pontos.",
    category: "Puzzle",
    emoji: "🃏",
    gradient: "linear-gradient(135deg,#ff6fd8,#7a2cf5)",
    kind: "proprio",
    scoreLabel: "pontos",
    coinsFor: (s) => Math.min(Math.round(s / 2), 60),
  },
  {
    slug: "esquiva-espacial",
    title: "Esquiva Espacial",
    description: "Desvie dos asteroides pelo maior tempo possível.",
    howTo: "Mova a nave com as setas, o mouse ou arrastando o dedo na tela.",
    category: "Ação",
    emoji: "🚀",
    gradient: "linear-gradient(135deg,#ff9a3c,#d7263d)",
    kind: "proprio",
    scoreLabel: "segundos",
    coinsFor: (s) => Math.min(s, 120),
  },
];

export const CATEGORIES: Category[] = ["Arcade", "Puzzle", "Ação"];

export function getGame(slug: string) {
  return GAMES.find((g) => g.slug === slug);
}
