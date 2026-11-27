const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const gameRoot=path.join(__dirname,'../public/volta-rapida');
const source=['car-models','circuit','vehicle','race'].map(name=>readFileSync(path.join(gameRoot,name+'.js'),'utf8')).join('\n');
const game=vm.runInNewContext(source+
  '\n;({TRACK,makeCircuit,tangentBends,makeCourseRunoff,timingGates,raceLaps,gateCount,gateSpacing,startDistance,trackBarriers,runoffBarriers,gridPosition,racePoint,keepOutsideRails,resolveRailContacts,resolveRaceEnvironment,updateRacePosition,advanceRaceGates,recordPassage,updateIntervals,carContact,driveCar,roadCar})',
  {Path2D:class{moveTo(){} lineTo(){} arc(){} closePath(){}}});

function move(car,point,time){
  const {x,y}=car;
  car.x=point.x;
  car.y=point.y;
  game.resolveRaceEnvironment(car,x,y);
  game.updateRacePosition(car,x,y,time,1/60);
}

function trace(car,from,to,laneAt=()=>0,step=4){
  for(let s=from;Math.sign(step)*(s-to)<=0;s+=step){
    move(car,game.racePoint(s,laneAt(s)),Math.abs(s-from)/300+60);
  }
}

test('The two walls hug the marked inside edges, with no wall on the opposite side',()=>{
  const {TRACK,trackBarriers}=game;
  assert.equal(trackBarriers.paths.length,2);
  let length=0;
  for(const points of trackBarriers.paths){
    assert.notDeepEqual(points[0],points.at(-1));
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];
      length+=Math.hypot(b.x-a.x,b.y-a.y);
      for(let t=0;t<=1;t+=.05){
        const offset=TRACK.offsetAt(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);
        assert(Math.abs(offset-TRACK.halfWidth)<.3,'wall follows the inside edge');
      }
    }
  }
  assert(length<TRACK.length*.20);
});

test('Both walls stop high speed cuts while the car is still on asphalt',()=>{
  const {TRACK,trackBarriers}=game;
  for(const points of trackBarriers.paths){
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];
      const length=Math.hypot(b.x-a.x,b.y-a.y);
      for(const t of [0,.5,1]){
        const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
        const nx=(a.y-b.y)/length,ny=(b.x-a.x)/length;
        const oldX=x+nx*32,oldY=y+ny*32;
        const car={x:x-nx*48,y:y-ny*48,a:Math.atan2(-ny,-nx),vx:-410*nx,vy:-410*ny};
        const heading=car.a;
        game.keepOutsideRails(car,oldX,oldY);
        assert((car.x-x)*nx+(car.y-y)*ny>0,'sweep prevents tunneling');
        assert(Math.abs(TRACK.offsetAt(car.x,car.y))<TRACK.halfWidth);
        assert(Math.hypot(car.vx,car.vy)<220);
        assert.equal(car.a,heading);
      }
    }
  }
});

test('The invisible boundaries form two closed, nonintersecting loops off asphalt',()=>{
  const {TRACK,runoffBarriers}=game;
  assert.equal(runoffBarriers.paths.length,2);
  for(const wall of runoffBarriers.paths){
    let fullWidth=0;
    for(let i=0;i<wall.length;i++){
      const a=wall[i],b=wall[(i+1)%wall.length];
      const nearby=runoffBarriers.nearby(a.x,a.y,b.x,b.y,0);
      assert([...nearby].some(segment=>segment.a===a && segment.b===b),'no gaps, including the seam');
      const distance=Math.abs(TRACK.offsetAt((a.x+b.x)/2,(a.y+b.y)/2));
      assert(distance>TRACK.halfWidth+7 && distance<=2*TRACK.halfWidth+.01);
      if(distance>2*TRACK.halfWidth-.1) fullWidth++;
      for(const other of nearby){
        const dx=b.x-a.x,dy=b.y-a.y,rx=other.a.x-a.x,ry=other.a.y-a.y;
        const cross=dx*other.dy-dy*other.dx;
        if(Math.abs(cross)<1e-9) continue;
        const along=(rx*other.dy-ry*other.dx)/cross;
        const across=(rx*dy-ry*dx)/cross;
        assert(!(along>1e-7 && along<1-1e-7 && across>1e-7 && across<1-1e-7),'closed boundaries cannot cross');
      }
    }
    assert(fullWidth>wall.length/4,'open sections use the full setback');
  }
});

test('Both invisible boundaries stop full speed contact and swept displacements',()=>{
  const {runoffBarriers}=game;
  for(const [side,points] of runoffBarriers.paths.entries()){
    for(const i of [...points.keys()].filter(i=>i%11===0 || i===points.length-1)){
      const a=points[i],b=points[(i+1)%points.length];
      const x=(a.x+b.x)/2,y=(a.y+b.y)/2;
      const length=Math.hypot(b.x-a.x,b.y-a.y);
      const sign=side===1?1:-1;
      const nx=sign*(a.y-b.y)/length,ny=sign*(b.x-a.x)/length;
      for(const target of [18,-45]){
        const oldX=x+nx*29,oldY=y+ny*29;
        const car={x:x+nx*target,y:y+ny*target,a:Math.atan2(-ny,-nx),vx:-410*nx,vy:-410*ny};
        game.resolveRailContacts(car,oldX,oldY,runoffBarriers);
        assert((car.x-x)*nx+(car.y-y)*ny>0,'car stays on the road side of the invisible boundary');
        assert(Math.hypot(car.vx,car.vy)<410,'impact reduces speed');
      }
    }
  }
});

test('The car may cross the finish line entirely on either grass verge and still count the lap',()=>{
  const {TRACK}=game;
  for(const side of [-1,1]){
    const car=game.gridPosition(0);
    const lane=s=>side*145*Math.max(0,Math.min(1,(s-TRACK.length+135)/120));
    trace(car,-26,TRACK.length+8,lane,2);
    assert.equal(car.checkpoint,game.gateCount);
    assert(car.lastLapTime>0);
    assert(Math.abs(car.lane)>TRACK.halfWidth+20);
  }
});

test('Multiplayer host snapshots and guest prediction enforce the same runoff',()=>{
  const online=readFileSync(path.join(gameRoot,'online-race.js'),'utf8');
  const match={id:'test-runoff',difficulty:'medio',fillBots:false,players:[
    {name:'Anfitrião',carModel:'agulha'},{name:'Convidado',carModel:'cupim'}
  ]};
  function peer(host,id){
    let listener,now=100;
    const packets=[];
    const parent={},origin='http://localhost';
    const api=vm.runInNewContext(source+
      '\nlet car,bots,done=false,elapsed=0,raceClosed=false,difficulty; const ready=true,externalMenu=false;'+
      '\nconst camera={},setup={},positionEl={},canvas={focus(){}},raceNotice={},playerPaint=[];'+
      '\nfunction raceControls(){return {throttle:1,steer:0,drift:false};}'+
      '\nfunction reset(){} function updateRaceHud(){} function renderStandings(){} function collectIntervals(){}\n'+
      online+'\n;({onlineRace, own:()=>car, opponents:()=>bots})',
      {parent,location:{origin},performance:{now:()=>now},document:{querySelector:()=>({})},
        addEventListener:(_,handler)=>{listener=handler;},
        Path2D:class{moveTo(){} lineTo(){} arc(){} closePath(){}}});
    const port={postMessage:packet=>packets.push(packet)};
    listener({source:parent,origin,data:{type:'vr-connect'},ports:[port]});
    const receive=(type,payload)=>port.onmessage({data:{type,payload}});
    receive('start',{match,host,id});
    return {api,packets,receive,tick:(time,dt)=>{now=time;api.onlineRace.tick(dt,now);}};
  }
  const host=peer(true,8),guest=peer(false,7);
  const remote=host.api.opponents()[0];
  assert.equal(host.api.own().carModel,'agulha');
  assert.equal(remote.carModel,'cupim');
  assert.equal(guest.api.own().carModel,'cupim');
  assert.equal(guest.api.opponents()[0].carModel,'agulha');
  function replicate(now,dt=0){
    host.tick(now,dt);
    const packet=host.packets.at(-1);
    assert.equal(packet.type,'snapshot');
    guest.tick(now,0);
    guest.receive('snapshot',packet.payload);
  }

  const approach=game.racePoint(200,153);
  const axis=game.TRACK.pointAt(game.startDistance+200);
  Object.assign(remote,approach,{a:Math.atan2(-axis.tx,axis.ty),vx:410*axis.ty,vy:-410*axis.tx,lane:153});
  replicate(5000);
  for(let i=1;i<=5;i++){
    guest.tick(5000+i*17,1/60);
    host.tick(5000+i*17,1/60);
  }
  for(const driver of [remote,guest.api.own()]){
    assert(driver.lane>=153 && driver.lane<171);
    assert(Math.hypot(driver.vx,driver.vy)<30);
  }

  const finish=game.racePoint(game.TRACK.length-1,125);
  Object.assign(remote,finish,{lane:125,vx:190*Math.cos(finish.a),vy:190*Math.sin(finish.a),
    routeGate:game.gateCount-1,checkpoint:0});
  replicate(5200,1/60);
  assert.equal(remote.checkpoint,game.gateCount);
  assert.equal(guest.api.own().checkpoint,game.gateCount);
  assert(guest.api.own().lastLapTime>0);
  assert(guest.api.own().lane>game.TRACK.halfWidth+20);
});

test('Cutting across the northern hairpin or southwest loop cannot credit a lap',()=>{
  const length=game.TRACK.length;
  for(const [from,to] of [[3100,4060],[3225,3946],[5850,6720],[5990,6640]]){
    const car=game.gridPosition(0);
    trace(car,-26,from);
    const a=game.racePoint(from,0),b=game.racePoint(to,0);
    // Even a detour around the end of the fence must visit the intervening
    // timing lines. Bypass physical contact here to exercise that safeguard.
    for(let i=1;i<=140;i++){
      const {x,y}=car;
      car.x=a.x+(b.x-a.x)*i/140;
      car.y=a.y+(b.y-a.y)*i/140;
      game.updateRacePosition(car,x,y,30+i/60,1/60);
    }
    trace(car,to,length+8);
    assert.equal(car.checkpoint,0);
  }
});

test('Crossing the line in reverse and repeating the finish stripe cannot add a lap',()=>{
  const {TRACK,gateCount}=game;
  const car=game.gridPosition(0);
  trace(car,-26,70);
  for(let repeat=0;repeat<8;repeat++){
    trace(car,70,-25,()=>0,-3);
    trace(car,-25,70);
  }
  assert.equal(car.checkpoint,0);
  trace(car,70,-TRACK.length-12,()=>0,-3);
  assert.equal(car.checkpoint,0);
  assert(car.routeGate<-gateCount+1);
  trace(car,-TRACK.length-12,TRACK.length+6);
  assert.equal(car.checkpoint,gateCount);
});

test('Glancing contact with the wheel held cannot reverse steering',()=>{
  for(const turn of [-1,1]){
    for(const swapped of [true,false]){
      const car={...game.gridPosition(0),x:0,y:0,a:turn*.77,spec:game.roadCar,
        vx:230*Math.cos(.77),vy:turn*230*Math.sin(.77)};
      const other={...game.gridPosition(1),x:-5,y:turn*9,a:0,vx:170,vy:0,spec:game.roadCar};
      const initial=car.a;
      if(swapped) game.carContact(other,car);
      else game.carContact(car,other);
      for(let frame=0;frame<10;frame++){
        const before=car.a;
        game.driveCar(car,{throttle:1,steer:turn,drift:false},1/60);
        game.driveCar(other,{throttle:1,steer:0,drift:false},1/60);
        assert(turn*(car.a-before)>0);
        game.carContact(car,other);
      }
      assert(turn*(car.a-initial)>.12);
      assert.equal(other.a,0);
    }
  }
});

test('Fast legal lines with tyres riding the kerb complete the entire lap',()=>{
  const length=game.TRACK.length;
  for(const [from,to,lane] of [[450,1070,-86],[550,1310,0],[650,1270,86]]){
    const car=game.gridPosition(0);
    trace(car,-26,from,()=>lane);
    const a=game.racePoint(from,lane),b=game.racePoint(to,lane);
    let maxDepth=0;
    for(let i=1;i<=140;i++){
      move(car,{x:a.x+(b.x-a.x)*i/140,y:a.y+(b.y-a.y)*i/140},(from+(to-from)*i/140+30)/300);
      maxDepth=Math.max(maxDepth,Math.abs(car.lane)-game.TRACK.halfWidth);
    }
    trace(car,to,length+6,()=>lane);
    assert(maxDepth>8 && maxDepth<11);
    assert.equal(car.checkpoint,game.gateCount);
    assert(car.lastLapTime>0);
  }
});

test('Gaps reflect the preceding driver’s actual movement, stops, and finishing time',()=>{
  const makeDriver=id=>({...game.gridPosition(0),id,standing:0,motionHistory:[]});
  const leader=makeDriver(1),second=makeDriver(2),third=makeDriver(3);
  for(let n=0;n<=80;n++){
    const time=n/10;
    leader.standing=Math.min(600,100*time);
    second.standing=time<=2?100*time:time<=4?200:200+75*(time-4);
    third.standing=Math.max(0,(time-4.5)*100);
    if(time<=6) game.recordPassage(leader,time);
    game.recordPassage(second,time);
    game.recordPassage(third,time);
  }
  leader.finishedAt=6;
  game.updateIntervals([third,second,leader],8);
  assert.equal(leader.gap,null);
  assert(Math.abs(second.gap-3)<.001); // leader passed 500 at 5 s
  assert(Math.abs(third.gap-2)<.001);  // second passed 350 at 6 s
  assert.equal(third.gapTo,second.id);
  // Park at 350 for three seconds. Waiting in place cannot change a measured split.
  game.recordPassage(third,11);
  game.updateIntervals([leader,second,third],11);
  assert(Math.abs(third.gap-2)<.01);
  const arriving=makeDriver(4);
  arriving.standing=199;
  game.recordPassage(arriving,8);
  game.updateIntervals([leader,second,arriving],8);
  assert(Math.abs(arriving.gap-6.01)<.02); // arrival just before the stop
  arriving.standing=201;
  game.updateIntervals([leader,second,arriving],8);
  assert(Math.abs(arriving.gap-(4-1/75))<.12); // passage after departure
});

test('Lap and finish times use the fraction of the tick when the car crosses',()=>{
  const car=game.gridPosition(0),length=game.TRACK.length;
  for(let lap=1;lap<=game.raceLaps;lap++){
    const before=game.racePoint(lap*length-1,0),after=game.racePoint(lap*length+3,0);
    Object.assign(car,{x:after.x,y:after.y,routeGate:lap*game.gateCount-1,checkpoint:(lap-1)*game.gateCount});
    game.advanceRaceGates(car,before.x,before.y,20*lap+.04,.04);
    assert(Math.abs(car.lapEndedAt-(20*lap+.01))<1e-8);
    assert(Math.abs(car.lastLapTime-(lap===1?20.01:20))<1e-8);
  }
  assert(Math.abs(car.finishedAt-60.01)<1e-8);
});

test('All eight staggered grid slots leave clearance for the largest cars',()=>{
  const {maxWidth,maxLength}=require('../public/volta-rapida/car-models');
  const slots=Array.from({length:8},(_,i)=>game.gridPosition(i));
  const step=slots[0].progress-slots[1].progress;
  assert(-slots[0].progress > maxLength/2 + 4 + game.TRACK.halfWidth/10 + 8, 'first grid marking clears the finish stripe');
  for(let i=0;i<slots.length;i++){
    const slot=slots[i];
    assert(Math.abs(slot.lane)+maxWidth/2<game.TRACK.halfWidth);
    if(i){
      assert.equal(slots[i-1].progress-slot.progress,step);
      assert(Math.abs(slots[i-1].lane-slot.lane)-maxWidth>=25);
    }
    if(i>=2){
      assert.equal(slot.lane,slots[i-2].lane);
      assert(Math.hypot(slots[i-2].x-slot.x,slots[i-2].y-slot.y)-maxLength>=25);
    }
  }
});

test('Every model pair makes contact at its own bumper and side dimensions',()=>{
  const {carModels,sizeForModel}=require('../public/volta-rapida/car-models');
  for(const a of carModels) for(const b of carModels){
    const first=sizeForModel(a.id),second=sizeForModel(b.id);
    for(const angle of [0,.64,1.57]) for(const side of [false,true]){
      const axis=angle+(side?Math.PI/2:0);
      const span=side ? first.halfWidth+second.halfWidth : first.halfLength+second.halfLength;
      for(const clearance of [-1,1]){
        const follower={x:0,y:0,a:angle,vx:0,vy:0,carModel:a.id};
        const leader={...follower,carModel:b.id,x:Math.cos(axis)*(span+clearance),y:Math.sin(axis)*(span+clearance)};
        const before=Math.hypot(leader.x,leader.y);
        game.carContact(follower,leader);
        const after=Math.hypot(leader.x-follower.x,leader.y-follower.y);
        if(clearance<0) assert(after-before>.7);
        else assert.equal(after,before);
      }
    }
  }
});
