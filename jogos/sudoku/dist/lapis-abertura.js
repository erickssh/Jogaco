(() => {
  'use strict';

  const query = new URLSearchParams(location.search).get('lapis');
  const model = query === 'amarelo' || query === 'grafite' ? query : 'azul';
  const modelId = 'intro-pencil-' + model;
  const art = document.getElementById(modelId);
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const faces = [];
  const lightDirection = [0.42, 0.91];
  const hard = [43, 51, 58];
  const wood = [231, 178, 121];
  const silver = [180, 195, 211];
  const brass = [214, 179, 113];
  const eraser = [211, 123, 111];

  // The barrel rises toward the viewer. Perspective makes its back end appear
  // wider while keeping the point at (0, 0), where the writing animation starts.
  function project(x, cross, length) {
    const depth = length * .66 + cross * .751;
    const scale = 154 / (154 - depth);
    return { x: x * scale, y: (-length * .751 + cross * .66) * scale, depth };
  }

  function tint(color, light, shine = 0) {
    const channels = color.map(channel => Math.round(
      Math.min(255, channel * light + (255 - channel) * shine)
    ));
    return 'rgb(' + channels.join(',') + ')';
  }

  function face(points, fill) {
    // The sign of the projected area tells us which side faces the camera.
    const area = points.reduce((sum, point, i) => {
      const next = points[(i + 1) % points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0);
    if (area > .001) {
      const depth = points.reduce((sum, point) => sum + point.depth, 0) / points.length;
      faces.push({ points, fill, depth });
    }
  }

  function ring(length, radius, sides, turn) {
    return Array.from({ length: sides }, (_, i) => {
      const angle = turn + i * 2 * Math.PI / sides;
      return project(radius * Math.cos(angle), radius * Math.sin(angle), length);
    });
  }

  function section(profile, color, { sides = 18, gloss = .18, turn = 0, cap = false } = {}) {
    const rings = profile.map(([length, radius]) => ring(length, radius, sides, turn));
    for (let step = 1; step < rings.length; step++) {
      const start = rings[step - 1];
      const end = rings[step];
      for (let i = 0; i < sides; i++) {
        const next = (i + 1) % sides;
        const angle = turn + (i + .5) * 2 * Math.PI / sides;
        const light = Math.max(0, -Math.cos(angle) * lightDirection[0] + Math.sin(angle) * lightDirection[1]);
        const glint = light ** 8 * gloss;
        face([start[i], start[next], end[next], end[i]], tint(color, .57 + light * .44, glint));
      }
    }
    if (cap) face(rings.at(-1), tint(color, 1.08, .24));
  }

  if (model === 'grafite') {
    section([[0, 0], [3.8, .48], [5.5, .48]], hard, { gloss: .08 });
    section([[3.8, .7], [7.8, 1.8], [12.2, 3.75]], silver, { gloss: .43 });
    section([[11.7, 3.7], [13.2, 4.45], [24.4, 4.45], [25.8, 3.9]], silver, { gloss: .46 });
    for (const mark of [14, 16.8, 19.6, 22.4]) {
      section([[mark, 4.43], [mark + .62, 4.49], [mark + 1.05, 4.44]], [113, 132, 151], { gloss: .28 });
    }
    section([[24.6, 3.95], [26.1, 4.13], [45.6, 4.13], [47.2, 3.58]], [56, 75, 96], { gloss: .32 });
    section([[25.2, 4.03], [27.3, 4.19]], [54, 118, 155], { gloss: .35 });
    section([[46.7, 2.1], [48, 2.9], [49.8, 2.9], [50.5, 2.4]], silver, { gloss: .45, cap: true });
    // Raised spring clip on the lit side of the mechanical pencil.
    face([
      project(-2, 4.2, 45.5), project(-1.35, 4.55, 45.1), project(-1.45, 4.05, 35.2),
      project(-2.4, 3.7, 34.6), project(-2.8, 3.4, 35.6), project(-2.5, 3, 44)
    ], tint(silver, 1.08, .45));
  } else {
    const blue = model === 'azul';
    // Match the game player's digit color (#355b7a), retaining 3D shading.
    const lacquer = blue ? [53, 91, 122] : [236, 163, 42];
    const ferrule = blue ? silver : brass;
    const radius = blue ? 4.65 : 4.95;
    const hex = { sides: 6, turn: Math.PI / 12, gloss: .29 };
    section([[0, 0], [3.3, 1.5], [4, 1.8]], hard, hex);
    section([[3.3, 1.5], [11.1, radius], [12.8, radius]], wood, hex);
    section([[11.7, radius], [37.6, radius], [39.3, radius - .35]], lacquer, hex);
    section([[37.6, radius - .46], [39.1, radius - .08], [43.7, radius - .08], [44.9, radius - .66]], ferrule, { gloss: .45 });
    for (const band of [39.7, 42.5]) {
      section([[band, radius - .12], [band + .28, radius + .06], [band + .58, radius - .1]], ferrule, { gloss: .61 });
    }
    section([[44.2, radius - .72], [48.5, radius - .74], [50, radius - 1.4]], eraser, { gloss: .16, cap: true });
  }

  faces.sort((a, b) => a.depth - b.depth);
  for (const { points, fill } of faces) {
    const polygon = document.createElementNS(svgNamespace, 'polygon');
    polygon.setAttribute('points', points.map(p => p.x.toFixed(2) + ',' + p.y.toFixed(2)).join(' '));
    polygon.setAttribute('fill', fill);
    polygon.setAttribute('stroke', fill);
    polygon.setAttribute('stroke-width', '.12');
    art.append(polygon);
  }
  document.getElementById('intro-pencil-art').setAttribute('href', '#' + modelId);
})();
