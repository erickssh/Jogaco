// Susdoku — motor: regras, contagem de soluções, resolvedor lógico (como um humano),
// classificação de dificuldade, gerador de casos e textos das pistas.

import {
  CORES_COMODO, Genero, LUGARES, NOMES, OBJETOS, OBJETOS_GERAIS, embaralhar, emojiPessoa, rngSemente, sortear,
} from "./dados";

// ---------- Tipos ----------
export type Pessoa = { nome: string; g: Genero; emoji: string };
export type Comodo = { nome: string; g: Genero; cor: string };

export type Pista =
  | { t: "sala"; p: number; s: number; neg?: boolean }
  | { t: "obj"; p: number; o: string; neg?: boolean }
  | { t: "mesmaSala"; a: number; b: number; neg?: boolean }
  | { t: "esq"; a: number; b: number }
  | { t: "acima"; a: number; b: number }
  | { t: "conta"; s: number; k: number };

export type TipoPista = "sala" | "salaNeg" | "obj" | "objNeg" | "mesmaSala" | "salaDiferente" | "esq" | "acima" | "conta";

export type Caso = {
  id: string;
  n: number;
  lugar: string;
  titulo: string;
  texto: string;
  acao: string;
  comodos: Comodo[];
  /** cômodo de cada casa (índice = linha * n + coluna) */
  celComodo: number[];
  /** objeto em cada casa (ou null) */
  objetos: (string | null)[];
  pessoas: Pessoa[];
  /** casa de cada pessoa na solução */
  solucao: number[];
  pistas: Pista[];
  /** cômodo onde aconteceu o caso; o culpado é a única pessoa nele */
  alvo: number;
  culpado: number;
  dificuldade: number;
  tecnicas: string[];
  tutorial?: string[];
};

export type NivelLogica = "basico" | "relacoes" | "tentativa";

// ---------- Utilidades da grade ----------
const linha = (c: number, n: number) => Math.floor(c / n);
const coluna = (c: number, n: number) => c % n;

function permutacoes(n: number): number[][] {
  if (n === 1) return [[0]];
  const res: number[][] = [];
  for (const p of permutacoes(n - 1))
    for (let i = 0; i <= p.length; i++) res.push([...p.slice(0, i), n - 1, ...p.slice(i)]);
  return res;
}

const cachePos = new Map<number, Uint8Array>();
/** Todas as formas de colocar n pessoas numa grade n×n com uma por linha e uma por coluna. */
export function todasPosicoes(n: number): Uint8Array {
  const c = cachePos.get(n);
  if (c) return c;
  const perms = permutacoes(n);
  const out = new Uint8Array(perms.length * perms.length * n);
  let k = 0;
  for (const pessoaLinha of perms)
    for (const linhaColuna of perms)
      for (let p = 0; p < n; p++) out[k++] = pessoaLinha[p] * n + linhaColuna[pessoaLinha[p]];
  cachePos.set(n, out);
  return out;
}

type Base = Pick<Caso, "n" | "celComodo" | "objetos">;

/** A pista vale para esta disposição de pessoas? */
export function satisfaz(base: Base, pos: ArrayLike<number>, off: number, ps: Pista): boolean {
  const { n, celComodo, objetos } = base;
  switch (ps.t) {
    case "sala":
      return (celComodo[pos[off + ps.p]] === ps.s) !== !!ps.neg;
    case "obj":
      return (objetos[pos[off + ps.p]] === ps.o) !== !!ps.neg;
    case "mesmaSala":
      return (celComodo[pos[off + ps.a]] === celComodo[pos[off + ps.b]]) !== !!ps.neg;
    case "esq":
      return coluna(pos[off + ps.a], n) < coluna(pos[off + ps.b], n);
    case "acima":
      return linha(pos[off + ps.a], n) < linha(pos[off + ps.b], n);
    case "conta": {
      let k = 0;
      for (let p = 0; p < n; p++) if (celComodo[pos[off + p]] === ps.s) k++;
      return k === ps.k;
    }
  }
}

/** Quantas soluções existem com estas pistas (para em `limite`). */
export function contarSolucoes(base: Base, pistas: Pista[], limite = 2): number {
  const pos = todasPosicoes(base.n);
  const n = base.n;
  let total = 0;
  for (let off = 0; off < pos.length; off += n) {
    let ok = true;
    for (const ps of pistas) if (!satisfaz(base, pos, off, ps)) { ok = false; break; }
    if (ok && ++total >= limite) return total;
  }
  return total;
}

// ---------- Resolvedor lógico (passo a passo, como uma pessoa) ----------
export type Passo = { tecnica: string; pessoa?: number; casa?: number; pistas: number[] };

const PESO: Record<string, number> = { pista: 1, unico: 1, linha: 2, contagem: 3, relacao: 3, tentativa: 8 };

type Estado = Uint8Array[]; // candidato[pessoa][casa]

class Resolvedor {
  cand: Estado;
  motivos: Set<number>[]; // pistas que eliminaram casas de cada pessoa
  propagado: boolean[];
  passos: Passo[] = [];
  score = 0;
  tecnicas = new Set<string>();
  contradicao = false;

  constructor(private base: Base, private pistas: Pista[], private nivel: NivelLogica, cand?: Estado) {
    const n = base.n;
    this.cand = cand ?? Array.from({ length: n }, () => new Uint8Array(n * n).fill(1));
    this.motivos = Array.from({ length: n }, () => new Set<number>());
    this.propagado = new Array(n).fill(false);
  }

  get n() {
    return this.base.n;
  }

  qtd(p: number) {
    let k = 0;
    for (const v of this.cand[p]) k += v;
    return k;
  }

  unica(p: number) {
    return this.cand[p].indexOf(1);
  }

  /** remove a casa c da pessoa p; registra quando a pessoa fica com uma só opção */
  tirar(p: number, c: number, tecnica: string, pista: number) {
    if (!this.cand[p][c]) return false;
    this.cand[p][c] = 0;
    if (pista >= 0) this.motivos[p].add(pista);
    const q = this.qtd(p);
    if (q === 0) this.contradicao = true;
    if (q === 1) this.passos.push({ tecnica, pessoa: p, casa: this.unica(p), pistas: [...this.motivos[p]] });
    return true;
  }

  marcar(tecnica: string) {
    this.score += PESO[tecnica];
    this.tecnicas.add(tecnica);
  }

  resolvido() {
    return this.cand.every((_, p) => this.qtd(p) === 1);
  }

  // Pistas que falam de uma pessoa só
  aplicarUnarias() {
    const { celComodo, objetos, n } = this.base;
    this.pistas.forEach((ps, i) => {
      let mudou = false;
      for (let c = 0; c < n * n; c++) {
        let ok = true;
        if (ps.t === "sala") ok = (celComodo[c] === ps.s) !== !!ps.neg;
        else if (ps.t === "obj") ok = (objetos[c] === ps.o) !== !!ps.neg;
        else if (ps.t === "conta" && ps.k === 0) {
          if (celComodo[c] === ps.s) for (let p = 0; p < n; p++) mudou = this.tirar(p, c, "pista", i) || mudou;
          continue;
        } else continue;
        if (!ok) mudou = this.tirar(ps.p, c, "pista", i) || mudou;
      }
      if (mudou) this.marcar("pista");
    });
  }

  // Pessoa com uma só casa possível ocupa a linha e a coluna
  unicos() {
    const n = this.n;
    for (let p = 0; p < n; p++) {
      if (this.propagado[p] || this.qtd(p) !== 1) continue;
      this.propagado[p] = true;
      const c = this.unica(p);
      let mudou = false;
      for (let q = 0; q < n; q++) {
        if (q === p) continue;
        for (let d = 0; d < n * n; d++)
          if (this.cand[q][d] && (linha(d, n) === linha(c, n) || coluna(d, n) === coluna(c, n))) mudou = this.tirar(q, d, "unico", -1) || mudou;
      }
      if (mudou) {
        this.marcar("unico");
        return true;
      }
    }
    return false;
  }

  // Cada linha/coluna precisa de exatamente uma pessoa
  linhasColunas() {
    const n = this.n;
    for (const eixo of ["linha", "coluna"] as const) {
      const f = eixo === "linha" ? linha : coluna;
      for (let r = 0; r < n; r++) {
        const quem: number[] = [];
        for (let p = 0; p < n; p++) {
          for (let c = 0; c < n * n; c++) if (this.cand[p][c] && f(c, n) === r) { quem.push(p); break; }
        }
        if (quem.length === 0) {
          this.contradicao = true;
          return false;
        }
        if (quem.length === 1) {
          const p = quem[0];
          let mudou = false;
          for (let c = 0; c < n * n; c++) if (this.cand[p][c] && f(c, n) !== r) mudou = this.tirar(p, c, "linha", -1) || mudou;
          if (mudou) {
            this.marcar("linha");
            return true;
          }
        }
      }
      // pessoa presa numa linha/coluna: os outros não podem usá-la
      for (let p = 0; p < n; p++) {
        let r = -1;
        let mesma = true;
        for (let c = 0; c < n * n; c++) {
          if (!this.cand[p][c]) continue;
          if (r === -1) r = f(c, n);
          else if (f(c, n) !== r) { mesma = false; break; }
        }
        if (!mesma || r === -1) continue;
        let mudou = false;
        for (let q = 0; q < n; q++) {
          if (q === p) continue;
          for (let c = 0; c < n * n; c++) if (this.cand[q][c] && f(c, n) === r) mudou = this.tirar(q, c, "linha", -1) || mudou;
        }
        if (mudou) {
          this.marcar("linha");
          return true;
        }
      }
    }
    return false;
  }

  // "Havia exatamente k pessoas no cômodo"
  contagens() {
    const { celComodo, n } = this.base;
    for (let i = 0; i < this.pistas.length; i++) {
      const ps = this.pistas[i];
      if (ps.t !== "conta") continue;
      const possiveis: number[] = [];
      const certos: number[] = [];
      for (let p = 0; p < n; p++) {
        let algum = false, todos = true;
        for (let c = 0; c < n * n; c++) {
          if (!this.cand[p][c]) continue;
          if (celComodo[c] === ps.s) algum = true;
          else todos = false;
        }
        if (algum) possiveis.push(p);
        if (algum && todos) certos.push(p);
      }
      if (certos.length > ps.k || possiveis.length < ps.k) {
        this.contradicao = true;
        return false;
      }
      let mudou = false;
      if (certos.length === ps.k) {
        for (const p of possiveis) {
          if (certos.includes(p)) continue;
          for (let c = 0; c < n * n; c++) if (celComodo[c] === ps.s) mudou = this.tirar(p, c, "contagem", i) || mudou;
        }
      }
      if (!mudou && possiveis.length === ps.k) {
        for (const p of possiveis)
          for (let c = 0; c < n * n; c++) if (celComodo[c] !== ps.s) mudou = this.tirar(p, c, "contagem", i) || mudou;
      }
      if (mudou) {
        this.marcar("contagem");
        return true;
      }
    }
    return false;
  }

  // Pistas entre duas pessoas
  relacoes() {
    const { celComodo, n } = this.base;
    const rel = (ps: Pista, x: number, y: number) => {
      if (ps.t === "mesmaSala") return (celComodo[x] === celComodo[y]) !== !!ps.neg;
      if (ps.t === "esq") return coluna(x, n) < coluna(y, n);
      if (ps.t === "acima") return linha(x, n) < linha(y, n);
      return true;
    };
    for (let i = 0; i < this.pistas.length; i++) {
      const ps = this.pistas[i];
      if (ps.t !== "mesmaSala" && ps.t !== "esq" && ps.t !== "acima") continue;
      let mudou = false;
      for (const [a, b, inv] of [[ps.a, ps.b, false], [ps.b, ps.a, true]] as const) {
        for (let x = 0; x < n * n; x++) {
          if (!this.cand[a][x]) continue;
          let apoio = false;
          for (let y = 0; y < n * n && !apoio; y++) {
            if (!this.cand[b][y] || linha(x, n) === linha(y, n) || coluna(x, n) === coluna(y, n)) continue;
            apoio = inv ? rel(ps, y, x) : rel(ps, x, y);
          }
          if (!apoio) mudou = this.tirar(a, x, "relacao", i) || mudou;
        }
      }
      if (mudou) {
        this.marcar("relacao");
        return true;
      }
    }
    return false;
  }

  /** propaga até não haver mais progresso (sem tentativa) */
  propagar(): boolean {
    while (!this.contradicao) {
      if (this.unicos()) continue;
      if (this.linhasColunas()) continue;
      if (this.contradicao) break;
      if (this.contagens()) continue;
      if (this.contradicao) break;
      if (this.nivel !== "basico" && this.relacoes()) continue;
      break;
    }
    return !this.contradicao;
  }

  // "E se…?": supõe uma casa e vê se dá contradição
  tentativa() {
    const n = this.n;
    for (let p = 0; p < n; p++) {
      if (this.qtd(p) < 2) continue;
      for (let c = 0; c < n * n; c++) {
        if (!this.cand[p][c]) continue;
        const copia = this.cand.map((x) => x.slice());
        copia[p].fill(0);
        copia[p][c] = 1;
        const r = new Resolvedor(this.base, this.pistas, "relacoes", copia);
        r.propagar();
        if (r.contradicao) {
          this.tirar(p, c, "tentativa", -1);
          this.marcar("tentativa");
          return true;
        }
      }
    }
    return false;
  }

  resolver() {
    this.aplicarUnarias();
    while (!this.contradicao && !this.resolvido()) {
      if (this.unicos()) continue;
      if (this.linhasColunas()) continue;
      if (this.contradicao) break;
      if (this.contagens()) continue;
      if (this.contradicao) break;
      if (this.nivel !== "basico" && this.relacoes()) continue;
      if (this.nivel === "tentativa" && this.tentativa()) continue;
      break;
    }
    return !this.contradicao && this.resolvido();
  }
}

export function resolverLogica(base: Base, pistas: Pista[], nivel: NivelLogica) {
  const r = new Resolvedor(base, pistas, nivel);
  const ok = r.resolver();
  return { ok, score: r.score, tecnicas: [...r.tecnicas], passos: r.passos, cand: r.cand };
}

/**
 * Dica: a próxima pessoa que dá para descobrir com lógica a partir do que o jogador já colocou certo.
 */
export function proximaDica(caso: Caso, colocadosCertos: (number | null)[]): Passo | null {
  const n = caso.n;
  const cand: Estado = Array.from({ length: n }, (_, p) => {
    const a = new Uint8Array(n * n).fill(1);
    if (colocadosCertos[p] != null) {
      a.fill(0);
      a[colocadosCertos[p]!] = 1;
    }
    return a;
  });
  const r = new Resolvedor(caso, caso.pistas, "tentativa", cand);
  r.aplicarUnarias();
  const novo = () => r.passos.find((ps) => ps.pessoa != null && colocadosCertos[ps.pessoa] == null);
  while (!novo() && !r.contradicao && !r.resolvido()) {
    if (r.unicos() || r.linhasColunas() || r.contagens() || r.relacoes() || r.tentativa()) continue;
    break;
  }
  const passo = novo();
  if (passo) return passo;
  // reserva: revela alguém que falta
  const p = colocadosCertos.findIndex((x) => x == null);
  return p >= 0 ? { tecnica: "revelar", pessoa: p, casa: caso.solucao[p], pistas: [] } : null;
}

// ---------- Textos ----------
const art = (g: Genero) => (g === "f" ? "a" : "o");
const Art = (g: Genero) => (g === "f" ? "A" : "O");
export const nomeCom = (p: Pessoa, maiuscula = false) => `${maiuscula ? Art(p.g) : art(p.g)} ${p.nome}`;
export const emComodo = (c: Comodo) => `${c.g === "f" ? "na" : "no"} ${c.nome}`;
export const deComodo = (c: Comodo) => `${c.g === "f" ? "da" : "do"} ${c.nome}`;

export function textoPista(caso: Caso, ps: Pista): string {
  const P = (i: number, m = false) => nomeCom(caso.pessoas[i], m);
  switch (ps.t) {
    case "sala":
      return `${P(ps.p, true)} ${ps.neg ? "não estava" : "estava"} ${emComodo(caso.comodos[ps.s])}.`;
    case "obj": {
      const o = OBJETOS[ps.o];
      if (ps.neg) return `${P(ps.p, true)} não estava perto de ${o.g === "f" ? "nenhuma" : "nenhum"} ${o.nome}.`;
      const unico = caso.objetos.filter((x) => x === ps.o).length === 1;
      return `${P(ps.p, true)} estava perto ${unico ? (o.g === "f" ? "da" : "do") : o.g === "f" ? "de uma" : "de um"} ${o.nome}.`;
    }
    case "mesmaSala":
      return ps.neg
        ? `${P(ps.a, true)} e ${P(ps.b)} estavam em cômodos diferentes.`
        : `${P(ps.a, true)} e ${P(ps.b)} estavam no mesmo cômodo.`;
    case "esq":
      return `${P(ps.a, true)} estava mais à esquerda que ${P(ps.b)}.`;
    case "acima":
      return `${P(ps.a, true)} estava mais acima que ${P(ps.b)}.`;
    case "conta": {
      const c = caso.comodos[ps.s];
      if (ps.k === 0) return `Ninguém estava ${emComodo(c)}.`;
      if (ps.k === 1) return `Só uma pessoa estava ${emComodo(c)}.`;
      return `Havia exatamente ${ps.k} pessoas ${emComodo(c)}.`;
    }
  }
}

export function textoCaso(caso: Pick<Caso, "texto" | "comodos" | "alvo">) {
  const c = caso.comodos[caso.alvo];
  return caso.texto.replace("{em}", emComodo(c)).replace("{de}", deComodo(c));
}

export function textoDesfecho(caso: Caso) {
  const p = caso.pessoas[caso.culpado];
  const c = caso.comodos[caso.alvo];
  return `${nomeCom(p, true)} era a única pessoa ${emComodo(c)}: foi ${p.g === "f" ? "ela" : "ele"} quem ${caso.acao}!`;
}

export const NOME_TECNICA: Record<string, string> = {
  pista: "Pista direta",
  unico: "Linha e coluna ocupadas",
  linha: "Única opção na linha/coluna",
  contagem: "Contagem no cômodo",
  relacao: "Relação entre pessoas",
  tentativa: "E se…? (eliminação por contradição)",
  revelar: "Revelação",
};

// ---------- Gerador ----------
export type OpcoesGerador = {
  id: string;
  n: number;
  lugar: string;
  semente: number;
  /** tipos de pista permitidos */
  tipos: TipoPista[];
  /** pistas extras (redundantes) para deixar mais fácil */
  extras: number;
  nivel: NivelLogica;
  /** índice do cenário (se omitido, sorteia) */
  cenario?: number;
  /** quantos cômodos (se omitido, sorteia) */
  comodos?: number;
};

function particionar(n: number, k: number, rnd: () => number): number[] | null {
  const total = n * n;
  const dono = new Array(total).fill(-1);
  const sementes = embaralhar([...Array(total).keys()], rnd).slice(0, k);
  sementes.forEach((c, i) => (dono[c] = i));
  let livres = total - k;
  let guarda = 0;
  while (livres > 0 && guarda++ < 10000) {
    const c = Math.floor(rnd() * total);
    if (dono[c] !== -1) continue;
    const viz = [c - n, c + n, coluna(c, n) > 0 ? c - 1 : -1, coluna(c, n) < n - 1 ? c + 1 : -1].filter((v) => v >= 0 && v < total && dono[v] !== -1);
    if (!viz.length) continue;
    // prefere crescer o cômodo menor (cômodos mais equilibrados)
    viz.sort((a, b) => dono.filter((x) => x === dono[a]).length - dono.filter((x) => x === dono[b]).length);
    dono[c] = dono[viz[rnd() < 0.7 ? 0 : Math.floor(rnd() * viz.length)]];
    livres--;
  }
  if (livres > 0) return null;
  for (let i = 0; i < k; i++) if (dono.filter((x) => x === i).length < 2) return null;
  return dono;
}

function todasPistasVerdadeiras(caso: Omit<Caso, "pistas" | "dificuldade" | "tecnicas">, tipos: TipoPista[]): Pista[] {
  const { n, celComodo, objetos, solucao, comodos } = caso;
  const out: Pista[] = [];
  const objsNoMapa = [...new Set(objetos.filter((o): o is string => !!o))];
  for (let p = 0; p < n; p++) {
    const c = solucao[p];
    if (tipos.includes("sala")) out.push({ t: "sala", p, s: celComodo[c] });
    if (tipos.includes("salaNeg")) comodos.forEach((_, s) => s !== celComodo[c] && out.push({ t: "sala", p, s, neg: true }));
    if (tipos.includes("obj") && objetos[c]) out.push({ t: "obj", p, o: objetos[c]! });
    if (tipos.includes("objNeg")) objsNoMapa.forEach((o) => o !== objetos[c] && out.push({ t: "obj", p, o, neg: true }));
    for (let q = 0; q < n; q++) {
      if (q === p) continue;
      const d = solucao[q];
      if (p < q && tipos.includes("mesmaSala") && celComodo[c] === celComodo[d]) out.push({ t: "mesmaSala", a: p, b: q });
      if (p < q && tipos.includes("salaDiferente") && celComodo[c] !== celComodo[d]) out.push({ t: "mesmaSala", a: p, b: q, neg: true });
      if (tipos.includes("esq") && coluna(c, n) < coluna(d, n)) out.push({ t: "esq", a: p, b: q });
      if (tipos.includes("acima") && linha(c, n) < linha(d, n)) out.push({ t: "acima", a: p, b: q });
    }
  }
  if (tipos.includes("conta"))
    comodos.forEach((_, s) => out.push({ t: "conta", s, k: solucao.filter((c) => celComodo[c] === s).length }));
  return out;
}

const igual = (a: Pista, b: Pista) => JSON.stringify(a) === JSON.stringify(b);

/** Gera um caso com solução única e resolvível só por lógica (ou null se não conseguir). */
export function gerarCaso(o: OpcoesGerador): Caso | null {
  const rnd = rngSemente(o.semente);
  const lugar = LUGARES[o.lugar];
  const n = o.n;

  for (let tentativa = 0; tentativa < 60; tentativa++) {
    // Cômodos
    const k = o.comodos ?? (n <= 4 ? 4 + Math.floor(rnd() * 2) : n + Math.floor(rnd() * 2));
    const celComodo = particionar(n, k, rnd);
    if (!celComodo) continue;
    const defs = embaralhar(lugar.comodos, rnd).slice(0, k);
    const cores = embaralhar(CORES_COMODO, rnd);
    const comodos: Comodo[] = defs.map((d, i) => ({ nome: d.nome, g: d.g, cor: cores[i % cores.length] }));

    // Objetos (cerca de 55% das casas)
    const objetos: (string | null)[] = celComodo.map((s) => {
      if (rnd() > 0.55) return null;
      const pool = [...defs[s].objetos, ...defs[s].objetos, ...OBJETOS_GERAIS];
      return sortear(pool, rnd);
    });

    // Pessoas e solução
    const nomes = embaralhar(NOMES, rnd).slice(0, n);
    const pessoas: Pessoa[] = nomes.map((x) => ({ ...x, emoji: emojiPessoa(x.g, lugar.criancas, rnd) }));
    const linhas = embaralhar([...Array(n).keys()], rnd);
    const colunas = embaralhar([...Array(n).keys()], rnd);
    const solucao = linhas.map((r) => r * n + colunas[r]);

    // Cômodo do caso: precisa ter exatamente uma pessoa
    const sozinhos = comodos.map((_, s) => s).filter((s) => solucao.filter((c) => celComodo[c] === s).length === 1);
    if (!sozinhos.length) continue;
    const alvo = sortear(sozinhos, rnd);
    const culpado = solucao.findIndex((c) => celComodo[c] === alvo);
    const cenario = lugar.cenarios[o.cenario ?? Math.floor(rnd() * lugar.cenarios.length)];

    const semPistas = {
      id: o.id, n, lugar: o.lugar, titulo: cenario.titulo, texto: cenario.texto, acao: cenario.acao,
      comodos, celComodo, objetos, pessoas, solucao, alvo, culpado,
    };
    const base = { n, celComodo, objetos };

    // Escolhe pistas até sobrar uma só solução.
    // Não usamos pistas que entregam o culpado de cara (ex.: "X estava no cômodo do ocorrido"),
    // senão o botão Acusar perde a graça.
    const entrega = (x: Pista) =>
      (x.t === "sala" && !x.neg && x.s === alvo) ||
      (x.t === "conta" && x.s === alvo) ||
      (x.t === "obj" && !x.neg && objetos.every((ob, c) => ob !== x.o || celComodo[c] === alvo));
    const todas = embaralhar(todasPistasVerdadeiras(semPistas, o.tipos).filter((x) => !entrega(x)), rnd);
    const pos = todasPosicoes(n);
    let restantes: number[] = [];
    for (let off = 0; off < pos.length; off += n) restantes.push(off);
    const escolhidas: Pista[] = [];
    for (const ps of todas) {
      if (restantes.length === 1) break;
      const filtrados = restantes.filter((off) => satisfaz(base, pos, off, ps));
      if (filtrados.length < restantes.length) {
        escolhidas.push(ps);
        restantes = filtrados;
      }
    }
    if (restantes.length !== 1) continue;

    // Remove pistas desnecessárias (mantendo solução única e resolvível pela lógica do nível)
    let pistas = [...escolhidas];
    for (const ps of embaralhar(escolhidas, rnd)) {
      const sem = pistas.filter((x) => x !== ps);
      if (contarSolucoes(base, sem) === 1 && resolverLogica(base, sem, o.nivel).ok) pistas = sem;
    }
    if (!resolverLogica(base, pistas, o.nivel).ok) continue;

    // Pistas extras para fases fáceis (as mais diretas)
    if (o.extras > 0) {
      const faceis = todas.filter((x) => (x.t === "sala" && !x.neg) || (x.t === "obj" && !x.neg)).filter((x) => !pistas.some((y) => igual(x, y)));
      pistas = [...pistas, ...faceis.slice(0, o.extras)];
    }

    const r = resolverLogica(base, pistas, "tentativa");
    if (!r.ok) continue;
    return { ...semPistas, pistas: embaralhar(pistas, rnd), dificuldade: r.score, tecnicas: r.tecnicas };
  }
  return null;
}
