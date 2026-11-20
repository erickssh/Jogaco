// Gera as fases fixas do Susdoku (Capítulo 1 — Escola) e salva em lib/susdoku/fases.json.
// Uso: npm run gerar:susdoku
// (o npm script compila o motor para .susdoku-build e depois roda este arquivo)

const fs = require("fs");
const path = require("path");
const M = require("../.susdoku-build/motor.js");

const BASICO = ["sala", "obj"];
const NEGATIVAS = [...BASICO, "salaNeg", "objNeg"];
const CONTA = [...NEGATIVAS, "conta"];
const RELACOES = [...CONTA, "mesmaSala", "salaDiferente"];
const TUDO = [...RELACOES, "esq", "acima"];

// alvo = percentil de dificuldade dentro dos candidatos gerados (0 = mais fácil)
const PLANO = [
  { tipos: BASICO, extras: 2, nivel: "basico", comodos: 4, alvo: 0.0, tutorial: [
    "Cada linha e cada coluna da planta tem exatamente UMA pessoa.",
    "Toque numa pessoa (embaixo da planta) e depois na casa onde ela estava.",
    "Use as pistas para descobrir onde cada um estava. \"Perto de um objeto\" quer dizer na mesma casa do objeto.",
    "Quando todos estiverem no lugar, o culpado é quem ficou SOZINHO no cômodo do ocorrido.",
  ] },
  { tipos: BASICO, extras: 1, nivel: "basico", comodos: 4, alvo: 0.3, tutorial: [
    "Dica de detetive: quando você coloca alguém, aquela linha e aquela coluna ficam ocupadas.",
    "Use o modo ✖ para marcar casas onde você tem certeza que não havia ninguém.",
  ] },
  { tipos: BASICO, extras: 0, nivel: "basico", alvo: 0.6, tutorial: [
    "🔎 Acha que já sabe quem foi? Use o botão Acusar a qualquer momento.",
    "Acertou antes de colocar todos? Ganha o selo Detetive Brilhante. Errou? Perde uma vida.",
  ] },
  { tipos: NEGATIVAS, extras: 1, nivel: "basico", alvo: 0.3, tutorial: [
    "Novidade: pistas negativas. \"Não estava na Cantina\" elimina todas as casas da Cantina para aquela pessoa.",
  ] },
  { tipos: CONTA, extras: 0, nivel: "basico", alvo: 0.4, tutorial: [
    "Novidade: contagem. \"Ninguém estava no Pátio\" elimina o Pátio para todo mundo.",
  ] },
  { tipos: CONTA, extras: 0, nivel: "basico", alvo: 0.8 },
  { tipos: RELACOES, extras: 1, nivel: "relacoes", alvo: 0.4, tutorial: [
    "Novidade: pistas entre duas pessoas, como \"estavam no mesmo cômodo\" ou \"em cômodos diferentes\".",
  ] },
  { tipos: TUDO, extras: 0, nivel: "relacoes", alvo: 0.5, tutorial: [
    "Novidade: posição. \"Mais à esquerda que\" compara as colunas; \"mais acima que\" compara as linhas.",
  ] },
  { tipos: TUDO, extras: 0, nivel: "relacoes", alvo: 0.85 },
  { tipos: TUDO, extras: 0, nivel: "tentativa", alvo: 0.9 },
];

const CANDIDATOS = 40;
const fases = [];
PLANO.forEach((pl, i) => {
  const lista = [];
  for (let s = 0; s < CANDIDATOS; s++) {
    const caso = M.gerarCaso({
      id: `escola-${i + 1}`,
      n: 4,
      lugar: "escola",
      semente: 1000 * (i + 1) + s,
      tipos: pl.tipos,
      extras: pl.extras,
      nivel: pl.nivel,
      cenario: i,
      comodos: pl.comodos,
    });
    if (caso) lista.push(caso);
  }
  lista.sort((a, b) => a.dificuldade - b.dificuldade);
  const escolhido = lista[Math.min(lista.length - 1, Math.round(pl.alvo * (lista.length - 1)))];
  if (pl.tutorial) escolhido.tutorial = pl.tutorial;
  fases.push(escolhido);
  const faixa = lista.length ? `${lista[0].dificuldade}–${lista[lista.length - 1].dificuldade}` : "-";
  console.log(
    `Fase ${String(i + 1).padStart(2)}: dificuldade ${String(escolhido.dificuldade).padStart(3)} (faixa ${faixa}, ${lista.length} gerados) · ${escolhido.pistas.length} pistas · técnicas: ${escolhido.tecnicas.join(", ")} · "${escolhido.titulo}"`,
  );
});

const destino = path.join(__dirname, "..", "lib", "susdoku", "fases.json");
fs.writeFileSync(destino, JSON.stringify({ capitulos: [{ id: "escola", nome: "Escola", emoji: "🏫", fases }] }));
console.log(`\nSalvo em ${destino}`);
