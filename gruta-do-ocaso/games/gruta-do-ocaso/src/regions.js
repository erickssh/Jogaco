export const ORIGINAL = 'ocaso';
export const regions = {
  ocaso: {
    name: 'Gruta do Ocaso',
    route:
      'Lanternas levam às provisões, garras marcam a trilha da Sentinela e cristais apontam o atalho ao centro.',
    sign: 'Galeria',
    dark: '#08141f',
    shadow: '#172331',
    edge: '#4a5962',
    rock: '#263442',
    light: '#3d4e59',
    accent: '#a6e5d3',
    floor: '#34424a',
    cover: 'cavern.webp',
  },
  caldeira: {
    name: 'Caldeira Rubra',
    route: 'Duas pontes de basalto contornam cada cratera e voltam a se unir na forja.',
    sign: 'Forja',
    dark: '#451c1c',
    shadow: '#48201e',
    edge: '#974930',
    rock: '#432e32',
    light: '#84473a',
    accent: '#ffc177',
    floor: '#513634',
  },
  bosque: {
    name: 'Bosque das Lanternas',
    route: 'As trilhas se ramificam em clareiras. Bosques laterais escondem tesouros.',
    sign: 'Trilha',
    dark: '#112a27',
    shadow: '#24392d',
    edge: '#69835b',
    rock: '#304d3f',
    light: '#507454',
    accent: '#a2efd1',
    floor: '#38523b',
  },
  geleira: {
    name: 'Geleira da Aurora',
    route: 'Fendas de gelo conduzem em espiral ao centro. Um anel externo liga as entradas.',
    sign: 'Fenda',
    dark: '#243957',
    shadow: '#345e78',
    edge: '#a8dce1',
    rock: '#487693',
    light: '#9acbd6',
    accent: '#ceefff',
    floor: '#8baebc',
  },
  ruinas: {
    name: 'Ruínas do Sol',
    route: 'Corredores em cotovelo conectam os pátios. As passagens internas cruzam o santuário.',
    sign: 'Pátio',
    dark: '#4a3540',
    shadow: '#654e44',
    edge: '#d3a76c',
    rock: '#85634f',
    light: '#c09969',
    accent: '#ffe196',
    floor: '#af9164',
  },
  mares: {
    name: 'Arquipélago das Marés',
    route:
      'Passarelas de madeira ligam ilhotas. Nas docas, escolha entre seguir pela costa ou cortar para a ilha central.',
    sign: 'Doca',
    dark: '#1a5263',
    shadow: '#397884',
    edge: '#c0ddbf',
    rock: '#576d62',
    light: '#96a58a',
    accent: '#ffe0a0',
    floor: '#b3a07b',
  },
};
export const coverOf = (id) => regions[id].cover || 'vista-' + id + '.webp';

// Each plan describes one player's sector. Coordinates are a fraction of the radius
// and of the angle between adjacent entrances. Index zero in each plan is the spawn.
const plans = {
  caldeira: {
    rooms: [
      [0.925, 0, 260],
      [0.73, 0, 215],
      [0.53, -0.23, 168],
      [0.52, 0.23, 180],
      [0.34, 0, 260],
      [0.16, 0, 168],
    ],
    paths: [
      [0, 1, 132],
      [1, 2, 86],
      [1, 3, 98],
      [2, 4, 88],
      [3, 4, 102],
      [4, 5, 115],
    ],
    cross: [[4, 4, 88]],
    center: [5],
    vault: 3,
    cache: 2,
  },
  bosque: {
    rooms: [
      [0.925, 0, 265],
      [0.74, -0.08, 240],
      [0.71, -0.29, 175],
      [0.56, 0.13, 270],
      [0.48, 0.32, 185],
      [0.32, -0.08, 235],
      [0.17, 0.1, 190],
    ],
    paths: [
      [0, 1, 136],
      [1, 2, 94],
      [1, 3, 114],
      [3, 4, 88],
      [3, 5, 115],
      [5, 6, 120],
    ],
    cross: [[6, 5, 83]],
    center: [6],
    vault: 4,
    cache: 2,
  },
  geleira: {
    rooms: [
      [0.925, 0, 250],
      [0.74, 0.08, 195],
      [0.57, 0.28, 170],
      [0.38, 0.49, 205],
      [0.22, 0.7, 195],
      [0.12, 0.83, 150],
    ],
    paths: [
      [0, 1, 115],
      [1, 2, 118],
      [2, 3, 98],
      [3, 4, 115],
      [4, 5, 105],
    ],
    cross: [
      [1, 1, 86],
      [4, 3, 76],
    ],
    center: [5],
    vault: 2,
    cache: 3,
  },
  ruinas: {
    rooms: [
      [0.925, 0, 255],
      [0.79, 0, 190],
      [0.75, 0.22, 175],
      [0.55, 0.22, 235],
      [0.55, -0.14, 210],
      [0.31, -0.14, 240],
      [0.31, 0.15, 175],
      [0.14, 0.15, 190],
    ],
    paths: [
      [0, 1, 105],
      [1, 2, 96],
      [2, 3, 110],
      [3, 4, 96],
      [4, 5, 102],
      [5, 6, 96],
      [6, 7, 114],
    ],
    cross: [
      [3, 4, 87],
      [6, 5, 95],
    ],
    center: [7],
    vault: 4,
    cache: 6,
  },
  mares: {
    rooms: [
      [0.925, 0, 265],
      [0.74, -0.11, 245],
      [0.55, -0.23, 220],
      [0.59, 0.15, 225],
      [0.34, 0.07, 250],
      [0.17, -0.07, 190],
    ],
    paths: [
      [0, 1, 66],
      [1, 2, 66],
      [1, 3, 61],
      [3, 4, 62],
      [4, 5, 71],
    ],
    cross: [
      [3, 2, 66],
      [2, 4, 61],
    ],
    center: [5],
    vault: 2,
    cache: 3,
  },
};
const TAU = Math.PI * 2;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
function distanceToSegment(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function makeRegion(count, id) {
  const plan = plans[id],
    radius = 4000 + count * 155,
    step = TAU / count;
  const nodes = [],
    paths = [],
    sectors = [],
    spawns = [],
    encounters = [],
    chests = [],
    vaults = [];
  function node(x, y, r) {
    nodes.push({ x, y, r });
    return nodes.length - 1;
  }
  function link(a, b, r) {
    paths.push({ a, b, r: Math.max(id === 'mares' ? 82 : 92, r) });
  }
  const center = node(0, 0, id === 'ruinas' ? 335 : id === 'mares' ? 305 : 385);
  for (let i = 0; i < count; i++) {
    const sectorAngle = -Math.PI / 2 + step * i;
    const indices = plan.rooms.map(([depth, sweep, r]) => {
      const angle = sectorAngle + step * sweep;
      return node(Math.cos(angle) * depth * radius, Math.sin(angle) * depth * radius, r);
    });
    sectors.push(indices);
    for (const [a, b, r] of plan.paths) link(indices[a], indices[b], r);
    for (const j of plan.center) link(indices[j], center, id === 'mares' ? 77 : 120);
    const start = nodes[indices[0]];
    spawns.push(start);
    chests.push({
      x: start.x - 64 * Math.cos(sectorAngle),
      y: start.y - 64 * Math.sin(sectorAngle),
      id: 'provisao' + i,
      tier: 1,
    });
    const stash = nodes[indices[plan.cache]];
    chests.push({
      x: stash.x + Math.cos(sectorAngle) * 48,
      y: stash.y + Math.sin(sectorAngle) * 48,
      id: 'veio' + i,
      tier: 2,
    });
    for (const j of [1, 2, 3, 4, indices.length - 1]) {
      const room = nodes[indices[j]];
      const a = encounters.length * 2.39;
      encounters.push({ x: room.x + 65 * Math.cos(a), y: room.y + 65 * Math.sin(a) });
    }
  }
  for (let i = 0; i < count; i++)
    for (const [a, b, r] of plan.cross) link(sectors[i][a], sectors[(i + 1) % count][b], r);
  for (let i = 0; i < count; i++) {
    const anchor = sectors[i][plan.vault],
      base = nodes[anchor];
    // Put the treasury in solid terrain, clear of through-routes and other vaults.
    let best = -Infinity,
      site = null;
    for (const length of [760, 920, 1100, 1300]) {
      for (let j = 0; j < 64; j++) {
        const a = step * i + (TAU * j) / 64,
          ux = Math.cos(a),
          uy = Math.sin(a);
        const p = { x: base.x + ux * length, y: base.y + uy * length, ux, uy };
        const clearance = Math.min(
          radius - Math.hypot(p.x, p.y),
          ...nodes.map((n) => dist(n, p) - n.r),
          ...paths.map((e) => distanceToSegment(p, nodes[e.a], nodes[e.b]) - e.r),
          ...vaults.map((v) => dist(v, p) - 415),
        );
        if (clearance > best) {
          best = clearance;
          site = p;
        }
      }
      if (best >= 415) break;
    }
    const { x, y, ux, uy } = site,
      vid = 'camara' + i;
    const entrance = node(x - ux * 350, y - uy * 350, 91);
    link(anchor, entrance, 92);
    const guarded = i % 2 === 0;
    vaults.push({
      ...site,
      id: vid,
      guarded,
      halfW: 300,
      halfH: 235,
      doorGap: 48,
      door: { x: x - 307 * ux, y: y - 307 * uy },
    });
    chests.push({
      x: x + 178 * ux,
      y: y + 178 * uy,
      id: 'tesouro' + i,
      tier: guarded ? 3 : 2,
      vault: vid,
    });
  }
  return { id, radius, nodes, paths, vaults, spawns, chests, encounters };
}
