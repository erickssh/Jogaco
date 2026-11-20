"use client";

// Gerador de personagens caricatos do Susdoku (vetorial, montado por partes).
// O visual de cada pessoa é sorteado de forma fixa a partir do nome, então
// a mesma pessoa sempre tem o mesmo rosto.

import { useId } from "react";
import { hashTexto, rngSemente } from "@/lib/susdoku/dados";

export type Expressao = "neutro" | "feliz" | "nervoso" | "flagrado";

const OUT = "#1e1e24";
const PELES = ["#f8dcc8", "#f1c7a3", "#e3aa7e", "#c68a5e", "#9a6440", "#6b4128"];
const CABELOS = ["#2b1a10", "#5a3418", "#8a5a2b", "#e2b85c", "#b83a26", "#1e1e24"];
const CAMISAS = ["#7f77dd", "#1d9e75", "#d85a30", "#378add", "#d4537e", "#efb84a", "#5fb04a", "#8f6fe0"];
const FUNDOS = ["#ece9ff", "#ddf4ec", "#fde7df", "#e3eefb", "#fbe6ef", "#fff3d6", "#e6f6dc"];

const ESTILOS_F = ["longo", "rabo", "cacheado", "coque", "chanel", "franja"] as const;
const ESTILOS_M = ["curto", "cacheadoM", "bone", "careca", "topete", "espetado"] as const;

export type Visual = {
  pele: string;
  peleSombra: string;
  cabelo: string;
  estilo: string;
  camisa: string;
  fundo: string;
  oculos: boolean;
  sardas: boolean;
  barba: boolean;
  brinco: boolean;
  nariz: 0 | 1 | 2;
};

function escurecer(hex: string, f = 0.82) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Visual fixo da pessoa, sorteado a partir do nome. */
export function visualDe(nome: string, g: "f" | "m", adulto: boolean): Visual {
  const rnd = rngSemente(hashTexto(`rosto-${nome}`));
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
  const pele = pick(PELES);
  const estilo = pick(g === "f" ? ESTILOS_F : ESTILOS_M);
  let cabelo = pick(CABELOS);
  if (adulto && rnd() < 0.15) cabelo = "#a7a7ad"; // grisalho
  return {
    pele,
    peleSombra: escurecer(pele),
    cabelo,
    estilo,
    camisa: pick(CAMISAS),
    fundo: pick(FUNDOS),
    oculos: rnd() < 0.28,
    sardas: rnd() < 0.22,
    barba: adulto && g === "m" && estilo !== "bone" && rnd() < 0.4,
    brinco: g === "f" && rnd() < 0.35,
    nariz: Math.floor(rnd() * 3) as 0 | 1 | 2,
  };
}

/** Cabelo de trás (desenhado antes do rosto). */
function CabeloTras({ v }: { v: Visual }) {
  const c = v.cabelo;
  switch (v.estilo) {
    case "longo":
    case "franja":
      return <path d="M-31 -8Q-33 -38 0 -38Q33 -38 31 -8L34 36L-34 36Z" fill={c} />;
    case "chanel":
      return <path d="M-32 -8Q-33 -38 0 -38Q33 -38 32 -8L32 16Q26 22 20 12L-20 12Q-26 22 -32 16Z" fill={c} />;
    case "rabo":
      return (
        <>
          <path d="M22 -26Q48 -22 44 8Q42 24 30 30Q37 8 24 -8Z" fill={c} />
          <circle cx="25" cy="-24" r="5.5" fill="#ff7aa8" />
        </>
      );
    case "coque":
      return <circle cx="0" cy="-36" r="12" fill={c} />;
    case "cacheado":
      return (
        <>
          {[[-22, -20, 13], [-8, -32, 14], [10, -32, 14], [24, -18, 13], [-30, -2, 11], [30, -2, 11], [-30, 14, 10], [30, 14, 10]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={c} />
          ))}
        </>
      );
    default:
      return null;
  }
}

/** Cabelo da frente (desenhado depois do rosto). */
function CabeloFrente({ v }: { v: Visual }) {
  const c = v.cabelo;
  switch (v.estilo) {
    case "longo":
      return <path d="M-27 -6Q-26 -33 0 -33Q26 -33 27 -10Q14 -24 -4 -19Q-17 -15 -27 -6Z" fill={c} />;
    case "franja":
    case "chanel":
      return <path d="M-27 -4Q-28 -33 0 -33Q28 -33 27 -4L22 -12L14 -6L6 -13L-2 -6L-10 -13L-18 -6Z" fill={c} />;
    case "rabo":
    case "coque":
      return <path d="M-27 -4Q-29 -34 0 -34Q29 -34 27 -6Q18 -21 0 -21Q-18 -21 -27 -4Z" fill={c} />;
    case "cacheado":
      return <path d="M-26 -8Q-22 -30 0 -30Q22 -30 26 -8Q14 -20 0 -18Q-14 -20 -26 -8Z" fill={c} />;
    case "curto":
      return <path d="M-27 -6Q-28 -35 0 -35Q28 -35 27 -6Q20 -22 0 -22Q-20 -22 -27 -6Z" fill={c} />;
    case "cacheadoM":
      return (
        <>
          {[[-20, -22, 9], [-8, -30, 10], [6, -31, 10], [19, -24, 9], [-26, -10, 7], [26, -10, 7]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={c} />
          ))}
        </>
      );
    case "bone":
      return (
        <>
          <path d="M-28 -8Q-27 -38 0 -38Q27 -38 28 -8Z" fill="#e5243b" />
          <path d="M-31 -8H38Q41 -3 35 0H-31Z" fill="#a3122a" />
          <circle cx="0" cy="-37" r="3" fill="#a3122a" />
        </>
      );
    case "careca":
      return (
        <>
          <path d="M-28 -2Q-31 -18 -21 -22Q-20 -10 -23 0Z" fill={c} />
          <path d="M28 -2Q31 -18 21 -22Q20 -10 23 0Z" fill={c} />
          <path d="M-8 -26Q0 -29 8 -26" stroke="#ffffff" strokeWidth="2.5" fill="none" opacity="0.6" />
        </>
      );
    case "topete":
      return <path d="M-27 -6Q-28 -30 -8 -34Q-4 -48 16 -42Q12 -38 20 -34Q28 -28 27 -6Q20 -22 0 -22Q-20 -22 -27 -6Z" fill={c} />;
    case "espetado":
      return <path d="M-27 -6L-26 -26L-18 -36L-14 -28L-6 -42L0 -30L8 -42L12 -30L20 -38L22 -26L27 -6Q20 -20 0 -20Q-20 -20 -27 -6Z" fill={c} />;
    default:
      return null;
  }
}

function Olhos({ e }: { e: Expressao }) {
  // deslocamento das pupilas e tamanho do branco por expressão
  const dx = e === "nervoso" ? -3 : 0;
  const ry = e === "flagrado" ? 10 : e === "feliz" ? 6.5 : 8;
  const rp = e === "flagrado" ? 2.4 : 3.3;
  if (e === "feliz") {
    return (
      <>
        <path d="M-16 -1Q-10 -8 -4 -1" stroke={OUT} strokeWidth="3.2" fill="none" />
        <path d="M4 -1Q10 -8 16 -1" stroke={OUT} strokeWidth="3.2" fill="none" />
      </>
    );
  }
  return (
    <>
      <ellipse cx="-10" cy="-2" rx="7" ry={ry} fill="#ffffff" stroke={OUT} strokeWidth="2.5" />
      <ellipse cx="10" cy="-2" rx="7" ry={ry} fill="#ffffff" stroke={OUT} strokeWidth="2.5" />
      <circle cx={-10 + dx} cy="-1" r={rp} fill={OUT} />
      <circle cx={10 + dx} cy="-1" r={rp} fill={OUT} />
      <circle cx={-8.5 + dx} cy="-3" r="1.1" fill="#ffffff" />
      <circle cx={11.5 + dx} cy="-3" r="1.1" fill="#ffffff" />
    </>
  );
}

function Sobrancelhas({ e }: { e: Expressao }) {
  const d =
    e === "nervoso" ? "M-18 -12Q-12 -11 -4 -16M4 -16Q12 -11 18 -12"
      : e === "flagrado" ? "M-18 -17Q-11 -23 -4 -18M4 -18Q11 -23 18 -17"
        : e === "feliz" ? "M-17 -12Q-11 -17 -4 -12M4 -12Q11 -17 17 -12"
          : "M-17 -12L-4 -13M4 -13L17 -12";
  return <path d={d} stroke={OUT} strokeWidth="3.6" fill="none" strokeLinecap="round" />;
}

function Boca({ e }: { e: Expressao }) {
  switch (e) {
    case "feliz":
      return <path d="M-11 14Q0 28 12 14Z" fill="#7a1f1f" stroke={OUT} strokeWidth="2.5" strokeLinejoin="round" />;
    case "nervoso":
      return <path d="M-10 18Q-6 14 -2 18Q2 22 6 18Q10 14 12 18" stroke={OUT} strokeWidth="2.6" fill="none" strokeLinecap="round" />;
    case "flagrado":
      return <ellipse cx="1" cy="19" rx="6" ry="7.5" fill="#7a1f1f" stroke={OUT} strokeWidth="2.5" />;
    default:
      return <path d="M-7 16Q1 21 8 15" stroke={OUT} strokeWidth="2.6" fill="none" strokeLinecap="round" />;
  }
}

function Nariz({ v }: { v: Visual }) {
  if (v.nariz === 0) return <ellipse cx="1" cy="7" rx="4.5" ry="3.8" fill={v.peleSombra} stroke={OUT} strokeWidth="2.2" />;
  if (v.nariz === 1) return <path d="M0 0Q-8 11 1 13Q8 14 6 8" fill={v.peleSombra} stroke={OUT} strokeWidth="2.2" strokeLinejoin="round" />;
  return <path d="M1 0Q4 8 1 11" stroke={OUT} strokeWidth="2.4" fill="none" strokeLinecap="round" />;
}

type Props = {
  nome: string;
  g: "f" | "m";
  adulto?: boolean;
  expressao?: Expressao;
  tamanho?: number;
  /** desenha com o fundo redondo (avatar) */
  moldura?: boolean;
  className?: string;
};

/** Personagem caricato (busto) num quadrado -50..50. */
export function Rosto({ nome, g, adulto = false, expressao = "neutro", tamanho = 48, moldura = true, className }: Props) {
  const v = visualDe(nome, g, adulto);
  const id = useId().replace(/:/g, "");
  return (
    <svg width={tamanho} height={tamanho} viewBox="-50 -50 100 100" className={className} aria-hidden="true">
      <RostoG v={v} e={expressao} moldura={moldura} clipId={`rc${id}`} />
    </svg>
  );
}

/** Versão para usar dentro de outro SVG (a planta). */
export function RostoG({ v, e, moldura, clipId }: { v: Visual; e: Expressao; moldura: boolean; clipId: string }) {
  return (
    <g>
      {moldura && (
        <defs>
          <clipPath id={clipId}><circle r="46" /></clipPath>
        </defs>
      )}
      {moldura && <circle r="47" fill={v.fundo} stroke={OUT} strokeWidth="3.5" />}
      <g clipPath={moldura ? `url(#${clipId})` : undefined} stroke={OUT} strokeWidth="3" strokeLinejoin="round">
        <CabeloTras v={v} />
        <path d="M-34 50Q-36 30 0 27Q36 30 34 50Z" fill={v.camisa} />
        <path d="M-7 20L-6 30H6L7 20Z" fill={v.peleSombra} />
        <circle cx="-27" cy="2" r="6.5" fill={v.pele} />
        <circle cx="27" cy="2" r="6.5" fill={v.pele} />
        {v.brinco && (
          <>
            <circle cx="-27" cy="11" r="3" fill="#ffd84a" strokeWidth="2" />
            <circle cx="27" cy="11" r="3" fill="#ffd84a" strokeWidth="2" />
          </>
        )}
        <ellipse cx="0" cy="0" rx="27" ry="30" fill={v.pele} />
        {v.barba && <path d="M-26 6Q-29 40 0 41Q29 40 26 6Q19 20 0 20Q-19 20 -26 6Z" fill={v.cabelo} />}
        <CabeloFrente v={v} />
        <g stroke="none">
          <ellipse cx="-17" cy="10" rx="5.5" ry="3.2" fill="#ff7a6b" opacity="0.35" />
          <ellipse cx="17" cy="10" rx="5.5" ry="3.2" fill="#ff7a6b" opacity="0.35" />
          {v.sardas && [[-16, 6], [-19, 9], [-13, 9], [16, 6], [19, 9], [13, 9]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.3" fill="#a0522d" />)}
        </g>
        <Olhos e={e} />
        {v.oculos && (
          <g fill="none" strokeWidth="2.8">
            <circle cx="-10" cy="-2" r="10" />
            <circle cx="10" cy="-2" r="10" />
            <path d="M-1 -3Q0 -5 1 -3" />
          </g>
        )}
        <Sobrancelhas e={e} />
        <Nariz v={v} />
        <Boca e={e} />
        {(e === "nervoso" || e === "flagrado") && (
          <path d="M24 -24Q30 -14 25 -9Q19 -13 24 -24Z" fill="#9fd3ee" strokeWidth="2" />
        )}
        {e === "flagrado" && <path d="M-26 -30Q-31 -21 -27 -17Q-22 -21 -26 -30Z" fill="#9fd3ee" strokeWidth="2" />}
      </g>
    </g>
  );
}
