import { makeCave, floorAt, nearestFeature, vaultPoint, routeTo, distanceToPath } from './cave.js';
import { CAPACITY, receive, equip, clearKit } from './inventory.js';
import {
  effectLifetime,
  areaStyle,
  SHOT_RADIUS,
  LUNAR_WAVE,
  CHARGED_ATTACKS,
  LIGHT_CHARGE,
  FULL_CHARGE,
} from './combat-spec.js';
export const PREP = 300;
export const END = 900;
export const CLASSIC_TIMING = Object.freeze({ prep: PREP, end: END });
export const QUICK_TIMING = Object.freeze({ prep: 30, end: 300 });
export const GUARD_WINDUP = 0.85;
export const CLASSES = {
  guerreiro: {
    name: 'Guerreiro',
    weapon: 'Espada',
    role: 'Corpo a corpo',
    color: '#efb467',
    hp: 135,
    range: 100,
    speed: 190,
    damage: 21,
    attackName: 'Espadada',
    attackStyle: 'slash',
    attackInterval: 1.42,
    skills: [
      ['Talho lunar', 'Dispara uma onda cortante que avança na direção da mira.'],
      ['Impacto', 'Marca o chão aos seus pés e o abala após 0,55 s.'],
      ['Bastião', 'Recupera vida e ergue a guarda.'],
    ],
  },
  mago: {
    name: 'Mago',
    weapon: 'Cajado',
    role: 'Cajado e magia carregada',
    color: '#baa2ff',
    hp: 90,
    range: 74,
    speed: 182,
    damage: 18,
    attackName: 'Cajadada',
    attackStyle: 'staff',
    attackInterval: 1.6,
    attackRecovery: 0.45,
    skills: [
      ['Nova arcana', 'Marca a área na mira e explode após 0,65 s.'],
      ['Tríade', 'Carrega três faíscas antes de lançá-las.'],
      ['Pulso glacial', 'Marca o chão e desacelera quem estiver na área após 0,65 s.'],
    ],
  },
  arqueiro: {
    name: 'Arqueiro',
    weapon: 'Arco',
    role: 'Longo alcance',
    color: '#9adf94',
    hp: 100,
    range: 630,
    speed: 205,
    damage: 13,
    attackName: 'Flecha simples',
    attackSpeed: 690,
    attackInterval: 1.3,
    skills: [
      ['Perfuração', 'Mira por um instante antes de lançar uma flecha perfurante.'],
      ['Leque', 'Marca as trajetórias e dispara cinco flechas.'],
      ['Passo leve', 'Acelera e recupera a esquiva.'],
    ],
  },
  invocador: {
    name: 'Invocador',
    weapon: 'Grimório',
    role: 'Criaturas aliadas',
    color: '#6bdbce',
    hp: 105,
    range: 420,
    speed: 186,
    damage: 13,
    attackName: 'Disparo espiritual',
    attackSpeed: 500,
    attackInterval: 1.45,
    skills: [
      ['Familiar', 'Chama um espírito que luta ao seu lado.'],
      ['Selo', 'Marca uma runa na mira que detona após 0,70 s.'],
      ['Vínculo', 'Cura e prolonga a invocação.'],
    ],
  },
};
export const PASSIVES = [
  ['Vigor', 'Mais vida máxima.'],
  ['Agilidade', 'Move-se mais rápido.'],
  ['Potência', 'Todos os ataques causam mais dano.'],
];
export const ITEMS = { blade: 'Arma', armor: 'Couraça', boots: 'Botas', potion: 'Poção' };
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const blank = () => ({ x: 0, y: 0, a: 0, attack: false });
function collapseProgress(s) {
  const { prep, end } = s.timing ?? CLASSIC_TIMING;
  return Math.max(0, Math.min(1, (s.time - prep) / (end - prep)));
}
export function zone(s) {
  const t = collapseProgress(s);
  return s.radius * (1 - t) * (1 - 0.42 * t);
}
function free(s, p, pad = 18) {
  return (
    floorAt(s.layout, s.doors, p, pad) &&
    !s.rocks.some((r) => Math.abs(r.x - p.x) < r.r + pad && dist(r, p) < r.r + pad)
  );
}
function safestEntrance(s, old) {
  const danger = [old, ...s.players.filter((p) => p.alive), ...s.mobs.filter((m) => m.alive)];
  const score = (n) => Math.min(...danger.map((t) => dist(t, n)));
  const { x, y } = s.spawns.reduce((a, b) => (score(a) > score(b) ? a : b));
  return { x, y };
}
function lineOpen(s, a, b) {
  const steps = Math.ceil(dist(a, b) / 18);
  for (let i = 1; i <= steps; i++)
    if (!free(s, { x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps }, 1))
      return false;
  return true;
}
function clearDistance(s, x, y, angle, range) {
  const dx = Math.cos(angle),
    dy = Math.sin(angle);
  const steps = Math.ceil(range / 12);
  for (let i = 1; i <= steps; i++) {
    const length = (range * i) / steps;
    if (!free(s, { x: x + dx * length, y: y + dy * length }, 1)) return (range * (i - 1)) / steps;
  }
  return range;
}
function interact(s, p) {
  const f = nearestFeature(s, p);
  if (!f) return;
  if (f.kind === 'door') {
    s.doors[f.id] = true;
    return;
  }
  if (f.blocked) return;
  const c = s.layout.chests.find((c) => c.id === f.id);
  if (!lineOpen(s, p, c)) return;
  s.opened[c.id] = true;
  const rewards = [
    { type: pick(['blade', 'armor', 'boots']), tier: c.tier },
    { type: 'potion', tier: 1 },
  ];
  if (c.tier === 3) rewards.push({ type: pick(['blade', 'armor', 'boots']), tier: 2 });
  for (const r of rewards) if (!receive(p, { ...r, id: s.next++ })) drop(s, c, r.type, r.tier);
  p.found = (p.found || 0) + 1;
  effect(s, c, 'ring', 40, '#ffd583');
}
function manageBag(s, p) {
  const cmd = p.bagCommand;
  if (!cmd) return;
  p.bagCommand = null;
  if (cmd.action === 'equip') equip(p, cmd.id);
  else if (cmd.action === 'remove') {
    const item = Object.values(p.gear).find((it) => it?.id === cmd.id);
    if (item && p.bag.length < CAPACITY) {
      p.gear[item.type] = null;
      p[item.type] = 0;
      p.bag.push(item);
    }
  } else {
    const i = p.bag.findIndex((it) => it.id === cmd.id);
    if (i >= 0) {
      const [it] = p.bag.splice(i, 1);
      drop(s, p, it.type, it.tier, p.id);
    }
  }
}
function move(s, p, dx, dy, pad = 14) {
  if (free(s, { x: p.x + dx, y: p.y }, pad)) p.x += dx;
  if (free(s, { x: p.x, y: p.y + dy }, pad)) p.y += dy;
}
export function createMatch(roster, mapId, timing = CLASSIC_TIMING) {
  const layout = makeCave(roster.length, mapId),
    radius = layout.radius;
  const spawns =
    timing === QUICK_TIMING
      ? layout.paths
          .filter(({ a, b }) => a === 0 || b === 0)
          .map(({ a, b }) => layout.nodes[a || b])
      : layout.spawns;
  if (timing === QUICK_TIMING) {
    for (const [i, p] of spawns.entries()) {
      const distance = Math.hypot(p.x, p.y);
      layout.chests.push({
        id: 'provisao-rapida' + i,
        x: p.x - (p.x * 64) / distance,
        y: p.y - (p.y * 64) / distance,
        tier: 1,
      });
    }
  }
  const s = {
    time: 0,
    timing,
    spawns,
    radius,
    layout,
    doors: {},
    opened: {},
    phase: 'pve',
    winner: null,
    rocks: [],
    players: [],
    mobs: [],
    loot: [],
    shots: [],
    fx: [],
    next: 1,
    spawnAt: 0,
  };
  for (const n of layout.nodes) {
    const a = rnd(0, Math.PI * 2);
    const p = { x: n.x + Math.cos(a) * n.r * 0.72, y: n.y + Math.sin(a) * n.r * 0.72 };
    if (
      n.r > 155 &&
      layout.chests.every((c) => dist(c, p) > 110) &&
      layout.encounters.every((c) => dist(c, p) > 80) &&
      floorAt(layout, {}, p, 58) &&
      layout.paths.every((e) => distanceToPath(p, layout.nodes[e.a], layout.nodes[e.b]) > e.r + 58)
    )
      s.rocks.push({ ...p, r: rnd(22, 38), style: s.next++ % 3 });
  }
  const offset = Math.floor(rnd(0, roster.length));
  for (const [i, user] of roster.entries()) {
    const { x, y } = spawns[(i + offset) % roster.length];
    const p = { x, y };
    const kind = CLASSES[user.kind];
    s.players.push({
      ...p,
      id: user.id,
      name: user.name,
      kind: user.kind,
      bot: !!user.bot,
      hp: kind.hp,
      maxHp: kind.hp,
      alive: true,
      level: 1,
      xp: 0,
      need: 22,
      skill: [1, 0, 0],
      passive: [0, 0, 0],
      offers: [],
      credits: 0,
      blade: 0,
      armor: 0,
      potion: 0,
      boots: 0,
      bag: [],
      gear: { blade: null, armor: null, boots: null },
      bagCommand: null,
      kills: 0,
      hunts: 0,
      face: 0,
      cd: [0, 0, 0],
      weaponCd: 0,
      recovery: 0,
      dashCd: 0,
      dash: 0,
      shield: 2,
      pet: 0,
      petCd: 0,
      haste: 0,
      slow: 0,
      input: blank(),
      botThink: 0,
      events: [],
      lastHit: -10,
      action: null,
      cast: null,
      attackCharge: null,
      lastDodge: -10,
      dashA: 0,
      hurtA: 0,
    });
  }
  for (const site of layout.encounters) spawnMob(s, site);
  for (const v of layout.vaults) if (v.guarded) spawnMob(s, vaultPoint(v, 5, 0), v.id);
  return s;
}
function spawnMob(s, pos, guard = null) {
  const type = guard ? 2 : s.next % 3,
    hp = guard ? 245 : [34, 48, 70][type];
  s.mobs.push({
    ...pos,
    guard,
    windup: 0,
    id: 'm' + s.next++,
    type,
    hp,
    maxHp: hp,
    cd: 1,
    slow: 0,
    alive: true,
    homeX: pos.x,
    homeY: pos.y,
    lastHit: -10,
    face: 0,
    attackAt: -10,
    attackA: 0,
    windupAt: -10,
    hurtA: 0,
  });
}
function drop(s, p, type, tier = 1, owner = null) {
  s.loot.push({ id: s.next++, x: p.x, y: p.y, type, tier, owner });
}
function effect(s, p, type, r, color, a = 0, style = type, kind = null) {
  s.fx.push({ id: s.next++, x: p.x, y: p.y, type, style, kind, r, color, a, t: s.time });
}
function options(p) {
  if (p.offers.length || !p.credits) return;
  const pool = [0, 1, 2].map((i) => ({
    id: 'p' + i,
    title: PASSIVES[i][0],
    desc: PASSIVES[i][1],
    label: 'Passiva comum',
  }));
  for (let i = 0; i < 3; i++)
    if (p.skill[i] < 5)
      pool.push({
        id: 's' + i,
        title: CLASSES[p.kind].skills[i][0],
        desc: p.skill[i] ? 'Aumenta a força ou duração.' : CLASSES[p.kind].skills[i][1],
        label: p.skill[i] ? 'Melhoria · Nv. ' + (p.skill[i] + 1) : 'Nova skill',
      });
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  p.offers = pool.slice(0, 3);
}
export function choose(p, id) {
  if (!p.alive || !p.offers.some((o) => o.id === id)) return;
  const i = Number(id[1]);
  if (id[0] === 's') p.skill[i]++;
  else {
    p.passive[i]++;
    if (i === 0) {
      p.maxHp += 12;
      p.hp = Math.min(p.maxHp, p.hp + 12);
    }
  }
  p.credits--;
  p.offers = [];
  options(p);
}
export function awardXP(p, xp) {
  p.xp += xp;
  while (p.xp >= p.need) {
    p.xp -= p.need;
    p.level++;
    p.credits++;
    p.need += 9;
  }
  options(p);
}
function targets(s, p, canHitPlayers = s.phase === 'pvp') {
  return canHitPlayers ? [...s.mobs, ...s.players.filter((t) => t !== p && t.alive)] : s.mobs;
}
function death(s, p, source) {
  const old = { x: p.x, y: p.y };
  p.hp = 0;
  p.alive = false;
  if (!p.kind) {
    if (source?.kind && source.alive) {
      source.hunts++;
      awardXP(source, p.guard ? 80 : 14 + p.type * 6);
    }
    if (Math.random() < 0.65 && s.loot.length < 160)
      drop(s, p, pick(Object.keys(ITEMS)), Math.random() < 0.18 ? 2 : 1);
    return;
  }
  p.cast = null;
  p.attackCharge = null;
  if (s.phase === 'pve') {
    Object.assign(p, safestEntrance(s, old));
    clearKit(p);
    p.hp = p.maxHp;
    p.alive = true;
    p.shield = 2;
    p.pet = 0;
    p.dash = 0;
    p.haste = 0;
    p.slow = 0;
    p.respawns = (p.respawns || 0) + 1;
    p.events = [];
    p.input = blank();
    p.action = null;
    p.recovery = 0;
    p.lastHit = -10;
    p.lastDodge = -10;
  } else {
    if (source?.kind && source !== p) {
      source.kills++;
      awardXP(source, 30);
    }
    for (const item of [...p.bag, ...Object.values(p.gear).filter(Boolean)])
      drop(s, p, item.type, item.tier);
    for (let i = 0; i < p.potion; i++) drop(s, p, 'potion');
    clearKit(p);
    const live = s.players.filter((t) => t.alive);
    if (live.length === 1) {
      s.phase = 'end';
      s.winner = live[0].id;
    }
  }
}
function hurt(s, target, damage, source, storm = false) {
  if (
    !target.alive ||
    s.phase === 'end' ||
    (!storm && target.kind && (target.shield > 0 || target.dash > 0))
  )
    return false;
  target.hp -= damage * (target.kind && !storm ? 1 / (1 + 0.18 * target.armor) : 1);
  if (!storm) {
    target.lastHit = s.time;
    target.hurtA = source
      ? Math.atan2(target.y - source.y, target.x - source.x)
      : target.face + Math.PI;
    if (source)
      effect(
        s,
        target,
        'impact',
        target.guard ? 27 : 17,
        source.kind ? CLASSES[source.kind].color : '#ffbe85',
        target.hurtA,
        'hit',
        source.kind ?? 'monster',
      );
  }
  if (target.hp <= 0) death(s, target, source);
  return true;
}
function shot(
  s,
  p,
  a,
  dmg,
  range,
  speed,
  { pierce = false, wave = false, origin = p, chargeTier, radius = SHOT_RADIUS } = {},
) {
  s.shots.push({
    id: s.next++,
    owner: p.id,
    kind: p.kind,
    x: origin.x,
    y: origin.y,
    a,
    dmg,
    range,
    speed,
    pierce,
    wave,
    chargeTier,
    radius,
    canHitPlayers: origin.canHitPlayers ?? s.phase === 'pvp',
    life: p.respawns ?? 0,
    hits: [],
  });
}
function area(s, p, at, r, dmg, { a = null, style, slow = 0, canHitPlayers, front = 0.12 } = {}) {
  effect(
    s,
    at,
    a === null ? 'ring' : 'arc',
    r,
    CLASSES[p.kind].color,
    a ?? 0,
    style ?? areaStyle(p.kind, 'attack', a !== null),
    p.kind,
  );
  for (const t of targets(s, p, canHitPlayers)) {
    if (!t.alive || dist(t, at) > r + (a === null ? 0 : 10)) continue;
    if (!lineOpen(s, at, t)) continue;
    if (a !== null && Math.cos(Math.atan2(t.y - at.y, t.x - at.x) - a) < front) continue;
    if (hurt(s, t, dmg, p) && slow) t.slow = Math.max(t.slow, slow);
  }
}
function prepareSkill(s, p, key, delay, damage, target) {
  const cast = {
    id: s.next++,
    kind: p.kind,
    owner: p.id,
    at: s.time,
    landAt: s.time + delay,
    canHitPlayers: s.phase === 'pvp',
    damage,
    ...target,
  };
  p.cast = cast;
  p.action = { at: cast.at, kind: key, angle: p.face, releaseAt: cast.landAt };
}
function prepareArea(s, p, key, delay, damage, radius, offset = 0, slow = 0) {
  const length = clearDistance(s, p.x, p.y, p.face, offset);
  prepareSkill(s, p, key, delay, damage, {
    x: p.x + Math.cos(p.face) * length,
    y: p.y + Math.sin(p.face) * length,
    r: radius,
    style: areaStyle(p.kind, key, false),
    slow,
  });
}
function prepareVolley(
  s,
  p,
  key,
  delay,
  { damage, range, speed, count = 1, spacing = 0, pierce = false },
) {
  const lanes = [];
  for (let i = -(count - 1) / 2; i <= (count - 1) / 2; i++) {
    const a = p.face + i * spacing;
    lanes.push({ a, range: clearDistance(s, p.x, p.y, a, range) });
  }
  prepareSkill(s, p, key, delay, damage, {
    x: p.x,
    y: p.y,
    lanes,
    speed,
    pierce,
  });
}
function resolveSkill(s, p) {
  const cast = p.cast;
  if (!cast || s.time < cast.landAt) return;
  p.cast = null;
  p.weaponCd = Math.max(p.weaponCd, 0.29);
  if (cast.lanes) {
    for (const { a, range } of cast.lanes)
      if (range > 0)
        shot(s, p, a, cast.damage, range, cast.speed, {
          pierce: cast.pierce,
          origin: cast,
        });
  } else area(s, p, cast, cast.r, cast.damage, cast);
}
function releaseBasicAttack(s, p, power) {
  const charge = p.attackCharge;
  p.attackCharge = null;
  if (!charge) return;
  const c = CLASSES[p.kind];
  const held = s.time - charge.at;
  const tier = held >= FULL_CHARGE - 1e-8 ? 2 : held >= LIGHT_CHARGE - 1e-8 ? 1 : 0;
  const attack = CHARGED_ATTACKS[p.kind][tier - 1];
  const range = attack?.range ?? c.range;
  const damage = (attack?.damage ?? c.damage) * power;
  const canHitPlayers = charge.canHitPlayers;
  p.weaponCd = c.attackInterval;
  p.recovery = attack?.recovery ?? c.attackRecovery ?? 0;
  p.action = { at: s.time, kind: 'attack', angle: p.face, chargeTier: tier };
  const style = attack ? attack.style : c.attackStyle;
  if (style)
    area(s, p, p, range, damage, {
      a: p.face,
      style,
      front: attack?.front,
      canHitPlayers,
    });
  else
    shot(s, p, p.face, damage, range, attack?.speed ?? c.attackSpeed, {
      ...(tier ? { chargeTier: tier, radius: attack.radius } : {}),
      origin: { x: p.x, y: p.y, canHitPlayers },
    });
}
function perform(s, p, key) {
  const c = CLASSES[p.kind],
    power = 1 + 0.18 * p.blade + 0.1 * p.passive[2],
    a = p.face;
  if (key === 'interact') {
    interact(s, p);
    return;
  }
  if (key === 'attack') {
    if (!p.attackCharge && !p.cast && p.weaponCd <= 1e-8 && p.recovery <= 1e-8 && !p.dash)
      p.attackCharge = { at: s.time, canHitPlayers: s.phase === 'pvp' };
    return;
  }
  if (key === 'attack-release') {
    releaseBasicAttack(s, p, power);
    return;
  }
  if (key === 'dash') {
    if (p.dashCd <= 0) {
      p.attackCharge = null;
      p.dash = 0.16;
      p.dashCd = 2.5;
      p.dashA = p.input.x || p.input.y ? Math.atan2(p.input.y, p.input.x) : a;
      p.lastDodge = s.time;
      effect(s, p, 'ring', 25, c.color, p.dashA, 'dash', p.kind);
    }
    return;
  }
  if (key === 'potion') {
    if (p.potion > 0 && p.hp < p.maxHp) {
      p.potion--;
      p.hp = Math.min(p.maxHp, p.hp + 42);
      effect(s, p, 'ring', 38, '#8bf2b6', 0, 'heal', p.kind);
    }
    return;
  }
  const slot = ['q', 'e', 'r'].indexOf(key);
  if (slot < 0 || p.cast || p.attackCharge || p.recovery > 1e-8 || !p.skill[slot] || p.cd[slot] > 0)
    return;
  const rank = p.skill[slot],
    d = (24 + rank * 7) * power;
  p.cd[slot] = [4.5, 6, 8][slot];
  p.weaponCd = Math.max(p.weaponCd, 0.29);
  p.action = { at: s.time, kind: key, angle: a };
  if (p.kind === 'guerreiro') {
    if (slot === 0)
      shot(s, p, a, d, LUNAR_WAVE.range, LUNAR_WAVE.speed, { pierce: true, wave: true });
    else if (slot === 1) prepareArea(s, p, key, 0.55, d, 142);
    else {
      p.shield = 1 + rank * 0.35;
      p.hp = Math.min(p.maxHp, p.hp + 10 * rank);
      effect(s, p, 'ring', 35, c.color, 0, 'guard', p.kind);
    }
  } else if (p.kind === 'arqueiro') {
    if (slot === 0)
      prepareVolley(s, p, key, 0.32, { damage: d, range: 710, speed: 760, pierce: true });
    if (slot === 1)
      prepareVolley(s, p, key, 0.4, {
        damage: d * 0.65,
        count: 5,
        spacing: 0.15,
        range: 510,
        speed: 690,
      });
    if (slot === 2) {
      p.haste = 2 + rank;
      p.dashCd = 0;
    }
  } else if (p.kind === 'mago') {
    if (slot === 0) {
      const offset = Math.min(260, p.input.reach ?? 170);
      prepareArea(s, p, key, 0.65, d, 88 + rank * 6, offset);
    } else if (slot === 1)
      prepareVolley(s, p, key, 0.4, {
        damage: d * 0.8,
        count: 3,
        spacing: 0.16,
        range: 510,
        speed: 530,
      });
    else prepareArea(s, p, key, 0.65, d, 180, 0, 1.5 + rank * 0.3);
  } else if (p.kind === 'invocador' && slot === 0) {
    p.pet = 7 + rank * 2;
    p.petCd = 0;
    effect(s, p, 'ring', 36, c.color, 0, 'seal', p.kind);
  } else if (p.kind === 'invocador' && slot === 2) {
    p.pet += p.pet > 0 ? 2 + rank : 0;
    p.hp = Math.min(p.maxHp, p.hp + 18 + rank * 8);
    effect(s, p, 'ring', 38, '#8bf2b6', 0, 'heal', p.kind);
  } else {
    const offset = Math.min(260, Math.max(0, p.input.reach ?? 170));
    prepareArea(s, p, key, 0.7, d, 88 + rank * 6, offset);
  }
}
export function setInput(p, data = {}) {
  const num = (v, min, max) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : 0);
  p.input = {
    x: num(data.x, -1, 1),
    y: num(data.y, -1, 1),
    a: num(data.a, -Math.PI, Math.PI),
    reach: num(data.reach, 0, 700),
    attack: data.attack === true,
  };
  if (p.alive && Array.isArray(data.events))
    for (const k of data.events.slice(0, 5))
      if (
        ['q', 'e', 'r', 'dash', 'potion', 'attack', 'attack-release', 'interact'].includes(k) &&
        !p.events.includes(k)
      )
        p.events.push(k);
  if (typeof data.choice === 'string') choose(p, data.choice);
  if (
    p.alive &&
    data.bag &&
    ['equip', 'remove', 'drop'].includes(data.bag.action) &&
    Number.isSafeInteger(data.bag.id)
  )
    p.bagCommand = { action: data.bag.action, id: data.bag.id };
}
function bot(s, p) {
  p.botThink = 0.27;
  if (p.offers.length) choose(p, pick(p.offers).id);
  const better = p.bag.find((it) => it.tier > p[it.type]);
  if (better) equip(p, better.id);
  const nearby = nearestFeature(s, p);
  if (nearby && !nearby.blocked) interact(s, p);
  const seekRivals = s.timing === QUICK_TIMING && s.phase === 'pvp';
  const list = (seekRivals ? s.players : targets(s, p)).filter(
    (t) => t !== p && t.alive && (!t.guard || s.doors[t.guard]),
  );
  let dest = list.sort((a, b) => dist(a, p) - dist(b, p))[0];
  let shoot = dest && dist(dest, p) < CLASSES[p.kind].range * 0.9 && lineOpen(s, p, dest);
  if (!shoot && s.phase === 'pve') {
    const treasure = s.layout.chests
      .filter((c) => !s.opened[c.id] && !c.vault)
      .sort((a, b) => dist(p, a) - dist(p, b))[0];
    if (treasure && (!dest || dist(p, treasure) < dist(p, dest))) dest = treasure;
  }
  if (s.phase === 'pvp' && Math.hypot(p.x, p.y) > zone(s) * 0.77) {
    dest = { x: 0, y: 0 };
    shoot = false;
  }
  if (!dest) {
    setInput(p);
    return;
  }
  if (!shoot && dist(p, dest) > 220 && !lineOpen(s, p, dest)) dest = routeTo(s.layout, p, dest);
  const a = Math.atan2(dest.y - p.y, dest.x - p.x),
    d = dist(dest, p);
  const events = [p.hp < p.maxHp * 0.65 ? 'potion' : pick(['q', 'e', 'r'])];
  const c = CLASSES[p.kind];
  const [light, heavy] = CHARGED_ATTACKS[p.kind];
  const inReach = (dest.kind || dest.type !== undefined) && d < heavy.range && lineOpen(s, p, dest);
  const delay =
    d < c.range * (c.attackStyle ? 0.82 : 0.37)
      ? 0
      : d < light.range * 0.74
        ? LIGHT_CHARGE
        : FULL_CHARGE;
  let attack = false;
  if (p.attackCharge) {
    attack = !!inReach && s.time - p.attackCharge.at < delay;
    if (!attack && inReach) events.push('attack-release');
  } else if (inReach && !p.cast && p.weaponCd <= 1e-8) {
    events.push('attack');
    attack = delay > 0;
    if (!attack) events.push('attack-release');
  }
  let walk = shoot && dest.kind !== undefined ? 0.25 : 1;
  if (dest.kind === undefined && dest.type !== undefined && shoot) walk = 0.25;
  let walkA = a + (walk < 1 ? 1.3 : 0);
  if (!free(s, { x: p.x + Math.cos(walkA) * 52, y: p.y + Math.sin(walkA) * 52 })) walkA += 1.45;
  setInput(p, {
    x: Math.cos(walkA) * walk,
    y: Math.sin(walkA) * walk,
    a,
    reach: d,
    attack,
    events,
  });
}
export function tick(s, dt) {
  if (s.phase === 'end') return;
  const { prep, end } = s.timing;
  s.time = Math.min(end, s.time + dt);
  if (s.time >= prep) s.phase = 'pvp';
  const safeRadius = zone(s);
  const collapseDamage = 6 + 28 * collapseProgress(s);
  for (const p of s.players) {
    if (!p.alive || s.phase === 'end') continue;
    manageBag(s, p);
    if (p.bot && (p.botThink -= dt) <= 0) bot(s, p);
    for (const k of [
      'weaponCd',
      'recovery',
      'shield',
      'dashCd',
      'dash',
      'haste',
      'slow',
      'pet',
      'petCd',
    ])
      p[k] = Math.max(0, p[k] - dt);
    for (let i = 0; i < 3; i++) p.cd[i] = Math.max(0, p.cd[i] - dt);
    p.face = p.input.a;
    for (const key of p.events) perform(s, p, key);
    p.events = [];
    if (!p.input.attack) p.attackCharge = null;
    let dx = p.input.x,
      dy = p.input.y;
    let speed =
      CLASSES[p.kind].speed *
      (1 + 0.06 * p.boots) *
      (1 + Math.min(0.6, 0.05 * p.passive[1])) *
      (p.haste ? 1.5 : 1) *
      (p.slow ? 0.6 : 1);
    if (p.attackCharge && s.time - p.attackCharge.at >= 0.16) speed *= 0.62;
    if (p.dash) {
      dx = Math.cos(p.dashA);
      dy = Math.sin(p.dashA);
      speed = 760;
    }
    const n = Math.max(1, Math.hypot(dx, dy));
    move(s, p, (dx / n) * speed * dt, (dy / n) * speed * dt);
    if (p.pet > 0 && p.petCd <= 0) {
      const t = targets(s, p)
        .filter((t) => t.alive && dist(t, p) < 280)
        .sort((a, b) => dist(a, p) - dist(b, p))[0];
      if (t) {
        p.petCd = 0.8;
        shot(s, p, Math.atan2(t.y - p.y, t.x - p.x), 12 + p.skill[0] * 4, 310, 560);
      }
    }
    s.loot = s.loot.filter((l) => {
      const distance = dist(l, p);
      if (l.owner === p.id && distance > 52) l.owner = null;
      if (distance > 32 || l.owner === p.id || !lineOpen(s, p, l) || !receive(p, l)) return true;
      effect(s, p, 'pickup', 22, '#f8d985');
      return false;
    });
    if (s.phase === 'pvp' && Math.hypot(p.x, p.y) > safeRadius)
      hurt(s, p, dt * collapseDamage, null, true);
  }
  for (const m of s.mobs) {
    if (!m.alive || s.phase === 'end') continue;
    if (m.guard && !s.doors[m.guard]) continue;
    m.cd -= dt;
    m.slow = Math.max(0, m.slow - dt);
    const t = s.players
      .filter(
        (p) =>
          p.alive &&
          p.shield <= 0 &&
          dist(m, p) < (m.guard ? 460 : 330) &&
          (!m.guard || dist({ x: m.homeX, y: m.homeY }, p) < 400) &&
          lineOpen(s, m, p),
      )
      .sort((a, b) => dist(a, m) - dist(b, m))[0];
    const aim = t || { x: m.homeX, y: m.homeY },
      d = dist(aim, m),
      a = Math.atan2(aim.y - m.y, aim.x - m.x);
    if (m.guard && m.windup > 0) {
      m.windup -= dt;
      if (m.windup <= 0) {
        m.attackAt = s.time;
        m.attackA = m.face;
        for (const victim of s.players)
          if (dist(m, victim) < 98 && lineOpen(s, m, victim)) hurt(s, victim, 29, m);
        effect(s, m, 'ring', 98, '#ffb278', m.attackA, 'slam', 'monster');
        m.cd = 2.1;
      }
      continue;
    }
    if (t || d > 4) m.face = a;
    if (m.guard && t && d < 85 && m.cd <= 0) {
      m.windup = GUARD_WINDUP;
      m.windupAt = s.time;
      continue;
    }
    if (d > (t ? 23 : 4)) {
      const speed = [78, 92, 57][m.type] * (m.slow ? 0.48 : 1);
      let dir = a;
      if (!free(s, { x: m.x + Math.cos(a) * 25, y: m.y + Math.sin(a) * 25 })) dir += 1.3;
      move(s, m, Math.cos(dir) * speed * dt, Math.sin(dir) * speed * dt, 12);
    }
    if (!m.guard && t && d < 36 && m.cd <= 0) {
      m.cd = 1.35;
      m.attackAt = s.time;
      m.attackA = a;
      hurt(s, t, 7 + m.type * 2, m);
      effect(s, m, 'arc', 30, '#f7a38b', a, 'claw', 'monster');
    }
  }
  if (s.phase !== 'end') {
    for (const p of s.players) if (p.alive) resolveSkill(s, p);
  }
  s.shots = s.shots.filter((b) => {
    const p = s.players.find((t) => t.id === b.owner);
    if (!p?.alive || b.life !== (p.respawns ?? 0) || s.phase === 'end') return false;
    const prev = { x: b.x, y: b.y };
    const dx = Math.cos(b.a),
      dy = Math.sin(b.a);
    const step = Math.min(b.range, b.speed * dt);
    b.x += dx * step;
    b.y += dy * step;
    const blocked = !lineOpen(s, prev, b);
    if (blocked && !b.wave) return false;
    if (blocked) {
      const reach = clearDistance(s, prev.x, prev.y, b.a, step);
      b.x = prev.x + dx * reach;
      b.y = prev.y + dy * reach;
    }
    b.range -= step;
    const width = b.wave ? LUNAR_WAVE.radius : b.radius;
    for (const t of targets(s, p, b.canHitPlayers)) {
      if (!t.alive || b.hits.includes(t.id) || distanceToPath(t, prev, b) >= width) continue;
      if (!lineOpen(s, prev, t)) continue;
      if (b.wave && dx * (t.x - prev.x) + dy * (t.y - prev.y) < 0) continue;
      hurt(s, t, b.dmg, p);
      b.hits.push(t.id);
      if (!b.pierce) return false;
    }
    return !blocked && b.range > 0;
  });
  s.fx = s.fx.filter((e) => s.time - e.t < effectLifetime(e));
  s.mobs = s.mobs.filter((m) => m.alive);
  if (s.time >= s.spawnAt) {
    s.spawnAt = s.time + 4;
    if (s.mobs.filter((m) => !m.guard).length < s.layout.encounters.length) {
      const sites = s.layout.encounters.filter(
        (n) =>
          s.players.every((p) => !p.alive || dist(n, p) > 370) &&
          s.mobs.every((m) => dist(n, m) > 160),
      );
      if (sites.length) spawnMob(s, pick(sites));
    }
  }
  if (s.phase === 'pvp' && s.time >= end) {
    const live = s.players
      .filter((p) => p.alive)
      .sort((a, b) => Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y) || a.hp - b.hp);
    for (const p of live.slice(0, -1)) death(s, p, null);
  }
}
export function forfeit(s, id) {
  const p = s.players.find((p) => p.id === id);
  if (!p?.alive || s.phase === 'end') return;
  p.alive = false;
  p.cast = null;
  p.attackCharge = null;
  p.hp = 0;
  const live = s.players.filter((t) => t.alive);
  if (live.length <= 1) {
    s.winner = live[0]?.id ?? null;
    s.phase = 'end';
  }
}
export function snapshot(s, id) {
  const p = s.players.find((t) => t.id === id);
  return {
    time: s.time,
    timing: s.timing,
    phase: s.phase,
    winner: s.winner,
    radius: s.radius,
    zone: zone(s),
    doors: s.doors,
    opened: s.opened,
    players: s.players.map(
      ({
        id,
        name,
        kind,
        x,
        y,
        hp,
        maxHp,
        alive,
        face,
        level,
        pet,
        lastHit,
        shield,
        dash,
        action,
        lastDodge,
        dashA,
        hurtA,
        attackCharge,
      }) => ({
        id,
        name,
        kind,
        x,
        y,
        hp,
        maxHp,
        alive,
        face,
        level,
        pet,
        lastHit,
        shield,
        dash,
        action,
        lastDodge,
        dashA,
        hurtA,
        chargeAt: attackCharge?.at ?? null,
      }),
    ),
    mobs: s.mobs.map(
      ({
        id,
        type,
        x,
        y,
        hp,
        maxHp,
        lastHit,
        guard,
        windup,
        face,
        attackAt,
        attackA,
        windupAt,
        hurtA,
      }) => ({
        id,
        type,
        x,
        y,
        hp,
        maxHp,
        lastHit,
        guard,
        windup,
        face,
        attackAt,
        attackA,
        windupAt,
        hurtA,
      }),
    ),
    loot: s.loot,
    shots: s.shots,
    telegraphs:
      s.phase === 'end' ? [] : s.players.flatMap((p) => (p.alive && p.cast ? [p.cast] : [])),
    fx: s.fx,
    me: {
      id: p.id,
      skill: p.skill,
      passive: p.passive,
      offers: p.offers,
      credits: p.credits,
      level: p.level,
      xp: p.xp,
      need: p.need,
      cd: p.cd,
      dashCd: p.dashCd,
      weaponCd: p.weaponCd,
      recovery: p.recovery,
      blade: p.blade,
      boots: p.boots,
      bag: p.bag,
      gear: p.gear,
      found: p.found || 0,
      feature: nearestFeature(s, p),
      armor: p.armor,
      potion: p.potion,
      kills: p.kills,
      hunts: p.hunts,
      respawns: p.respawns || 0,
    },
  };
}
