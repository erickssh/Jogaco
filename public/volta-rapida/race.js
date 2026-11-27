// Positions are measured from the start line, including the negative distance
// occupied by the grid. A single centreline serves both bots and standings.
const raceLaps=3;
const raceLength=raceLaps*TRACK.length;
const difficultySettings={
  facil:{topSpeed:roadCar.topSpeed*.94,cornerGrip:570,braking:250,previewTime:.34,driftTime:.17},
  medio:{topSpeed:roadCar.topSpeed*.97,cornerGrip:700,braking:285,previewTime:.48,driftTime:.22},
  dificil:{topSpeed:roadCar.topSpeed,cornerGrip:820,braking:290,previewTime:.68,driftTime:.28}
};
const opponentPaint=[
  ['#285b84','#5195c8','#87c6e6','#234561','#e8f2e8'],
  ['#aa7925','#e5b748','#fae184','#6e501e','#fff5cb'],
  ['#3c6c42','#6ea76b','#add77f','#32543a','#ebedac'],
  ['#624777','#a377b3','#c6a5ce','#51395f','#ece0c6'],
  ['#a85932','#e39656','#ffc58b','#7b432b','#fff0c9'],
  ['#277275','#52aaa1','#99d9c2','#225253','#ecf0c7'],
  ['#60667a','#b9bec5','#eef0ec','#434b5e','#363b53']
];
const gridSpacing=29;
const gridLead=-29;
const gridLane=32;
const racingLanes=[-55,-24,24,55];
const samplesPerLap=Math.ceil(TRACK.length/6);
const sampleDistance=TRACK.length/samplesPerLap;
const raceRoute=Array.from({length:samplesPerLap},(_,i)=>TRACK.pointAt(startDistance+i*sampleDistance));

const gateCount=trackBarriers.gates.length;
const gateSpacing=TRACK.length/gateCount;

function routeIndex(index){
  return ((index%samplesPerLap)+samplesPerLap)%samplesPerLap;
}

function racePoint(progress,lane){
  const p=TRACK.pointAt(startDistance+progress);
  return {x:p.x+p.ty*lane,y:p.y-p.tx*lane,a:Math.atan2(p.ty,p.tx),curvature:p.curvature};
}

function gridPosition(slot){
  const progress=gridLead-slot*gridSpacing;
  const lane=slot%2?-gridLane:gridLane;
  return {...racePoint(progress,lane),progress,lane,standing:progress,
    checkpoint:0,routeGate:Math.floor(progress/gateSpacing),finishedAt:Infinity,lapStartedAt:0,lastLapTime:null,lapEndedAt:null,
    motionHistory:[{distance:progress,time:0}],gapTo:null,gap:null,
    vx:0,vy:0,spin:0,drifting:false,lastSkid:null};
}

// Find the nearest centreline point within the current timing sector.
function measureRaceProgress(x,y,from,to){
  let distance=Infinity,progress=from*sampleDistance;
  for(let i=from;i<to;i++){
    const a=raceRoute[routeIndex(i)], b=raceRoute[routeIndex(i+1)];
    const dx=b.x-a.x,dy=b.y-a.y;
    const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)));
    const squared=(x-a.x-t*dx)**2+(y-a.y-t*dy)**2;
    if(squared<distance){
      distance=squared;
      progress=(i+t)*sampleDistance;
    }
  }
  return progress;
}

// Find a smooth line within the drivable width. The cost penalizes rapid
// heading changes across several samples, so shallow bends can share a chord.
function buildRacingLine(){
  const count=Math.ceil(TRACK.length/28);
  const spacing=TRACK.length/count;
  const nodes=Array.from({length:count},(_,i)=>TRACK.pointAt(startDistance+i*spacing));
  const maxLane=TRACK.halfWidth-31;
  const offsets=new Float64Array(count), momentum=new Float64Array(count);
  const next=new Float64Array(count), xs=new Float64Array(count), ys=new Float64Array(count);
  const wrap=i=>(i+count)%count;
  for(let pass=0;pass<760;pass++){
    nodes.forEach((node,i)=>{
      xs[i]=node.x+node.ty*momentum[i];
      ys[i]=node.y-node.tx*momentum[i];
    });
    nodes.forEach((node,i)=>{
      const a=wrap(i-2),b=wrap(i-1),c=wrap(i+1),d=wrap(i+2);
      const gx=xs[a]-4*xs[b]+6*xs[i]-4*xs[c]+xs[d];
      const gy=ys[a]-4*ys[b]+6*ys[i]-4*ys[c]+ys[d];
      // Favor shorter paths as well as smooth turns, to bring the line
      // toward the inside of the apex without introducing sharp changes.
      const chordX=2*xs[i]-xs[b]-xs[c];
      const chordY=2*ys[i]-ys[b]-ys[c];
      const gradient=(gx+.05*chordX)*node.ty-(gy+.05*chordY)*node.tx+.00035*momentum[i];
      next[i]=Math.max(-maxLane,Math.min(maxLane,momentum[i]-.055*gradient));
    });
    const boost=pass/(pass+3);
    for(let i=0;i<count;i++){
      momentum[i]=next[i]+boost*(next[i]-offsets[i]);
      offsets[i]=next[i];
    }
  }
  return progress=>{
    const index=Math.floor(progress/spacing);
    const t=progress/spacing-index;
    const i=((index%count)+count)%count;
    const a=offsets[wrap(i-1)],b=offsets[i],c=offsets[wrap(i+1)],d=offsets[wrap(i+2)];
    const lane=b+.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));
    return Math.max(-maxLane,Math.min(maxLane,lane));
  };
}

const racingLineAt=buildRacingLine();
const linePoints=raceRoute.map((_,i)=>{
  const progress=i*sampleDistance;
  return racePoint(progress,racingLineAt(progress));
});

function lineCurvature(index,radius){
  const a=linePoints[routeIndex(index-radius)],b=linePoints[routeIndex(index)],c=linePoints[routeIndex(index+radius)];
  const first=Math.atan2(b.y-a.y,b.x-a.x),second=Math.atan2(c.y-b.y,c.x-b.x);
  return angleBetween(second,first)/(Math.hypot(b.x-a.x,b.y-a.y)+Math.hypot(c.x-b.x,c.y-b.y))*2;
}

const lineCurve=raceRoute.map((_,i)=>lineCurvature(i,8)*.7+lineCurvature(i,15)*.3);

function prepareSpeedLimits(settings){
  const limits=lineCurve.map(curve=>Math.min(settings.topSpeed,
    Math.sqrt(settings.cornerGrip/Math.max(.0001,Math.abs(curve)))));
  // Walk backwards around the loop to brake before bends, including the seam.
  for(let i=2*samplesPerLap-1;i>=0;i--){
    const index=routeIndex(i),next=limits[routeIndex(i+1)];
    limits[index]=Math.min(limits[index],Math.sqrt(next*next+2*settings.braking*sampleDistance));
  }
  return limits;
}
const difficultyProfiles=Object.fromEntries(Object.entries(difficultySettings).map(([key,settings])=>
  [key,{...settings,limits:prepareSpeedLimits(settings)}]));

function createOpponents(difficulty){
  const profile=difficultyProfiles[difficulty];
  return opponentPaint.map((paint,index)=>{
    const slot=index;
    return {...gridPosition(slot), id:index+1, paint, profile,spec:roadCar,speedLimit:profile.topSpeed,driftUntil:0,driftReady:0,stalledSince:null,reverseUntil:0,escapeDirection:1,
      pace:[1.01,.993,.962,1.023,.985,1.004,.974][index],
      reaction:(difficulty==='dificil'?.025:.10)+(index*5%7)*.019,
      laneGoal:slot%2?-gridLane:gridLane, passUntil:0, lineBias:(index-3)*1.7};
  });
}

function circuitGap(a,b){
  const gap=a-b;
  return gap-Math.round(gap/TRACK.length)*TRACK.length;
}

function chooseOpponentLane(bot,traffic,ideal,elapsed){
  const current=elapsed<bot.passUntil?bot.laneGoal:ideal;
  const obstruction=traffic.find(other=>other.id!==bot.id &&
    Math.abs(other.lane-current)<27 && circuitGap(other.progress,bot.progress)>0 &&
    circuitGap(other.progress,bot.progress)<124);
  if(!obstruction){
    if(elapsed>=bot.passUntil) bot.laneGoal=ideal;
    return;
  }
  const alternatives=[...racingLanes].sort((a,b)=>Math.abs(a-ideal)-Math.abs(b-ideal));
  for(const lane of alternatives){
    if(Math.abs(lane-obstruction.lane)<34) continue;
    const blocked=traffic.some(other=>other.id!==bot.id &&
      Math.abs(other.lane-lane)<27 && Math.abs(circuitGap(other.progress,bot.progress)-22)<79);
    if(!blocked){
      bot.laneGoal=lane;
      bot.passUntil=elapsed+1.15;
      return;
    }
  }
}

function opponentControls(bot,traffic,elapsed){
  if(elapsed<bot.reaction) return {throttle:0,steer:0,drift:false};
  const {profile}=bot;
  const speed=Math.hypot(bot.vx,bot.vy);
  const far=45+speed*profile.previewTime;
  const index=Math.round(bot.progress/sampleDistance);
  const corner=lineCurve[routeIndex(index+7)];
  const deepCorner=lineCurve[routeIndex(index+15)];
  const ideal=racingLineAt(bot.progress+far)+bot.lineBias;
  const leavingGrid=bot.progress<190 && elapsed<2.05;
  const startLane=(bot.id-1)%2?-gridLane:gridLane;
  chooseOpponentLane(bot,traffic,leavingGrid?startLane:ideal,elapsed);
  if(speed>20) bot.stalledSince=null;
  else if(bot.stalledSince===null) bot.stalledSince=elapsed;
  if(elapsed<bot.reverseUntil) return {throttle:-.42,steer:bot.escapeDirection,drift:false};
  if(bot.stalledSince!==null && elapsed-bot.stalledSince>1.2){
    bot.stalledSince=null;
    bot.reverseUntil=elapsed+.92;
    const side=bot.laneGoal>bot.lane?1:-1;
    bot.escapeDirection=-side;
    return {throttle:-.42,steer:bot.escapeDirection,drift:false};
  }
  const onGrass=Math.abs(bot.lane)>TRACK.halfWidth;
  const recovering=Math.abs(bot.lane)>TRACK.halfWidth*.95;
  const passing=elapsed<bot.passUntil;
  const stayInLane=leavingGrid||passing;
  const reach=recovering?Math.min(72,far):passing?Math.min(far,44+speed*.21):far;
  const lineLane=racingLineAt(bot.progress+reach)+bot.lineBias;
  const targetLane=stayInLane?bot.laneGoal:lineLane;
  const next=racePoint(bot.progress+reach,recovering?0:Math.max(-61,Math.min(61,targetLane)));
  const steerError=angleBetween(Math.atan2(next.y-bot.y,next.x-bot.x),bot.a);
  const sample=routeIndex(Math.floor((bot.progress+9)/sampleDistance));
  let target=profile.limits[sample]*bot.pace;
  if(recovering) target=Math.min(target,onGrass?145:220);
  if(Math.abs(steerError)>1.02) target=Math.min(target,115);
  for(const other of traffic){
    if(other.id===bot.id) continue;
    const gap=circuitGap(other.progress,bot.progress);
    if(gap>0 && gap<94 && Math.abs(other.lane-bot.lane)<26){
      const crawl=passing && Math.abs(other.lane-bot.laneGoal)>29 ? 32 : 0;
      const nextSpeed=Math.max(crawl,(gap-42)*8+other.speed*.70);
      target=Math.min(target,nextSpeed);
    }
  }

  // Reserve the handbrake for sustained curvature near the apex.
  if(elapsed>=bot.driftReady && !recovering && speed>158 &&
     Math.abs(corner)>.0052 && Math.abs(deepCorner)>.0044 && corner*deepCorner>0 &&
     Math.abs(steerError)>.09 && Math.abs(steerError)<.88 && corner*steerError>0 &&
     Math.abs(corner)*speed>1.04){
    bot.driftUntil=elapsed+profile.driftTime;
    bot.driftReady=bot.driftUntil+.12;
  }
  const drift=elapsed<bot.driftUntil && !recovering && Math.abs(steerError)>.105;
  const trim=.38+(target-speed)/24;
  // A small overshoot is handled by easing off, without touching the brake.
  const request=target>80 && speed-target<15 ? Math.max(.06,trim) : trim;
  const throttle=Math.max(speed<9||target<8?0:-1,Math.min(1,target<8?-speed/26:request));
  const steer=Math.max(-1,Math.min(1,steerError*(drift?3.55:2.55)+(recovering||drift?0:deepCorner*speed*0.36)));
  return {throttle,steer,drift};
}

function refreshRacePosition(car){
  // The adjacent timing lines identify the correct stretch, including on
  // the grass in a hairpin where two stretches can be close together.
  const from=Math.floor(car.routeGate*gateSpacing/sampleDistance);
  const to=Math.ceil((car.routeGate+1)*gateSpacing/sampleDistance);
  car.progress=measureRaceProgress(car.x,car.y,from,to);
}

// The line spans both barriers. Count forward crossings and undo progress
// when traversing the same line in reverse.
function crossTimingLine(index,oldX,oldY,x,y,direction){
  const gate=trackBarriers.gates[((index%gateCount)+gateCount)%gateCount];
  const {point,right,left}=gate;
  const before=(oldX-point.x)*point.tx+(oldY-point.y)*point.ty;
  const after=(x-point.x)*point.tx+(y-point.y)*point.ty;
  if(direction===1?before>=0 || after<0:before<0 || after>=0) return null;
  const t=before/(before-after);
  const offset=(oldX+(x-oldX)*t-point.x)*point.ty-(oldY+(y-oldY)*t-point.y)*point.tx;
  const min=(right.x-point.x)*point.ty-(right.y-point.y)*point.tx;
  const max=(left.x-point.x)*point.ty-(left.y-point.y)*point.tx;
  return offset>=min-1e-6 && offset<=max+1e-6?t:null;
}

function advanceRaceGates(car,oldX,oldY,elapsed,dt){
  if(Number.isFinite(car.finishedAt)) return;
  let lastCrossing=-1;
  while(true){
    const next=car.routeGate+1;
    const forward=crossTimingLine(next,oldX,oldY,car.x,car.y,1);
    const reverse=crossTimingLine(car.routeGate,oldX,oldY,car.x,car.y,-1);
    if(reverse!==null && reverse>lastCrossing && (forward===null || reverse<forward)){
      car.routeGate--;
      lastCrossing=reverse;
      continue;
    }
    if(forward===null || forward<=lastCrossing) break;
    car.routeGate=next;
    lastCrossing=forward;
    if(next!==car.checkpoint+gateCount) continue;
    const crossedAt=Math.max(0,elapsed-dt*(1-forward));
    car.checkpoint=next;
    car.lastLapTime=crossedAt-car.lapStartedAt;
    car.lapEndedAt=car.lapStartedAt=crossedAt;
    if(next===raceLaps*gateCount){
      car.finishedAt=crossedAt;
      break;
    }
  }
}

function updateRacePosition(car,oldX,oldY,elapsed,dt){
  car.lane=TRACK.offsetAt(car.x,car.y);
  if(Number.isFinite(car.finishedAt)) return;
  advanceRaceGates(car,oldX,oldY,elapsed,dt);
  refreshRacePosition(car);
  car.standing=Number.isFinite(car.finishedAt)?raceLength:Math.min(raceLength,car.progress);
  recordPassage(car,Number.isFinite(car.finishedAt)?car.finishedAt:elapsed);
}

function raceOrder(drivers){
  return [...drivers].sort((a,b)=>a===b?0:aheadInRace(a,b)?-1:1);
}

// Record where this driver actually was on the race clock. Sampling at 10 Hz
// retains stops and speed changes without storing an entire physics replay.
function recordPassage(car,time){
  const history=car.motionHistory, distance=car.standing;
  while(history.length && history[history.length-1].distance>distance) history.pop();
  let last=history[history.length-1];
  if(car.observedDistance!==distance){
    car.observedDistance=distance;
    car.arrivedAt=time;
  }else if(last && last.distance!==distance){
    // Store the exact onset of a stop between regular samples.
    last={distance,time:car.arrivedAt};
    history.push(last);
  }
  if(last && time-last.time<.1 && !Number.isFinite(car.finishedAt)) return;
  if(last && distance===last.distance && history[history.length-2]?.distance===distance){
    last.time=time;
  }else history.push({distance,time});
}

function passageAt(car,distance,elapsed){
  const points=car.motionHistory;
  if(!points.length || distance<points[0].distance || distance>car.standing) return null;
  // First arrival at this point. If the leader parked here, the gap to a
  // pursuing car still reflects the leader's actual arrival and departure.
  let low=0,high=points.length;
  while(low<high){
    const mid=(low+high)>>>1;
    if(points[mid].distance<distance) low=mid+1;
    else high=mid;
  }
  const after=points[low]??{distance:car.standing,time:elapsed};
  if(after.distance===distance) return after.time;
  const before=points[low-1];
  if(!before) return null;
  const fraction=(distance-before.distance)/(after.distance-before.distance);
  return before.time+fraction*(after.time-before.time);
}

function updateIntervals(drivers,elapsed){
  const sorted=raceOrder(drivers);
  sorted.forEach((driver,index)=>{
    driver.gap=null;
    const ahead=sorted[index-1];
    driver.gapTo=ahead?.id??null;
    if(!ahead || Number.isFinite(driver.finishedAt)) return;
    const passed=passageAt(ahead,driver.standing,elapsed);
    const arrived=passageAt(driver,driver.standing,elapsed);
    if(passed!==null && arrived!==null) driver.gap=Math.max(0,arrived-passed);
  });
}

function advanceField(car,bots,controls,dt,elapsed){
  const drivers=[car,...bots];
  if(dt<=0) return;
  const substeps=Math.ceil(dt*60);
  const step=dt/substeps;
  for(let i=0;i<substeps;i++) advanceRacers(drivers,()=>controls,step,elapsed-dt+(i+1)*step);
}

function advanceRacers(drivers,controlsFor,dt,elapsed){
  const movement=drivers.map(driver=>({x:driver.x,y:driver.y}));
  const traffic=drivers.filter(driver=>!Number.isFinite(driver.finishedAt)).map(({id,progress,lane,vx,vy})=>({id,progress,lane,speed:Math.hypot(vx,vy)}));
  for(const driver of drivers){
    if(Number.isFinite(driver.finishedAt)){
      driveCar(driver,{throttle:0,steer:0,drift:false},dt);
      continue;
    }
    const controls=driver.profile?opponentControls(driver,traffic,elapsed):controlsFor(driver);
    driveCar(driver,controls,dt);
  }
  for(let a=0;a<drivers.length;a++){
    for(let b=a+1;b<drivers.length;b++) carContact(drivers[a],drivers[b]);
  }
  drivers.forEach((driver,i)=>{
    keepInsideMap(driver);
    const {x,y}=movement[i];
    keepOutsideRails(driver,x,y);
    keepOutsideScenery(driver,x,y);
    updateRacePosition(driver,x,y,elapsed,dt);
  });
}

function aheadInRace(a,b){
  if(a.finishedAt!==b.finishedAt) return a.finishedAt<b.finishedAt;
  return a.standing>b.standing || (a.standing===b.standing && a.id<b.id);
}

function leadingProgress(car,bots){
  let leader=Number.isFinite(car.finishedAt)?-Infinity:car.standing;
  for(const bot of bots){
    if(!Number.isFinite(bot.finishedAt)) leader=Math.max(leader,bot.standing);
  }
  return leader;
}
