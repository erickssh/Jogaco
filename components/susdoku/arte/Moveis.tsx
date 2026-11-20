"use client";

// Móveis e objetos do Susdoku em estilo caricato (contorno grosso, cores vivas).
// Cada desenho ocupa uma casa de 100×100 unidades (origem no canto superior esquerdo).

const OUT = "#1e1e24";
const MAD = "#b8763d";
const MAD_ESC = "#7a5232";

const s = { stroke: OUT, strokeWidth: 3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

export function Movel({ id }: { id: string }) {
  switch (id) {
    case "cadeira":
      return (
        <g {...s}>
          <rect x="31" y="28" width="38" height="12" rx="5" fill="#a85f26" />
          <rect x="33" y="40" width="34" height="32" rx="7" fill="#d0883c" />
        </g>
      );
    case "quadro":
      return (
        <g {...s}>
          <rect x="20" y="28" width="60" height="42" rx="3" fill="#fff6e0" stroke={MAD} strokeWidth="6" />
          <rect x="20" y="28" width="60" height="42" rx="3" fill="none" />
          <path d="M26 64L40 46L50 56L58 48L74 64Z" fill="#5fd36c" strokeWidth="2.5" />
          <circle cx="64" cy="40" r="5" fill="#ffd84a" strokeWidth="2.5" />
        </g>
      );
    case "relogio":
      return (
        <g {...s}>
          <circle cx="50" cy="50" r="23" fill="#ffffff" stroke={OUT} strokeWidth="4" />
          <circle cx="50" cy="50" r="23" fill="none" stroke="#e5243b" strokeWidth="2" />
          <path d="M50 50V36M50 50L60 55" strokeWidth="3.5" fill="none" />
          <circle cx="50" cy="50" r="2.5" fill={OUT} />
        </g>
      );
    case "estante":
      return (
        <g {...s}>
          <rect x="16" y="24" width="68" height="52" rx="4" fill={MAD_ESC} />
          <path d="M16 50H84" fill="none" />
          {[["#e5243b", 21, 9], ["#378add", 31, 7], ["#ffd84a", 39, 9], ["#4cc25a", 49, 7], ["#8f6fe0", 57, 9], ["#ff7a3c", 67, 8], ["#378add", 76, 6]].map(([c, x, w], i) => (
            <rect key={`a${i}`} x={x as number} y="29" width={w as number} height="18" rx="2" fill={c as string} strokeWidth="2" />
          ))}
          {[["#4cc25a", 21, 8], ["#ff7aa8", 30, 9], ["#ffd84a", 40, 7], ["#e5243b", 48, 9], ["#378add", 58, 8], ["#ff7a3c", 67, 9]].map(([c, x, w], i) => (
            <rect key={`b${i}`} x={x as number} y="55" width={w as number} height="18" rx="2" fill={c as string} strokeWidth="2" />
          ))}
        </g>
      );
    case "microscopio":
      return (
        <g {...s}>
          <ellipse cx="50" cy="72" rx="22" ry="7" fill="#3b3b48" />
          <path d="M44 70V52Q44 40 56 34" fill="none" strokeWidth="6" stroke="#3b3b48" />
          <path d="M44 70V52Q44 40 56 34" fill="none" strokeWidth="2" stroke="#9a9aa6" />
          <rect x="52" y="22" width="12" height="26" rx="4" fill="#e9ecef" transform="rotate(30 58 35)" />
          <rect x="36" y="56" width="28" height="6" rx="2" fill="#9a9aa6" />
        </g>
      );
    case "computador":
      return (
        <g {...s}>
          <rect x="16" y="34" width="68" height="40" rx="6" fill="#c98a4b" />
          <rect x="30" y="26" width="40" height="28" rx="4" fill="#2b2b38" />
          <rect x="35" y="31" width="30" height="18" rx="2" fill="#6fd3ff" strokeWidth="2" />
          <rect x="34" y="60" width="32" height="8" rx="2" fill="#e9ecef" strokeWidth="2" />
        </g>
      );
    case "arquivo":
      return (
        <g {...s}>
          <rect x="30" y="20" width="40" height="60" rx="5" fill="#9aa6ae" />
          <path d="M30 40H70M30 60H70" fill="none" />
          {[30, 50, 70].map((y) => <rect key={y} x="44" y={y - 3} width="12" height="5" rx="2" fill="#e9ecef" strokeWidth="2" />)}
        </g>
      );
    case "telefone":
      return (
        <g {...s}>
          <rect x="30" y="42" width="40" height="28" rx="9" fill="#e5243b" />
          <path d="M26 42Q26 30 38 32H62Q74 30 74 42Q74 48 66 46L62 38H38L34 46Q26 48 26 42Z" fill="#2b2b38" />
          <circle cx="50" cy="56" r="7" fill="#ffffff" strokeWidth="2" />
        </g>
      );
    case "arvore":
      return (
        <g {...s}>
          <circle cx="50" cy="50" r="33" fill="#3fae4a" />
          <circle cx="38" cy="40" r="12" fill="#5fd36c" strokeWidth="2.5" />
          <circle cx="62" cy="58" r="10" fill="#5fd36c" strokeWidth="2.5" />
          <circle cx="58" cy="34" r="4" fill="#e5243b" strokeWidth="2" />
          <circle cx="36" cy="62" r="4" fill="#e5243b" strokeWidth="2" />
        </g>
      );
    case "bola":
      return (
        <g {...s}>
          <circle cx="50" cy="50" r="17" fill="#ffffff" strokeWidth="3.5" />
          <path d="M50 42L57 47L54 55H46L43 47Z" fill={OUT} strokeWidth="1.5" />
          <path d="M50 42V34M57 47L65 44M54 55L59 62M46 55L41 62M43 47L35 44" fill="none" strokeWidth="2" />
        </g>
      );
    case "torneira":
      return (
        <g {...s}>
          <rect x="22" y="30" width="56" height="42" rx="12" fill="#ffffff" />
          <ellipse cx="50" cy="54" rx="19" ry="12" fill="#9fdcf2" />
          <path d="M50 34V42" strokeWidth="5" stroke="#9a9aa6" fill="none" />
          <circle cx="50" cy="34" r="5" fill="#c4c4cc" strokeWidth="2.5" />
        </g>
      );
    case "espelho":
      return (
        <g {...s}>
          <ellipse cx="50" cy="50" rx="21" ry="27" fill="#bfe9f7" stroke={MAD} strokeWidth="7" />
          <ellipse cx="50" cy="50" rx="21" ry="27" fill="none" />
          <path d="M40 38Q44 32 50 31M42 46L52 34" stroke="#ffffff" strokeWidth="3" fill="none" />
        </g>
      );
    case "fogao":
      return (
        <g {...s}>
          <rect x="22" y="24" width="56" height="52" rx="7" fill="#3b3b48" />
          <circle cx="38" cy="40" r="7" fill="none" stroke="#ff7a3c" strokeWidth="3" />
          <circle cx="62" cy="40" r="7" fill="none" stroke="#9a9aa6" strokeWidth="3" />
          <circle cx="38" cy="62" r="7" fill="none" stroke="#9a9aa6" strokeWidth="3" />
          <circle cx="62" cy="62" r="7" fill="none" stroke="#9a9aa6" strokeWidth="3" />
          <path d="M34 36Q38 28 42 36" fill="#ffd84a" strokeWidth="2" />
        </g>
      );
    case "cafeteira":
      return (
        <g {...s}>
          <rect x="34" y="24" width="28" height="44" rx="6" fill="#3b3b48" />
          <path d="M37 50H59V64Q59 70 48 70Q37 70 37 64Z" fill="#8a5a2b" strokeWidth="2.5" />
          <rect x="62" y="56" width="16" height="16" rx="4" fill="#ffffff" />
          <path d="M66 52Q68 48 66 44M72 52Q74 48 72 44" stroke="#9a9aa6" strokeWidth="2" fill="none" />
        </g>
      );
    case "sofa":
      return (
        <g {...s}>
          <rect x="14" y="26" width="72" height="48" rx="14" fill="#8f6fe0" />
          <rect x="24" y="38" width="25" height="30" rx="8" fill="#b49bf5" />
          <rect x="51" y="38" width="25" height="30" rx="8" fill="#b49bf5" />
        </g>
      );
    case "tv":
      return (
        <g {...s}>
          <rect x="16" y="26" width="68" height="42" rx="7" fill="#2b2b38" />
          <rect x="22" y="31" width="56" height="31" rx="3" fill="#6fd3ff" strokeWidth="2" />
          <path d="M30 40L42 36M30 46L38 43" stroke="#ffffff" strokeWidth="3" fill="none" />
          <path d="M40 68L36 78H64L60 68" fill="#3b3b48" />
        </g>
      );
    case "cama":
      return (
        <g {...s}>
          <rect x="22" y="12" width="56" height="76" rx="10" fill="#ffffff" />
          <rect x="29" y="18" width="42" height="17" rx="8" fill="#ffffff" />
          <rect x="22" y="42" width="56" height="46" rx="8" fill="#4fa3ff" />
          <path d="M22 52H78" fill="none" strokeWidth="2.5" />
        </g>
      );
    case "carro":
      return (
        <g {...s}>
          <rect x="18" y="26" width="10" height="16" rx="3" fill={OUT} />
          <rect x="72" y="26" width="10" height="16" rx="3" fill={OUT} />
          <rect x="18" y="58" width="10" height="16" rx="3" fill={OUT} />
          <rect x="72" y="58" width="10" height="16" rx="3" fill={OUT} />
          <rect x="24" y="12" width="52" height="76" rx="18" fill="#e5243b" />
          <rect x="32" y="30" width="36" height="14" rx="5" fill="#9fdcf2" strokeWidth="2.5" />
          <rect x="32" y="60" width="36" height="12" rx="5" fill="#9fdcf2" strokeWidth="2.5" />
        </g>
      );
    case "ferramentas":
      return (
        <g {...s}>
          <path d="M38 40V32H62V40" fill="none" strokeWidth="4" />
          <rect x="22" y="40" width="56" height="32" rx="5" fill="#e5243b" />
          <path d="M22 52H78" fill="none" />
          <rect x="44" y="49" width="12" height="7" rx="2" fill="#ffd84a" strokeWidth="2" />
        </g>
      );
    case "flor":
      return (
        <g {...s}>
          <path d="M50 52V80" stroke="#3fae4a" strokeWidth="4" fill="none" />
          <ellipse cx="60" cy="70" rx="8" ry="4" fill="#5fd36c" strokeWidth="2" />
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={50 + 12 * Math.cos((a * Math.PI) / 180)} cy={42 + 12 * Math.sin((a * Math.PI) / 180)} r="9" fill="#ff7aa8" strokeWidth="2.5" />
          ))}
          <circle cx="50" cy="42" r="7" fill="#ffd84a" strokeWidth="2.5" />
        </g>
      );
    case "planta":
      return (
        <g {...s}>
          <ellipse cx="36" cy="38" rx="12" ry="8" fill="#4cc25a" transform="rotate(-35 36 38)" />
          <ellipse cx="64" cy="38" rx="12" ry="8" fill="#4cc25a" transform="rotate(35 64 38)" />
          <ellipse cx="50" cy="30" rx="8" ry="13" fill="#5fd36c" />
          <path d="M34 54H66L62 76H38Z" fill="#ff9a3c" />
          <path d="M32 54H68" strokeWidth="4" fill="none" />
        </g>
      );
    case "janela":
      return (
        <g {...s}>
          <rect x="22" y="22" width="56" height="50" rx="3" fill="#bfe9f7" stroke="#ffffff" strokeWidth="9" />
          <rect x="22" y="22" width="56" height="50" rx="3" fill="none" />
          <path d="M50 22V72M22 47H78" stroke="#ffffff" strokeWidth="4" fill="none" />
          <path d="M14 18Q22 46 16 78H26Q22 46 28 18Z" fill="#ff7aa8" strokeWidth="2.5" />
          <path d="M86 18Q78 46 84 78H74Q78 46 72 18Z" fill="#ff7aa8" strokeWidth="2.5" />
        </g>
      );
    case "lixeira":
      return (
        <g {...s}>
          <path d="M34 36H66L62 76H38Z" fill="#4cc25a" />
          <rect x="30" y="28" width="40" height="9" rx="3" fill="#3fae4a" />
          <path d="M44 44V68M56 44V68" fill="none" strokeWidth="2.5" />
        </g>
      );
    case "cesto":
      return (
        <g {...s}>
          <ellipse cx="50" cy="52" rx="26" ry="22" fill="#d9a066" />
          <ellipse cx="50" cy="48" rx="19" ry="14" fill="#ffffff" strokeWidth="2.5" />
          <path d="M40 44Q46 38 52 46Q58 52 62 44" stroke="#4fa3ff" strokeWidth="5" fill="none" />
          <path d="M24 56Q50 66 76 56" fill="none" strokeWidth="2" />
        </g>
      );
    case "banheira":
      return (
        <g {...s}>
          <rect x="12" y="24" width="76" height="52" rx="22" fill="#ffffff" />
          <rect x="20" y="31" width="60" height="38" rx="16" fill="#7fd6f5" strokeWidth="2.5" />
          <circle cx="34" cy="42" r="5" fill="#ffffff" strokeWidth="2" />
          <circle cx="46" cy="52" r="4" fill="#ffffff" strokeWidth="2" />
          <circle cx="64" cy="44" r="6" fill="#ffffff" strokeWidth="2" />
          <path d="M70 58Q74 54 78 58L74 62Z" fill="#ffd84a" strokeWidth="2" />
        </g>
      );
    case "mochila":
      return (
        <g {...s}>
          <path d="M40 30Q40 20 50 20Q60 20 60 30" fill="none" strokeWidth="4" />
          <rect x="30" y="28" width="40" height="48" rx="12" fill="#378add" />
          <rect x="37" y="52" width="26" height="18" rx="6" fill="#85b7eb" strokeWidth="2.5" />
          <path d="M37 52H63" fill="none" strokeWidth="2" />
        </g>
      );
    case "trofeu":
      return (
        <g {...s}>
          <path d="M34 26H66V40Q66 56 50 58Q34 56 34 40Z" fill="#ffd84a" />
          <path d="M34 32Q22 32 26 44Q30 50 36 48M66 32Q78 32 74 44Q70 50 64 48" fill="none" strokeWidth="3.5" />
          <path d="M46 58H54V66H46Z" fill="#efb84a" />
          <rect x="36" y="66" width="28" height="10" rx="3" fill={MAD} />
          <path d="M44 34L48 38" stroke="#ffffff" strokeWidth="3" fill="none" />
        </g>
      );
    default:
      return null;
  }
}

/** Padrões de piso. Use <DefsPisos prefixo="..."/> dentro do <svg> e pisoDe(nome) para escolher. */
export function DefsPisos({ p }: { p: string }) {
  return (
    <defs>
      <pattern id={`${p}-madeira`} width="44" height="22" patternUnits="userSpaceOnUse">
        <rect width="44" height="22" fill="#f3c77f" />
        <path d="M0 21H44M16 0V22" stroke="#d99b4a" strokeWidth="2" fill="none" />
      </pattern>
      <pattern id={`${p}-madeira2`} width="44" height="22" patternUnits="userSpaceOnUse">
        <rect width="44" height="22" fill="#e3ad6c" />
        <path d="M0 21H44M30 0V22" stroke="#c2854a" strokeWidth="2" fill="none" />
      </pattern>
      <pattern id={`${p}-xadrez`} width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="#fff6e0" />
        <rect width="20" height="20" fill="#8fd8ec" />
        <rect x="20" y="20" width="20" height="20" fill="#8fd8ec" />
      </pattern>
      <pattern id={`${p}-azulejo`} width="20" height="20" patternUnits="userSpaceOnUse">
        <rect width="20" height="20" fill="#b5ecf8" />
        <path d="M0 19H20M19 0V20" stroke="#7fd0e6" strokeWidth="2" fill="none" />
      </pattern>
      <pattern id={`${p}-carpete`} width="16" height="16" patternUnits="userSpaceOnUse">
        <rect width="16" height="16" fill="#cdb9f5" />
        <circle cx="8" cy="8" r="2" fill="#b39cec" />
      </pattern>
      <pattern id={`${p}-carpete2`} width="16" height="16" patternUnits="userSpaceOnUse">
        <rect width="16" height="16" fill="#f5b5a8" />
        <circle cx="8" cy="8" r="2" fill="#e8907f" />
      </pattern>
      <pattern id={`${p}-grama`} width="22" height="16" patternUnits="userSpaceOnUse">
        <rect width="22" height="16" fill="#8ed16b" />
        <path d="M4 13L7 6M11 14L12 7M18 13L16 6" stroke="#6fb64c" strokeWidth="2" fill="none" strokeLinecap="round" />
      </pattern>
      <pattern id={`${p}-concreto`} width="50" height="50" patternUnits="userSpaceOnUse">
        <rect width="50" height="50" fill="#cfd3d8" />
        <path d="M0 49H50M49 0V50" stroke="#b3b8bf" strokeWidth="2" fill="none" />
        <circle cx="14" cy="18" r="1.5" fill="#b3b8bf" />
        <circle cx="34" cy="36" r="1.5" fill="#b3b8bf" />
      </pattern>
      <pattern id={`${p}-quadra`} width="50" height="50" patternUnits="userSpaceOnUse">
        <rect width="50" height="50" fill="#5bbf8a" />
        <path d="M0 25H50" stroke="#ffffff" strokeWidth="2" opacity="0.55" fill="none" />
      </pattern>
      <pattern id={`${p}-branco`} width="25" height="25" patternUnits="userSpaceOnUse">
        <rect width="25" height="25" fill="#f2f4f7" />
        <path d="M0 24H25M24 0V25" stroke="#d8dde3" strokeWidth="2" fill="none" />
      </pattern>
    </defs>
  );
}

const PISO_POR_COMODO: Record<string, string> = {
  "Sala de Estar": "madeira",
  Cozinha: "xadrez",
  Quarto: "carpete",
  Banheiro: "azulejo",
  Escritório: "madeira2",
  Garagem: "concreto",
  Jardim: "grama",
  Lavanderia: "azulejo",
  "Sala de Aula": "madeira",
  Biblioteca: "carpete2",
  Cantina: "xadrez",
  Secretaria: "madeira2",
  Pátio: "grama",
  Laboratório: "branco",
  Quadra: "quadra",
  "Sala dos Professores": "carpete",
};

export const pisoDe = (p: string, comodo: string) => `url(#${p}-${PISO_POR_COMODO[comodo] ?? "madeira"})`;
