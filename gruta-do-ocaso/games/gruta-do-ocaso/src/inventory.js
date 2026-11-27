export const CAPACITY = 8;
export const POTION_LIMIT = 5;
export const TIERS = ['', 'Comum', 'Raro', 'Relíquia'];
const names = {
  blade: ['de ferro', 'de cristal', 'do Ocaso'],
  armor: ['Gibão de couro', 'Couraça de quartzo', 'Armadura da Sentinela'],
  boots: ['Botas de trilha', 'Botas de eco', 'Passos do Ocaso'],
};
export const slots = { blade: 'Arma', armor: 'Peitoral', boots: 'Botas' };
export function itemName(item, weapon) {
  if (item.type === 'potion') return 'Poção de vida';
  if (item.type === 'blade') return weapon + ' ' + names.blade[item.tier - 1];
  return names[item.type][item.tier - 1];
}
export function bonus(item) {
  if (item.type === 'potion') return 'Recupera 42 PV';
  if (item.type === 'armor')
    return (
      'Defesa ' +
      item.tier +
      ' · −' +
      Math.round(100 - 100 / (1 + 0.18 * item.tier)) +
      '% de dano recebido'
    );
  return (
    '+' +
    item.tier * (item.type === 'boots' ? 6 : 18) +
    '% de ' +
    (item.type === 'boots' ? 'movimento' : 'dano')
  );
}
export function receive(p, item) {
  if (item.type === 'potion') {
    if (p.potion >= POTION_LIMIT) return false;
    p.potion++;
    return true;
  }
  if (p.bag.length >= CAPACITY) return false;
  p.bag.push({ id: item.id, type: item.type, tier: item.tier ?? 1 });
  return true;
}
export function equip(p, id) {
  const i = p.bag.findIndex((item) => item.id === id);
  if (i < 0) return;
  const [item] = p.bag.splice(i, 1),
    old = p.gear[item.type];
  if (old) p.bag.splice(i, 0, old);
  p.gear[item.type] = item;
  p[item.type] = item.tier;
}
export function clearKit(p) {
  p.bag = [];
  p.gear = { blade: null, armor: null, boots: null };
  p.blade = p.armor = p.boots = p.potion = 0;
  p.bagCommand = null;
}
