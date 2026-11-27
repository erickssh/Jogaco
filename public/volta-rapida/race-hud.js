const standings=document.querySelector('#standings');
const spectateButton=document.querySelector('#spectate');
const spectatorBar=document.querySelector('#spectator-bar');
const timeLabel=document.querySelector('#time-label');
let watching=null, raceClosed=false, nextIntervalsAt=0, standingsSignature='';

function resetPresentation(){
  watching=null;
  raceClosed=false;
  nextIntervalsAt=0;
  standingsSignature='';
  standings.hidden=true;
  spectatorBar.hidden=true;
  spectateButton.hidden=true;
  timeLabel.textContent='Volta atual';
}

function clockTime(seconds){
  const ticks=Math.max(0,Math.round(seconds*100));
  const pad=value=>String(value).padStart(2,'0');
  return pad(Math.floor(ticks/6000))+':'+pad(Math.floor(ticks/100)%60)+','+pad(ticks%100);
}

function driverName(driver){
  return driver.name || (driver===car?'Você':'Bot '+driver.id);
}

function lapOnDisplay(driver,clock){
  return driver.lastLapTime!=null && clock-driver.lapEndedAt<2;
}

function collectIntervals(drivers,clock){
  if(clock<nextIntervalsAt) return;
  updateIntervals(drivers,clock);
  nextIntervalsAt=Math.floor(clock)+1;
}

function renderStandings(order,clock){
  const rows=order.map((driver,index)=>{
    let timing;
    if(Number.isFinite(driver.finishedAt)) timing=clockTime(driver.finishedAt);
    else if(raceClosed) timing='Não concluiu';
    else if(lapOnDisplay(driver,clock)) timing='V'+Math.floor(driver.checkpoint/gateCount)+' · '+clockTime(driver.lastLapTime);
    else if(!index) timing='Líder';
    else timing=driver.gap==null?'—':'+'+driver.gap.toFixed(2).replace('.',',')+' s';
    return {driver,timing};
  });
  const signature=JSON.stringify(rows.map(({driver,timing})=>[driver.id,timing,driver===watching]));
  if(signature===standingsSignature) return;
  standingsSignature=signature;
  standings.querySelector('ol').replaceChildren(...rows.map(({driver,timing},index)=>{
    const row=document.createElement('li'),dot=document.createElement('span');
    dot.className='dot';
    dot.style.backgroundColor=(driver.paint??playerPaint)[2];
    const label=document.createElement('span');
    label.className='driver';
    label.textContent=(index+1)+'º '+driverName(driver)+(driver===car&&driver.name?' (você)':'');
    if(driver===car) row.setAttribute('aria-current','true');
    if(driver===watching) row.classList.add('watching');
    const time=document.createElement('span');
    time.className='interval';
    time.textContent=timing;
    row.append(dot,label,time);
    return row;
  }));
  standings.hidden=false;
}

function availableToWatch(order){
  return raceClosed?[]:order.filter(driver=>driver!==car && !Number.isFinite(driver.finishedAt));
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

function updateRaceHud(now,clock=elapsed){
  cueRaceCrowds(now);
  paintSkidMarks(car);
  bots.forEach(paintSkidMarks);
  const order=raceOrder([car,...bots]);
  const placed=Number.isFinite(car.finishedAt);
  if(placed || raceClosed){
    if(!done){
      done=true;
      clearKeys();
      finish.classList.add('show');
    }
    const available=availableToWatch(order);
    spectateButton.hidden=available.length===0;
    if(watching && !available.includes(watching)) watchDriver(available[0]??null);
    setHudText(document.querySelector('#result'),placed?
      (order.indexOf(car)+1)+'º lugar de '+order.length+' · '+clockTime(car.finishedAt):'Tempo limite atingido.');
  }
  const focus=watching??car;
  setHudText(positionEl,(order.indexOf(focus)+1)+' / '+order.length);
  setHudText(speedEl,String(Math.round(Math.hypot(focus.vx,focus.vy)*kilometersPerHour)));
  raceNotice.hidden=done||!car.missedLap;
  if(!raceNotice.hidden) setHudText(raceNotice,car.cutLap?'Corte de caminho. Esta volta não conta.':'Volta incompleta. Siga a pista na próxima passagem.');
  const completed=Math.floor(focus.checkpoint/gateCount);
  setHudText(lapEl,Math.min(raceLaps,completed+1)+' / '+raceLaps);
  const finished=Number.isFinite(focus.finishedAt);
  const split=lapOnDisplay(focus,clock);
  setHudText(timeLabel,finished?'Tempo final':split?'Volta '+completed:'Volta atual');
  setHudText(timeEl,clockTime(finished?focus.finishedAt:split?focus.lastLapTime:clock-focus.lapStartedAt));
  renderStandings(order,clock);
}

spectateButton.onclick=()=>cycleSpectator(1);
document.querySelector('#watch-prev').onclick=()=>cycleSpectator(-1);
document.querySelector('#watch-next').onclick=()=>cycleSpectator(1);
document.querySelector('#watch-result').onclick=()=>watchDriver(null);
