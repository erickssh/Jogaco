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

function paintTrackBarriers(ctx){
  ctx.save();
  ctx.lineCap='round';
  ctx.lineJoin='round';
  for(const points of trackBarriers.paths){
    const wall=new Path2D();
    wall.moveTo(points[0].x,points[0].y);
    for(const p of points.slice(1)) wall.lineTo(p.x,p.y);
    castShadow(ctx,5,shade=>{
      shade.strokeStyle=SUN_SHADOW.color;
      shade.lineWidth=trackWallWidth;
      shade.stroke(wall);
    });
    ctx.strokeStyle='#424941';
    ctx.lineWidth=trackWallWidth;
    ctx.stroke(wall);
    ctx.strokeStyle='#a6aaa0';
    ctx.lineWidth=7;
    ctx.stroke(wall);
    ctx.save();
    ctx.translate(-1,-1);
    ctx.strokeStyle='#dbd9c8';
    ctx.lineWidth=3;
    ctx.stroke(wall);
    ctx.restore();

    // Small joints in the concrete caps, spaced by distance along the wall.
    let untilJoint=18;
    ctx.strokeStyle='#73796e';
    ctx.lineWidth=1;
    ctx.beginPath();
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];
      const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
      const nx=-dy/length,ny=dx/length;
      while(untilJoint<length){
        const t=untilJoint/length,x=a.x+t*dx,y=a.y+t*dy;
        ctx.moveTo(x+nx*3,y+ny*3);
        ctx.lineTo(x-nx*3,y-ny*3);
        untilJoint+=24;
      }
      untilJoint-=length;
    }
    ctx.stroke();
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

function carView(car,decay){
  const dx=car.viewOffsetX??0,dy=car.viewOffsetY??0;
  const angle=car.viewOffsetAngle??0;
  car.viewOffsetX=dx*decay;
  car.viewOffsetY=dy*decay;
  car.viewOffsetAngle=angle*decay;
  return {x:car.x+dx,y:car.y+dy,a:car.a+angle,paint:car.paint,name:car.name,lane:car.lane,retiredAt:car.retiredAt,carModel:car.carModel};
}

const carArt = new Map();

async function prepareCarArt() {
  await Promise.all(OverdriveCars.carModels.map(async model => {
    const image = new Image();
    image.src = OverdriveCars.imageForModel(model.id);
    await image.decode();

    // Keep each silhouette within the footprint shared by all race cars.
    const scale = Math.min(63 / image.naturalHeight, 40.5 / image.naturalWidth);
    const shadow = document.createElement('canvas');
    shadow.width = image.naturalWidth;
    shadow.height = image.naturalHeight;
    const brush = shadow.getContext('2d');
    brush.drawImage(image,0,0);
    brush.globalCompositeOperation = 'source-in';
    brush.fillStyle = SUN_SHADOW.color;
    brush.fillRect(0,0,shadow.width,shadow.height);
    carArt.set(model.id,{image,shadow,width:shadow.width*scale,length:shadow.height*scale});
  }));
}

function paintCar(ctx, car) {
  const art = carArt.get(car.carModel) ?? carArt.get(OverdriveCars.defaultModel);
  if (!art) return;
  const {image,shadow,width,length} = art;
  const angle = car.a + Math.PI / 2; // The art faces up; physics uses +x as forward.
  castShadow(ctx,6,shade=>{
    shade.translate(car.x,car.y);
    shade.rotate(angle);
    shade.drawImage(shadow,-width/2,-length/2,width,length);
  },.52);

  ctx.save();
  ctx.translate(car.x,car.y);
  ctx.rotate(angle);
  ctx.drawImage(image,-width/2,-length/2,width,length);
  ctx.restore();
}
