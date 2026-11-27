export const SHOT_RADIUS = 24;
export const LUNAR_WAVE = Object.freeze({ radius: 44, range: 305, speed: 500 });
export const LIGHT_CHARGE = 0.5;
export const FULL_CHARGE = 1.15;
export const CHARGED_ATTACKS = {
  guerreiro: [
    { name: 'Corte amplo', style: 'wideSlash', front: 0.05, damage: 29, range: 132, recovery: 0.5 },
    {
      name: 'Corte pesado',
      style: 'heavySlash',
      front: 0.54,
      damage: 45,
      range: 165,
      recovery: 0.82,
    },
  ],
  mago: [
    { name: 'Faísca arcana', damage: 23, range: 535, speed: 570, radius: 20, recovery: 0.5 },
    { name: 'Orbe arcano', damage: 43, range: 540, speed: 360, radius: 34, recovery: 0.75 },
  ],
  arqueiro: [
    { name: 'Flecha tensa', damage: 20, range: 675, speed: 830, radius: 24, recovery: 0.44 },
    { name: 'Flecha pesada', damage: 33, range: 755, speed: 780, radius: 29, recovery: 0.68 },
  ],
  invocador: [
    { name: 'Dardo espiritual', damage: 21, range: 490, speed: 570, radius: 22, recovery: 0.48 },
    { name: 'Orbe espiritual', damage: 36, range: 515, speed: 340, radius: 37, recovery: 0.72 },
  ],
};

const durations = {
  slash: 0.32,
  staff: 0.28,
  wideSlash: 0.34,
  heavySlash: 0.42,
  cleave: 0.38,
  claw: 0.24,
  hit: 0.23,
  quake: 0.48,
  slam: 0.48,
  nova: 0.44,
  frost: 0.44,
  seal: 0.44,
  heal: 0.42,
  guard: 0.4,
  dash: 0.24,
};
export function effectLifetime(effect) {
  return durations[effect.style] ?? 0.34;
}
export function areaStyle(kind, action, directional) {
  if (kind === 'guerreiro')
    return directional ? (action === 'attack' ? 'slash' : 'cleave') : 'quake';
  return kind === 'mago' ? (action === 'r' ? 'frost' : 'nova') : 'seal';
}
