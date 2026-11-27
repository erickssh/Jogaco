const shadowPad = 7;
const shadowSide = TILE + Math.ceil(TILE * .80) + shadowPad * 2;

function shadowCanvas(side) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = side;
  return canvas;
}

// Use the visible wood at the lowest opaque part of each tree as its root.
function findRoot(silhouette) {
  const alpha = silhouette.getContext('2d').getImageData(0, 0, TILE, TILE).data;
  for (let y = TILE - 1; y >= 0; y--) {
    let total = 0, count = 0;
    for (let x = 0; x < TILE; x++) {
      if (alpha[(y * TILE + x) * 4 + 3] < 165) continue;
      total += x + .5;
      count++;
    }
    if (count >= 3) return {x: total / count / TILE, y: (y + .5) / TILE};
  }
  return {x:.5, y:.90};
}

function projectCrown(brush, silhouette, root, index) {
  // Project every part of the tree relative to the root. At ground height
  // displacement is exactly zero. The tips of the crown reach farthest.
  const height = [.58, .69, .54, .52][index];
  brush.save();
  brush.translate(root.x, root.y);
  brush.beginPath();
  brush.ellipse(.023,.009,.077,.035,.38,0,Math.PI*2);
  brush.fill();
  brush.transform(.83, 0, -SUN_SHADOW.x * height, .15 - SUN_SHADOW.y * height, 0, 0);
  brush.drawImage(silhouette, -root.x, -root.y, 1, 1);
  brush.restore();
}

function pavilionShadow(brush) {
  // The eaves of the painted roof occupy a hexagon. Their six uprights
  // meet the deck lower down in the view, with the steps at its south tip.
  const eaves = [[96,14],[156,47],[156,109],[96,138],[37,109],[37,47]];
  const feet = eaves.map(([x,y]) => [(96 + (x-96)*.90)/TILE,(y+23)/TILE]);
  const reach = .175;
  const roof = eaves.map(([x,y]) => [
    x/TILE + reach * SUN_SHADOW.x, (y+23)/TILE + reach * SUN_SHADOW.y
  ]);
  function polygon(points) {
    brush.beginPath();
    brush.moveTo(...points[0]);
    for (const point of points.slice(1)) brush.lineTo(...point);
    brush.closePath();
    brush.fill();
  }
  polygon(feet);
  polygon(roof);
  brush.strokeStyle = SUN_SHADOW.color;
  brush.lineWidth = .031;
  brush.lineCap = 'round';
  for (let i = 0; i < feet.length; i++) {
    brush.beginPath();
    brush.moveTo(...feet[i]);
    brush.lineTo(...roof[i]);
    brush.stroke();
  }
}

function buildObjectShadows(atlas) {
  const profiles = {};
  for (const [kind, index] of Object.entries(species)) {
    const silhouette = shadowCanvas(TILE);
    const ink = silhouette.getContext('2d');
    ink.drawImage(atlas, (index % 4) * TILE, Math.floor(index / 4) * TILE, TILE, TILE, 0, 0, TILE, TILE);
    ink.globalCompositeOperation = 'source-in';
    ink.fillStyle = SUN_SHADOW.color;
    ink.fillRect(0, 0, TILE, TILE);
    const root = findRoot(silhouette);

    const mask = shadowCanvas(shadowSide);
    const brush = mask.getContext('2d');
    brush.setTransform(TILE, 0, 0, TILE, shadowPad, shadowPad);
    brush.fillStyle = SUN_SHADOW.color;
    if (index < 4) {
      projectCrown(brush, silhouette, root, index);
    } else if (kind === 'pavilion') {
      pavilionShadow(brush);
    } else {
      // Low objects rest on the ground. Sweep the actual alpha continuously
      // from zero offset, including the spaces between the individual rocks.
      const reach = {flowers:.105, rocks:.115, table:.15,stand:.095,tent:.16,lodge:.13,lodgeNorth:.13,cafe:.13,garage:.12,tower:.17,visitor:.12,mill:.14,market:.115}[kind];
      const steps = Math.ceil(TILE * reach);
      for (let i = 0; i <= steps; i++) {
        const h = reach * i / steps;
        brush.drawImage(silhouette, h * SUN_SHADOW.x, h * SUN_SHADOW.y, 1, 1);
      }
    }
    const result = shadowCanvas(shadowSide);
    const finish = result.getContext('2d');
    finish.filter = 'blur(1.8px)';
    finish.globalAlpha = .24;
    finish.drawImage(mask, 0, 0);
    finish.filter = 'none';
    finish.globalAlpha = .31;
    finish.drawImage(mask, 0, 0);
    // Tight contact darkening stays attached to the actual artwork contour.
    finish.filter = 'blur(1.9px)';
    finish.globalAlpha = .30;
    finish.drawImage(silhouette, shadowPad + 1.5, shadowPad + 2.2);
    profiles[kind] = { image:result, root };

  }
  return profiles;
}

function paintObjectShadows(ctx, profiles, objects) {
  for (const [kind,x,y,size] of objects) {
    const ratio = size / TILE;
    ctx.drawImage(profiles[kind].image, x - size / 2 - shadowPad * ratio,
      y - size / 2 - shadowPad * ratio, shadowSide * ratio, shadowSide * ratio);
  }
}
