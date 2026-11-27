// Axle locations are measured on each 144 px race sprite, facing up.
// The exposed tyres are cut from their own artwork. The others sit under the fenders.
const frontAxles = {
  agulha: {x:11, y:34, cut:[[0,19],[20,19],[21,26],[21,42],[19,50],[0,50]]},
  cupim: {x:13, y:27, cut:[[0,6],[22,6],[24,13],[25,26],[24,41],[21,48],[0,48]]},
  lotus: {x:9.5, y:30, width:10, length:31},
  sabia: {x:8.5, y:30, width:10.5, length:30},
  arraia: {x:9, y:28, width:11, length:31},
  bigorna: {x:11, y:32, width:12, length:33},
  ferrao: {x:11, y:35, width:13, length:34},
  faisca: {x:10, y:26, width:12, length:35},
  orca: {x:8.5, y:30, width:10.5, length:29},
  bisao: {x:9, y:34, width:13, length:37, tread:'cupim'},
  estalo: {x:9, y:34, width:13, length:33, tread:'cupim'},
};

const carArt = new Map();

function carLayer(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function carShadow(image) {
  const shadow = carLayer(image.width, image.height);
  const brush = shadow.getContext('2d');
  brush.drawImage(image,0,0);
  brush.globalCompositeOperation = 'source-in';
  brush.fillStyle = SUN_SHADOW.color;
  brush.fillRect(0,0,shadow.width,shadow.height);
  return shadow;
}

function exposedWheels(image, axle, spriteWidth) {
  const body = carLayer(image.naturalWidth,image.naturalHeight);
  const bodyBrush = body.getContext('2d');
  bodyBrush.drawImage(image,0,0);
  bodyBrush.globalCompositeOperation = 'destination-out';
  const scaleX = body.width/spriteWidth, scaleY = body.height/144;
  const wheels = [false,true].map(right => {
    const points = axle.cut.map(([x,y]) => [(right?spriteWidth-x:x)*scaleX,y*scaleY]);
    const path = new Path2D();
    path.moveTo(...points[0]);
    for (const point of points.slice(1)) path.lineTo(...point);
    path.closePath();
    bodyBrush.fill(path);

    const left = Math.floor(Math.min(...points.map(point=>point[0])));
    const top = Math.floor(Math.min(...points.map(point=>point[1])));
    const width = Math.ceil(Math.max(...points.map(point=>point[0])))-left;
    const height = Math.ceil(Math.max(...points.map(point=>point[1])))-top;
    const layer = carLayer(width,height);
    const brush = layer.getContext('2d');
    brush.translate(-left,-top);
    brush.clip(path);
    brush.drawImage(image,0,0);
    const x = right?spriteWidth-axle.x:axle.x;
    return {x,y:axle.y,left:left/scaleX-x,top:top/scaleY-axle.y,
      width:width/scaleX,height:height/scaleY,layer,shadow:carShadow(layer)};
  });
  return {body,wheels};
}

function makeCarLayers(image, id, spriteWidth, exposed) {
  const axle = frontAxles[id];
  const {body,wheels} = axle.cut ? exposedWheels(image,axle,spriteWidth) : {
    body:image,
    wheels:[axle.x,spriteWidth-axle.x].map(x => {
      const tyre = exposed[axle.tread??'agulha'];
      return {x,y:axle.y,left:-axle.width/2,top:-axle.length/2,
        width:axle.width,height:axle.length,layer:tyre.layer,shadow:tyre.shadow};
    }),
  };
  return {body,wheels,shadow:carShadow(body)};
}

async function loadCarImage(id, compact) {
  const image = new Image();
  image.src = OverdriveCars.imageForModel(id,compact);
  await image.decode();
  return image;
}

async function prepareCarArt() {
  const images = await Promise.all(OverdriveCars.carModels.map(async ({id}) => [id,await loadCarImage(id,true)]));
  const exposed = {};
  for (const [id,image] of images) {
    if (!frontAxles[id].cut) continue;
    const layers = makeCarLayers(image,id,image.naturalWidth);
    exposed[id] = layers.wheels[0];
    carArt.set(id,{id,image,...OverdriveCars.sizeForModel(id),...layers});
  }
  for (const [id,image] of images) {
    if (carArt.has(id)) continue;
    carArt.set(id,{id,image,...OverdriveCars.sizeForModel(id),...makeCarLayers(image,id,image.naturalWidth,exposed),exposed});
  }
}

function paintCarLayers(ctx, art, steeringAngle, shadow) {
  const {width,length,image} = art;
  const pixelsWide = image.naturalWidth;
  const {wheels,body,shadow:bodyShadow} = art.highRes ?? art;
  ctx.translate(-width/2,-length/2);
  ctx.scale(width/pixelsWide,length/144);
  for (const wheel of wheels) {
    ctx.save();
    ctx.translate(wheel.x,wheel.y);
    ctx.rotate(steeringAngle);
    ctx.drawImage(shadow?wheel.shadow:wheel.layer,wheel.left,wheel.top,wheel.width,wheel.height);
    ctx.restore();
  }
  ctx.drawImage(shadow?bodyShadow:body,0,0,pixelsWide,144);
}

function paintCar(ctx, car) {
  const art = carArt.get(car.carModel) ?? carArt.get(OverdriveCars.defaultModel);
  if (!art) return;
  // Keep the native artwork available for displays larger than the race sprite.
  if (art.length*scale > art.image.naturalHeight && !art.loadingHighRes) {
    art.loadingHighRes = loadCarImage(art.id,false).then(image => {
      art.highRes = makeCarLayers(image,art.id,art.image.naturalWidth,art.exposed);
    }).catch(()=>{});
  }
  const angle = car.a + Math.PI / 2; // The art faces up; physics uses +x as forward.
  castShadow(ctx,6,shade=>{
    shade.translate(car.x,car.y);
    shade.rotate(angle);
    paintCarLayers(shade,art,car.steeringAngle,true);
  },.52);

  ctx.save();
  ctx.translate(car.x,car.y);
  ctx.rotate(angle);
  paintCarLayers(ctx,art,car.steeringAngle,false);
  ctx.restore();
}

