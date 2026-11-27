// World-space handling profile. Future cars can override these three values.
const roadCar={acceleration:210,topSpeed:410,turn:1};
const kilometersPerHour=.5;

function angleBetween(target,current){
  const delta=target-current;
  return Math.atan2(Math.sin(delta),Math.cos(delta));
}

function driveCar(car,{throttle,steer,drift},dt){
  const {topSpeed,acceleration,turn}=car.spec;
  const grass=Math.max(0,Math.min(1,(Math.abs(car.lane)-TRACK.halfWidth+2)/13));
  const speed=Math.hypot(car.vx,car.vy);
  const ratio=Math.min(1,speed/topSpeed);
  const forwardBefore=car.vx*Math.cos(car.a)+car.vy*Math.sin(car.a);
  const sliding=drift && grass<.5;
  const turnRate=(sliding?2.58:1.94-.78*ratio)*turn*(1-.26*grass);
  const steering=steer*turnRate*Math.min(1,speed/95)*(forwardBefore<0?-1:1);
  car.a+=((speed>4?steering:0)+car.spin)*dt;
  car.spin*=Math.exp(-dt*(sliding?2.25:2.9));

  const fx=Math.cos(car.a),fy=Math.sin(car.a);
  let forward=car.vx*fx+car.vy*fy;
  let sideways=car.vy*fx-car.vx*fy;
  // Power tapers as the car approaches its rated top speed.
  const opposing=forward*throttle<0;
  const power=opposing?365:acceleration*(1-.70*Math.min(1,Math.abs(forward)/topSpeed)**2);
  forward+=throttle*power*dt;
  if(sliding){
    const brake=(Math.abs(steer)>.12?36:175)*dt;
    forward=Math.sign(forward)*Math.max(0,Math.abs(forward)-brake);
  }
  const drag=(throttle===0?.46:.085)+grass*2.35;
  forward*=Math.exp(-drag*dt);
  sideways*=Math.exp(-dt*grass*2.1);
  const grip=sliding?2.1:9.7-4.7*grass;
  const wanted=sideways*(1-Math.exp(-grip*dt));
  const correction=(sliding?590:510-285*grass)*dt;
  sideways-=Math.sign(wanted)*Math.min(correction,Math.abs(wanted));

  forward=Math.max(-topSpeed*.30,Math.min(topSpeed,forward));
  car.vx=fx*forward-fy*sideways;
  car.vy=fy*forward+fx*sideways;
  const speedLimit=car.speedLimit ?? topSpeed;
  const limit=speedLimit/Math.max(speedLimit,Math.hypot(car.vx,car.vy));
  car.vx*=limit;
  car.vy*=limit;
  car.x+=car.vx*dt;
  car.y+=car.vy*dt;
  car.drifting=sliding && Math.abs(sideways)>26 && speed>95;
}

function keepInsideMap(car){
  const margin=15;
  const x=Math.max(margin,Math.min(W-margin,car.x));
  const y=Math.max(margin,Math.min(H-margin,car.y));
  if(x!==car.x) car.vx*=-.24;
  if(y!==car.y) car.vy*=-.24;
  car.x=x;car.y=y;
}

function keepOutsideRails(car){
  // Match the length of the chassis with a front and rear bumper.
  for(const segment of railSegments){
    for(const end of [-11,11]){
      const offset=railOffset(segment,car.x+Math.cos(car.a)*end,car.y+Math.sin(car.a)*end);
      const distance=Math.hypot(offset.x,offset.y);
      if(distance>=17) continue;
      const along=Math.hypot(segment.dx,segment.dy);
      const side=Math.sign(car.vx*segment.dy-car.vy*segment.dx)||1;
      const nx=distance>1e-6?offset.x/distance:-side*segment.dy/along;
      const ny=distance>1e-6?offset.y/distance:side*segment.dx/along;
      car.x+=nx*(17-distance);
      car.y+=ny*(17-distance);
      const inward=car.vx*nx+car.vy*ny;
      if(inward<0){
        car.vx=.86*(car.vx-nx*inward*1.08);
        car.vy=.86*(car.vy-ny*inward*1.08);
      }
    }
  }
}

function carAxes(car){
  const fx=Math.cos(car.a),fy=Math.sin(car.a);
  return [{x:fx,y:fy,half:20},{x:-fy,y:fx,half:10}];
}

function projectionRadius(axes,x,y){
  return axes.reduce((span,axis)=>span+axis.half*Math.abs(axis.x*x+axis.y*y),0);
}

// Counter immediate position corrections in the renderer. Race progress,
// collisions and speed still use the actual simulation state.
function smoothCarCorrection(car,dx,dy,angle=0,limit=24){
  const x=(car.viewOffsetX??0)-dx;
  const y=(car.viewOffsetY??0)-dy;
  const cap=limit/Math.max(limit,Math.hypot(x,y));
  car.viewOffsetX=x*cap;
  car.viewOffsetY=y*cap;
  car.viewOffsetAngle=Math.max(-.75,Math.min(.75,(car.viewOffsetAngle??0)-angle));
}

function separateCar(car,dx,dy){
  if(dx===0 && dy===0) return;
  car.x+=dx;
  car.y+=dy;
  smoothCarCorrection(car,dx,dy);
}

// Rear bumper contacts are a speed penalty in this arcade model. The front
// driver keeps their line and the following driver can steer out of contact.
function rearBumperContact(follower,leader,axes,followingAxes,along,lateral){
  const leaderSpeed=leader.vx*axes[0].x+leader.vy*axes[0].y;
  const followerSpeed=follower.vx*axes[0].x+follower.vy*axes[0].y;
  if(along<17 || along<Math.abs(lateral)*.86 || leaderSpeed < -4 || followerSpeed < -4) return false;

  // Move the following car just far enough along the leader's heading to
  // clear the overlap on one separating axis.
  const forward=axes[0];
  const dx=leader.x-follower.x,dy=leader.y-follower.y;
  let clearance=Infinity;
  for(const axis of [...axes,...followingAxes]){
    const rate=forward.x*axis.x+forward.y*axis.y;
    if(Math.abs(rate)<.001) continue;
    const span=projectionRadius(axes,axis.x,axis.y)+projectionRadius(followingAxes,axis.x,axis.y);
    const gap=(dx*axis.x+dy*axis.y)*Math.sign(rate);
    clearance=Math.min(clearance,(span-gap)/Math.abs(rate));
  }
  separateCar(follower,-forward.x*(clearance+.1),-forward.y*(clearance+.1));
  const closing=followerSpeed-leaderSpeed;
  if(closing < -1) return true;
  const frontLoss=Math.min(.065,.006+Math.max(0,closing)*.0003);
  leader.vx*=1-frontLoss;
  leader.vy*=1-frontLoss;
  const separation=Math.min(32,5+.14*Math.max(0,closing)+.025*followerSpeed);
  const target=Math.max(0,leaderSpeed*(1-frontLoss)-separation);
  const scale=Math.min(1-frontLoss*2,target/Math.max(1,followerSpeed));
  follower.vx*=scale;
  follower.vy*=scale;
  return true;
}

function carContact(a,b){
  if(Number.isFinite(a.finishedAt) || Number.isFinite(b.finishedAt)) return;
  const dx=b.x-a.x,dy=b.y-a.y;
  if(dx*dx+dy*dy>45*45) return;
  const axesA=carAxes(a),axesB=carAxes(b);
  let depth=Infinity,nx=0,ny=0;
  for(const axis of [...axesA,...axesB]){
    const along=dx*axis.x+dy*axis.y;
    const ra=projectionRadius(axesA,axis.x,axis.y);
    const rb=projectionRadius(axesB,axis.x,axis.y);
    const overlap=ra+rb-Math.abs(along);
    if(overlap<=0) return;
    if(overlap<depth){
      depth=overlap;
      const sign=along>=0?1:-1;
      nx=axis.x*sign;
      ny=axis.y*sign;
    }
  }

  if(Math.cos(a.a-b.a)>.38){
    const forward=dx*axesB[0].x+dy*axesB[0].y;
    if(forward>0){
      if(rearBumperContact(a,b,axesB,axesA,forward,dx*axesB[1].x+dy*axesB[1].y)) return;
    }else if(rearBumperContact(b,a,axesA,axesB,-dx*axesA[0].x-dy*axesA[0].y,-dx*axesA[1].x-dy*axesA[1].y)) return;
  }

  const closing=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
  const correction=Math.max(0,depth-.12)*.5;
  separateCar(a,-nx*correction,-ny*correction);
  separateCar(b,nx*correction,ny*correction);
  if(closing<=0) return;

  // Match normal speeds without a rebound. Tangential travel continues
  // along the other car and each driver's steering still controls yaw.
  const impulse=closing*.5;
  const loss=Math.min(.16,closing*.00055);
  slideAlongCar(a,-nx*impulse,-ny*impulse,loss);
  slideAlongCar(b,nx*impulse,ny*impulse,loss);
}

function slideAlongCar(car,ix,iy,loss){
  const speed=Math.hypot(car.vx,car.vy);
  const fx=Math.cos(car.a),fy=Math.sin(car.a);
  const forward=car.vx*fx+car.vy*fy;
  car.vx+=ix;
  car.vy+=iy;
  const after=car.vx*fx+car.vy*fy;
  if(forward>=0 && after<0){
    car.vx-=after*fx;
    car.vy-=after*fy;
  }
  const limit=Math.max(speed*(1-loss),Math.min(55,Math.hypot(ix,iy)));
  const scale=Math.min(1-loss,limit/Math.max(.01,Math.hypot(car.vx,car.vy)));
  car.vx*=scale;
  car.vy*=scale;
}
