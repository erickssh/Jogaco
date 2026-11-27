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
  /** ainda não dá moedas (recompensas definidas depois) */
  semMoedas?: boolean;
  scoreLabel: string;
  /** Converte a pontuação de uma partida em moedas. */
  coinsFor: (score: number) => number;
};

export const GAMES: Game[] = [
  {
    slug: "volta-rapida",
    title: "Volta Rápida",
    description: "Dispute três voltas no Circuito do Bosque contra a máquina ou com amigos.",
    howTo: "Use WASD para dirigir e Shift para derrapar. Crie uma sala e compartilhe o convite para jogar online.",
    category: "Arcade",
    emoji: "🏎️",
    gradient: "linear-gradient(135deg,#3d6749,#a44536)",
    kind: "proprio",
    href: "/volta-rapida",
    online: true,
    hideRecord: true,
    semMoedas: true,
    scoreLabel: "",
    coinsFor: () => 0,
  },
  {
    slug: "gruta-do-ocaso",
    title: "Gruta do Ocaso",
    description: "Explore a caverna, monte sua build e seja o último a sobreviver.",
    howTo: "Use WASD para mover, o mouse para mirar e atacar, e Q, E e R para usar habilidades. Crie uma sala para jogar com amigos ou treine contra bots.",
    category: "Ação",
    emoji: "🏮",
    gradient: "linear-gradient(135deg,#192d34,#865335)",
    kind: "proprio",
    href: "/gruta-do-ocaso",
    hideRecord: true,
    semMoedas: true,
    // Selo "Online" desligado até o servidor de salas da Gruta estar hospedado
    // (OCASO_ROOMS_ORIGIN na Vercel). Sem ele, só o treino contra bots funciona.
    online: false,
    scoreLabel: "",
    coinsFor: () => 0,
  },
  {
    slug: "susdoku",
    title: "Susdoku",
    description: "O sudoku de detetive: descubra onde cada pessoa estava e quem foi o culpado.",
    howTo: "Use as pistas para posicionar cada pessoa na planta. Uma pessoa por linha e por coluna.",
    category: "Puzzle",
    emoji: "🔎",
    gradient: "linear-gradient(135deg,#2a1f4a,#d7263d)",
    kind: "proprio",
    href: "/susdoku",
    hideRecord: true,
    semMoedas: true,
    scoreLabel: "",
    coinsFor: () => 0,
  },
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
