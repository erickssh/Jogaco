"use client";

// Planta baixa ilustrada do Susdoku: pisos, móveis, paredes com portas, cômodos e personagens.

import { useId, useMemo } from "react";
import { LUGARES, OBJETOS } from "@/lib/susdoku/dados";
import { Caso } from "@/lib/susdoku/motor";
import { DefsPisos, Movel, pisoDe } from "./Moveis";
import { Expressao, RostoG, visualDe } from "./Rosto";

const U = 100;
const PAREDE = "#2b2140";

type Props = {
  caso: Caso;
  colocados: (number | null)[];
  marcas: Set<number>;
  dicaCasa: number | null;
  erroCasa: number | null;
  /** mostra a expressão final (culpado flagrado) */
  revelado: boolean;
  selecionado: number | null;
  onClicar: (casa: number) => void;
};

type Segmento = { x1: number; y1: number; x2: number; y2: number; chave: string };

export function Planta({ caso, colocados, marcas, dicaCasa, erroCasa, revelado, selecionado, onClicar }: Props) {
  const n = caso.n;
  const L = n * U;
  const p = useId().replace(/:/g, "");
  const adulto = !LUGARES[caso.lugar]?.criancas;

  // Paredes internas (entre cômodos diferentes) e uma porta por par de cômodos vizinhos
  const { paredes, portas, rotulos } = useMemo(() => {
    const sala = (r: number, c: number) => caso.celComodo[r * n + c];
    const segs: Segmento[] = [];
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        if (c < n - 1 && sala(r, c) !== sala(r, c + 1)) {
          const [a, b] = [sala(r, c), sala(r, c + 1)].sort((x, y) => x - y);
          segs.push({ x1: (c + 1) * U, y1: r * U, x2: (c + 1) * U, y2: (r + 1) * U, chave: `${a}-${b}` });
        }
        if (r < n - 1 && sala(r, c) !== sala(r + 1, c)) {
          const [a, b] = [sala(r, c), sala(r + 1, c)].sort((x, y) => x - y);
          segs.push({ x1: c * U, y1: (r + 1) * U, x2: (c + 1) * U, y2: (r + 1) * U, chave: `${a}-${b}` });
        }
      }
    const porChave = new Map<string, Segmento[]>();
    segs.forEach((s) => porChave.set(s.chave, [...(porChave.get(s.chave) ?? []), s]));
    const portas = new Set<Segmento>();
    porChave.forEach((lista) => portas.add(lista[Math.floor(lista.length / 2)]));
    const rotulos = new Map<number, number>();
    caso.celComodo.forEach((s, c) => {
      if (![...rotulos.values()].includes(s)) rotulos.set(c, s);
    });
    return { paredes: segs, portas, rotulos };
  }, [caso, n]);

  const ocupadas = useMemo(() => {
    const ls = new Set<number>(), cs = new Set<number>();
    colocados.forEach((c) => {
      if (c == null) return;
      ls.add(Math.floor(c / n));
      cs.add(c % n);
    });
    return { ls, cs };
  }, [colocados, n]);

  const expressao = (pessoa: number): Expressao => {
    if (revelado) return pessoa === caso.culpado ? "flagrado" : "feliz";
    return selecionado === pessoa ? "nervoso" : "neutro";
  };

  const celulas = [...Array(n * n).keys()];
  const xy = (c: number) => ({ x: (c % n) * U, y: Math.floor(c / n) * U });

  return (
    <svg className="sd-planta-svg" viewBox={`-8 -8 ${L + 16} ${L + 16}`} role="img" aria-label="Planta do local do caso">
      <DefsPisos p={p} />

      {/* Pisos */}
      {celulas.map((c) => {
        const { x, y } = xy(c);
        return <rect key={`p${c}`} x={x} y={y} width={U} height={U} fill={pisoDe(p, caso.comodos[caso.celComodo[c]].nome)} />;
      })}

      {/* Móveis / objetos */}
      {celulas.map((c) => {
        const o = caso.objetos[c];
        if (!o) return null;
        const { x, y } = xy(c);
        const temRotulo = rotulos.has(c);
        return (
          <g key={`m${c}`} transform={`translate(${x + (temRotulo ? 6 : 0)} ${y + (temRotulo ? 10 : 0)}) scale(${temRotulo ? 0.88 : 1})`}>
            <Movel id={o} />
          </g>
        );
      })}

      {/* Linhas e colunas já ocupadas ficam mais escuras */}
      {celulas.map((c) => {
        const { x, y } = xy(c);
        const vazia = !colocados.includes(c);
        if (!vazia || !(ocupadas.ls.has(Math.floor(c / n)) || ocupadas.cs.has(c % n))) return null;
        return <rect key={`a${c}`} x={x} y={y} width={U} height={U} fill="#1e1e24" opacity="0.22" pointerEvents="none" />;
      })}

      {/* Contorno do cômodo do ocorrido */}
      <g stroke="#e5243b" strokeWidth="5" strokeDasharray="12 8" fill="none" strokeLinecap="round">
        {celulas.filter((c) => caso.celComodo[c] === caso.alvo).map((c) => {
          const { x, y } = xy(c);
          const r = Math.floor(c / n), k = c % n;
          const fora = (rr: number, kk: number) => rr < 0 || kk < 0 || rr >= n || kk >= n || caso.celComodo[rr * n + kk] !== caso.alvo;
          const i = 9;
          return (
            <g key={`al${c}`}>
              {fora(r - 1, k) && <path d={`M${x} ${y + i}H${x + U}`} />}
              {fora(r + 1, k) && <path d={`M${x} ${y + U - i}H${x + U}`} />}
              {fora(r, k - 1) && <path d={`M${x + i} ${y}V${y + U}`} />}
              {fora(r, k + 1) && <path d={`M${x + U - i} ${y}V${y + U}`} />}
            </g>
          );
        })}
      </g>

      {/* Paredes com portas */}
      <g stroke={PAREDE} strokeWidth="9" strokeLinecap="square" fill="none">
        {paredes.map((s, i) => {
          if (!portas.has(s)) return <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />;
          const mx = (a: number, b: number, t: number) => a + (b - a) * t;
          return (
            <g key={i}>
              <line x1={s.x1} y1={s.y1} x2={mx(s.x1, s.x2, 0.28)} y2={mx(s.y1, s.y2, 0.28)} />
              <line x1={mx(s.x1, s.x2, 0.72)} y1={mx(s.y1, s.y2, 0.72)} x2={s.x2} y2={s.y2} />
            </g>
          );
        })}
        <rect x={0} y={0} width={L} height={L} strokeWidth="12" />
      </g>

      {/* Marcas ✖ */}
      {celulas.filter((c) => marcas.has(c) && !colocados.includes(c)).map((c) => {
        const { x, y } = xy(c);
        return (
          <path key={`x${c}`} d={`M${x + 32} ${y + 32}L${x + 68} ${y + 68}M${x + 68} ${y + 32}L${x + 32} ${y + 68}`} stroke="#c0182e" strokeWidth="9" strokeLinecap="round" opacity="0.75" pointerEvents="none" />
        );
      })}

      {/* Personagens */}
      {colocados.map((c, pessoa) => {
        if (c == null) return null;
        const { x, y } = xy(c);
        const ps = caso.pessoas[pessoa];
        const w = ps.nome.length * 8 + 16;
        return (
          <g key={`f${pessoa}`} className="sd-personagem" pointerEvents="none">
            <g transform={`translate(${x + U / 2} ${y + 44}) scale(0.62)`}>
              <RostoG v={visualDe(ps.nome, ps.g, adulto)} e={expressao(pessoa)} moldura clipId={`${p}-f${pessoa}`} />
            </g>
            <rect x={x + U / 2 - w / 2} y={y + 76} width={w} height={19} rx="9.5" fill={revelado && pessoa === caso.culpado ? "#e5243b" : "#ffffff"} stroke="#1e1e24" strokeWidth="2.5" />
            <text x={x + U / 2} y={y + 90} textAnchor="middle" fontSize="12.5" fontWeight="800" fill={revelado && pessoa === caso.culpado ? "#ffffff" : "#1e1e24"} fontFamily="system-ui, sans-serif">
              {ps.nome}
            </text>
          </g>
        );
      })}

      {/* Nome dos cômodos */}
      {[...rotulos.entries()].map(([c, s]) => {
        const { x, y } = xy(c);
        const alvo = s === caso.alvo;
        const texto = `${alvo ? "🔎 " : ""}${caso.comodos[s].nome}`;
        const w = Math.min(U * 2 - 14, texto.length * 7.6 + 14);
        return (
          <g key={`r${c}`} pointerEvents="none">
            <rect x={x + 7} y={y + 8} width={w} height={21} rx="10.5" fill={alvo ? "#e5243b" : "#ffffff"} stroke="#1e1e24" strokeWidth="2.5" />
            <text x={x + 7 + w / 2} y={y + 23} textAnchor="middle" fontSize="12.5" fontWeight="800" fill={alvo ? "#ffffff" : "#1e1e24"} fontFamily="system-ui, sans-serif">
              {texto}
            </text>
          </g>
        );
      })}

      {/* Dica e erro */}
      {dicaCasa != null && (() => {
        const { x, y } = xy(dicaCasa);
        return <rect className="sd-celula-dica" x={x + 4} y={y + 4} width={U - 8} height={U - 8} rx="10" fill="none" stroke="#ffc83d" strokeWidth="7" pointerEvents="none" />;
      })()}
      {erroCasa != null && (() => {
        const { x, y } = xy(erroCasa);
        return <rect className="sd-celula-erro" x={x} y={y} width={U} height={U} fill="#e5243b" pointerEvents="none" />;
      })()}

      {/* Área de toque */}
      {celulas.map((c) => {
        const { x, y } = xy(c);
        const quem = colocados.indexOf(c);
        const o = caso.objetos[c];
        return (
          <rect
            key={`t${c}`}
            className="sd-celula"
            x={x}
            y={y}
            width={U}
            height={U}
            fill="transparent"
            onClick={() => onClicar(c)}
            role="button"
            aria-label={`Linha ${Math.floor(c / n) + 1}, coluna ${(c % n) + 1}, ${caso.comodos[caso.celComodo[c]].nome}${o ? `, ${OBJETOS[o].nome}` : ""}${quem >= 0 ? `, ${caso.pessoas[quem].nome}` : ""}`}
          />
        );
      })}
    </svg>
  );
}
