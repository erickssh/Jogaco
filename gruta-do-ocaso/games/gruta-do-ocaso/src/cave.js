import { makeRegion, ORIGINAL, regions } from './regions.js';
const TAU = 2 * Math.PI;
const polar = (r, a) => ({ x: Math.cos(a) * r, y: Math.sin(a) * r });
export const INTERACT = 78;
const length = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function distanceToPath(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    d2 = dx * dx + dy * dy;
  const t = d2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / d2)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

// Nodes are chambers and paths are the tunnels between them. The same geometry drives
// collision, navigation, the floor silhouette and the map the player can unfold.
export function makeCave(count, id = ORIGINAL) {
  if (!Object.hasOwn(regions, id)) throw new RangeError('Mapa desconhecido.');
  if (id !== ORIGINAL) return makeRegion(count, id);
  const radius = 4000 + count * 155;
  const nodes = [],
    paths = [],
    vaults = [],
    spawns = [],
    chests = [],
    encounters = [],
    outer = [],
    inner = [];
  function node(p, r) {
    nodes.push({ ...p, r });
    return nodes.length - 1;
  }
  function link(a, b, r, trail, mouth = false) {
    const path = { a, b, r };
    if (trail) path.trail = trail;
    if (mouth) path.mouth = true;
    paths.push(path);
  }
  const center = node({ x: 0, y: 0 }, 430);
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + (TAU * i) / count,
      rad = polar(1, a),
      side = polar(1, a + Math.PI / 2);
    const put = (r, lateral = 0) => ({
      x: rad.x * r + side.x * lateral,
      y: rad.y * r + side.y * lateral,
    });
    const junction = radius * 0.925 - 370;
    const start = node(put(radius * 0.925), 220);
    const first = node(put(junction), 154);
    const stores = node(put(junction - 175, -495), 151);
    const middle = node(put(radius * 0.59, -510), 250);
    const fork = node(put(radius * 0.35, 100), 235);
    const near = node(put(radius * 0.175, -40), 190);
    link(start, first, 106);
    link(first, stores, 88, 'provisoes', true);
    link(stores, middle, 106);
    link(middle, fork, 126);
    link(first, fork, 95, 'atalho', true);
    link(fork, near, 120, 'atalho');
    link(near, center, 145, 'atalho');
    outer.push(middle);
    inner.push(fork);
    spawns.push(nodes[start]);
    chests.push({ ...put(radius * 0.925 - 64), id: 'provisao' + i, tier: 1 });
    chests.push({
      ...put(junction - 195, -535),
      id: 'veio' + i,
      tier: 2,
      name: 'Baú de provisões',
    });
    const v = {
      ...put(junction - 230, 930),
      ux: side.x,
      uy: side.y,
      id: 'camara' + i,
      guarded: true,
      halfW: 300,
      halfH: 235,
      doorGap: 48,
    };
    const door = vaultPoint(v, -307, 0),
      entry = node(vaultPoint(v, -350, 0), 91);
    link(first, entry, 90, 'sentinela', true);
    vaults.push({ ...v, door });
    chests.push({
      ...vaultPoint(v, 178, 0),
      id: 'tesouro' + i,
      tier: 3,
      vault: v.id,
    });
    encounters.push(
      put(junction - 202, 515),
      put(radius * 0.59, -555),
      put(radius * 0.52, -325),
      put(radius * 0.39, 70),
      put(radius * 0.18, -65),
    );
  }
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (TAU * (i + 0.5)) / count;
    const crossing = node(polar(radius * 0.41, angle), 140);
    link(outer[i], crossing, 90);
    link(crossing, outer[(i + 1) % count], 90);
    link(inner[i], inner[(i + 1) % count], 108);
  }
  return { id, radius, nodes, paths, vaults, spawns, chests, encounters };
}
export function vaultPoint(v, x, y) {
  return { x: v.x + v.ux * x - v.uy * y, y: v.y + v.uy * x + v.ux * y };
}
function local(v, p) {
  const dx = p.x - v.x,
    dy = p.y - v.y;
  return { x: dx * v.ux + dy * v.uy, y: -dx * v.uy + dy * v.ux };
}
const cache = new WeakMap(),
  CELL = 512;
function indexFor(map) {
  if (cache.has(map)) return cache.get(map);
  const cells = new Map(),
    neighbors = map.nodes.map(() => []);
  const index = (o, x1, y1, x2, y2) => {
    for (let x = Math.floor(x1 / CELL); x <= Math.floor(x2 / CELL); x++)
      for (let y = Math.floor(y1 / CELL); y <= Math.floor(y2 / CELL); y++) {
        const k = x + ',' + y;
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(o);
      }
  };
  for (const n of map.nodes) index(n, n.x - n.r, n.y - n.r, n.x + n.r, n.y + n.r);
  for (const path of map.paths) {
    const a = map.nodes[path.a],
      b = map.nodes[path.b],
      r = path.r,
      dx = b.x - a.x,
      dy = b.y - a.y;
    index(
      { x: a.x, y: a.y, r, dx, dy, d2: dx * dx + dy * dy },
      Math.min(a.x, b.x) - r,
      Math.min(a.y, b.y) - r,
      Math.max(a.x, b.x) + r,
      Math.max(a.y, b.y) + r,
    );
    const cost = Math.hypot(dx, dy);
    neighbors[path.a].push({ node: path.b, cost });
    neighbors[path.b].push({ node: path.a, cost });
  }
  const routes = neighbors.map((_, goal) => {
    const next = Array(neighbors.length).fill(-1),
      distances = Array(neighbors.length).fill(Infinity),
      visited = new Uint8Array(neighbors.length);
    next[goal] = goal;
    distances[goal] = 0;
    for (let step = 0; step < neighbors.length; step++) {
      let current = -1,
        best = Infinity;
      for (let n = 0; n < neighbors.length; n++)
        if (!visited[n] && distances[n] < best) {
          current = n;
          best = distances[n];
        }
      if (current === -1) break;
      visited[current] = 1;
      for (const edge of neighbors[current])
        if (best + edge.cost < distances[edge.node]) {
          distances[edge.node] = best + edge.cost;
          next[edge.node] = current;
        }
    }
    return next;
  });
  const result = { cells, routes };
  cache.set(map, result);
  return result;
}
export function floorAt(map, doors, p, pad = 14) {
  for (const v of map.vaults) {
    const width = v.halfW ?? 145,
      height = v.halfH ?? 110,
      gap = v.doorGap ?? 39;
    const bound = Math.hypot(width + 17, height + 17) + pad;
    if (Math.abs(p.x - v.x) > bound || Math.abs(p.y - v.y) > bound) continue;
    const q = local(v, p),
      ax = Math.abs(q.x),
      ay = Math.abs(q.y);
    if (ax > width + 15 + pad || ay > height + 14 + pad) continue;
    if (ax < width - pad && ay < height - pad) return true;
    if (q.x < 0 && ay < gap - pad && doors[v.id]) return true;
    return false;
  }
  const shapes = indexFor(map).cells.get(Math.floor(p.x / CELL) + ',' + Math.floor(p.y / CELL));
  if (!shapes) return false;
  return shapes.some((o) => {
    let dx = p.x - o.x,
      dy = p.y - o.y;
    if (o.d2) {
      const t = Math.min(1, Math.max(0, (dx * o.dx + dy * o.dy) / o.d2));
      dx -= o.dx * t;
      dy -= o.dy * t;
    }
    return dx * dx + dy * dy < (o.r - pad) ** 2;
  });
}
export function routeTo(map, p, target) {
  let destination = target;
  for (const v of map.vaults) {
    const width = v.halfW ?? 145,
      height = v.halfH ?? 110,
      from = local(v, p),
      to = local(v, target);
    const pInside = Math.abs(from.x) < width - 14 && Math.abs(from.y) < height - 14;
    const tInside = Math.abs(to.x) < width - 14 && Math.abs(to.y) < height - 14;
    if (pInside === tInside) continue;
    const outer = vaultPoint(v, -width - 50, 0),
      inner = vaultPoint(v, -width + 60, 0);
    if (pInside) return length(p, inner) > 40 ? inner : outer;
    if (length(p, outer) < 45) return inner;
    destination = outer;
    break;
  }
  function closest(v) {
    let best = 0;
    for (let i = 1; i < map.nodes.length; i++)
      if (length(v, map.nodes[i]) < length(v, map.nodes[best])) best = i;
    return best;
  }
  const a = closest(p),
    b = closest(destination);
  if (a === b) return destination;
  const next = map.nodes[indexFor(map).routes[b][a]];
  return length(p, map.nodes[a]) > 55 && length(p, next) > length(map.nodes[a], next)
    ? map.nodes[a]
    : next;
}
export function nearestFeature(s, p) {
  let out = null,
    d = INTERACT;
  function check(pos, kind, id, blocked = false) {
    const hit = length(p, pos);
    if (hit <= d) {
      out = { kind, id, blocked };
      d = hit;
    }
  }
  for (const v of s.layout.vaults) if (!s.doors[v.id]) check(v.door, 'door', v.id);
  for (const c of s.layout.chests)
    if (!s.opened[c.id] && (!c.vault || s.doors[c.vault]))
      check(c, 'chest', c.id, !!c.vault && s.mobs.some((m) => m.alive && m.guard === c.vault));
  return out;
}
