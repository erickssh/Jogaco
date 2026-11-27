function meadowMaterial(image) {
  const material = terrainCtx.createPattern(image, 'repeat');
  material.setTransform(new DOMMatrix().scale(340 / image.naturalWidth));
  return material;
}

// Each planting keeps its position when the screen changes size.
function meadowRandom(col, row, salt) {
  let state = Math.imul(col + 1021, 73856093) ^ Math.imul(row + 2053, 19349663) ^ salt;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1597334677);
    return (state >>> 0) / 4294967296;
  };
}

function groundPlant(ctx, art, variety, x, y, size, angle, opacity) {
  if (!art.complete || !art.naturalWidth) return;
  const cell = art.naturalWidth / 4;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha *= opacity;
  ctx.drawImage(art, cell * variety, 0, cell, cell, -size / 2, -size / 2, size, size);
  ctx.restore();
}

// Small, inked clusters use the same dark-green edge as the larger plants.
function paintTuft(ctx, x, y, size, rotation, variety) {
  const palettes = [
    ['#31543b','#4e7547','#648752'],
    ['#2f533e','#4c7351','#63835a'],
    ['#40583a','#677f46','#7e9150']
  ];
  const [outline, fill, highlight] = palettes[variety];
  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(rotation);
  ctx.scale(size,size);
  ctx.beginPath();
  if (variety===1) {
    ctx.moveTo(-.52,.13);
    ctx.quadraticCurveTo(-.61,-.02,-.36,-.15);
    ctx.quadraticCurveTo(-.25,-.22,-.09,-.13);
    ctx.quadraticCurveTo(-.17,-.37,.03,-.34);
    ctx.quadraticCurveTo(.16,-.34,.22,-.19);
    ctx.quadraticCurveTo(.53,-.31,.52,-.07);
    ctx.quadraticCurveTo(.51,.10,.32,.14);
    ctx.quadraticCurveTo(.31,.31,.08,.23);
    ctx.quadraticCurveTo(-.22,.31,-.52,.13);
  } else {
    ctx.moveTo(-.51,.08);
    ctx.quadraticCurveTo(-.66,-.11,-.44,-.15);
    ctx.quadraticCurveTo(-.34,-.18,-.22,-.11);
    ctx.quadraticCurveTo(-.29,-.34,-.12,-.33);
    ctx.quadraticCurveTo(-.01,-.34,.04,-.18);
    ctx.quadraticCurveTo(.13,-.42,.28,-.33);
    ctx.quadraticCurveTo(.38,-.27,.28,-.11);
    ctx.quadraticCurveTo(.48,-.21,.53,-.07);
    ctx.quadraticCurveTo(.55,.06,.41,.14);
    ctx.quadraticCurveTo(.47,.25,.23,.26);
    ctx.quadraticCurveTo(.10,.27,.03,.20);
    ctx.quadraticCurveTo(-.27,.35,-.51,.08);
  }
  ctx.closePath();
  ctx.fillStyle=fill;
  ctx.fill();
  ctx.strokeStyle=outline;
  ctx.lineWidth=.062;
  ctx.lineJoin='round';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-.41,-.06);
  ctx.quadraticCurveTo(-.29,-.13,-.19,.01);
  ctx.quadraticCurveTo(-.33,-.03,-.40,.015);
  ctx.moveTo(.09,-.09);
  ctx.quadraticCurveTo(.17,-.31,.25,-.25);
  ctx.quadraticCurveTo(.21,-.22,.09,-.09);
  ctx.fillStyle=highlight;
  ctx.fill();
  ctx.restore();
}

function paintGrassDetails(ctx, left, top, right, bottom, meadow, art, objects) {
  if (meadow) {
    ctx.save();
    ctx.globalAlpha = .23;
    ctx.fillStyle = meadow;
    ctx.fillRect(left, top, right-left, bottom-top);
    ctx.restore();
  }

  for (let row=Math.floor(top/43);row<=bottom/43;row++) {
    for (let col=Math.floor(left/50);col<=right/50;col++) {
      const random=meadowRandom(col,row,31847);
      const x=(col+.13+random()*.70)*50, y=(row+.12+random()*.73)*43;
      const patchiness = Math.sin(x/123+y/177)*Math.cos(y/91-x/138);
      if (random()>.69+patchiness*.22 || !hasRoadClearance(x,y,22)) continue;
      if (objects.some(([,px,py,diameter]) =>
        Math.abs(x-px)<diameter*.47+25 && Math.abs(y-py)<diameter*.47+20)) continue;
      const size=10+random()*13;
      const variety=Math.floor(random()*3);
      paintTuft(ctx,x,y,size,(random()-.5)*.55,variety);
      if(random()<.49)paintTuft(ctx,x+size*.62,y+size*.36,size*.61,.27,variety);
      if(random()<.044)groundPlant(ctx,art,3,x-12,y-1,15,.18,.89);
    }
  }

}
