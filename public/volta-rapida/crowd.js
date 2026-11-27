// Positions and colours of the five original spectators in the 192 px tile.
const grandstandFans = [
  {x:49,y:90,hatW:24,hatH:19,shirt:'#44877c',skin:'#e9c198',claps:true},
  {x:91,y:90,hatW:24,hatH:17,shirt:'#8c4334',skin:'#f0cc9f',claps:false},
  {x:135,y:90,hatW:24,hatH:19,shirt:'#d7c4a3',skin:'#e3b786',claps:true},
  {x:60,y:127,hatW:29,hatH:24,shirt:'#377f7b',skin:'#f1c69a',claps:false},
  {x:128,y:127,hatW:25,hatH:24,shirt:'#b54939',skin:'#d6a884',claps:true}
];

function prepareGrandstand(atlas) {
  const atlasY = TILE * 2;
  const heads = grandstandFans.map(fan => {
    const head = shadowCanvas(32);
    const face = head.getContext('2d');
    face.beginPath();
    face.ellipse(16,16,fan.hatW/2,fan.hatH/2,0,0,2*Math.PI);
    face.clip();
    face.drawImage(atlas,0,atlasY,TILE,TILE,16-fan.x,16-fan.y,TILE,TILE);

    return head;
  });
  return {heads};
}

function roundedShape(ctx,x,y,radiusX,radiusY,fill) {
  ctx.beginPath();
  ctx.ellipse(x,y,radiusX,radiusY,0,0,Math.PI*2);
  ctx.fillStyle=fill;
  ctx.fill();
}

function drawFanArm(ctx,fan,side,lift,clap) {
  const shoulderX=side*7, shoulderY=5;
  const elbowX=side*(11+lift*4), elbowY=10-lift*3;
  const handX=fan.claps ? side*(8-lift*6*clap) : side*(7+lift*10);
  const handY=fan.claps ? 14-lift*6 : 14-lift*18;
  ctx.beginPath();
  ctx.moveTo(shoulderX,shoulderY);
  ctx.quadraticCurveTo(elbowX,elbowY,handX,handY);
  ctx.strokeStyle='#423024';
  ctx.lineWidth=6.4;
  ctx.stroke();
  ctx.strokeStyle=fan.shirt;
  ctx.lineWidth=4.6;
  ctx.stroke();
  roundedShape(ctx,handX,handY,3.2,3,'#423024');
  roundedShape(ctx,handX-.35,handY-.45,2.1,1.9,fan.skin);
}
