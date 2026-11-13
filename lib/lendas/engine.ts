// Motor de batalha em tempo real da Arena das Lendas.
// Lógica pura (sem React): pode rodar no navegador ou, no futuro, no servidor para batalhas online.

import { EFEITOS, EfeitoId, Elemento, Golpe, IMUNIDADES, Lenda, VANTAGENS, getLenda } from "./data";

export const VIDA_MULT = 5; // vida base × 5 = cada lenda dura ~15-25s em combate
export const TROCA_ESPERA = 5; // segundos entre trocas
export const TRAVA_ACAO = 0.5; // pausa curta após qualquer ação

export type Lutador = {
  lenda: Lenda;
  vida: number;
  vidaMax: number;
  recargas: [number, number, number, number];
  efeitos: Partial<Record<EfeitoId, number>>;
  caiu: boolean;
};

export type Lado = 0 | 1; // 0 = jogador, 1 = adversário

export type Evento = {
  id: number;
  lado: Lado; // quem RECEBEU (para números de dano) ou quem agiu (para texto)
  texto: string;
  dano?: number;
  cura?: number;
  efetividade?: number;
};

export type Batalha = {
  times: [Lutador[], Lutador[]];
  ativo: [number, number];
  esperaTroca: [number, number];
  trava: [number, number];
  tempo: number;
  vencedor: Lado | null;
  eventos: Evento[];
  seq: number;
};

function novoLutador(id: string): Lutador {
  const lenda = getLenda(id);
  if (!lenda) throw new Error(`Lenda desconhecida: ${id}`);
  const vidaMax = lenda.vida * VIDA_MULT;
  return { lenda, vida: vidaMax, vidaMax, recargas: [0, 0, 0, 0], efeitos: {}, caiu: false };
}

export function criarBatalha(timeA: string[], timeB: string[]): Batalha {
  return {
    times: [timeA.map(novoLutador), timeB.map(novoLutador)],
    ativo: [0, 0],
    esperaTroca: [0, 0],
    trava: [0, 0],
    tempo: 0,
    vencedor: null,
    eventos: [],
    seq: 0,
  };
}

export const atual = (b: Batalha, lado: Lado) => b.times[lado][b.ativo[lado]];
export const vivos = (b: Batalha, lado: Lado) => b.times[lado].filter((l) => l.vida > 0).length;

function evento(b: Batalha, e: Omit<Evento, "id">) {
  b.eventos.push({ ...e, id: ++b.seq });
  if (b.eventos.length > 60) b.eventos.splice(0, b.eventos.length - 60);
}

export function vantagem(golpe: Elemento, alvo: Elemento) {
  return VANTAGENS[golpe][alvo] ?? 1;
}

export const bloqueado = (l: Lutador) => !!(l.efeitos.sono || l.efeitos.atordoado);

/** Recarga do ataque básico depende da velocidade. */
export function recargaGolpe(l: Lutador, i: number) {
  return i === 0 ? 0.8 + 40 / l.lenda.velocidade : l.lenda.golpes[i].recarga;
}

function aplicarEfeito(b: Batalha, alvo: Lutador, lado: Lado, ef: EfeitoId) {
  if (IMUNIDADES[ef] === alvo.lenda.elemento) {
    evento(b, { lado, texto: `${alvo.lenda.nome} é imune a ${EFEITOS[ef].nome.toLowerCase()}!` });
    return;
  }
  alvo.efeitos[ef] = EFEITOS[ef].duracao;
  evento(b, { lado, texto: `${alvo.lenda.nome}: ${EFEITOS[ef].icone} ${EFEITOS[ef].nome}` });
}

function curar(b: Batalha, l: Lutador, lado: Lado, qtd: number) {
  const real = Math.min(l.vidaMax - l.vida, qtd);
  if (real <= 0) return;
  l.vida += real;
  evento(b, { lado, texto: "", cura: Math.round(real) });
}

/** Fórmula de dano do Jogaço. */
export function calcularDano(atacante: Lutador, defensor: Lutador, g: Golpe, aleatorio = Math.random()) {
  let atk = atacante.lenda.ataque;
  if (atacante.efeitos.furia) atk *= 1.35;
  if (atacante.efeitos.enfraquecido) atk *= 0.65;
  if (atacante.efeitos.queimado) atk *= 0.75;
  let def = defensor.lenda.defesa;
  if (defensor.efeitos.escudo) def *= 1.5;
  const mesmoElemento = g.elemento === atacante.lenda.elemento ? 1.2 : 1;
  const ef = vantagem(g.elemento, defensor.lenda.elemento);
  const variacao = 0.9 + aleatorio * 0.2;
  const dano = ((atk / def) * g.poder * 0.55 + 3) * mesmoElemento * ef * variacao;
  return { dano: Math.max(1, Math.round(dano)), efetividade: ef };
}

export function podeUsar(b: Batalha, lado: Lado, i: number) {
  const l = atual(b, lado);
  return b.vencedor === null && l.vida > 0 && !bloqueado(l) && b.trava[lado] <= 0 && l.recargas[i] <= 0;
}

export function usarGolpe(b: Batalha, lado: Lado, i: number): boolean {
  if (!podeUsar(b, lado, i)) return false;
  const outro: Lado = lado === 0 ? 1 : 0;
  const eu = atual(b, lado);
  const alvo = atual(b, outro);
  const g = eu.lenda.golpes[i];
  eu.recargas[i] = recargaGolpe(eu, i);
  b.trava[lado] = TRAVA_ACAO;
  if (i !== 0) evento(b, { lado, texto: `${eu.lenda.nome} usou ${g.nome}!` });

  if (g.poder > 0) {
    if (alvo.efeitos.protegido) {
      evento(b, { lado: outro, texto: `${alvo.lenda.nome} se protegeu!` });
    } else {
      const { dano, efetividade } = calcularDano(eu, alvo, g);
      alvo.vida = Math.max(0, alvo.vida - dano);
      evento(b, { lado: outro, texto: "", dano, efetividade });
      if (g.dreno) curar(b, eu, lado, dano * g.dreno);
      if (g.recuo) {
        eu.vida = Math.max(0, eu.vida - dano * g.recuo);
        evento(b, { lado, texto: "", dano: Math.round(dano * g.recuo) });
      }
      if (g.noAlvo && alvo.vida > 0 && Math.random() < g.noAlvo.chance) aplicarEfeito(b, alvo, outro, g.noAlvo.efeito);
    }
  } else if (g.noAlvo && !alvo.efeitos.protegido && Math.random() < g.noAlvo.chance) {
    aplicarEfeito(b, alvo, outro, g.noAlvo.efeito);
  }
  g.emSi?.forEach((ef) => aplicarEfeito(b, eu, lado, ef));
  if (g.cura) curar(b, eu, lado, eu.vidaMax * g.cura);
  verificarDerrotas(b);
  return true;
}

export function podeTrocar(b: Batalha, lado: Lado, idx: number) {
  const l = b.times[lado][idx];
  return (
    b.vencedor === null && idx !== b.ativo[lado] && !!l && l.vida > 0 &&
    b.esperaTroca[lado] <= 0 && !bloqueado(atual(b, lado))
  );
}

export function trocar(b: Batalha, lado: Lado, idx: number, forcado = false): boolean {
  if (!forcado && !podeTrocar(b, lado, idx)) return false;
  b.ativo[lado] = idx;
  b.esperaTroca[lado] = TROCA_ESPERA;
  b.trava[lado] = TRAVA_ACAO;
  evento(b, { lado, texto: `${lado === 0 ? "Vai" : "Adversário chamou"}: ${b.times[lado][idx].lenda.nome}!` });
  return true;
}

function verificarDerrotas(b: Batalha) {
  for (const lado of [0, 1] as Lado[]) {
    const l = atual(b, lado);
    if (l.vida > 0 || l.caiu) continue;
    l.caiu = true;
    l.efeitos = {};
    evento(b, { lado, texto: `${l.lenda.nome} caiu!` });
    const prox = b.times[lado].findIndex((x) => x.vida > 0);
    if (prox >= 0) {
      trocar(b, lado, prox, true);
      b.esperaTroca[lado] = 0; // não pune a troca forçada
    }
  }
  const v0 = vivos(b, 0);
  const v1 = vivos(b, 1);
  if (v0 === 0 || v1 === 0) b.vencedor = v1 === 0 && v0 > 0 ? 0 : 1; // empate conta como derrota
}

/** Avança o tempo da batalha. */
export function avancar(b: Batalha, dt: number) {
  if (b.vencedor !== null) return;
  b.tempo += dt;
  for (const lado of [0, 1] as Lado[]) {
    b.esperaTroca[lado] = Math.max(0, b.esperaTroca[lado] - dt);
    b.trava[lado] = Math.max(0, b.trava[lado] - dt);
    for (const l of b.times[lado]) {
      if (l.vida <= 0) continue;
      const ativo = l === atual(b, lado);
      // Recargas andam para todos; lento/acelerado só valem para quem está em campo
      let ritmo = 1;
      if (ativo && l.efeitos.lento) ritmo *= 0.5;
      if (ativo && l.efeitos.acelerado) ritmo *= 1.5;
      l.recargas = l.recargas.map((r) => Math.max(0, r - dt * ritmo)) as Lutador["recargas"];
      for (const k of Object.keys(l.efeitos) as EfeitoId[]) {
        l.efeitos[k] = (l.efeitos[k] ?? 0) - dt;
        if ((l.efeitos[k] ?? 0) <= 0) delete l.efeitos[k];
      }
      if (ativo && (l.efeitos.queimado || l.efeitos.envenenado)) {
        const taxa = (l.efeitos.queimado ? 0.012 : 0) + (l.efeitos.envenenado ? 0.016 : 0);
        l.vida = Math.max(0, l.vida - l.vidaMax * taxa * dt);
      }
    }
  }
  verificarDerrotas(b);
}

// ---------- Computador ----------

export type Nivel = 1 | 2 | 3;
export type Cerebro = { espera: number };

const REACAO: Record<Nivel, number> = { 1: 0.9, 2: 0.45, 3: 0.15 };

/** Decide e executa a ação do computador. */
export function jogarComputador(b: Batalha, lado: Lado, nivel: Nivel, cerebro: Cerebro, dt: number) {
  if (b.vencedor !== null) return;
  cerebro.espera -= dt;
  if (cerebro.espera > 0) return;
  const eu = atual(b, lado);
  const outro: Lado = lado === 0 ? 1 : 0;
  const alvo = atual(b, outro);
  if (bloqueado(eu) || b.trava[lado] > 0) return;

  // Troca se estiver em desvantagem e com pouca vida (níveis 2 e 3)
  if (nivel >= 2 && b.esperaTroca[lado] <= 0) {
    const ruim = vantagem(alvo.lenda.elemento, eu.lenda.elemento) > 1 && eu.vida / eu.vidaMax < (nivel === 3 ? 0.55 : 0.3);
    if (ruim) {
      const melhor = b.times[lado].findIndex((l, i) => i !== b.ativo[lado] && l.vida > 0 && vantagem(alvo.lenda.elemento, l.lenda.elemento) <= 1);
      if (melhor >= 0 && trocar(b, lado, melhor)) {
        cerebro.espera = REACAO[nivel];
        return;
      }
    }
  }

  const opcoes = [0, 1, 2, 3].filter((i) => podeUsar(b, lado, i));
  if (!opcoes.length) return;

  let escolha: number;
  if (nivel === 1 && Math.random() < 0.5) {
    escolha = opcoes[Math.floor(Math.random() * opcoes.length)];
  } else {
    const nota = (i: number) => {
      const g = eu.lenda.golpes[i];
      let n = g.poder > 0 ? calcularDano(eu, alvo, g, 0.5).dano : 0;
      if (g.noAlvo && !alvo.efeitos[g.noAlvo.efeito]) n += 25 * g.noAlvo.chance;
      if (g.emSi?.some((ef) => !eu.efeitos[ef])) n += 30;
      if (g.cura) n += (1 - eu.vida / eu.vidaMax) * 120 * g.cura * 3;
      if (alvo.efeitos.protegido && g.poder > 0) n *= 0.1;
      return n;
    };
    escolha = opcoes.reduce((a, c) => (nota(c) > nota(a) ? c : a), opcoes[0]);
  }
  usarGolpe(b, lado, escolha);
  cerebro.espera = REACAO[nivel] * (0.7 + Math.random() * 0.6);
}
