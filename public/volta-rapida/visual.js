// World-space direction opposite the sun in the upper-left.
const SUN_SHADOW = { x: .86, y: 1, color: '#213322' };

function castShadow(ctx, height, silhouette, opacity = .42) {
  ctx.save();
  ctx.translate(SUN_SHADOW.x * height, SUN_SHADOW.y * height);
  ctx.fillStyle = SUN_SHADOW.color;
  ctx.globalAlpha *= opacity;
  silhouette(ctx);
  ctx.restore();
}

function paintShortcutRails(ctx){
  ctx.save();
  ctx.lineCap='round';
  ctx.lineJoin='round';
  for(const points of shortcutRails){
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for(const point of points.slice(1)) ctx.lineTo(...point);
    ctx.strokeStyle='#213c27';
    ctx.lineWidth=14;
    ctx.stroke();
    ctx.strokeStyle='#9eaa9b';
    ctx.lineWidth=9;
    ctx.stroke();
    ctx.strokeStyle='#e2ded1';
    ctx.lineWidth=3;
    ctx.stroke();
    for(const [x,y] of points){
      ctx.fillStyle='#596354';
      ctx.fillRect(x-3,y-4,6,8);
    }
  }
  ctx.restore();
}

function paintCircuit(ctx,startingSlots=[]) {
  ctx.lineCap = 'butt';
  function strokeTrack(color, lineWidth) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke(TRACK.path);
  }

  const roadWidth = TRACK.halfWidth * 2;
  ctx.save();
  ctx.translate(SUN_SHADOW.x * 3, SUN_SHADOW.y * 3);
  ctx.globalAlpha = .27;
  strokeTrack(SUN_SHADOW.color, roadWidth + 12);
  ctx.restore();
  strokeTrack('#6b694b', roadWidth + 9);
  strokeTrack('#a5a17c', roadWidth + 5);
  strokeTrack('#ded5ae', roadWidth + 1);

  const asphalt = ctx.createLinearGradient(130, 0, 1060, 700);
  asphalt.addColorStop(0, '#566062');
  asphalt.addColorStop(.42, '#51595b');
  asphalt.addColorStop(1, '#495456');
  strokeTrack(asphalt, roadWidth - 4);

  // Put the painted kerbs just inside the playable circuit.
  for (const offset of [innerEdge + 4.5, outerEdge - 4.5]) {
    const kerbs = new Path2D();
    const tail = 16;
    for (const {x, y, start:angle, end, sweep, radius:axisRadius} of TRACK.arcs) {
      if (Math.abs(sweep) < .32) continue;
      const direction = Math.sign(sweep);
      const radius = axisRadius + direction * offset;
      const sx = x + Math.cos(angle) * radius;
      const sy = y + Math.sin(angle) * radius;
      kerbs.moveTo(sx + Math.sin(angle) * tail * direction, sy - Math.cos(angle) * tail * direction);
      kerbs.lineTo(sx, sy);
      kerbs.arc(x, y, radius, angle, end, direction < 0);
      kerbs.lineTo(x + Math.cos(end) * radius - Math.sin(end) * tail * direction,
        y + Math.sin(end) * radius + Math.cos(end) * tail * direction);
    }
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#35312a';
    ctx.stroke(kerbs);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#e7d9b7';
    ctx.stroke(kerbs);
    ctx.strokeStyle = '#c25d46';
    ctx.setLineDash([11, 11]);
    ctx.stroke(kerbs);
    ctx.setLineDash([]);
  }

  // Trace the two verges where they cross the river. Railings stay parallel
  // to traffic, and the road surface continues uninterrupted over the water.
  for (const side of [-1,1]) {
    let run = [];
    function rail() {
      if (run.length < 2) { run=[]; return; }
      const railPath = new Path2D();
      railPath.moveTo(run[0].x,run[0].y);
      for(const p of run.slice(1))railPath.lineTo(p.x,p.y);
      landscapePath(ctx,railPath,'#574d41',8);
      landscapePath(ctx,railPath,'#c49a61',5);
      landscapePath(ctx,railPath,'#f4cf85',2);
      for(let j=0;j<run.length;j+=5){
        const p=run[j];ctx.fillStyle='#64553c';ctx.fillRect(p.x-4,p.y-4,8,8);
        ctx.fillStyle='#efce91';ctx.fillRect(p.x-3,p.y-4,6,5);
      }
      run=[];
    }
    for(let d=0;d<TRACK.length;d+=5){
      const p=TRACK.pointAt(d);
      const x=p.x+side*(TRACK.halfWidth+4)*p.ty, y=p.y-side*(TRACK.halfWidth+4)*p.tx;
      if(Math.abs(y-streamY(x))<=streamHalf(x)+11)run.push({x,y});
      else if(run.length)rail();
    }
    rail();
  }
  ctx.save();
  ctx.translate(grid.x-600,grid.y-600);
  const stripe = roadWidth / 20;
  ctx.fillStyle = '#403c36';
  ctx.fillRect(600 - stripe - 2, 600 - TRACK.halfWidth + 2, stripe * 2 + 4, roadWidth - 4);
  for (let row = 0; row < 20; row++) {
    for (let col = 0; col < 2; col++) {
      ctx.fillStyle = (row + col) % 2 ? '#393932' : '#e8dcb8';
      ctx.fillRect(600 + (col - 1) * stripe, 600 - TRACK.halfWidth + row * stripe, stripe, stripe);
    }
  }

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#e4d5af7d';
  for(const {x,y,a} of startingSlots){
    ctx.save();
    ctx.translate(x-grid.x+600,y-grid.y+600);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(5,-13);
    ctx.lineTo(23,-13);
    ctx.lineTo(23,13);
    ctx.lineTo(5,13);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

const playerPaint=['#ad403c','#ef7e64','#ff9a79','#702c2e','#ffd3ae'];

function paintCar(ctx, car) {
  const [shade,bright,highlight,trim,stripe]=car.paint??playerPaint;
  const body=new Path2D();
  body.moveTo(-19,-7);
  body.quadraticCurveTo(-17,-11,-11,-11);
  body.lineTo(10,-10);
  body.quadraticCurveTo(20,-9,21,-5);
  body.lineTo(21,5);
  body.quadraticCurveTo(20,9,10,10);
  body.lineTo(-11,11);
  body.quadraticCurveTo(-17,11,-19,7);
  body.closePath();
  castShadow(ctx, 6, (shade) => {
    shade.translate(car.x, car.y);
    shade.rotate(car.a);
    shade.fill(body);
  }, .52);

  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.a);
  ctx.fillStyle='#10171d';
  for(const x of [-14,9]){
    for(const y of [-12,8]){
      ctx.beginPath();
      ctx.roundRect(x,y,7,4,1.4);
      ctx.fill();
    }
  }

  const paint=ctx.createLinearGradient(0,-12,0,12);
  paint.addColorStop(0,shade);
  paint.addColorStop(.25,bright);
  paint.addColorStop(.5,highlight);
  paint.addColorStop(.75,bright);
  paint.addColorStop(1,shade);
  ctx.fillStyle=paint;
  ctx.fill(body);
  ctx.strokeStyle=trim;
  ctx.lineWidth=.85;
  ctx.stroke(body);

  ctx.fillStyle=stripe;
  ctx.fillRect(-15,-2.2,35,4.4);
  ctx.fillStyle='#242f3b';
  ctx.beginPath();
  ctx.moveTo(-10,-5);
  ctx.quadraticCurveTo(-1,-8,6,-6);
  ctx.lineTo(9,-4.5);
  ctx.lineTo(9,4.5);
  ctx.lineTo(6,6);
  ctx.quadraticCurveTo(-1,8,-10,5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle='#506d79';
  ctx.fillRect(4,-4.5,3.5,9);
  ctx.fillRect(-9,-4,2.5,8);
  ctx.fillStyle=bright;
  ctx.beginPath();
  ctx.roundRect(-6,-4.8,9,9.6,2);
  ctx.fill();
  ctx.fillStyle=stripe;
  ctx.fillRect(-5,-1.4,7,2.8);

  ctx.fillStyle='#191f28';
  ctx.fillRect(-18.5,-10,2.6,20);
  ctx.fillStyle='#ff514b';
  ctx.fillRect(-16,-8,2,3.2);
  ctx.fillRect(-16,4.8,2,3.2);
  ctx.fillStyle='#fff0bf';
  ctx.fillRect(17,-6.2,3.2,2.3);
  ctx.fillRect(17,3.9,3.2,2.3);
  ctx.restore();
}
