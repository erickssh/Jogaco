const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const gameRoot=path.join(__dirname,'../public/volta-rapida');
const source=['circuit','vehicle','race'].map(name=>readFileSync(path.join(gameRoot,name+'.js'),'utf8')).join('\n');
const game=vm.runInNewContext(source+
  '\n;({TRACK,raceLaps,gateCount,gateSpacing,gridPosition,racePoint,refreshRacePosition,advanceRaceGates,recordPassage,updateIntervals,carContact,driveCar,roadCar})',
  {Path2D:class{moveTo(){} lineTo(){} arc(){} closePath(){}}});

function move(car,point,time){
  const {x,y}=car;
  car.x=point.x;
  car.y=point.y;
  game.refreshRacePosition(car);
  game.advanceRaceGates(car,x,y,time,1/60);
}

function trace(car,from,to,laneAt=()=>0){
  for(let s=from;s<=to;s+=4) move(car,game.racePoint(s,laneAt(s)),(s+30)/300);
}

test('Grass following the course counts, but a shortcut cannot be redeemed downstream',()=>{
  const length=game.TRACK.length;
  const wide=game.gridPosition(0);
  trace(wide,-26,length+6,s=>115*Math.max(0,1-Math.abs(s-300)/150));
  assert.equal(wide.checkpoint,game.gateCount);
  for(const [from,to] of [[2352,3212],[714,1354],[3115,4180]]){
    const car=game.gridPosition(0);
    trace(car,-26,from);
    const start=game.racePoint(from,0),end=game.racePoint(to,0);
    for(let i=1;i<=180;i++){
      move(car,{x:start.x+(end.x-start.x)*i/180,y:start.y+(end.y-start.y)*i/180},20);
    }
    trace(car,to,length+5);
    assert.equal(car.checkpoint,0);
    assert.equal(car.missedLap,true);
    trace(car,length+8,2*length+8);
    assert.equal(car.checkpoint,game.gateCount);
  }
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
    Object.assign(car,{x:after.x,y:after.y,previousProgress:lap*length-1,progress:lap*length+3,
      checkpoint:lap*game.gateCount-1,lane:0});
    game.advanceRaceGates(car,before.x,before.y,20*lap+.04,.04);
    assert(Math.abs(car.lapEndedAt-(20*lap+.01))<1e-8);
    assert(Math.abs(car.lastLapTime-(lap===1?20.01:20))<1e-8);
  }
  assert(Math.abs(car.finishedAt-60.01)<1e-8);
});
