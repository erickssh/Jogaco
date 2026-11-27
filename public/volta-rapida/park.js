const TILE = 192;
const species = { oak:0, fir:1, copper:2, blossom:3, pavilion:4, table:5, flowers:6, rocks:7,
  tent:9, lodge:10, lodgeNorth:11, cafe:12, garage:13, tower:14, visitor:15, mill:16, market:17 };
const landmarks = [
  ['tent',grid.x-372,grid.y-204,106],['lodgeNorth',grid.x+255,grid.y+346,264],
  ['table',grid.x+97,grid.y+208,54],['table',grid.x+81,grid.y+256,47],
  ['pavilion',1972,1825,121],['table',2035,1855,52],['table',2000,1910,48],
  ['lodge',1628,865,137],['tent',1735,840,74],['pavilion',1170,2250,109],
  ['rocks',1300,2205,56],['rocks',1290,1260,50]
];
function streamY(x) {
  return 1610 + 95*Math.sin(x/322) + 43*Math.sin(x/161);
}
function streamHalf(x) { return 29 + 7*Math.cos(x/176); }
function waterBand(ctx, left, right, extra, shift, color) {
  const step = 6;
  const start = Math.floor(left / step) * step - step;
  const end = Math.ceil(right / step) * step + step;
  ctx.beginPath();
  for (let x = start; x <= end; x += step) {
    const y = streamY(x) + shift - streamHalf(x) - extra;
    if (x === start) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let x = end; x >= start; x -= step) {
    ctx.lineTo(x, streamY(x) + shift + streamHalf(x) + extra);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function landscapePath(ctx, path, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(path);
}

function footbridge(ctx, x) {
  const y = streamY(x);
  const slope = (streamY(x + 1) - streamY(x - 1)) / 2;
  const angle = Math.atan(slope);
  const halfLength = Math.ceil(streamHalf(x)) + 11;
  castShadow(ctx, 6, shade => {
    shade.translate(x, y);
    shade.rotate(angle);
    shade.fillRect(-14, -halfLength, 28, halfLength * 2);
  });
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#6b5039';
  ctx.fillRect(-14, -halfLength, 28, halfLength * 2);
  for (let v = -halfLength + 1, row = 0; v < halfLength - 1; v += 4, row++) {
    ctx.fillStyle = ['#c79c66','#b58a59','#d1a976'][row % 3];
    ctx.fillRect(-13, v, 26, Math.min(3.5, halfLength - v));
  }
  for (const side of [-14, 12]) {
    ctx.fillStyle = '#70533b';
    ctx.fillRect(side, -halfLength - 1, 2.8, halfLength * 2 + 2);
    ctx.fillStyle = '#e1bc89';
    ctx.fillRect(side, -halfLength - 1, 1.4, halfLength * 2 + 2);
    for (const position of [-halfLength, 0, halfLength]) {
      ctx.fillStyle = '#8c6d4e';
      ctx.fillRect(side - 1, position - 2, 4, 4);
      ctx.fillStyle = '#e4c296';
      ctx.fillRect(side - 1, position - 2, 3, 2);
    }
  }
  ctx.restore();
}

function paintMeadow(ctx, left, top, width, height, objects, meadow, art) {
  ctx.fillStyle='#45694d';
  ctx.fillRect(left,top,width,height);
  paintGrassDetails(ctx,left,top,left+width,top+height,meadow,art,objects);
  // The picnic walk follows the water and meets the footbridge.
  const walk = new Path2D();
  walk.moveTo(1225,1990);
  walk.bezierCurveTo(1430,1843,1700,1920,1972,1868);
  walk.bezierCurveTo(2000,1760,1720,1765,1700,streamY(1700));
  walk.quadraticCurveTo(1680,1430,1810,1280);
  landscapePath(ctx,walk,'#768152',19);
  landscapePath(ctx,walk,'#c4af78',15);
  landscapePath(ctx,walk,'#d6c598',11);
  waterBand(ctx,left,left+width,9,0,'#67844d');
  waterBand(ctx,left,left+width,4,0,'#d1bf83');
  waterBand(ctx,left,left+width,0,0,'#7cc4aa');
  waterBand(ctx,left,left+width,-6,0,'#55ae9e');
  waterBand(ctx,left,left+width,-16,0,'#469e96');
  footbridge(ctx,1700);
  for(let x=45;x<width;x+=57){
    const side = Math.sin(x*2.2)>0 ? 1 : -1;
    paintTuft(ctx,x,streamY(x)+side*(streamHalf(x)+8),24,.2*side,1);
  }
  for (let step=0;step<3;step++) {
    const x=grid.x+244+step%2*2, y=grid.y+112+step*12;
    ctx.beginPath();
    ctx.roundRect(x,y+1,22,8,3);
    ctx.fillStyle='#344f3f';ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x,y,22,7,3);
    ctx.fillStyle='#baaa82';ctx.fill();
  }
  // Packed gravel under the starting grandstands.
  ctx.beginPath();
  ctx.roundRect(finishStand.x-finishStand.width/2-18,finishStand.y-finishStand.depth/2-14,finishStand.width+36,finishStand.depth+26,22);
  ctx.fillStyle='#829060';ctx.fill();
  ctx.beginPath();ctx.roundRect(finishStand.x-finishStand.width/2-13,finishStand.y-finishStand.depth/2-9,finishStand.width+26,finishStand.depth+17,18);
  ctx.fillStyle='#c3b58a';ctx.fill();
}
function hasRoadClearance(x,y,size) {
  return Math.abs(TRACK.offsetAt(x,y))>TRACK.halfWidth+size/2+5;
}
function parkLayout(){
  const placed=[];
  function addObject(object) {
    const [, x, y, size] = object;
    const overlaps = placed.some(([, otherX, otherY, otherSize]) =>
      Math.abs(x-otherX) < (size+otherSize)*.47+3 &&
      Math.abs(y-otherY) < (size+otherSize)*.47+3);
    const railClearance=size*.52+12;
    const nearRail=[...trackBarriers.nearby(x,y,x,y,railClearance)].some(segment=>{
      const offset=railOffset(segment,x,y);
      return Math.hypot(offset.x,offset.y)<railClearance;
    });
    if (!overlaps && !nearRail && !inRaceFacility(x,y,size) && !insideFinishStand(x,y,size*.52+12)) placed.push(object);
  }
  for (const landmark of landmarks) {
    const [, x, y, size] = landmark;
    if (hasRoadClearance(x,y,size*.70)) addObject(landmark);
  }
  const types=['oak','fir','copper','blossom'];
  for(let row=0;row<H/113;row++){
    for(let col=0;col<W/127;col++){
      const pick=meadowRandom(col,row,95617);
      const x=(col+.15+pick()*.72)*127, y=(row+.12+pick()*.78)*113;
      if (landmarks.some(([,px,py,size])=>Math.hypot(x-px,y-py)<size*.55+39)) continue;
      if(Math.abs(y-streamY(x))<streamHalf(x)+46) continue;
      const p=pick();
      const localTree = x<1000 ? 'fir' : y<830 ? 'blossom' : x>2100 ? 'copper' : 'oak';
      const kind=p<.72 ? (pick()<.52 ? localTree : types[Math.floor(pick()*4)]) : p<.85?'flowers':'rocks';
      const tree=species[kind]<4, size=tree?59+pick()*47:23+pick()*19;
      const room=Math.abs(TRACK.offsetAt(x,y))-TRACK.halfWidth;
      // Occasional canopies frame a bend while their roots stay on the verge.
      if(room<(tree?size*.20:size*.53) || !hasRoadClearance(x,y+(tree?size*.41:0),9))continue;
      addObject([kind,x,y,size]);
    }
  }
  return placed.sort((a,b)=>(a[2]+a[3]*.34)-(b[2]+b[3]*.34));
}

function paintObjects(ctx, atlas, profiles, objects, seconds, houseArt, driver) {
  for (const [kind, x, y, size] of objects) {
    const index = species[kind];
    const sx = (index % 4) * TILE, sy = Math.floor(index / 4) * TILE;
    ctx.save();
    ctx.translate(x, y);
    // When driving on grass, let nearby scenery reveal the car underneath.
    if(driver && Math.abs(driver.lane)>TRACK.halfWidth){
      const distance=Math.max(Math.abs(driver.x-x),Math.abs(driver.y-y));
      const cover=Math.max(0,Math.min(1,(size*.54+13-distance)/23));
      ctx.globalAlpha*=1-.69*cover;
    }
    if (index < 4) {
      const sway = .013 * Math.sin(seconds * 1.28 + x * .017 + y * .012);
      const root = profiles[kind].root;
      const pivotX = (root.x - .5) * size, pivotY = (root.y - .5) * size;
      ctx.translate(pivotX, pivotY);
      ctx.transform(1, 0, sway, 1, 0, 0);
      ctx.translate(-pivotX, -pivotY);
    }
    if (kind === 'lodgeNorth' && houseArt.complete && houseArt.naturalWidth) {
      ctx.drawImage(houseArt,-size/2,-size/2,size,size);
    } else {
      ctx.drawImage(atlas, sx, sy, TILE, TILE, -size / 2, -size / 2, size, size);
    }
    ctx.restore();
  }
}
