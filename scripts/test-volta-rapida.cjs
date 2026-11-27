const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const gameRoot=path.join(__dirname,'../public/volta-rapida');
const source=['circuit','vehicle','race'].map(name=>readFileSync(path.join(gameRoot,name+'.js'),'utf8')).join('\n');
const game=vm.runInNewContext(source+
  '\n;({TRACK,makeCircuit,tangentBends,makeTrackBarriers,raceLaps,gateCount,gateSpacing,startDistance,trackBarriers,gridPosition,racePoint,keepOutsideRails,updateRacePosition,advanceRaceGates,recordPassage,updateIntervals,carContact,driveCar,roadCar})',
  {Path2D:class{moveTo(){} lineTo(){} arc(){} closePath(){}}});

function move(car,point,time){
  const {x,y}=car;
  car.x=point.x;
  car.y=point.y;
  game.keepOutsideRails(car,x,y);
  game.updateRacePosition(car,x,y,time,1/60);
}

function trace(car,from,to,laneAt=()=>0,step=4){
  for(let s=from;Math.sign(step)*(s-to)<=0;s+=step){
    move(car,game.racePoint(s,laneAt(s)),Math.abs(s-from)/300+60);
  }
}

test('Both barriers form closed non-intersecting loops beyond the asphalt',()=>{
  const {TRACK,trackBarriers}=game;
  const {paths}=trackBarriers;
  const extent=2*TRACK.halfWidth;
  for(const [side,wall] of paths.entries()){
    let atTarget=0;
    for(let index=0;index<wall.length;index++){
      const a=wall[index],b=wall[(index+1)%wall.length];
      const offset=Math.abs(TRACK.offsetAt((a.x+b.x)/2,(a.y+b.y)/2));
      assert(offset>TRACK.halfWidth+7,'rail and its paint clear the asphalt');
      assert(offset<=extent+.001,'rail is never farther out than requested');
      if(offset>extent-.2) atTarget++;
      for(const other of trackBarriers.nearby(a.x,a.y,b.x,b.y,0)){
        if(other.wall===side && (other.a===a || other.b===a || other.a===b)) continue;
        const dx=b.x-a.x,dy=b.y-a.y,rx=other.a.x-a.x,ry=other.a.y-a.y;
        const cross=dx*other.dy-dy*other.dx;
        if(Math.abs(cross)<1e-9) continue;
        const along=(rx*other.dy-ry*other.dx)/cross;
        const across=(rx*dy-ry*dx)/cross;
        assert(!(along>1e-7 && along<1-1e-7 && across>1e-7 && across<1-1e-7),'barriers do not cross');
      }
    }
    assert(atTarget>0,'the full setback is used where it fits');
  }
});

test('A different circuit derives half-width setbacks from its own dimensions',()=>{
  const track=game.makeCircuit(10,game.tangentBends([
    [50,50,18],[200,50,18],[200,140,18],[50,140,18]
  ]));
  const rails=game.makeTrackBarriers(track,0);
  for(const wall of rails.paths) for(const p of wall){
    assert(Math.abs(Math.abs(track.offsetAt(p.x,p.y))-10)<.01);
  }
});

function insideLoop(x,y,points){
  let inside=false;
  for(const [i,a] of points.entries()){
    const b=points[(i+1)%points.length];
    if((a.y>y)!==(b.y>y) && x<a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y)) inside=!inside;
  }
  return inside;
}

test('A full-speed hit and a large displacement stay inside either wall, including the seam',()=>{
  const {TRACK,trackBarriers}=game;
  for(const [side,points] of trackBarriers.paths.entries()){
    for(const index of [...points.keys()].filter(i=>i%13===0 || i===points.length-1)){
      const a=points[index],b=points[(index+1)%points.length];
      const p=TRACK.pointAt(game.startDistance+index*TRACK.length/points.length);
      const x=(a.x+b.x)/2,y=(a.y+b.y)/2;
      const length=Math.hypot(b.x-a.x,b.y-a.y);
      const nx=(1-2*side)*(b.y-a.y)/length,ny=(1-2*side)*(a.x-b.x)/length;
      const oldX=x+nx*13.5,oldY=y+ny*13.5;
      const car={x:x+nx*7,y:y+ny*7,a:Math.atan2(-ny,-nx),vx:-410*nx,vy:-410*ny};
      game.keepOutsideRails(car,oldX,oldY);
      assert((car.x-x)*nx+(car.y-y)*ny>0);
      assert(Math.hypot(car.vx,car.vy)<410,'a wall hit dissipates speed');
      assert.equal(trackBarriers.paths.filter(path=>insideLoop(car.x,car.y,path)).length,1);
      car.x=x-nx*50;car.y=y-ny*50;
      game.keepOutsideRails(car,oldX,oldY);
      assert.equal(trackBarriers.paths.filter(path=>insideLoop(car.x,car.y,path)).length,1,'sweep prevents tunneling');
      const road=game.racePoint(index*TRACK.length/points.length,0);
      const clean={...road,vx:p.tx*410,vy:p.ty*410};
      game.keepOutsideRails(clean,road.x-p.tx*6,road.y-p.ty*6);
      assert.equal(clean.x,road.x);
      assert.equal(clean.y,road.y);
    }
  }
});

test('Laps count entirely off asphalt where the corridor allows it, in either verge',()=>{
  const length=game.TRACK.length;
  for(const side of [-1,1]){
    const wall=game.trackBarriers.paths[side===1?1:0];
    const count=wall.length;
    const car=game.gridPosition(0);
    const laneAt=s=>{
      const i=((Math.round(s/length*count)%count)+count)%count;
      const centre=game.racePoint(i*length/count,0);
      return side*Math.min(140,Math.hypot(wall[i].x-centre.x,wall[i].y-centre.y)-26);
    };
    trace(car,-26,2*length+8,laneAt);
    assert.equal(car.checkpoint,2*game.gateCount);
    assert(car.lastLapTime>0);
    assert(Math.abs(car.lane)>game.TRACK.halfWidth+23,'crossing can occur fully on the grass');
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
