const finishApproach=TRACK.pointAt(startDistance-390);
const crowdWait=3200;
const crowdSettle=1800;
const finishCrowd={};
const northCrowd={};

function resetCrowds(){
  for(const crowd of [finishCrowd,northCrowd]){
    crowd.lap=0;
    crowd.started=-Infinity;
    crowd.passed=-Infinity;
  }
}

function cueCrowd(crowd,lap,now,approaching,passing){
  if(crowd.lap!==lap && (approaching || passing)){
    crowd.lap=lap;
    crowd.started=now;
    crowd.passed=-Infinity;
  }
  if(passing && crowd.lap===lap && crowd.passed===-Infinity){
    // A very slow approach can wind down before the driver finally arrives.
    if(now-crowd.started>=crowdWait+crowdSettle) crowd.started=now;
    crowd.passed=now;
  }
}

function crowdMotion(crowd,now,reduced){
  const timeout=crowd.started+crowdWait;
  const end=crowd.passed<=timeout && Number.isFinite(crowd.passed) ? crowd.passed+550 : timeout;
  const age=(now-crowd.started)/1000;
  const release=(now-end)/1000;
  if(reduced){
    return age>=0 && release<crowdSettle/1000 ? {clock:0,age:1.2,release:-1} : {clock:0,age:-1,release:0};
  }
  return {clock:now/1000,age:release<crowdSettle/1000?age:-1,release};
}

function easeCrowd(value){
  const t=Math.max(0,Math.min(1,value));
  return t*t*(3-2*t);
}

const capOrder=[0,2,1,4,0,1,2,4,0];

function paintSpectatorHair(ctx,fan,column) {
  const hair=['#523c31','#352f2b','#845137'][column%3];
  roundedShape(ctx,0,1,11.7,10.6,'#50392d');
  roundedShape(ctx,0,3,10.7,9.35,fan.skin);
  roundedShape(ctx,0,-2.2,11.05,8.5,hair);
  roundedShape(ctx,-2.5,-4.15,6,3.3,'#ab8260');
  // Top of the head occupies most of the shape. The nose is on the track side.
  roundedShape(ctx,.4,10.15,1.85,2.2,fan.skin);
}

function paintTerraceFan(ctx,stand,row,column,x,y,motion) {
  const head=capOrder[(column+3*row)%capOrder.length];
  const fan=grandstandFans[head];
  const delay=(column%8)*.037+row*.05+Math.floor(column/8)*.065;
  const age=motion.age-delay;
  const settle=1.05+(row+column)%5*.095;
  const effort=easeCrowd(age/.38)*(1-easeCrowd((motion.release-delay*.45)/settle));
  const pulse=effort>0 ? Math.cos(age*(fan.claps?12:8)+(row*8+column)*.84) : 0;
  const pairPhase=Math.floor(column/2)*2.73+row*1.57;
  const chat=Math.pow(Math.max(0,Math.sin(motion.clock*.89+pairPhase)),4)*(1-effort);
  const nod=chat*Math.sin(motion.clock*3.1+column*.6);
  const facing=column%2?-1:1;
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(.68,.68);
  ctx.translate(facing*chat*.95,-effort*(2.5+1.45*pulse)+nod*.7);
  ctx.rotate(facing*chat*.11+effort*.09*Math.sin(effort>0 ? age*8+column : 0));

  const shoulders=12;
  roundedShape(ctx,0,5,shoulders,8,'#503b30');
  roundedShape(ctx,0,5,shoulders-1.3,6.5,fan.shirt);
  roundedShape(ctx,-8,7,2.4,3.2,'#dac299');
  roundedShape(ctx,8,7,2.4,3.2,'#dac299');

  if(effort>0){
    ctx.save();
    ctx.globalAlpha*=easeCrowd(effort*2.2);
    if(fan.claps) ctx.translate(0,3.4*effort);
    for(const side of [-1,1]){
      const energy=fan.claps?effort:effort*(.70+side*.22*pulse);
      drawFanArm(ctx,fan,side,energy,(1+pulse)/2);
    }
    ctx.restore();
  }
  if((column+row*2)%4===1) paintSpectatorHair(ctx,fan,column);
  else ctx.drawImage(stand.heads[head],-16,-16);
  ctx.restore();
}

function paintNorthTerrace(ctx,motion,stand) {
  ctx.save();
  ctx.translate(terrace.x,terrace.y);
  ctx.rotate(terrace.angle);

  siteRect(ctx,-100,-76,204,123,5,'#8e7957');
  siteRect(ctx,-104,-80,204,123,5,'#354d43');
  siteRect(ctx,-101,-77,198,117,3,'#987445');

  for(let row=0;row<3;row++){
    const y=-72+row*36;
    siteRect(ctx,-97,y,190,35,2,'#684d34');
    siteRect(ctx,-96,y+5,188,25,2,row%2?'#b79260':'#c39c6a');
    siteRect(ctx,-96,y+6,188,2,1,'#ddc18a');
    siteLine(ctx,[[-95,y+23],[91,y+23]],'#a38157',1);
    for(const x of [-26,31]) siteLine(ctx,[[x,y+8],[x,y+21]],'#a38357',.8);
    siteRect(ctx,-95,y+30,186,3,1,'#7d5b39');

    if(stand){
      for(let column=0;column<8;column++){
        paintTerraceFan(ctx,stand,row,column,(column-3.5)*22-2+(row%2?2:-2),-52+row*36,motion);
      }
    }
  }
  for(const x of [-101,97]){
    siteRect(ctx,x-2,-78,4,119,2,'#315046');
    for(const y of [-74,-38,-2,34]) roundedShape(ctx,x,y,2.6,2.2,'#c6c6a1');
  }
  ctx.restore();
}

// Three seating blocks with two aisles, all facing the finish straight.
const finishStand={x:grid.x,y:grid.y-292,width:594,depth:181,rows:5,sections:3,seats:8};

function insideFinishStand(x,y,margin) {
  return Math.abs(x-finishStand.x)<finishStand.width/2+margin &&
    Math.abs(y-finishStand.y)<finishStand.depth/2+margin;
}

function paintFinishDeck(ctx) {
  const {width:w,depth:d,sections,rows}=finishStand;
  siteRect(ctx,-w/2+5,-d/2+7,w,d,10,'#46553c');
  siteRect(ctx,-w/2,-d/2,w,d,9,'#334a40');
  siteRect(ctx,-w/2+5,-d/2+5,w-10,d-10,6,'#997749');
  for(let row=0;row<rows;row++){
    const y=-d/2+9+row*32;
    siteRect(ctx,-w/2+7,y,w-14,33,2,'#664b35');
    siteRect(ctx,-w/2+8,y+3,w-16,26,2,row%2?'#b79260':'#c39c6a');
    siteLine(ctx,[[-w/2+10,y+5],[w/2-10,y+5]],'#ddc18a',2);
    siteLine(ctx,[[-w/2+10,y+25],[w/2-10,y+25]],'#a38157',1);
    for(let i=1;i<sections;i++){
      const x=(i-sections/2)*194;
      siteRect(ctx,x-9,y+1,18,31,1,'#8d8570');
      siteLine(ctx,[[x-8,y+5],[x+8,y+5]],'#c6b9a0',1.65);
      siteLine(ctx,[[x-8,y+27],[x+8,y+27]],'#504d42',1.65);
    }
  }
  for(const x of [-w/2+5,w/2-5]){
    siteRect(ctx,x-2,-d/2+4,4,d-8,2,'#315046');
    for(let y=-d/2+11;y<d/2;y+=32) roundedShape(ctx,x,y,2.6,2.2,'#c6c6a1');
  }
  siteRect(ctx,-w/2+4,d/2-8,w-8,5,2,'#315046');
  for(let x=-w/2+14;x<w/2;x+=30) roundedShape(ctx,x,d/2-5,2.15,2,'#c6c6a1');
}

function paintFinishFans(ctx,motion,stand) {
  for(let row=0;row<finishStand.rows;row++){
    for(let section=0;section<finishStand.sections;section++){
      for(let seat=0;seat<finishStand.seats;seat++){
        const x=(section-1)*194+(seat-3.5)*21+(row%2?2:-2);
        const y=-finishStand.depth/2+24+row*32;
        paintTerraceFan(ctx,stand,row,seat+section*finishStand.seats,x,y,motion);
      }
    }
  }
}

function prepareFinishStand(){
  const width=finishStand.width+22,height=finishStand.depth+22;
  function makeLayer(){
    const canvas=document.createElement('canvas');
    canvas.width=width*2;canvas.height=height*2;
    return canvas;
  }
  const deck=makeLayer();
  const deckCtx=deck.getContext('2d');
  deckCtx.setTransform(2,0,0,2,width,height);
  paintFinishDeck(deckCtx);
  return {deck,fans:makeLayer(),width,height,clock:-1,age:null};
}

function paintFinishStand(ctx,stand,layers,motion) {
  const {deck,fans,width,height}=layers;
  const tick=Math.floor(motion.clock*(motion.age<0?18:36));
  if(stand && (layers.clock!==tick || (motion.clock===0 && layers.age!==motion.age))){
    const fanCtx=fans.getContext('2d');
    fanCtx.resetTransform();
    fanCtx.clearRect(0,0,fans.width,fans.height);
    fanCtx.setTransform(2,0,0,2,width,height);
    paintFinishFans(fanCtx,motion,stand);
    layers.clock=tick;
    layers.age=motion.age;
  }
  const x=finishStand.x-width/2,y=finishStand.y-height/2;
  ctx.drawImage(deck,x,y,width,height);
  if(stand) ctx.drawImage(fans,x,y,width,height);
}
