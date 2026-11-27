/* Shared by the race frame and the menus. All models use the same physics. */
var OverdriveCars = (() => {
  const carModels = [
    { id: 'agulha', name: 'Agulha' },
    { id: 'lotus', name: 'Lotus' },
    { id: 'sabia', name: 'Sabiá' },
    { id: 'arraia', name: 'Arraia' },
    { id: 'bigorna', name: 'Bigorna' },
    { id: 'ferrao', name: 'Ferrão' },
    { id: 'faisca', name: 'Faísca' },
    { id: 'orca', name: 'Orca' },
    { id: 'bisao', name: 'Bisão' },
    { id: 'cupim', name: 'Cupim' },
    { id: 'estalo', name: 'Estalo' },
  ];
  const defaultModel = carModels[0].id;
  const isCarModel = value => carModels.some(model => model.id === value);
  const imageForModel = id => '/volta-rapida/cars/' + id + '.webp';

  function sampleCarModels(count, excluded = []) {
    const available = carModels.map(model => model.id).filter(id => !excluded.includes(id));
    return Array.from({ length: Math.min(count, available.length) }, () =>
      available.splice(Math.floor(Math.random() * available.length), 1)[0]);
  }

  return { carModels, defaultModel, isCarModel, imageForModel, sampleCarModels };
})();
if (typeof module !== 'undefined') module.exports = OverdriveCars;
