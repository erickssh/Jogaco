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
const photographerDistance=1030;
const raceFacilities = [
  raceFacility('pits',7160,301,337,215,0,-90,270),
  raceFacility('broadcast',photographerDistance,323,172,160,3,180,158),
  raceFacility('marshal',2125,224,100,66,null,90,0),
  raceFacility('terrace',terraceDistance,282,242,178,null,90,0),
  raceFacility('rescue',4515,292,225,198,2,0,193),
  raceFacility('marshal',6150,225,100,66,null,90,0)
];
const terrace = raceFacilities.find(facility=>facility.kind==='terrace');
const photographer=raceFacilities.find(facility=>facility.kind==='broadcast');
const terraceGate = terrace.gate;
const terraceApproach=TRACK.pointAt(startDistance+terraceDistance-350);

// The broadcast sprite faces left before rotation. Anchor the flash at the
// centre of the lens hood's front rim.
const lensX=-.488*photographer.artSize,lensY=-.246*photographer.artSize;
const lensCos=Math.cos(photographer.artAngle),lensSin=Math.sin(photographer.artAngle);
const photoLens={
  x:photographer.x+lensX*lensCos-lensY*lensSin,
  y:photographer.y+lensX*lensSin+lensY*lensCos
};
const photoGate=photographer.gate;
const photoDistance=photographerDistance+(photoLens.x-photoGate.x)*photoGate.tx+
  (photoLens.y-photoGate.y)*photoGate.ty-10;
const photo={previous:-Infinity,lap:-1,at:-Infinity,burst:-Infinity};

function resetPhotographer(){
  photo.previous=-Infinity;
  photo.lap=-1;
  photo.at=-Infinity;
  photo.burst=-Infinity;
}

function cuePhotographer(leader,now){
  if(!leader || Number.isFinite(leader.finishedAt)) return;
  const progress=leader.standing;
  const lap=Math.floor((progress-photoDistance)/TRACK.length);
  const marker=photoDistance+lap*TRACK.length;
  if(lap>=0 && lap<raceLaps && lap>photo.lap &&
     photo.previous<marker && progress-marker<72){
    photo.lap=lap;
    photo.at=now;
    photo.burst=now;
  }
  photo.previous=progress;
}

const cameraShotInterval=140;
const cameraFlashFraction=.58;

function cameraShotAt(now){
  const age=now-photo.burst;
  if(age<0 || age>=cameraShotInterval*3) return -1;
  const shot=Math.floor(age/cameraShotInterval);
  return age/cameraShotInterval-shot<cameraFlashFraction?shot:-1;
}

function paintCameraFlash(ctx,now,reduced){
  const shot=cameraShotAt(now);
  if(shot<0) return;
  const progress=(now-photo.burst)/cameraShotInterval-shot;
  const fade=(1-progress/cameraFlashFraction)**1.25;
  const {x,y}=photoLens;
  const strength=reduced?.82:1;
  const reach=(reduced?82:148)*(1-progress*.18);
  const radius=(reduced?38:70)*(1-progress*.24);
  ctx.save();
  ctx.globalAlpha=fade*strength;
  ctx.translate(x,y);
  ctx.rotate(photographer.artAngle+Math.PI);
  const beam=ctx.createLinearGradient(0,0,reach,0);
  beam.addColorStop(0,'#fffbe8e8');
  beam.addColorStop(.16,'#fff0c6b8');
  beam.addColorStop(.52,'#ffdda05c');
  beam.addColorStop(1,'#ffcf8600');
  ctx.fillStyle=beam;
  ctx.beginPath();
  ctx.moveTo(0,-5);
  ctx.quadraticCurveTo(reach*.43,-radius*.65,reach,-radius*.55);
  ctx.quadraticCurveTo(reach*1.08,0,reach,radius*.55);
  ctx.quadraticCurveTo(reach*.43,radius*.65,0,5);
  ctx.closePath();
  ctx.fill();
  ctx.translate(reach*.12,0);
  const glow=ctx.createRadialGradient(0,0,1,0,0,radius);
  glow.addColorStop(0,'#fff');
  glow.addColorStop(.2,'#fffef3');
  glow.addColorStop(.62,'#fff0c4');
  glow.addColorStop(1,'transparent');
  ctx.fillStyle=glow;
  ctx.fillRect(-radius,-radius,radius*2,radius*2);
  ctx.translate(-reach*.12,0);
  if(!reduced){
    ctx.fillStyle='#fffef5';
    ctx.shadowColor='#fff3c8';
    ctx.shadowBlur=22;
    ctx.shadowOffsetX=1.5;
    ctx.beginPath();
    ctx.moveTo(0,-34);ctx.lineTo(5,-6);ctx.lineTo(34,0);ctx.lineTo(5,6);
    ctx.lineTo(0,34);ctx.lineTo(-5,6);ctx.lineTo(-34,0);ctx.lineTo(-5,-6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

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

// The atlas merges the parked vehicles into the buildings. Separate them
// at the roof and tent edges so each can scale around its parking position.
// Coordinates are local to the original 512px atlas tiles.
const facilityVehicles = {
  pits: [
    {scale:.45, anchor:[164,186], outline:[
      [99,54],[225,54],[225,144],[214,144],[214,184],[207,186],
      [117,186],[113,183],[113,144],[107,139],[103,134],[102,127],[99,123],
    ]},
    {scale:.45, anchor:[370,186], outline:[
      [303,54],[438,54],[437,124],[434,130],[431,135],[428,140],
      [423,145],[421,150],[421,184],[409,186],[325,186],[320,183],[316,145],[303,145],
    ]},
  ],
  rescue: [
    {scale:.32, anchor:[317,249], outline:[
      [0,0],[512,0],[512,271],[344,271],[330,268],[327,256],[323,250],
      [318,247],[312,247],[306,250],[302,253],[96,253],[88,250],[82,247],
      [75,246],[70,250],[66,258],[65,270],[0,270],
    ]},
  ],
};

function paintFacilityTile(ctx, f, atlas, tile, density) {
  const sourceX = (f.tile % 2) * tile;
  const sourceY = Math.floor(f.tile / 2) * tile;
  const paintTile = brush => brush.drawImage(atlas,sourceX,sourceY,tile,tile,0,0,tile,tile);
  const vehicles = facilityVehicles[f.kind];
  const size = f.artSize;
  if (!vehicles) {
    ctx.drawImage(atlas,sourceX,sourceY,tile,tile,-size/2,-size/2,size,size);
    return;
  }

  const building = shadowCanvas(tile);
  const base = building.getContext('2d');
  paintTile(base);
  base.globalCompositeOperation = 'destination-out';
  for (const {outline,anchor,scale} of vehicles) {
    const cut = new Path2D();
    for (const [index,[x,y]] of outline.entries()) {
      const atX = x * tile / 512;
      const atY = y * tile / 512;
      if (index === 0) cut.moveTo(atX,atY);
      else cut.lineTo(atX,atY);
    }
    cut.closePath();
    base.fill(cut);

    const vehicle = shadowCanvas(tile);
    const brush = vehicle.getContext('2d');
    brush.clip(cut);
    paintTile(brush);
    const [x,y] = anchor.map(value => (value / 512) * size);
    ctx.save();
    ctx.shadowOffsetX = 6 * density * scale;
    ctx.shadowOffsetY = 8 * density * scale;
    ctx.shadowBlur = 3 * density * scale;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(vehicle,(1-scale)*x-size/2,(1-scale)*y-size/2,size*scale,size*scale);
    ctx.restore();
  }
  // The original roof lip and tent stay in front of the vehicles.
  ctx.drawImage(building,-size/2,-size/2,size,size);
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
    paintFacilityTile(ctx,f,atlas,tile,density);
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
