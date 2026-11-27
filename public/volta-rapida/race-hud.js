const standings=document.querySelector('#standings');
const spectateButton=document.querySelector('#spectate');
const spectatorBar=document.querySelector('#spectator-bar');
const resultsRows=document.querySelector('#results-rows');
const resultsCount=document.querySelector('#results-count');
const resultsScroll=document.querySelector('.results-scroll');
const resultRowsByDriver=new Map();
const lapSplits=new WeakMap();
let watching=null, raceClosed=false, nextIntervalsAt=0, standingsSignature='';

function resetPresentation(){
  watching=null;
  raceClosed=false;
  nextIntervalsAt=0;
  standingsSignature='';
  standings.hidden=true;
  spectatorBar.hidden=true;
  spectateButton.hidden=true;
  resultsRows.replaceChildren();
  resultRowsByDriver.clear();
  resultsCount.textContent='';
}

function clockTime(seconds){
  const ticks=Math.max(0,Math.round(seconds*100));
  const pad=value=>String(value).padStart(2,'0');
  return pad(Math.floor(ticks/6000))+':'+pad(Math.floor(ticks/100)%60)+(language==='en'?'.':',')+pad(ticks%100);
}

function driverName(driver){
  return driver.name || (driver===car?translate('you'):translate('opponent'));
}

function lapOnDisplay(driver,now){
  if(driver.lastLapTime==null) return false;
  let split=lapSplits.get(driver);
  if(!split || split.crossing!==driver.lapEndedAt){
    split={crossing:driver.lapEndedAt,until:now+2000};
    lapSplits.set(driver,split);
  }
  return now<split.until;
}

function collectIntervals(drivers,clock){
  if(clock<nextIntervalsAt) return;
  updateIntervals(drivers,clock);
  nextIntervalsAt=Math.floor(clock)+1;
}

function renderStandings(order,now){
  const rows=order.map((driver,index)=>{
    let timing;
    const split=!isRetired(driver) && lapOnDisplay(driver,now);
    if(isRetired(driver)) timing=translate('retired');
    else if(split) timing=translate('lap')+' '+Math.floor(driver.checkpoint/gateCount)+' · '+clockTime(driver.lastLapTime);
    else if(Number.isFinite(driver.finishedAt)) timing=clockTime(driver.finishedAt);
    else if(raceClosed) timing=translate('dnf');
    else if(!index) timing=translate('leader');
    else timing=driver.gap==null || driver.gapTo!==order[index-1].id?'—':'+'+driver.gap.toFixed(2).replace('.',language==='en'?'.':',')+' s';
    return {driver,timing,split};
  });
  const signature=JSON.stringify(rows.map(({driver,timing})=>[driver.id,driver.name,timing,driver===watching]));
  if(signature===standingsSignature) return;
  standingsSignature=signature;
  standings.querySelector('ol').replaceChildren(...rows.map(({driver,timing,split},index)=>{
    const row=document.createElement('li'),dot=document.createElement('span');
    dot.className='dot';
    dot.style.backgroundColor=(driver.paint??playerPaint)[2];
    const label=document.createElement('span');
    label.className='driver';
    label.textContent=translate('ordinal',{n:index+1})+' '+driverName(driver)+(driver===car&&driver.name?translate('youTag'):'');
    if(driver===car) row.setAttribute('aria-current','true');
    if(driver===watching) row.classList.add('watching');
    const time=document.createElement('span');
    time.className=split?'interval lap-split':'interval';
    time.textContent=timing;
    row.append(dot,label,time);
    return row;
  }));
  standings.hidden=false;
}

function availableToWatch(order){
  return raceClosed?[]:order.filter(driver=>driver!==car && !raceTerminal(driver));
}

function watchDriver(driver){
  watching=driver;
  spectatorBar.hidden=!driver;
  finish.classList.toggle('show',!driver);
  clearKeys();
  if(driver){
    camera.x=driver.x;
    camera.y=driver.y;
    document.querySelector('#watch-name').textContent=driverName(driver);
    canvas.focus();
  }
}

function cycleSpectator(direction){
  const available=availableToWatch(raceOrder(bots));
  if(!available.length){watchDriver(null);return;}
  const index=available.indexOf(watching);
  watchDriver(available[index<0?0:(index+direction+available.length)%available.length]);
}

function setHudText(element,text){
  if(element.textContent!==text) element.textContent=text;
}

function renderRaceResults(order){
  resultsScroll.classList.toggle('has-more',order.length>8);
  let completed=0,rowIndex=0;
  for(const [index,driver] of order.entries()){
    const finished=Number.isFinite(driver.finishedAt);
    if(finished) completed++;
    if(!finished && !raceClosed && !isRetired(driver)) continue;
    let row=resultRowsByDriver.get(driver.id);
    if(!row){
      row=document.createElement('tr');
      row.className=finished?'arrival':'unfinished';
      if(driver===car) row.setAttribute('aria-current','true');
      for(let i=0;i<3;i++) row.insertCell();
      resultRowsByDriver.set(driver.id,row);
    }
    setHudText(row.cells[0],translate('ordinal',{n:index+1}));
    setHudText(row.cells[1],driverName(driver)+(driver===car && driver.name?translate('youTag'):''));
    setHudText(row.cells[2],finished?clockTime(driver.finishedAt):translate(isRetired(driver)?'retired':'dnf'));
    if(resultsRows.children[rowIndex]!==row) resultsRows.insertBefore(row,resultsRows.children[rowIndex]??null);
    rowIndex++;
  }
  setHudText(resultsCount,translate('finishedCount',{count:completed,total:order.length}));
}

function updateRaceHud(now){
  cueRaceCrowds(now);
  paintSkidMarks(car);
  bots.forEach(paintSkidMarks);
  const order=raceOrder([car,...bots]);
  if(!isRetired(order[0])) cuePhotographer(order[0],now);
  const placed=raceTerminal(car);
  if(placed || raceClosed){
    if(!done){
      done=true;
      clearKeys();
      finish.classList.add('show');
    }
    const available=availableToWatch(order);
    spectateButton.hidden=available.length===0;
    if(watching && !available.includes(watching)) watchDriver(available[0]??null);
    renderRaceResults(order);
  }
  const focus=watching??car;
  setHudText(positionEl,(order.indexOf(focus)+1)+' / '+order.length);
  const completed=Math.floor(focus.checkpoint/gateCount);
  setHudText(lapEl,Math.min(raceLaps,completed)+' / '+raceLaps);
  renderStandings(order,now);
}

spectateButton.onclick=()=>cycleSpectator(1);
document.querySelector('#watch-prev').onclick=()=>cycleSpectator(-1);
document.querySelector('#watch-next').onclick=()=>cycleSpectator(1);
document.querySelector('#watch-result').onclick=()=>watchDriver(null);
