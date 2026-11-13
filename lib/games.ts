export type Category = "Arcade" | "Puzzle" | "Ação" | "Tabuleiro";

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
  /** Página própria (em vez de /jogo/slug). */
  href?: string;
  /** Não mostrar "recorde" (ex.: xadrez, onde a pontuação é o resultado). */
  hideRecord?: boolean;
  online?: boolean;
  scoreLabel: string;
  /** Converte a pontuação de uma partida em moedas. */
  coinsFor: (score: number) => number;
};

export const GAMES: Game[] = [
  {
    slug: "arena-das-lendas",
    title: "Arena das Lendas",
    description: "Batalhas em tempo real com as lendas do folclore brasileiro.",
    howTo: "Monte um time de 3 lendas, use os golpes quando recarregarem e troque de lenda na hora certa.",
    category: "Ação",
    emoji: "⚔️",
    gradient: "linear-gradient(135deg,#1b998b,#6a0dad)",
    kind: "proprio",
    href: "/lendas",
    hideRecord: true,
    scoreLabel: "",
    // 0 = derrota, 2/3/4 = vitória (fácil / médio / difícil)
    coinsFor: (s) => [0, 0, 30, 40, 55][Math.min(Math.max(s, 0), 4)],
  },
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
  {
    slug: "xadrez",
    title: "Xadrez",
    description: "Jogue contra o computador, com um amigo no mesmo aparelho ou online.",
    howTo: "Toque em uma peça e depois na casa de destino.",
    category: "Tabuleiro",
    emoji: "♞",
    gradient: "linear-gradient(135deg,#3a3a52,#b58863)",
    kind: "proprio",
    href: "/xadrez",
    hideRecord: true,
    online: true,
    scoreLabel: "",
    // 0 = derrota, 1 = empate, 2/3/4 = vitória (fácil / médio / difícil ou online)
    coinsFor: (s) => [0, 15, 25, 35, 50][Math.min(Math.max(s, 0), 4)],
  },
];

export const CATEGORIES: Category[] = ["Arcade", "Puzzle", "Ação", "Tabuleiro"];

export function getGame(slug: string) {
  return GAMES.find((g) => g.slug === slug);
}

export function gameHref(g: Game) {
  return g.href ?? `/jogo/${g.slug}`;
}
