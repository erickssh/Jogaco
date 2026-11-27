// The atlas variants keep the ink outlines and shaded detail of the park art.
const forestStyles=[
  ['oak',1.10,.90, [31,56,36],[182,196,92]],
  ['oak',.91,1.10, [28,61,43],[138,194,111]],
  ['oak',1.14,.88, [35,61,37],[207,212,116]],
  ['oak',1.04,1.05, [34,57,31],[164,189,77]],
  ['fir',.73,1.08, [21,48,43],[123,180,145]],
  ['fir',1.02,.96, [25,52,45],[126,161,115]],
  ['fir',.87,1.08, [24,44,46],[134,171,166]],
  ['copper',1.10,.92, [61,42,33],[217,173,76]],
  ['copper',.91,1.05, [46,62,31],[188,206,99]],
  ['copper',1.08,.95, [59,36,33],[213,142,89]],
  ['blossom',.97,1.04, [36,63,48],[157,201,126]],
  ['blossom',1.09,.88, [64,49,45],[225,181,152]],
  ['flowers',1.20,.74, [29,53,35],[161,191,96]],
  ['flowers',.90,1.06, [34,53,43],[133,174,148]],
  ['flowers',1.04,.87, [47,62,34],[206,207,131]],
  ['rocks',1.17,.82, [37,51,46],[167,176,147]],
  ['rocks',.87,.96, [37,49,54],[175,192,189]],
  ['rocks',1.03,1.04, [51,51,42],[181,171,136]]
];
const forestTileSize=384;

function growForest(park){
  const trees=[], undergrowth=[];
  const roots=new Map();
  // Warp the planting grid and vary spacing across groves. Only the remote
  // groves overlap heavily; the existing park planting remains in place.
  for(let row=-1;row<=H/27+1;row++){
    for(let col=-1;col<=W/30+1;col++){
      const random=meadowRandom(col,row,671251);
      const x=(col+random())*30+22*Math.sin(row*.29+col*.09);
      const y=(row+random())*27+20*Math.sin(col*.27-row*.08);
      const grove=(Math.sin(x/213+y/297)+Math.cos(y/187-x/344))*.5;
      const setback=TRACK.halfWidth*2+grove*21;
      const distance=Math.abs(TRACK.offsetAt(x,y));
      if(distance<setback || x<0 || x>W || y<0 || y>H) continue;
      const density=Math.min(1,(distance-setback)/105);
      if(random()>density) continue;

      const tree=random()<.93;
      const depth=Math.min(1,(distance-setback)/165);
      const size=tree?80+random()*79+depth*51:23+random()*33;
      if(distance<TRACK.halfWidth*2+size*.25) continue;
      if(Math.abs(y-streamY(x))<streamHalf(x)+size*.50+12) continue;
      if(inRaceFacility(x,y,size) || insideFinishStand(x,y,size*.58+24)) continue;
      if(park.some(([kind,px,py,s])=>{
        if(depth>.72 && species[kind]<4)
          return Math.hypot(x-px,y+size*.44-py-s*.44)<41;
        if(depth>.72 && (kind==='rocks'||kind==='flowers')) return false;
        return Math.abs(x-px)<(size+s)*.39 && Math.abs(y-py)<(size+s)*.39;
      })) continue;
      const margin=size*.53+8;
      if([...trackBarriers.nearby(x,y,x,y,margin)].some(segment=>{
        const offset=railOffset(segment,x,y);
        return Math.hypot(offset.x,offset.y)<margin;
      })) continue;

      let style;
      if(tree){
        const mix=random();
        if(mix<.22+grove*.16) style=4+Math.floor(random()*3);
        else if(mix<.28+grove*.16) style=random()<.85?7:9;
        else if(mix>.97) style=11;
        else style=[0,1,2,3,8,10][Math.floor(random()*6)];
      }else{
        style=12+Math.floor(random()*6);
      }
      const [kind,width,height]=forestStyles[style];
      const item={kind,style,x,y,w:size*width,h:size*height,flip:random()<.5};
      if(tree){
        const rootY=y+item.h*.44;
        let crowded=false;
        for(let r=Math.floor((rootY-33)/40);r<=Math.floor((rootY+33)/40);r++){
          for(let c=Math.floor((x-33)/40);c<=Math.floor((x+33)/40);c++){
            const bucket=roots.get(c+','+r);
            if(bucket?.some(root=>Math.hypot(x-root.x,rootY-root.y)<33)) crowded=true;
          }
        }
        if(crowded) continue;
        const key=Math.floor(x/40)+','+Math.floor(rootY/40);
        if(!roots.has(key)) roots.set(key,[]);
        roots.get(key).push({x,y:rootY});
      }
      (tree?trees:undergrowth).push(item);
    }
  }
  return [...undergrowth,...trees.sort((a,b)=>(a.y+a.h*.43)-(b.y+b.h*.43))];
}

function prepareForestSprites(atlas){
  return forestStyles.map(([kind,,,shade,light])=>{
    const index=species[kind],sprite=shadowCanvas(TILE);
    const ink=sprite.getContext('2d',{willReadFrequently:true});
    ink.drawImage(atlas,index%4*TILE,Math.floor(index/4)*TILE,TILE,TILE,0,0,TILE,TILE);
    const pixels=ink.getImageData(0,0,TILE,TILE);
    const rgba=pixels.data;
    for(let i=0;i<rgba.length;i+=4){
      if(!rgba[i+3]) continue;
      const [r,g,b]=[rgba[i],rgba[i+1],rgba[i+2]];
      const value=(.26*r+.59*g+.15*b)/255;
      const blend=Math.min(.91,Math.max(0,(value-.105)*7));
      if(!blend) continue;
      // Keep the small warm trunk at the foot of every tree.
      if(index<4 && Math.floor(i/4/TILE)>163 && r>g*1.1 && g>b*1.15) continue;
      for(let c=0;c<3;c++){
        rgba[i+c]=rgba[i+c]*(1-blend)+(shade[c]+(light[c]-shade[c])*value)*blend;
      }
    }
    ink.putImageData(pixels,0,0);
    return sprite;
  });
}

function forestObject(ctx,item,image,shadowRoot=null){
  const {x,y,w,h,flip}=item;
  ctx.save();
  ctx.translate(x,y);
  if(flip) ctx.scale(-1,1);
  if(!shadowRoot){
    ctx.drawImage(image,-w/2,-h/2,w,h);
  }else{
    const pad=shadowPad/TILE,side=shadowSide/TILE;
    // Mirror the foliage, but keep its cast shadow to the southeast.
    if(flip){ctx.scale(-1,1);ctx.translate((.5-shadowRoot.x)*2*w,0);}
    ctx.drawImage(image,-w*(.5+pad),-h*(.5+pad),w*side,h*side);
  }
  ctx.restore();
}

async function bakeForest(atlas,items,ground,profiles,park,houseArt){
  const sprites=prepareForestSprites(atlas);
  const tiles=new Map(), revealTiles=new Map();
  let deadline=performance.now()+8;
  async function yieldIfNeeded(){
    if(performance.now()<deadline) return;
    await new Promise(resolve=>setTimeout(resolve,0));
    deadline=performance.now()+8;
  }
  function visitTiles(x,y,w,h,paint){
    for(let row=Math.floor((y-h/2)/forestTileSize);row<=Math.floor((y+h/2)/forestTileSize);row++){
      for(let col=Math.floor((x-w/2)/forestTileSize);col<=Math.floor((x+w/2)/forestTileSize);col++){
        const left=col*forestTileSize,top=row*forestTileSize;
        if(col<0 || row<0 || top>=H || left>=W) continue;
        const key=col+','+row;
        let tile=tiles.get(key);
        if(!tile){
          const image=shadowCanvas(forestTileSize);
          const brush=image.getContext('2d');
          brush.translate(-left,-top);
          brush.imageSmoothingQuality='high';
          tile={image,brush,left,top};
          tiles.set(key,tile);
        }
        paint(tile.brush);
      }
    }
  }

  ground.save();
  ground.globalAlpha=.65;
  for(const item of items){
    const profile=profiles[item.kind];
    forestObject(ground,item,profile.image,profile.root);
    await yieldIfNeeded();
  }
  ground.restore();
  for(const item of park){
    const [,x,y,size]=item;
    visitTiles(x,y,size,size,brush=>paintObjects(brush,atlas,profiles,[item],0,houseArt));
    await yieldIfNeeded();
  }
  for(const item of items){
    const {x,y,w,h,style}=item;
    visitTiles(x,y,w,h,brush=>forestObject(brush,item,sprites[style]));
    await yieldIfNeeded();
  }

  // Fold the opaque scenery into the main camera surface. Retain only a
  // small copy of each clearing for the short fade while driving under trees.
  for(const [key,{image,left,top}] of tiles){
    const size=forestTileSize;
    const reveal=shadowCanvas(size/2);
    const brush=reveal.getContext('2d',{alpha:false});
    brush.drawImage(ground.canvas,left,top,size,size,0,0,reveal.width,reveal.height);
    brush.globalAlpha=.20;
    brush.drawImage(image,0,0,reveal.width,reveal.height);
    revealTiles.set(key,reveal);
    ground.drawImage(image,left,top);
    await yieldIfNeeded();
  }
  return revealTiles;
}

function indexTreeTrunks(park,forest,profiles){
  const buckets=new Map();
  function add(kind,x,y,w,h,flip){
    if(species[kind]>=4) return;
    const root=profiles[kind].root;
    const cx=x+(root.x-.5)*w*(flip?-1:1),cy=y+(root.y-.5)*h;
    const key=Math.floor(cx/96)+','+Math.floor(cy/96);
    if(!buckets.has(key)) buckets.set(key,[]);
    buckets.get(key).push({x:cx,y:cy,radius:w*.075});
  }
  for(const [kind,x,y,size] of park) add(kind,x,y,size,size,false);
  for(const {kind,x,y,w,h,flip} of forest) add(kind,x,y,w,h,flip);
  return (x,y)=>{
    const trunks=[];
    for(let row=Math.floor((y-43)/96);row<=Math.floor((y+43)/96);row++){
      for(let col=Math.floor((x-43)/96);col<=Math.floor((x+43)/96);col++){
        const bucket=buckets.get(col+','+row);
        if(bucket) trunks.push(...bucket);
      }
    }
    return trunks;
  };
}

// Reveal the driver under the canopy. Only this small patch changes per frame.
function revealForestFloor(ctx,tiles,car,patch){
  if(Math.abs(car.lane)<TRACK.halfWidth*2-24) return;
  const radius=patch.width/2;
  const x=Math.floor(car.x)-radius,y=Math.floor(car.y)-radius;
  const size=forestTileSize;
  const brush=patch.getContext('2d');
  brush.setTransform(1,0,0,1,-x,-y);
  brush.clearRect(x,y,patch.width,patch.height);
  let painted=false;
  for(let row=Math.floor(y/size);row<=Math.floor((y+patch.height)/size);row++){
    for(let col=Math.floor(x/size);col<=Math.floor((x+patch.width)/size);col++){
      const tile=tiles.get(col+','+row);
      if(!tile) continue;
      brush.drawImage(tile,col*size,row*size,size,size);
      painted=true;
    }
  }
  if(!painted) return;
  brush.globalCompositeOperation='destination-in';
  const fade=brush.createRadialGradient(car.x,car.y,15,car.x,car.y,radius);
  fade.addColorStop(0,'#000');
  fade.addColorStop(.42,'rgba(0,0,0,.80)');
  fade.addColorStop(1,'transparent');
  brush.fillStyle=fade;
  brush.fillRect(x,y,patch.width,patch.height);
  brush.globalCompositeOperation='source-over';

  ctx.drawImage(patch,x,y);
}
