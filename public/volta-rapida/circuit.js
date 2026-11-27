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
const gates = [1,2,3,4].map(n=>TRACK.pointAt(startDistance+TRACK.length*n/4));

// Guardrails on the grass between adjacent legs. The same segments are
// used by the painter, the scenery layout and the physics.
const shortcutRails=[
  [[1507,1110],[1536,953],[1573,833],[1692,704],[1825,650]],
  [[887,2324],[780,2342],[670,2370],[645,2384]]
];
const railSegments=shortcutRails.flatMap(points=>points.slice(1).map(([bx,by],i)=>{
  const [ax,ay]=points[i];
  const dx=bx-ax,dy=by-ay;
  return {ax,ay,dx,dy,lengthSquared:dx*dx+dy*dy};
}));

function railOffset(segment,x,y){
  const {ax,ay,dx,dy,lengthSquared}=segment;
  const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/lengthSquared));
  return {x:x-ax-t*dx,y:y-ay-t*dy};
}

function crossesGate(gate, beforeX, beforeY, x, y, halfWidth=TRACK.halfWidth) {
  const before = (beforeX-gate.x)*gate.tx + (beforeY-gate.y)*gate.ty;
  const after = (x-gate.x)*gate.tx + (y-gate.y)*gate.ty;
  if (before>=0 || after<0) return false;
  const t = before/(before-after);
  const dx = beforeX+(x-beforeX)*t-gate.x, dy=beforeY+(y-beforeY)*t-gate.y;
  return Math.abs(dx*gate.ty-dy*gate.tx)<=halfWidth;
}
