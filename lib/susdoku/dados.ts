// Susdoku — dados: pessoas, lugares, cômodos, objetos e casos.
// Todo o conteúdo é original do Jogaço.

export type Genero = "f" | "m";

export type ObjetoDef = { nome: string; g: Genero; emoji: string };

export const OBJETOS: Record<string, ObjetoDef> = {
  cadeira: { nome: "cadeira", g: "f", emoji: "🪑" },
  quadro: { nome: "quadro", g: "m", emoji: "🖼️" },
  relogio: { nome: "relógio", g: "m", emoji: "🕰️" },
  estante: { nome: "estante", g: "f", emoji: "📚" },
  microscopio: { nome: "microscópio", g: "m", emoji: "🔬" },
  computador: { nome: "computador", g: "m", emoji: "💻" },
  arquivo: { nome: "arquivo", g: "m", emoji: "🗄️" },
  telefone: { nome: "telefone", g: "m", emoji: "☎️" },
  arvore: { nome: "árvore", g: "f", emoji: "🌳" },
  bola: { nome: "bola", g: "f", emoji: "⚽" },
  torneira: { nome: "torneira", g: "f", emoji: "🚰" },
  espelho: { nome: "espelho", g: "m", emoji: "🪞" },
  fogao: { nome: "fogão", g: "m", emoji: "🍳" },
  cafeteira: { nome: "cafeteira", g: "f", emoji: "☕" },
  sofa: { nome: "sofá", g: "m", emoji: "🛋️" },
  tv: { nome: "TV", g: "f", emoji: "📺" },
  cama: { nome: "cama", g: "f", emoji: "🛏️" },
  carro: { nome: "carro", g: "m", emoji: "🚗" },
  ferramentas: { nome: "caixa de ferramentas", g: "f", emoji: "🧰" },
  flor: { nome: "flor", g: "f", emoji: "🌻" },
  planta: { nome: "planta", g: "f", emoji: "🪴" },
  janela: { nome: "janela", g: "f", emoji: "🪟" },
  lixeira: { nome: "lixeira", g: "f", emoji: "🗑️" },
  cesto: { nome: "cesto de roupas", g: "m", emoji: "🧺" },
  banheira: { nome: "banheira", g: "f", emoji: "🛁" },
  mochila: { nome: "mochila", g: "f", emoji: "🎒" },
  trofeu: { nome: "troféu", g: "m", emoji: "🏆" },
};

/** Objetos que podem aparecer em qualquer cômodo. */
export const OBJETOS_GERAIS = ["janela", "planta", "lixeira"];

export type ComodoDef = { nome: string; g: Genero; objetos: string[] };

export type Cenario = {
  titulo: string;
  /** {em} = "na Biblioteca", {de} = "da Biblioteca" */
  texto: string;
  /** frase do desfecho: "foi ela quem ___" */
  acao: string;
  tom: "leve" | "medio" | "crime";
};

export type LugarDef = {
  id: string;
  nome: string;
  emoji: string;
  /** pessoas do lugar são crianças (alunos) ou adultos */
  criancas: boolean;
  comodos: ComodoDef[];
  cenarios: Cenario[];
};

export const LUGARES: Record<string, LugarDef> = {
  escola: {
    id: "escola",
    nome: "Escola",
    emoji: "🏫",
    criancas: true,
    comodos: [
      { nome: "Sala de Aula", g: "f", objetos: ["cadeira", "quadro", "relogio", "mochila"] },
      { nome: "Biblioteca", g: "f", objetos: ["estante", "cadeira", "computador"] },
      { nome: "Cantina", g: "f", objetos: ["fogao", "torneira", "cadeira"] },
      { nome: "Secretaria", g: "f", objetos: ["computador", "arquivo", "telefone"] },
      { nome: "Pátio", g: "m", objetos: ["arvore", "bola", "flor"] },
      { nome: "Banheiro", g: "m", objetos: ["torneira", "espelho"] },
      { nome: "Laboratório", g: "m", objetos: ["microscopio", "torneira", "computador"] },
      { nome: "Quadra", g: "f", objetos: ["bola", "trofeu"] },
      { nome: "Sala dos Professores", g: "f", objetos: ["sofa", "cafeteira", "arquivo"] },
    ],
    cenarios: [
      { titulo: "Cola na prova", texto: "Alguém pegou o gabarito da prova de matemática, que estava guardado {em}.", acao: "pegou o gabarito", tom: "leve" },
      { titulo: "O celular sumido", texto: "O celular da professora Marta sumiu {de}.", acao: "escondeu o celular", tom: "leve" },
      { titulo: "Bilhete misterioso", texto: "Um bilhete anônimo apareceu {em}, e ninguém assume quem escreveu.", acao: "escreveu o bilhete", tom: "leve" },
      { titulo: "O lanche desaparecido", texto: "O lanche do Pedro sumiu {de} no recreio.", acao: "comeu o lanche", tom: "leve" },
      { titulo: "Tinta derramada", texto: "Alguém derramou tinta azul {em} e saiu de fininho.", acao: "derramou a tinta", tom: "leve" },
      { titulo: "A chave escondida", texto: "A chave da diretoria foi escondida {em}.", acao: "escondeu a chave", tom: "leve" },
      { titulo: "Experiência sabotada", texto: "Alguém estragou a experiência de ciências que estava {em}.", acao: "sabotou a experiência", tom: "leve" },
      { titulo: "A caixinha vazia", texto: "Sumiu o dinheiro da caixinha da festa junina, que ficava {em}.", acao: "pegou o dinheiro", tom: "medio" },
      { titulo: "A bola furada", texto: "A bola nova do campeonato apareceu furada {em}.", acao: "furou a bola", tom: "leve" },
      { titulo: "O grande furto da formatura", texto: "Na véspera da formatura, o troféu da escola sumiu {de}!", acao: "levou o troféu", tom: "medio" },
    ],
  },
  casa: {
    id: "casa",
    nome: "Casa",
    emoji: "🏠",
    criancas: false,
    comodos: [
      { nome: "Sala de Estar", g: "f", objetos: ["sofa", "tv", "quadro"] },
      { nome: "Cozinha", g: "f", objetos: ["fogao", "torneira", "cafeteira"] },
      { nome: "Quarto", g: "m", objetos: ["cama", "espelho", "relogio"] },
      { nome: "Banheiro", g: "m", objetos: ["banheira", "torneira", "espelho"] },
      { nome: "Escritório", g: "m", objetos: ["computador", "estante", "telefone"] },
      { nome: "Garagem", g: "f", objetos: ["carro", "ferramentas"] },
      { nome: "Jardim", g: "m", objetos: ["arvore", "flor"] },
      { nome: "Lavanderia", g: "f", objetos: ["cesto", "torneira"] },
    ],
    cenarios: [
      { titulo: "O bolo de aniversário", texto: "Alguém comeu metade do bolo de aniversário que estava {em}.", acao: "comeu o bolo", tom: "leve" },
      { titulo: "O vaso quebrado", texto: "O vaso favorito da vovó apareceu quebrado {em}.", acao: "quebrou o vaso", tom: "leve" },
      { titulo: "Roubo das joias", texto: "As joias da família sumiram {de} durante o jantar.", acao: "roubou as joias", tom: "crime" },
      { titulo: "Assassinato na mansão", texto: "O Sr. Almeida foi encontrado sem vida {em}. Quem estava sozinho com ele é o culpado.", acao: "cometeu o crime", tom: "crime" },
      { titulo: "O cofre aberto", texto: "O cofre que ficava {em} foi aberto e esvaziado.", acao: "abriu o cofre", tom: "crime" },
    ],
  },
};

export type PessoaDef = { nome: string; g: Genero };

export const NOMES: PessoaDef[] = [
  { nome: "Ana", g: "f" }, { nome: "Oliver", g: "m" }, { nome: "Caio", g: "m" }, { nome: "Caroline", g: "f" },
  { nome: "Bia", g: "f" }, { nome: "Davi", g: "m" }, { nome: "Lara", g: "f" }, { nome: "Enzo", g: "m" },
  { nome: "Júlia", g: "f" }, { nome: "Rafael", g: "m" }, { nome: "Sofia", g: "f" }, { nome: "Theo", g: "m" },
  { nome: "Marina", g: "f" }, { nome: "Lucas", g: "m" }, { nome: "Isabela", g: "f" }, { nome: "Gabriel", g: "m" },
  { nome: "Helena", g: "f" }, { nome: "Miguel", g: "m" }, { nome: "Valentina", g: "f" }, { nome: "Bruno", g: "m" },
  { nome: "Luna", g: "f" }, { nome: "Arthur", g: "m" }, { nome: "Clara", g: "f" }, { nome: "Samuel", g: "m" },
  { nome: "Yasmin", g: "f" }, { nome: "Heitor", g: "m" }, { nome: "Alice", g: "f" }, { nome: "Joaquim", g: "m" },
  { nome: "Manuela", g: "f" }, { nome: "Kauã", g: "m" }, { nome: "Nina", g: "f" }, { nome: "Otávio", g: "m" },
];

const TONS = ["🏻", "🏼", "🏽", "🏾", "🏿"];
const BASE: Record<string, Record<Genero, string[]>> = {
  crianca: { f: ["👧"], m: ["👦"] },
  adulto: { f: ["👩", "👱‍♀️", "👩‍🦱", "👩‍🦰"], m: ["👨", "👱‍♂️", "👨‍🦱", "👨‍🦰", "🧔"] },
};

/** Emoji de pessoa com tom de pele (variado e determinístico pelo sorteio). */
export function emojiPessoa(g: Genero, crianca: boolean, rnd: () => number) {
  const lista = BASE[crianca ? "crianca" : "adulto"][g];
  const base = lista[Math.floor(rnd() * lista.length)];
  const tom = TONS[Math.floor(rnd() * TONS.length)];
  // insere o tom logo após o primeiro caractere (antes de um eventual ZWJ)
  const chars = Array.from(base);
  return chars[0] + tom + chars.slice(1).join("");
}

/** Cores de piso para os cômodos. */
export const CORES_COMODO = ["#fde2b8", "#c9e7f5", "#d6f0c8", "#f3cfe0", "#e2d6f7", "#fff1a8", "#cfe9e5", "#f6d3c4"];

// ---------- Aleatoriedade com semente ----------
export function rngSemente(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function embaralhar<T>(a: T[], rnd: () => number): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export const sortear = <T,>(a: T[], rnd: () => number) => a[Math.floor(rnd() * a.length)];

/** Semente numérica a partir de um texto (ex.: data do Caso do Dia). */
export function hashTexto(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
