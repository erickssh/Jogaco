// Define each circuit by tangent bends on its centreline, in travelling order.
// Both boundaries, kerbs and collisions use the same perpendicular half-width.
function makeCircuit(width, bends) {
  const halfWidth = width / 2;
  const path = new Path2D();
  const arcs = bends.map(([x, y, radius, start, sweep]) => {
    if (radius <= halfWidth || !sweep || Math.abs(sweep) >= Math.PI * 2)
      throw new Error('A bend needs enough radius for the inside edge.');
    const end = start + sweep;
    return {x, y, radius, start, end, sweep,
      ax:x + radius * Math.cos(start), ay:y + radius * Math.sin(start),
      bx:x + radius * Math.cos(end), by:y + radius * Math.sin(end)};
  });
  const lines = arcs.map((arc, i) => {
    const next = arcs[(i + 1) % arcs.length];
    const dx = next.ax - arc.bx, dy = next.ay - arc.by;
    return {x:arc.bx, y:arc.by, dx, dy, length:Math.hypot(dx,dy)};
  });
  path.moveTo(arcs[0].ax, arcs[0].ay);
  for (const arc of arcs) {
    path.lineTo(arc.ax, arc.ay);
    path.arc(arc.x, arc.y, arc.radius, arc.start, arc.end, arc.sweep < 0);
  }
  path.closePath();

  // Positive offsets are on the left of travel. The closest point is on a bend or a straight.
  function offsetAt(x, y) {
    let nearest = Infinity, side = 1;
    for (const line of lines) {
      if (!line.length) continue;
      const rx = x - line.x, ry = y - line.y;
      const t = Math.max(0, Math.min(1, (rx * line.dx + ry * line.dy) / (line.length ** 2)));
      const d = Math.hypot(rx - t * line.dx, ry - t * line.dy);
      if (d < nearest) {
        nearest = d;
        side = rx * line.dy - ry * line.dx >= 0 ? 1 : -1;
      }
    }
    const circle = 2 * Math.PI;
    for (const arc of arcs) {
      const rx = x - arc.x, ry = y - arc.y;
      const direction = Math.sign(arc.sweep);
      const angle = ((Math.atan2(ry, rx) - arc.start) * direction % circle + circle) % circle;
      if (angle > Math.abs(arc.sweep)) continue;
      const offset = (Math.hypot(rx, ry) - arc.radius) * direction;
      if (Math.abs(offset) < nearest) {
        nearest = Math.abs(offset);
        side = Math.sign(offset);
      }
    }
    return side * nearest;
  }
  const parts = [];
  let length = 0;
  for (const [i, arc] of arcs.entries()) {
    const arcLength = Math.abs(arc.sweep) * arc.radius;
    parts.push({start:length, end:length + arcLength, arc});
    length += arcLength;
    parts.push({start:length, end:length + lines[i].length, line:lines[i]});
    length += lines[i].length;
  }
  function pointAt(distance) {
    const s = ((distance % length) + length) % length;
    const part = parts.find(piece => piece.end > s) || parts[0];
    const local = s - part.start;
    if (part.arc) {
      const arc = part.arc, sign = Math.sign(arc.sweep);
      const angle = arc.start + sign * local / arc.radius;
      return {x:arc.x + Math.cos(angle)*arc.radius, y:arc.y + Math.sin(angle)*arc.radius,
        tx:-sign*Math.sin(angle), ty:sign*Math.cos(angle), curvature:sign/arc.radius};
    }
    const line = part.line, tx = line.dx/line.length, ty = line.dy/line.length;
    return {x:line.x + tx*local, y:line.y + ty*local, tx, ty, curvature:0};
  }
  return {halfWidth, path, arcs, offsetAt, length, pointAt};
}

// Fillet each waypoint with a circular arc tangent to its two straights.
// Positive and negative turns share the same track-width and collision rules.
function tangentBends(vertices) {
  const bends = vertices.map(([x,y,radius],i) => {
    const before = vertices[(i+vertices.length-1)%vertices.length];
    const after = vertices[(i+1)%vertices.length];
    const incoming = Math.atan2(y-before[1],x-before[0]);
    const outgoing = Math.atan2(after[1]-y,after[0]-x);
    const sweep = Math.atan2(Math.sin(outgoing-incoming),Math.cos(outgoing-incoming));
    const trim = radius*Math.tan(Math.abs(sweep)/2);
    const start = incoming - Math.sign(sweep)*Math.PI/2;
    const cx = x-trim*Math.cos(incoming)-radius*Math.cos(start);
    const cy = y-trim*Math.sin(incoming)-radius*Math.sin(start);
    return {arc:[cx,cy,radius,start,sweep],trim};
  });
  for (let i=0;i<bends.length;i++) {
    const j=(i+1)%bends.length;
    if (bends[i].trim + bends[j].trim > Math.hypot(vertices[i][0]-vertices[j][0],vertices[i][1]-vertices[j][1]))
      throw new Error('Adjacent bends overlap: '+i+' and '+j);
  }
  return bends.map(bend=>bend.arc);
}
// Waypoints follow the Paint sketch. The lower straight crosses the red mark.
const sketchScale = 22;
const mapX = x => (x - 47) * sketchScale + 490;
const mapY = y => (y - 29) * sketchScale + 500;
const W=3100, H=3050;
const TRACK = makeCircuit(180,tangentBends([
  [78,122,168],[117,122,156],[130,116,132],[124,103,145],
  [125,92,122],[139,87,139],[143,80,160],[135,68,150],
  [124,68,150],[111,69,166],[102,63,175],[100,48,132],
  [109,41,112],[125,38,102],[111,31,127],[101,29,142],
  [88,44,194],[84,60,172],[80,68,118],[79,80,129],
  [69,88,124],[69,99,124],[64,105,130],[53,105,139],
  [47,114,119],[50,120,126],[59,121,144],[69,119,114]
].map(([x,y,r])=>[mapX(x),mapY(y),r])));
const innerEdge = -TRACK.halfWidth, outerEdge = TRACK.halfWidth;
const firstBend = TRACK.arcs[0];
const startDistance = Math.abs(firstBend.sweep)*firstBend.radius + mapX(97.5)-firstBend.bx;
const grid = TRACK.pointAt(startDistance);
// Use half a road width of runoff beyond each edge. Where two legs meet
// or the inside radius is smaller, stop at the verge's geometric limit.
function makeCourseRunoff(track,origin){
  const gateCount=Math.ceil(track.length/36);
  const samplesPerGate=Math.max(8,Math.ceil(720/track.halfWidth));
  const count=gateCount*samplesPerGate;
  const spacing=track.length/count;
  const samples=Array.from({length:count},(_,i)=>track.pointAt(origin+i*spacing));
  const desired=2*track.halfWidth;
  const clearance=track.halfWidth/30;
  const limits=samples.map(point=>{
    let right=desired,left=desired;
    for(const other of samples){
      const dx=other.x-point.x,dy=other.y-point.y;
      const across=dx*point.ty-dy*point.tx;
      if(Math.abs(across)<1e-5) continue;
      const limit=(dx*dx+dy*dy)/(2*Math.abs(across))-clearance;
      if(across>0) left=Math.min(left,limit);
      else right=Math.min(right,limit);
    }
    return [right,left];
  });

  const widths=[0,1].map(side=>{
    const width=limits.map(pair=>pair[side]);
    // Ease both shoulders of a narrow verge without moving the limit out
    // into a neighboring leg. Wrap the passes around the start line.
    for(const direction of [1,-1]){
      for(let k=1;k<2*count;k++){
        const i=direction===1?k%count:(2*count-1-k)%count;
        const adjacent=(i-direction+count)%count;
        width[i]=Math.min(width[i],width[adjacent]+spacing*1.1);
      }
    }
    const radius=Math.max(1,Math.round(track.halfWidth*.4/spacing));
    return width.map((max,i)=>{
      let sum=0;
      for(let j=-radius;j<=radius;j++) sum+=width[(i+j+count)%count];
      return Math.min(max,sum/(2*radius+1));
    });
  });
  const paths=widths.map((width,side)=>{
    const sign=side===0?-1:1;
    return samples.map((p,i)=>[p.x+p.ty*sign*width[i],p.y-p.tx*sign*width[i]]);
  });

  // A timing line spans both runoffs. Its ends include a small margin for
  // collisions at the edge; tyre position never decides whether it counts.
  const tolerance=track.halfWidth/15;
  const gates=Array.from({length:gateCount},(_,i)=>{
    const sample=i*samplesPerGate;
    return {point:samples[sample],min:-widths[0][sample]-tolerance,max:widths[1][sample]+tolerance};
  });
  return {gates,barriers:makeTrackBarriers(paths,true)};
}

const {gates:timingGates,barriers:runoffBarriers}=makeCourseRunoff(TRACK,startDistance);

// The ranges follow the two marked inside kerbs, measured from the start.
// Take the finish at the same offset as the approach so the wall hugs the
// apex and stays on the asphalt boundary even where the radius is small.
const curveWalls=[[3170,4015],[5795,6640]];
const trackWallWidth=10;
const trackBarriers=makeTrackBarriers(curveWalls.map(([from,to])=>{
  const steps=Math.ceil((to-from)/5);
  const points=[];
  for(let i=0;i<=steps;i++){
    const p=TRACK.pointAt(startDistance+from+(to-from)*i/steps);
    const point=[p.x+p.ty*TRACK.halfWidth,p.y-p.tx*TRACK.halfWidth];
    if(points.length>=2){
      const [ax,ay]=points.at(-2),[bx,by]=points.at(-1);
      const cross=(bx-ax)*(point[1]-by)-(by-ay)*(point[0]-bx);
      if(Math.abs(cross)<1e-6) points.pop();
    }
    points.push(point);
  }
  return points;
}));

function makeTrackBarriers(layout,closed=false){
  const paths=layout.map(path=>path.map(([x,y])=>({x,y})));
  const cellSize=64;
  const cells=new Map();
  const cellKey=(x,y)=>x+','+y;
  paths.forEach(points=>{
    for(let index=0;index<points.length-(closed?0:1);index++){
      const a=points[index],b=points[(index+1)%points.length];
      const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
      const segment={a,b,dx,dy,nx:-dy/length,ny:dx/length,lengthSquared:length*length};
      for(let x=Math.floor(Math.min(a.x,b.x)/cellSize);x<=Math.floor(Math.max(a.x,b.x)/cellSize);x++){
        for(let y=Math.floor(Math.min(a.y,b.y)/cellSize);y<=Math.floor(Math.max(a.y,b.y)/cellSize);y++){
          const key=cellKey(x,y);
          if(!cells.has(key)) cells.set(key,[]);
          cells.get(key).push(segment);
        }
      }
    }
  });

  function nearby(x1,y1,x2,y2,margin){
    const segments=new Set();
    for(let x=Math.floor((Math.min(x1,x2)-margin)/cellSize);x<=Math.floor((Math.max(x1,x2)+margin)/cellSize);x++){
      for(let y=Math.floor((Math.min(y1,y2)-margin)/cellSize);y<=Math.floor((Math.max(y1,y2)+margin)/cellSize);y++){
        const list=cells.get(cellKey(x,y));
        if(list) for(const segment of list) segments.add(segment);
      }
    }
    return segments;
  }
  return {paths,nearby};
}

function railOffset(segment,x,y){
  const {a,dx,dy,lengthSquared}=segment;
  const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/lengthSquared));
  return {x:x-a.x-t*dx,y:y-a.y-t*dy};
}
