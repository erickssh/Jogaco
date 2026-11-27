/* Shared by the race frame and the menus. All models use the same physics. */
var OverdriveCars = (() => {
  const carModels = [
    { id: 'agulha', name: 'Agulha', pixels: [762, 1237] },
    { id: 'lotus', name: 'Lotus', pixels: [603, 1195] },
    { id: 'sabia', name: 'Sabiá', pixels: [630, 1223] },
    { id: 'arraia', name: 'Arraia', pixels: [702, 1188] },
    { id: 'bigorna', name: 'Bigorna', pixels: [662, 1238] },
    { id: 'ferrao', name: 'Ferrão', pixels: [730, 1182] },
    { id: 'faisca', name: 'Faísca', pixels: [734, 1222] },
    { id: 'orca', name: 'Orca', pixels: [639, 1240] },
    { id: 'bisao', name: 'Bisão', pixels: [766, 1228] },
    { id: 'cupim', name: 'Cupim', pixels: [885, 1196] },
    { id: 'estalo', name: 'Estalo', pixels: [708, 1249] },
  ];
  const defaultModel = carModels[0].id;
  const isCarModel = value => carModels.some(model => model.id === value);
  const imageForModel = (id, compact = false) =>
    '/volta-rapida/cars/' + id + (compact ? '-race' : '') + '.webp?v=79';

  const maxLength = 56.7, maxWidth = 36.45;
  const sizes = new Map(carModels.map(({id, pixels: [w,h]}) => {
    const scale = Math.min(maxLength/h, maxWidth/w);
    const width = w*scale, length = h*scale;
    // Exclude transparent padding and leave a small allowance for rounded bodywork.
    const halfLength = length*.48, halfWidth = width*.46;
    const bumper = halfLength-halfWidth;
    return [id, {width,length,halfLength,halfWidth,bumpers:[-bumper,0,bumper],
      radius:Math.hypot(halfLength,halfWidth)}];
  }));
  const sizeForModel = id => sizes.get(id) ?? sizes.get(defaultModel);

  function sampleCarModels(count, excluded = []) {
    const available = carModels.map(model => model.id).filter(id => !excluded.includes(id));
    return Array.from({ length: Math.min(count, available.length) }, () =>
      available.splice(Math.floor(Math.random() * available.length), 1)[0]);
  }

  return { maxLength, maxWidth, sizeForModel, carModels, defaultModel, isCarModel, imageForModel, sampleCarModels };
})();
if (typeof module !== 'undefined') module.exports = OverdriveCars;
