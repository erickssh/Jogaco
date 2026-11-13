// Arena das Lendas — criaturas do folclore brasileiro. Conteúdo 100% original do Jogaço.

export type Elemento = "fogo" | "agua" | "mata" | "pedra" | "vento" | "espirito";

export const ELEMENTOS: Record<Elemento, { nome: string; cor: string; icone: string }> = {
  fogo: { nome: "Fogo", cor: "#ff6b35", icone: "🔥" },
  agua: { nome: "Água", cor: "#2f8fff", icone: "💧" },
  mata: { nome: "Mata", cor: "#38b000", icone: "🌿" },
  pedra: { nome: "Pedra", cor: "#a47148", icone: "🪨" },
  vento: { nome: "Vento", cor: "#7ad7f0", icone: "🌪️" },
  espirito: { nome: "Espírito", cor: "#9d4edd", icone: "👻" },
};

/** Multiplicador ataque → defensor. Ausente = 1. */
export const VANTAGENS: Record<Elemento, Partial<Record<Elemento, number>>> = {
  fogo: { mata: 1.5, espirito: 1.5, agua: 0.67, pedra: 0.67 },
  agua: { fogo: 1.5, pedra: 1.5, mata: 0.67, vento: 0.67 },
  mata: { agua: 1.5, pedra: 1.5, fogo: 0.67, vento: 0.67 },
  pedra: { fogo: 1.5, vento: 1.5, agua: 0.67, mata: 0.67 },
  vento: { mata: 1.5, agua: 1.5, pedra: 0.67, espirito: 0.67 },
  espirito: { vento: 1.5, espirito: 1.5, fogo: 0.67 },
};

export type EfeitoId =
  | "queimado" | "envenenado" | "sono" | "atordoado" | "lento"
  | "enfraquecido" | "escudo" | "furia" | "acelerado" | "protegido";

export const EFEITOS: Record<EfeitoId, { nome: string; icone: string; ruim: boolean; duracao: number }> = {
  queimado: { nome: "Queimado", icone: "🔥", ruim: true, duracao: 6 },
  envenenado: { nome: "Envenenado", icone: "☠️", ruim: true, duracao: 6 },
  sono: { nome: "Dormindo", icone: "💤", ruim: true, duracao: 2.2 },
  atordoado: { nome: "Atordoado", icone: "💫", ruim: true, duracao: 1.5 },
  lento: { nome: "Lento", icone: "🐢", ruim: true, duracao: 5 },
  enfraquecido: { nome: "Enfraquecido", icone: "⬇️", ruim: true, duracao: 6 },
  escudo: { nome: "Escudo", icone: "🛡️", ruim: false, duracao: 6 },
  // fúria: +35% de ataque (ver calcularDano)
  furia: { nome: "Fúria", icone: "💢", ruim: false, duracao: 6 },
  acelerado: { nome: "Acelerado", icone: "⚡", ruim: false, duracao: 6 },
  protegido: { nome: "Protegido", icone: "✨", ruim: false, duracao: 1.2 },
};

/** Elementos imunes a certos efeitos. */
export const IMUNIDADES: Partial<Record<EfeitoId, Elemento>> = {
  queimado: "fogo",
  envenenado: "pedra",
  sono: "espirito",
};

export type Golpe = {
  nome: string;
  elemento: Elemento;
  poder: number; // 0 = não causa dano
  recarga: number; // segundos
  noAlvo?: { efeito: EfeitoId; chance: number };
  emSi?: EfeitoId[];
  cura?: number; // fração da vida máxima
  dreno?: number; // fração do dano que vira cura
  recuo?: number; // fração do dano que volta para quem atacou
};

export type Lenda = {
  id: string;
  nome: string;
  emoji: string;
  elemento: Elemento;
  descricao: string;
  vida: number;
  ataque: number;
  defesa: number;
  velocidade: number;
  preco: number; // 0 = já vem liberada
  golpes: [Golpe, Golpe, Golpe, Golpe]; // o primeiro é o ataque básico
};

const basico = (e: Elemento, nome: string): Golpe => ({ nome, elemento: e, poder: 25, recarga: 0 });

export const LENDAS: Lenda[] = [
  {
    id: "boitata", nome: "Boitatá", emoji: "🐍", elemento: "fogo", preco: 0,
    descricao: "A cobra de fogo que protege os campos.",
    vida: 110, ataque: 60, defesa: 45, velocidade: 55,
    golpes: [
      basico("fogo", "Brasa"),
      { nome: "Olhos de Fogo", elemento: "fogo", poder: 55, recarga: 5, noAlvo: { efeito: "queimado", chance: 0.4 } },
      { nome: "Fogo-Fátuo", elemento: "fogo", poder: 0, recarga: 12, emSi: ["furia"] },
      { nome: "Serpente Flamejante", elemento: "fogo", poder: 90, recarga: 9 },
    ],
  },
  {
    id: "curupira", nome: "Curupira", emoji: "🧒", elemento: "mata", preco: 0,
    descricao: "Guardião da floresta, de pés virados para trás.",
    vida: 95, ataque: 55, defesa: 40, velocidade: 75,
    golpes: [
      basico("mata", "Chicote de Cipó"),
      { nome: "Pés Virados", elemento: "mata", poder: 30, recarga: 6, noAlvo: { efeito: "lento", chance: 1 } },
      { nome: "Espinhos", elemento: "mata", poder: 45, recarga: 5, noAlvo: { efeito: "envenenado", chance: 0.6 } },
      { nome: "Fúria da Mata", elemento: "mata", poder: 85, recarga: 10 },
    ],
  },
  {
    id: "iara", nome: "Iara", emoji: "🧜‍♀️", elemento: "agua", preco: 0,
    descricao: "A mãe-d'água, cujo canto encanta quem ouve.",
    vida: 102, ataque: 62, defesa: 45, velocidade: 60,
    golpes: [
      basico("agua", "Respingo"),
      { nome: "Canto Encantado", elemento: "espirito", poder: 0, recarga: 12, noAlvo: { efeito: "sono", chance: 1 } },
      { nome: "Correnteza", elemento: "agua", poder: 65, recarga: 5, noAlvo: { efeito: "lento", chance: 0.3 } },
      { nome: "Maré Alta", elemento: "agua", poder: 90, recarga: 10 },
    ],
  },
  {
    id: "saci", nome: "Saci", emoji: "🌪️", elemento: "vento", preco: 0,
    descricao: "Travesso e veloz, some num redemoinho.",
    vida: 96, ataque: 57, defesa: 38, velocidade: 85,
    golpes: [
      basico("vento", "Rajada"),
      { nome: "Redemoinho", elemento: "vento", poder: 55, recarga: 5, noAlvo: { efeito: "atordoado", chance: 0.25 } },
      { nome: "Gorro Mágico", elemento: "espirito", poder: 0, recarga: 12, emSi: ["protegido", "acelerado"] },
      { nome: "Travessura", elemento: "vento", poder: 40, recarga: 6, noAlvo: { efeito: "enfraquecido", chance: 0.6 } },
    ],
  },
  {
    id: "mapinguari", nome: "Mapinguari", emoji: "🦍", elemento: "pedra", preco: 0,
    descricao: "Gigante da Amazônia, de couro duro como pedra.",
    vida: 138, ataque: 59, defesa: 58, velocidade: 30,
    golpes: [
      basico("pedra", "Pedrada"),
      { nome: "Casco de Pedra", elemento: "pedra", poder: 0, recarga: 10, emSi: ["escudo"] },
      { nome: "Grito da Floresta", elemento: "pedra", poder: 70, recarga: 7, noAlvo: { efeito: "atordoado", chance: 0.3 } },
      { nome: "Avalanche", elemento: "pedra", poder: 100, recarga: 11, recuo: 0.15 },
    ],
  },
  {
    id: "boto", nome: "Boto", emoji: "🐬", elemento: "agua", preco: 0,
    descricao: "Encantado dos rios, cura e confunde.",
    vida: 115, ataque: 48, defesa: 50, velocidade: 50,
    golpes: [
      basico("agua", "Respingo"),
      { nome: "Bálsamo do Rio", elemento: "agua", poder: 0, recarga: 12, cura: 0.3 },
      { nome: "Encanto", elemento: "espirito", poder: 30, recarga: 8, noAlvo: { efeito: "enfraquecido", chance: 1 } },
      { nome: "Onda", elemento: "agua", poder: 65, recarga: 6 },
    ],
  },
  {
    id: "mula", nome: "Mula Sem Cabeça", emoji: "🐴", elemento: "fogo", preco: 300,
    descricao: "Galopa soltando fogo pelo pescoço.",
    vida: 95, ataque: 70, defesa: 38, velocidade: 70,
    golpes: [
      basico("fogo", "Brasa"),
      { nome: "Coice em Chamas", elemento: "fogo", poder: 60, recarga: 5, noAlvo: { efeito: "queimado", chance: 0.3 } },
      { nome: "Disparada", elemento: "vento", poder: 0, recarga: 10, emSi: ["acelerado"] },
      { nome: "Labareda", elemento: "fogo", poder: 95, recarga: 9, recuo: 0.1 },
    ],
  },
  {
    id: "caipora", nome: "Caipora", emoji: "🐗", elemento: "mata", preco: 300,
    descricao: "Protetora dos animais, montada num porco-do-mato.",
    vida: 105, ataque: 52, defesa: 48, velocidade: 60,
    golpes: [
      basico("mata", "Chicote de Cipó"),
      { nome: "Urtiga", elemento: "mata", poder: 20, recarga: 7, noAlvo: { efeito: "envenenado", chance: 1 } },
      { nome: "Proteger a Caça", elemento: "mata", poder: 0, recarga: 12, cura: 0.25, emSi: ["escudo"] },
      { nome: "Tronco Caído", elemento: "pedra", poder: 80, recarga: 9 },
    ],
  },
  {
    id: "uirapuru", nome: "Uirapuru", emoji: "🐦", elemento: "vento", preco: 350,
    descricao: "Pássaro raro cujo canto traz sorte.",
    vida: 96, ataque: 61, defesa: 42, velocidade: 90,
    golpes: [
      basico("vento", "Rajada"),
      { nome: "Canto da Sorte", elemento: "espirito", poder: 0, recarga: 12, emSi: ["furia"], cura: 0.1 },
      { nome: "Voo Rasante", elemento: "vento", poder: 72, recarga: 6 },
      { nome: "Ventania", elemento: "vento", poder: 85, recarga: 10, noAlvo: { efeito: "lento", chance: 0.5 } },
    ],
  },
  {
    id: "cuca", nome: "Cuca", emoji: "🐊", elemento: "espirito", preco: 400,
    descricao: "A bruxa jacaré que vigia o sono das crianças.",
    vida: 110, ataque: 66, defesa: 46, velocidade: 55,
    golpes: [
      basico("espirito", "Toque Sombrio"),
      { nome: "Feitiço do Sono", elemento: "espirito", poder: 0, recarga: 12, noAlvo: { efeito: "sono", chance: 1 } },
      { nome: "Caldeirão", elemento: "espirito", poder: 55, recarga: 6, noAlvo: { efeito: "envenenado", chance: 0.6 } },
      { nome: "Pesadelo", elemento: "espirito", poder: 85, recarga: 9, dreno: 0.5 },
    ],
  },
  {
    id: "capelobo", nome: "Capelobo", emoji: "🐻", elemento: "pedra", preco: 450,
    descricao: "Fera do Norte com focinho de anta.",
    vida: 116, ataque: 64, defesa: 52, velocidade: 40,
    golpes: [
      basico("pedra", "Pedrada"),
      { nome: "Focinhada", elemento: "pedra", poder: 55, recarga: 7, dreno: 0.3 },
      { nome: "Couraça", elemento: "pedra", poder: 0, recarga: 10, emSi: ["escudo"] },
      { nome: "Tremor", elemento: "pedra", poder: 90, recarga: 10, noAlvo: { efeito: "atordoado", chance: 0.2 } },
    ],
  },
  {
    id: "lobisomem", nome: "Lobisomem", emoji: "🐺", elemento: "espirito", preco: 600,
    descricao: "Na lua cheia, vira a fera mais temida.",
    vida: 115, ataque: 72, defesa: 45, velocidade: 65,
    golpes: [
      basico("espirito", "Toque Sombrio"),
      { nome: "Uivo", elemento: "espirito", poder: 0, recarga: 12, emSi: ["furia"] },
      { nome: "Garras da Lua", elemento: "espirito", poder: 70, recarga: 6, noAlvo: { efeito: "enfraquecido", chance: 0.3 } },
      { nome: "Lua Cheia", elemento: "espirito", poder: 110, recarga: 12, recuo: 0.1 },
    ],
  },
];

export function getLenda(id: string) {
  return LENDAS.find((l) => l.id === id);
}
