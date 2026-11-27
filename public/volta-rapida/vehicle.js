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

// The leading feature is an edge for square impacts and a corner for a
// glancing impact. Project it onto the tangent to find the actual lever arm.
function facingSpan(car,axes,nx,ny,tx,ty){
  let center=car.x*tx+car.y*ty,half=0;
  for(const axis of axes){
    const toward=axis.x*nx+axis.y*ny;
    const span=axis.half*(axis.x*tx+axis.y*ty);
    if(Math.abs(toward)<.025) half+=Math.abs(span);
    else center+=Math.sign(toward)*span;
  }
  return {min:center-half,max:center+half};
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
  if(along<21 || along<Math.abs(lateral)*1.08 || leaderSpeed < -4 || followerSpeed < -4) return false;

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
  const dx=b.x-a.x,dy=b.y-a.y;
  if(dx*dx+dy*dy>45*45) return;
  const axesA=carAxes(a),axesB=carAxes(b);
  let depth=Infinity,nx=0,ny=0,plane=0;
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
      plane=(a.x*nx+a.y*ny+ra+b.x*nx+b.y*ny-rb)/2;
    }
  }

  if(Math.cos(a.a-b.a)>.57){
    const forward=dx*axesB[0].x+dy*axesB[0].y;
    if(forward>0){
      if(rearBumperContact(a,b,axesB,axesA,forward,dx*axesB[1].x+dy*axesB[1].y)) return;
    }else if(rearBumperContact(b,a,axesA,axesB,-dx*axesA[0].x-dy*axesA[0].y,-dx*axesA[1].x-dy*axesA[1].y)) return;
  }

  const tx=-ny,ty=nx;
  const faceA=facingSpan(a,axesA,nx,ny,tx,ty);
  const faceB=facingSpan(b,axesB,-nx,-ny,tx,ty);
  const tangent=(Math.max(faceA.min,faceB.min)+Math.min(faceA.max,faceB.max))/2;
  const x=nx*plane+tx*tangent,y=ny*plane+ty*tangent;
  const ra={x:x-a.x,y:y-a.y},rb={x:x-b.x,y:y-b.y};
  const relativeX=b.vx-a.vx-b.spin*rb.y+a.spin*ra.y;
  const relativeY=b.vy-a.vy+b.spin*rb.x-a.spin*ra.x;
  const closing=-(relativeX*nx+relativeY*ny);

  // Ease bodies apart along the contact normal without turning their noses.
  const correction=Math.max(0,depth-.12)*.47;
  separateCar(a,-nx*correction,-ny*correction);
  separateCar(b,nx*correction,ny*correction);
  if(closing<=.75) return;

  const inverseInertia=1/260;
  const armA=ra.x*ny-ra.y*nx,armB=rb.x*ny-rb.y*nx;
  const impulse=closing*1.025/(2+(armA*armA+armB*armB)*inverseInertia);
  const scrub=relativeX*tx+relativeY*ty;
  const friction=Math.max(-impulse*.12,Math.min(impulse*.12,-scrub*.24));
  const ix=nx*impulse+tx*friction,iy=ny*impulse+ty*friction;
  hitCar(a,ra,-ix,-iy,closing,inverseInertia);
  hitCar(b,rb,ix,iy,closing,inverseInertia);
}

function hitCar(car,arm,ix,iy,closing,inverseInertia){
  const priorSpeed=Math.hypot(car.vx,car.vy);
  const loss=Math.min(.21,closing*.00065);
  car.vx+=ix;
  car.vy+=iy;
  const torque=(arm.x*iy-arm.y*ix)*inverseInertia;
  car.spin=Math.max(-2.8,Math.min(2.8,car.spin+torque));
  // Dissipate speed without changing the direction established by the impact.
  const limit=Math.max(priorSpeed*(1-loss),Math.min(62,closing*.35));
  const scale=Math.min(1-loss*.25,limit/Math.max(.01,Math.hypot(car.vx,car.vy)));
  car.vx*=scale;
  car.vy*=scale;
}
