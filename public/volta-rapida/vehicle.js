// World-space handling profile. Future cars can override these three values.
const roadCar={acceleration:135,topSpeed:410,turn:1};
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
  const turnRate=(sliding?2.58:1.94-1.12*ratio)*turn*(1-.26*grass);
  const steering=steer*turnRate*Math.min(1,speed/95)*(forwardBefore<0?-1:1);
  car.a+=((speed>4?steering:0)+car.spin)*dt;
  car.spin*=Math.exp(-dt*(sliding?2.25:2.9));

  const fx=Math.cos(car.a),fy=Math.sin(car.a);
  let forward=car.vx*fx+car.vy*fy;
  let sideways=car.vy*fx-car.vx*fy;
  // Power tapers as the car approaches its rated top speed.
  const opposing=forward*throttle<0;
  car.motorLoad=opposing?0:Math.abs(throttle);
  const power=opposing?365:acceleration*(1-.70*Math.min(1,Math.abs(forward)/topSpeed)**2);
  forward+=throttle*power*dt;
  if(sliding){
    const brake=(Math.abs(steer)>.12?26:175)*dt;
    forward=Math.sign(forward)*Math.max(0,Math.abs(forward)-brake);
  }
  // Grass adds smooth, continuous rolling resistance without changing the
  // car's power or handling on asphalt. The exponential decay keeps the
  // slowdown frame-rate independent and still lets the car remain steerable.
  const drag=(throttle===0?.46:.085)+grass*4.2;
  forward*=Math.exp(-drag*dt);
  sideways*=Math.exp(-dt*grass*2.1);
  const cornerLoad=Math.min(1,Math.abs(steer)*ratio);
  const grip=sliding?2.1:(9.7-4.7*grass)*(1-.34*cornerLoad);
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

function sweepRail(segment,x,y,dx,dy,radius){
  const {a,b,nx,ny}=segment;
  let hit=null;
  function consider(t,normalX,normalY){
    if(t>=0 && t<=1 && (!hit || t<hit.t)) hit={t,nx:normalX,ny:normalY};
  }

  const offset=railOffset(segment,x,y);
  const clearance=Math.hypot(offset.x,offset.y);
  if(clearance>1e-6 && clearance<radius && offset.x*dx+offset.y*dy<0){
    return {t:0,nx:offset.x/clearance,ny:offset.y/clearance};
  }

  // Test both faces, then the rounded ends of the finite wall segment.
  const distance=(x-a.x)*nx+(y-a.y)*ny;
  const normalTravel=dx*nx+dy*ny;
  const side=Math.sign(distance);
  if(side*normalTravel<0 && Math.abs(distance)>=radius){
    const t=(side*radius-distance)/normalTravel;
    const along=((x+dx*t-a.x)*segment.dx+(y+dy*t-a.y)*segment.dy)/segment.lengthSquared;
    if(along>=0 && along<=1) consider(t,side*nx,side*ny);
  }

  const travelSquared=dx*dx+dy*dy;
  for(const end of [a,b]){
    const rx=x-end.x,ry=y-end.y;
    const along=rx*dx+ry*dy;
    const outside=rx*rx+ry*ry-radius*radius;
    const discriminant=along*along-travelSquared*outside;
    if(along>=0 || outside<0 || discriminant<0) continue;
    const t=(-along-Math.sqrt(discriminant))/travelSquared;
    consider(t,(rx+t*dx)/radius,(ry+t*dy)/radius);
  }
  return hit;
}

function keepOutsideRails(car,oldX,oldY){
  resolveRailContacts(car,oldX,oldY,trackBarriers,10+trackWallWidth/2);
}

function resolveRailContacts(car,oldX,oldY,barriers,radius){
  const segments=barriers.nearby(oldX,oldY,car.x,car.y,38);
  if(!segments.size) return;
  const fx=Math.cos(car.a),fy=Math.sin(car.a);
  const bumpers=[-11,0,11];
  let x=oldX,y=oldY,dx=car.x-oldX,dy=car.y-oldY;
  let impact=false;
  function stopInward(nx,ny){
    const inward=car.vx*nx+car.vy*ny;
    if(inward>=0) return;
    car.vx-=nx*inward;
    car.vy-=ny*inward;
    impact=true;
  }

  // Sweep the bumpers even after a pack collision displaces the car. Spend
  // the remaining movement along the wall instead of snapping it back.
  for(let pass=0;pass<3 && Math.hypot(dx,dy)>1e-6;pass++){
    let hit=null;
    for(const end of bumpers){
      const px=x+fx*end,py=y+fy*end;
      for(const segment of segments){
        const contact=sweepRail(segment,px,py,dx,dy,radius);
        if(contact && (!hit || contact.t<hit.t)) hit=contact;
      }
    }
    if(!hit){x+=dx;y+=dy;break;}
    const {t,nx,ny}=hit;
    x+=dx*t+nx*.02; y+=dy*t+ny*.02;
    const normal=dx*nx+dy*ny;
    dx=(dx-normal*nx)*(1-t);
    dy=(dy-normal*ny)*(1-t);
    stopInward(nx,ny);
  }

  // Steering at rest can rotate a bumper into a post without moving the
  // centre. Resolve that small overlap from the side the car approached.
  for(let pass=0;pass<3;pass++){
    let corrected=false;
    for(const end of bumpers){
      const px=x+fx*end,py=y+fy*end;
      let closest=null;
      for(const segment of segments){
        const offset=railOffset(segment,px,py);
        const distance=Math.hypot(offset.x,offset.y);
        if(distance<radius && (!closest || distance<closest.distance))
          closest={segment,offset,distance};
      }
      if(!closest) continue;
      const {segment,offset,distance}=closest;
      const side=Math.sign((oldX-segment.a.x)*segment.nx+(oldY-segment.a.y)*segment.ny)||1;
      const nx=distance>1e-6?offset.x/distance:segment.nx*side;
      const ny=distance>1e-6?offset.y/distance:segment.ny*side;
      x+=nx*(radius-distance+.02); y+=ny*(radius-distance+.02);
      stopInward(nx,ny);
      corrected=true;
    }
    if(!corrected) break;
  }
  car.x=x; car.y=y;
  if(impact){car.vx*=.86;car.vy*=.86;}
}

function resolveRaceEnvironment(car,oldX,oldY){
  keepInsideMap(car);
  keepOutsideRails(car,oldX,oldY);
  keepOutsideScenery(car,oldX,oldY);
  // Keep the last constraint on the hidden boundary even if contact with
  // a trunk, the river, or another car displaced the vehicle this step.
  resolveRailContacts(car,oldX,oldY,runoffBarriers,10);
}

// Resolve scenery contacts at ground level, preserving tangential motion.
function keepOutsideScenery(car,oldX,oldY){
  if(typeof nearbyTreeTrunks==='undefined' || !nearbyTreeTrunks) return;
  const radius=10;
  function impact(nx,ny){
    const normal=car.vx*nx+car.vy*ny;
    if(normal<0){
      car.vx-=normal*nx;
      car.vy-=normal*ny;
      car.vx*=.88; car.vy*=.88;
    }
  }
  for(const {x:cx,y:cy,radius:trunkRadius} of nearbyTreeTrunks(car.x,car.y)){
    const reach=radius+trunkRadius;
    if(Math.abs(car.x-cx)>reach+25 || Math.abs(car.y-cy)>reach+25) continue;
    const fx=Math.cos(car.a),fy=Math.sin(car.a);
    for(const end of [-11,0,11]){
      const dx=car.x+fx*end-cx,dy=car.y+fy*end-cy;
      const d=Math.hypot(dx,dy);
      if(d>=reach) continue;
      const nx=d>1e-5?dx/d:Math.cos(car.a+Math.PI);
      const ny=d>1e-5?dy/d:Math.sin(car.a+Math.PI);
      car.x+=nx*(reach-d); car.y+=ny*(reach-d);
      impact(nx,ny);
    }
  }
  // The asphalt is a bridge where it crosses the water.
  if(Math.abs(TRACK.offsetAt(car.x,car.y))<=TRACK.halfWidth+12) return;
  const side=Math.sign(oldY-streamY(oldX)) || 1;
  const slope=(streamY(car.x+1)-streamY(car.x-1))/2;
  const widthSlope=(streamHalf(car.x+1)-streamHalf(car.x-1))/2;
  const gradient=slope+side*widthSlope;
  const norm=Math.hypot(gradient,1);
  const nx=-side*gradient/norm,ny=side/norm;
  const clearance=(side*(car.y-streamY(car.x))-streamHalf(car.x))/norm;
  const extent=radius+11*Math.abs(Math.cos(car.a)*nx+Math.sin(car.a)*ny);
  if(clearance<extent && clearance> -extent-20){
    car.x+=nx*(extent-clearance); car.y+=ny*(extent-clearance);
    impact(nx,ny);
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
