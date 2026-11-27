// Each facility is set out from a specific point on the racing line. Its local
// positive Y axis points back towards the track. The art has four distinct views.
function raceFacility(kind, distance, setback, width, depth, tile, artFront, artSize) {
  const gate = TRACK.pointAt(startDistance + distance);
  const nx = gate.ty, ny = -gate.tx;
  const angle = Math.atan2(ny,nx);
  return {kind, gate, x:gate.x-nx*setback, y:gate.y-ny*setback,
    angle:angle-Math.PI/2, artAngle:angle-artFront*Math.PI/180,
    width, depth, tile, artSize};
}

const terraceDistance=3775;
const raceFacilities = [
  raceFacility('pits',7160,259,337,215,0,-90,270),
  raceFacility('broadcast',1030,223,172,160,3,180,158),
  raceFacility('marshal',2125,158,100,66,null,90,0),
  raceFacility('terrace',terraceDistance,249,242,178,null,90,0),
  raceFacility('rescue',4515,235,225,198,2,0,193),
  raceFacility('marshal',6150,159,100,66,null,90,0)
];
const terrace = raceFacilities.find(facility=>facility.kind==='terrace');
const terraceGate = terrace.gate;
const terraceApproach=TRACK.pointAt(startDistance+terraceDistance-350);

// Service vehicles reach the two paved aprons through gaps beside the pit wall.
function serviceRoutes(f) {
  if(f.kind!=='pits' && f.kind!=='rescue') return [];
  const sides=f.kind==='pits' ? [-1,1] : [1];
  return sides.map(side=>{
    const endX=side*(f.width/2+81);
    const wx=f.x+endX*Math.cos(f.angle), wy=f.y+endX*Math.sin(f.angle);
    const towardX=-Math.sin(f.angle), towardY=Math.cos(f.angle);
    let endY=f.depth/2;
    while(endY<320 && TRACK.offsetAt(wx+towardX*endY,wy+towardY*endY)<-TRACK.halfWidth-1) endY++;
    return [[side*(f.width/2-28),f.depth/2-24],[side*(f.width/2+10),f.depth/2-9],
      [side*(f.width/2+38),f.depth/2+18],[endX,endY+8]];
  });
}
for(const f of raceFacilities) f.routes=serviceRoutes(f);

function nearRoute(x,y,points,clearance) {
  return points.slice(1).some(([bx,by],i)=>{
    const [ax,ay]=points[i],dx=bx-ax,dy=by-ay;
    const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
    return Math.hypot(x-ax-t*dx,y-ay-t*dy)<clearance;
  });
}

function paintAccessRoutes(ctx) {
  for(const f of raceFacilities){
    ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.angle);
    for(const points of f.routes){
      siteLine(ctx,points,'#747961',34);
      siteLine(ctx,points,'#969989',30);
      siteLine(ctx,points,'#9d9e8e',23);
    }
    ctx.restore();
  }
}

function inRaceFacility(x,y,size) {
  return raceFacilities.some(f=>{
    const dx=x-f.x, dy=y-f.y, cos=Math.cos(f.angle), sin=Math.sin(f.angle);
    const along=dx*cos+dy*sin, across=-dx*sin+dy*cos;
    return f.routes.some(points=>nearRoute(along,across,points,17+size*.5)) ||
           Math.abs(along)<f.width/2+size*.55+7 &&
           Math.abs(across)<f.depth/2+size*.55+7;
  });
}

function siteRect(ctx,x,y,w,h,r,fill) {
  ctx.beginPath();
  ctx.roundRect(x,y,w,h,r);
  ctx.fillStyle=fill;
  ctx.fill();
}

function siteLine(ctx,points,color,width) {
  ctx.beginPath();
  points.forEach(([x,y],i)=>i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
  ctx.strokeStyle=color;
  ctx.lineCap='round';
  ctx.lineJoin='round';
  ctx.lineWidth=width;
  ctx.stroke();
}

// Short low barriers mark the working areas, with openings at the ends.
function siteBarrier(ctx,x,y,w) {
  siteRect(ctx,x+1,y+3,w,5,2,'#535d50');
  siteRect(ctx,x,y,w,5,1.8,'#e2d9b8');
  for(let i=1;i<w-8;i+=19) siteRect(ctx,x+i,y,8,5,1,'#b75a46');
}

function paintMarshal(ctx) {
  // Two marshals behind the low barrier; the cap brims and shoulders face the road.
  for(const [x,y,jacket] of [[-15,-7,'#df7834'],[8,-13,'#ee9447']]){
    siteRect(ctx,x-6,y-5,15,20,6,'#455346');
    siteRect(ctx,x-8,y-8,16,17,6,'#603e30');
    siteRect(ctx,x-7,y-7,14,15,5,jacket);
    ctx.fillStyle='#f5dcb0';ctx.fillRect(x-6,y+1,12,2);
    roundedShape(ctx,x,y-5,5.8,5.5,'#4d4135');
    roundedShape(ctx,x,y-5.5,4.8,4.5,'#f2dec0');
    siteRect(ctx,x-4,y-3,8,2.5,1,'#b98a64');
  }
  siteLine(ctx,[[15,-16],[22,8]],'#66513a',2);
  ctx.beginPath();ctx.moveTo(20,2);ctx.lineTo(32,-2);ctx.lineTo(28,-10);
  ctx.lineTo(17,-6);ctx.closePath();ctx.fillStyle='#e3b845';ctx.fill();
  siteBarrier(ctx,-41,18,82);
}

function paintFacilityGround(ctx,f) {
  ctx.save();
  ctx.translate(f.x,f.y);
  ctx.rotate(f.angle);
  const w=f.width,h=f.depth;
  const paved=f.kind==='pits'||f.kind==='rescue';
  siteRect(ctx,-w/2,-h/2,w,h,12,'#646b51');
  siteRect(ctx,-w/2+3,-h/2+3,w-6,h-6,10,paved?'#858b7f':'#b2a079');
  siteRect(ctx,-w/2+6,-h/2+6,w-12,h-12,8,paved?'#92968a':'#c3b188');
  if(f.kind==='pits'){
    // Three working bays and a continuous pit wall bordering the straight.
    for(let i=-1;i<=1;i++){
      const x=i*86;
      siteLine(ctx,[[x-34,54],[x-34,84],[x+33,84],[x+33,54]],'#e7d9ac',2.8);
    }
    siteBarrier(ctx,-131,h/2-12,262);
  }else if(f.kind==='rescue'){
    for(let i=0;i<4;i++) siteLine(ctx,[[w/2-40+i*7,h/2-31],[w/2-50+i*7,h/2-17]],'#e6d19a',2);
  }else if(f.kind==='terrace'){
    // An aisle runs between the front row and the spectator fence.
    siteRect(ctx,-w/2+10,h/2-26,w-20,16,5,'#d6c399');
    siteLine(ctx,[[-w*.45,h/2-9],[w*.45,h/2-9]],'#594e3b',4);
    for(let i=-3;i<=3;i++) siteRect(ctx,i*w*.14-2,h/2-12,4,8,1,'#796244');
  }else if(f.kind==='marshal') paintMarshal(ctx);
  ctx.restore();
}

// Cache each rotated building and its soft shadow at the original tile density.
function prepareFacilityArt(atlas) {
  const sprites=new Map();
  if(!atlas.naturalWidth) return sprites;
  const tile=atlas.naturalWidth/2;
  for(const f of raceFacilities){
    if(f.tile===null) continue;
    const density=tile/f.artSize;
    const inset=(Math.abs(Math.cos(f.artAngle))+Math.abs(Math.sin(f.artAngle)))*f.artSize;
    const side=Math.ceil((inset+40)*density);
    const layer=shadowCanvas(side);
    const ctx=layer.getContext('2d');
    ctx.setTransform(density,0,0,density,side/2,side/2);
    ctx.rotate(f.artAngle);
    ctx.shadowOffsetX=6*density;
    ctx.shadowOffsetY=8*density;
    ctx.shadowBlur=3*density;
    ctx.shadowColor='rgba(36,52,36,.54)';
    ctx.drawImage(atlas,(f.tile%2)*tile,Math.floor(f.tile/2)*tile,tile,tile,
      -f.artSize/2,-f.artSize/2,f.artSize,f.artSize);
    sprites.set(f,{layer,size:side/density});
  }
  return sprites;
}

function paintFacilityArt(ctx,f,sprites) {
  const sprite=sprites.get(f);
  if(!sprite) return;
  const {layer,size}=sprite;
  ctx.drawImage(layer,f.x-size/2,f.y-size/2,size,size);
}
