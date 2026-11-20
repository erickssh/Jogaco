"use client";

// Móveis e objetos do Susdoku em estilo caricato (contorno grosso, cores vivas, perspectiva 3/4).
// Cada desenho ocupa uma casa de 100×100 unidades (origem no canto superior esquerdo).

const OUT = "#1e1e24";
const MAD = "#b8763d";
const MAD_ESC = "#7a5232";

const s = { stroke: OUT, strokeWidth: 3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

/** Sombra no chão (para objetos que ficam no piso). */
function Sombra({ rx, cy = 84 }: { rx: number; cy?: number }) {
  return <ellipse cx="50" cy={cy} rx={rx} ry="6" fill="#000000" opacity="0.18" />;
}

/**
 * Objetos em perspectiva "3/4" (vistos de frente e um pouco de cima): o tampo/topo
 * aparece mais claro e a frente mais escura, como em jogos de casinha.
 */
export function Movel({ id }: { id: string }) {
  switch (id) {
    case "cadeira":
      return (
        <g {...s}>
          <Sombra rx={24} />
          <rect x="34" y="12" width="32" height="34" rx="6" fill="#b06b2a" />
          <rect x="40" y="18" width="20" height="20" rx="4" fill="#d9944a" strokeWidth="2.5" />
          <rect x="31" y="58" width="6" height="24" rx="2" fill="#8a4f1d" />
          <rect x="63" y="58" width="6" height="24" rx="2" fill="#8a4f1d" />
          <path d="M33 44H67L73 54H27Z" fill="#e8a75c" />
          <rect x="27" y="54" width="46" height="8" rx="2" fill="#a85f26" />
        </g>
      );
    case "quadro":
      return (
        <g {...s}>
          <path d="M50 14L36 26M50 14L64 26" fill="none" strokeWidth="2.5" />
          <circle cx="50" cy="14" r="2.5" fill={OUT} />
          <rect x="20" y="26" width="60" height="46" rx="3" fill="#fff6e0" stroke={MAD} strokeWidth="7" />
          <rect x="20" y="26" width="60" height="46" rx="3" fill="none" />
          <path d="M26 66L40 46L50 56L58 48L74 66Z" fill="#5fd36c" strokeWidth="2.5" />
          <circle cx="64" cy="40" r="5" fill="#ffd84a" strokeWidth="2.5" />
        </g>
      );
    case "relogio":
      return (
        <g {...s}>
          <rect x="36" y="12" width="28" height="70" rx="8" fill={MAD} />
          <circle cx="50" cy="32" r="13" fill="#ffffff" />
          <path d="M50 32V24M50 32L56 35" strokeWidth="3" fill="none" />
          <rect x="42" y="50" width="16" height="26" rx="6" fill="#fff6e0" strokeWidth="2.5" />
          <path d="M50 52V66" strokeWidth="2" fill="none" />
          <circle cx="50" cy="68" r="4" fill="#ffd84a" strokeWidth="2" />
          <Sombra rx={16} cy={86} />
        </g>
      );
    case "estante":
      return (
        <g {...s}>
          <Sombra rx={36} cy={88} />
          <path d="M80 18L87 11V78L80 85Z" fill="#5e3f26" />
          <path d="M14 18L21 11H87L80 18Z" fill="#9a6a43" />
          <rect x="14" y="18" width="66" height="67" fill={MAD_ESC} />
          <rect x="19" y="23" width="56" height="26" fill="#4a301d" strokeWidth="2" />
          <rect x="19" y="54" width="56" height="26" fill="#4a301d" strokeWidth="2" />
          {[["#e5243b", 21, 7, 24], ["#378add", 29, 6, 22], ["#ffd84a", 36, 8, 24], ["#4cc25a", 45, 6, 20], ["#8f6fe0", 52, 7, 24], ["#ff7a3c", 60, 6, 22], ["#378add", 67, 6, 24]].map(([c, x, w, h], i) => (
            <rect key={`a${i}`} x={x as number} y={49 - (h as number)} width={w as number} height={h as number} rx="1.5" fill={c as string} strokeWidth="2" />
          ))}
          {[["#4cc25a", 21, 7, 22], ["#ff7aa8", 29, 8, 24], ["#ffd84a", 38, 6, 20], ["#e5243b", 45, 8, 24], ["#378add", 54, 7, 22]].map(([c, x, w, h], i) => (
            <rect key={`b${i}`} x={x as number} y={80 - (h as number)} width={w as number} height={h as number} rx="1.5" fill={c as string} strokeWidth="2" />
          ))}
          <path d="M62 80L72 60L76 62L66 80Z" fill="#ff7a3c" strokeWidth="2" />
        </g>
      );
    case "microscopio":
      return (
        <g {...s}>
          <Sombra rx={22} />
          <path d="M28 78H72L68 70H32Z" fill="#3b3b48" />
          <path d="M44 70V52Q44 38 58 32" fill="none" strokeWidth="7" stroke="#3b3b48" />
          <path d="M44 70V52Q44 38 58 32" fill="none" strokeWidth="2.5" stroke="#9a9aa6" />
          <rect x="52" y="14" width="13" height="28" rx="4" fill="#e9ecef" transform="rotate(28 58 28)" />
          <rect x="34" y="56" width="30" height="6" rx="2" fill="#9a9aa6" />
          <circle cx="62" cy="15" r="3" fill="#2b2b38" strokeWidth="2" />
        </g>
      );
    case "computador":
      return (
        <g {...s}>
          <Sombra rx={38} cy={86} />
          <rect x="15" y="58" width="6" height="26" rx="2" fill="#8a5a2b" />
          <rect x="79" y="58" width="6" height="26" rx="2" fill="#8a5a2b" />
          <path d="M16 50L22 42H78L84 50Z" fill="#e6b071" />
          <rect x="12" y="50" width="76" height="9" rx="2" fill={MAD} />
          <rect x="31" y="12" width="38" height="27" rx="4" fill="#2b2b38" />
          <rect x="35" y="16" width="30" height="19" rx="2" fill="#6fd3ff" strokeWidth="2" />
          <path d="M39 22L47 19M39 27L44 25" stroke="#ffffff" strokeWidth="2.5" fill="none" />
          <rect x="46" y="39" width="8" height="5" fill="#2b2b38" strokeWidth="2" />
          <path d="M36 48L38 45H60L62 48Z" fill="#e9ecef" strokeWidth="2" />
        </g>
      );
    case "arquivo":
      return (
        <g {...s}>
          <Sombra rx={24} cy={86} />
          <path d="M66 20L74 13V75L66 82Z" fill="#7d8992" />
          <path d="M28 20L36 13H74L66 20Z" fill="#c9d1d7" />
          <rect x="28" y="20" width="38" height="62" rx="2" fill="#9aa6ae" />
          <path d="M28 40H66M28 61H66" fill="none" strokeWidth="2.5" />
          {[30, 50, 71].map((y) => <rect key={y} x="41" y={y - 3} width="12" height="5" rx="2" fill="#e9ecef" strokeWidth="2" />)}
          <path d="M40 24H54" stroke="#ffffff" strokeWidth="2" fill="none" />
        </g>
      );
    case "telefone":
      return (
        <g {...s}>
          <Sombra rx={22} cy={86} />
          <rect x="36" y="58" width="5" height="26" rx="2" fill="#8a5a2b" />
          <rect x="59" y="58" width="5" height="26" rx="2" fill="#8a5a2b" />
          <path d="M28 58L32 52H68L72 58Z" fill="#e6b071" />
          <rect x="28" y="58" width="44" height="6" rx="2" fill={MAD} />
          <path d="M34 50L37 34H63L66 50Z" fill="#e5243b" />
          <path d="M30 34Q30 22 40 24H60Q70 22 70 34Q70 38 64 37L60 30H40L36 37Q30 38 30 34Z" fill="#2b2b38" />
          <circle cx="50" cy="42" r="5" fill="#ffffff" strokeWidth="2" />
        </g>
      );
    case "arvore":
      return (
        <g {...s}>
          <Sombra rx={30} cy={88} />
          <path d="M44 60H56L58 86H42Z" fill="#8a5a2b" />
          <circle cx="50" cy="36" r="26" fill="#3fae4a" />
          <circle cx="30" cy="48" r="14" fill="#3fae4a" />
          <circle cx="70" cy="48" r="14" fill="#3fae4a" />
          <circle cx="40" cy="28" r="10" fill="#5fd36c" strokeWidth="2.5" />
          <circle cx="62" cy="26" r="4" fill="#e5243b" strokeWidth="2" />
          <circle cx="36" cy="50" r="4" fill="#e5243b" strokeWidth="2" />
          <circle cx="60" cy="50" r="4" fill="#e5243b" strokeWidth="2" />
        </g>
      );
    case "bola":
      return (
        <g {...s}>
          <Sombra rx={18} cy={84} />
          <circle cx="50" cy="64" r="18" fill="#ffffff" strokeWidth="3.5" />
          <path d="M50 55L58 61L55 70H45L42 61Z" fill={OUT} strokeWidth="1.5" />
          <path d="M50 55V46M58 61L67 58M55 70L60 78M45 70L40 78M42 61L33 58" fill="none" strokeWidth="2" />
          <path d="M40 54Q44 50 48 49" stroke="#ffffff" strokeWidth="2" fill="none" />
        </g>
      );
    case "torneira":
      return (
        <g {...s}>
          <Sombra rx={30} cy={86} />
          <rect x="22" y="46" width="56" height="36" rx="3" fill="#f4f1ea" />
          <path d="M50 46V82" fill="none" strokeWidth="2.5" />
          <circle cx="44" cy="62" r="2.5" fill={OUT} />
          <circle cx="56" cy="62" r="2.5" fill={OUT} />
          <path d="M22 46L28 34H72L78 46Z" fill="#e2ddd2" />
          <ellipse cx="50" cy="40" rx="15" ry="4.5" fill="#9fdcf2" strokeWidth="2.5" />
          <path d="M44 34V22Q44 16 52 16H58" stroke="#9a9aa6" strokeWidth="5" fill="none" />
          <path d="M44 34V22Q44 16 52 16H58" stroke={OUT} strokeWidth="1.5" fill="none" />
          <path d="M58 20Q60 25 58 27Q56 25 58 20Z" fill="#6fd3ff" strokeWidth="1.5" />
        </g>
      );
    case "espelho":
      return (
        <g {...s}>
          <ellipse cx="50" cy="48" rx="22" ry="30" fill="#bfe9f7" stroke={MAD} strokeWidth="7" />
          <ellipse cx="50" cy="48" rx="22" ry="30" fill="none" />
          <path d="M40 34Q44 28 50 27M42 44L53 31" stroke="#ffffff" strokeWidth="3" fill="none" />
        </g>
      );
    case "fogao":
      return (
        <g {...s}>
          <Sombra rx={30} cy={86} />
          <path d="M24 36L30 22H70L76 36Z" fill="#6b6b78" />
          <ellipse cx="41" cy="29" rx="7" ry="3" fill="none" stroke="#ff7a3c" strokeWidth="2.5" />
          <ellipse cx="60" cy="29" rx="7" ry="3" fill="none" stroke="#b8b8c2" strokeWidth="2.5" />
          <path d="M37 26Q41 16 45 26" fill="#ffd84a" strokeWidth="2" />
          <rect x="24" y="36" width="52" height="46" rx="3" fill="#3b3b48" />
          {[34, 44, 56, 66].map((x) => <circle key={x} cx={x} cy="42" r="2.6" fill="#e9ecef" strokeWidth="1.5" />)}
          <rect x="31" y="49" width="38" height="26" rx="4" fill="#ffb26b" />
          <path d="M37 54H63" stroke="#ffffff" strokeWidth="2.5" fill="none" />
        </g>
      );
    case "cafeteira":
      return (
        <g {...s}>
          <Sombra rx={24} cy={84} />
          <rect x="30" y="18" width="30" height="62" rx="6" fill="#3b3b48" />
          <rect x="30" y="18" width="30" height="12" rx="5" fill="#55556a" />
          <path d="M34 54H56V70Q56 76 45 76Q34 76 34 70Z" fill="#8a5a2b" strokeWidth="2.5" />
          <path d="M34 54H56V58H34Z" fill="#c9e6f2" strokeWidth="2" />
          <path d="M62 64H74V76Q74 80 68 80Q62 80 62 76Z" fill="#ffffff" />
          <path d="M74 67Q80 67 80 72Q80 76 74 75" fill="none" strokeWidth="2.5" />
          <path d="M66 58Q68 54 66 50M71 58Q73 54 71 50" stroke="#9a9aa6" strokeWidth="2" fill="none" />
        </g>
      );
    case "sofa":
      return (
        <g {...s}>
          <Sombra rx={40} cy={86} />
          <rect x="16" y="20" width="68" height="32" rx="12" fill="#7a5ec9" />
          <rect x="24" y="44" width="25" height="14" rx="5" fill="#c3b1fa" />
          <rect x="51" y="44" width="25" height="14" rx="5" fill="#c3b1fa" />
          <rect x="20" y="56" width="60" height="18" rx="5" fill="#8f6fe0" />
          <rect x="10" y="38" width="15" height="38" rx="7" fill="#9d80ea" />
          <rect x="75" y="38" width="15" height="38" rx="7" fill="#9d80ea" />
          <rect x="18" y="76" width="6" height="7" rx="1" fill="#5b4636" />
          <rect x="76" y="76" width="6" height="7" rx="1" fill="#5b4636" />
          <rect x="28" y="26" width="16" height="14" rx="5" fill="#ffd84a" strokeWidth="2.5" transform="rotate(-8 36 33)" />
        </g>
      );
    case "tv":
      return (
        <g {...s}>
          <Sombra rx={30} cy={86} />
          <path d="M20 66L26 60H74L80 66Z" fill="#8a5a2b" />
          <rect x="20" y="66" width="60" height="16" rx="2" fill="#6b4a33" />
          <path d="M50 66V82" fill="none" strokeWidth="2" />
          <rect x="18" y="16" width="64" height="40" rx="6" fill="#2b2b38" />
          <rect x="23" y="21" width="54" height="30" rx="3" fill="#6fd3ff" strokeWidth="2" />
          <path d="M30 30L42 26M30 36L38 33" stroke="#ffffff" strokeWidth="3" fill="none" />
          <rect x="44" y="56" width="12" height="5" fill="#3b3b48" strokeWidth="2" />
        </g>
      );
    case "cama":
      return (
        <g {...s}>
          <Sombra rx={36} cy={90} />
          <rect x="18" y="6" width="64" height="24" rx="9" fill="#b8763d" />
          <rect x="22" y="22" width="56" height="54" rx="5" fill="#ffffff" />
          <rect x="30" y="25" width="40" height="15" rx="7" fill="#ffffff" />
          <path d="M22 44H78V76H22Z" fill="#4fa3ff" />
          <path d="M22 50H78" fill="none" strokeWidth="2.5" />
          <rect x="22" y="76" width="56" height="10" rx="3" fill="#2f7fd6" />
          <circle cx="40" cy="62" r="3" fill="#ffffff" strokeWidth="1.5" />
          <circle cx="58" cy="66" r="3" fill="#ffffff" strokeWidth="1.5" />
        </g>
      );
    case "carro":
      return (
        <g {...s}>
          <Sombra rx={40} cy={84} />
          <path d="M26 48Q30 28 44 28H60Q72 28 78 48Z" fill="#e5243b" />
          <path d="M33 47Q36 34 45 34H51V47Z" fill="#9fdcf2" strokeWidth="2.5" />
          <path d="M55 34H60Q68 34 71 47H55Z" fill="#9fdcf2" strokeWidth="2.5" />
          <rect x="10" y="46" width="80" height="24" rx="10" fill="#e5243b" />
          <path d="M50 48V68" fill="none" strokeWidth="2" />
          <circle cx="86" cy="56" r="3.5" fill="#ffd84a" strokeWidth="2" />
          <rect x="11" y="54" width="6" height="5" rx="1" fill="#ff7a3c" strokeWidth="1.5" />
          <circle cx="30" cy="72" r="10" fill="#2b2b38" />
          <circle cx="30" cy="72" r="4" fill="#c4c4cc" strokeWidth="2" />
          <circle cx="70" cy="72" r="10" fill="#2b2b38" />
          <circle cx="70" cy="72" r="4" fill="#c4c4cc" strokeWidth="2" />
        </g>
      );
    case "ferramentas":
      return (
        <g {...s}>
          <Sombra rx={30} cy={84} />
          <path d="M38 36V26H62V36" fill="none" strokeWidth="4.5" />
          <path d="M20 44L26 36H74L80 44Z" fill="#ff5a6e" />
          <rect x="20" y="44" width="60" height="36" rx="4" fill="#e5243b" />
          <path d="M20 58H80" fill="none" />
          <rect x="44" y="54" width="12" height="8" rx="2" fill="#ffd84a" strokeWidth="2" />
          <path d="M66 36L72 24" stroke="#9a9aa6" strokeWidth="4" fill="none" />
        </g>
      );
    case "flor":
      return (
        <g {...s}>
          <Sombra rx={18} cy={86} />
          <path d="M50 46V66" stroke="#3fae4a" strokeWidth="4" fill="none" />
          <ellipse cx="58" cy="58" rx="7" ry="3.5" fill="#5fd36c" strokeWidth="2" />
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={50 + 10 * Math.cos((a * Math.PI) / 180)} cy={36 + 10 * Math.sin((a * Math.PI) / 180)} r="7.5" fill="#ff7aa8" strokeWidth="2.5" />
          ))}
          <circle cx="50" cy="36" r="6" fill="#ffd84a" strokeWidth="2.5" />
          <path d="M36 66H64L60 84H40Z" fill="#ff9a3c" />
          <path d="M34 66H66" strokeWidth="4" fill="none" />
        </g>
      );
    case "planta":
      return (
        <g {...s}>
          <Sombra rx={20} cy={86} />
          <ellipse cx="34" cy="40" rx="13" ry="8" fill="#4cc25a" transform="rotate(-35 34 40)" />
          <ellipse cx="66" cy="40" rx="13" ry="8" fill="#4cc25a" transform="rotate(35 66 40)" />
          <ellipse cx="50" cy="30" rx="8" ry="15" fill="#5fd36c" />
          <path d="M34 56H66L62 84H38Z" fill="#ff9a3c" />
          <path d="M32 56H68" strokeWidth="4" fill="none" />
        </g>
      );
    case "janela":
      return (
        <g {...s}>
          <rect x="22" y="18" width="56" height="54" rx="3" fill="#bfe9f7" stroke="#ffffff" strokeWidth="9" />
          <rect x="22" y="18" width="56" height="54" rx="3" fill="none" />
          <path d="M50 18V72M22 45H78" stroke="#ffffff" strokeWidth="4" fill="none" />
          <path d="M30 30L38 26M30 36L35 34" stroke="#ffffff" strokeWidth="2.5" fill="none" />
          <rect x="18" y="72" width="64" height="7" rx="2" fill="#e6e2d8" />
          <path d="M14 14Q22 44 16 78H26Q22 44 28 14Z" fill="#ff7aa8" strokeWidth="2.5" />
          <path d="M86 14Q78 44 84 78H74Q78 44 72 14Z" fill="#ff7aa8" strokeWidth="2.5" />
        </g>
      );
    case "lixeira":
      return (
        <g {...s}>
          <Sombra rx={18} cy={86} />
          <path d="M34 40H66L62 82H38Z" fill="#4cc25a" />
          <path d="M44 48V74M56 48V74" fill="none" strokeWidth="2.5" />
          <ellipse cx="50" cy="38" rx="18" ry="5.5" fill="#3fae4a" />
          <path d="M44 33Q50 26 56 33" fill="none" strokeWidth="3" />
        </g>
      );
    case "cesto":
      return (
        <g {...s}>
          <Sombra rx={26} cy={86} />
          <path d="M34 42Q38 28 50 32Q62 26 66 42Z" fill="#4fa3ff" />
          <path d="M42 40Q46 32 54 36" stroke="#ffffff" strokeWidth="2.5" fill="none" />
          <path d="M26 44H74L68 82H32Z" fill="#d9a066" />
          <path d="M28 56H72M30 68H70M42 44L44 82M58 44L56 82" fill="none" strokeWidth="2" />
          <rect x="24" y="40" width="52" height="7" rx="3" fill="#b8763d" />
        </g>
      );
    case "banheira":
      return (
        <g {...s}>
          <Sombra rx={38} cy={86} />
          <path d="M12 40H88Q86 74 66 76H34Q14 74 12 40Z" fill="#ffffff" />
          <ellipse cx="50" cy="40" rx="38" ry="9" fill="#ffffff" />
          <ellipse cx="50" cy="41" rx="32" ry="6" fill="#7fd6f5" strokeWidth="2.5" />
          <circle cx="30" cy="34" r="5" fill="#ffffff" strokeWidth="2" />
          <circle cx="40" cy="30" r="4" fill="#ffffff" strokeWidth="2" />
          <circle cx="60" cy="32" r="6" fill="#ffffff" strokeWidth="2" />
          <path d="M68 36Q72 30 76 36L72 40Z" fill="#ffd84a" strokeWidth="2" />
          <circle cx="28" cy="80" r="4" fill="#ffd84a" strokeWidth="2" />
          <circle cx="72" cy="80" r="4" fill="#ffd84a" strokeWidth="2" />
        </g>
      );
    case "mochila":
      return (
        <g {...s}>
          <Sombra rx={20} cy={84} />
          <path d="M40 26Q40 16 50 16Q60 16 60 26" fill="none" strokeWidth="4" />
          <rect x="30" y="24" width="40" height="56" rx="13" fill="#378add" />
          <rect x="37" y="54" width="26" height="20" rx="6" fill="#85b7eb" strokeWidth="2.5" />
          <path d="M37 60H63" fill="none" strokeWidth="2" />
          <path d="M42 32H58" stroke="#ffd84a" strokeWidth="3" fill="none" />
        </g>
      );
    case "trofeu":
      return (
        <g {...s}>
          <Sombra rx={18} cy={86} />
          <path d="M34 20H66V36Q66 52 50 54Q34 52 34 36Z" fill="#ffd84a" />
          <path d="M34 26Q22 26 26 38Q30 44 36 42M66 26Q78 26 74 38Q70 44 64 42" fill="none" strokeWidth="3.5" />
          <path d="M46 54H54V64H46Z" fill="#efb84a" />
          <path d="M34 72L38 64H62L66 72Z" fill="#c98a4b" />
          <rect x="34" y="72" width="32" height="10" rx="2" fill={MAD} />
          <path d="M44 28L48 32" stroke="#ffffff" strokeWidth="3" fill="none" />
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
