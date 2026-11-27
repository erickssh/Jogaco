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

function carContact(a,b){
  const dx=a.x-b.x,dy=a.y-b.y;
  if(dx*dx+dy*dy>44**2) return;
  const ax=Math.cos(a.a)*11,ay=Math.sin(a.a)*11;
  const bx=Math.cos(b.a)*11,by=Math.sin(b.a)*11;
  let contact;
  for(const endA of [-1,1]){
    for(const endB of [-1,1]){
      const cx=dx+ax*endA-bx*endB,cy=dy+ay*endA-by*endB;
      const distance=Math.hypot(cx,cy);
      if(distance>=21 || (contact && distance>=contact.distance)) continue;
      const nx=distance>.01?cx/distance:-Math.sin(b.a);
      const ny=distance>.01?cy/distance:Math.cos(b.a);
      contact={distance,nx,ny,x:b.x+bx*endB+nx*distance*.5,y:b.y+by*endB+ny*distance*.5};
    }
  }
  if(!contact) return;
  const {distance,nx,ny,x,y}=contact;
  const ra={x:x-a.x,y:y-a.y},rb={x:x-b.x,y:y-b.y};
  const relativeX=a.vx-b.vx-a.spin*ra.y+b.spin*rb.y;
  const relativeY=a.vy-b.vy+a.spin*ra.x-b.spin*rb.x;
  const closing=-(relativeX*nx+relativeY*ny);
  const overlap=(21-distance)*.5;
  a.x+=nx*overlap;a.y+=ny*overlap;
  b.x-=nx*overlap;b.y-=ny*overlap;
  if(closing<=3) return;

  // Impact torque is the force times its lever arm about the centre of the car.
  const inverseInertia=1/178;
  const armA=ra.x*ny-ra.y*nx,armB=rb.x*ny-rb.y*nx;
  const impulse=closing*1.12/(2+(armA*armA+armB*armB)*inverseInertia);
  const tangentX=-ny,tangentY=nx;
  const slip=relativeX*tangentX+relativeY*tangentY;
  const friction=Math.max(-impulse*.24,Math.min(impulse*.24,-slip*.44));
  const ix=nx*impulse+tangentX*friction,iy=ny*impulse+tangentY*friction;
  hitCar(a,ra,ix,iy,closing,inverseInertia);
  hitCar(b,rb,-ix,-iy,closing,inverseInertia);
}

function hitCar(car,arm,ix,iy,closing,inverseInertia){
  const priorSpeed=Math.hypot(car.vx,car.vy);
  const alignment=Math.abs(ix*Math.cos(car.a)+iy*Math.sin(car.a))/Math.hypot(ix,iy);
  // Different angles dissipate different amounts of speed from each chassis.
  const loss=Math.min(.34,closing*(.00048+.00037*alignment));
  car.vx+=ix;car.vy+=iy;
  car.spin=Math.max(-6,Math.min(6,car.spin+(arm.x*iy-arm.y*ix)*inverseInertia));
  const impactLimit=Math.max(priorSpeed*(1-loss),Math.min(49,closing*.34));
  const speed=Math.hypot(car.vx,car.vy);
  const factor=Math.min(1-loss*.26,impactLimit/Math.max(.01,speed));
  car.vx*=factor;car.vy*=factor;
}
