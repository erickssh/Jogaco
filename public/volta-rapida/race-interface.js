const raceMenu = document.querySelector('#race-menu');
const raceMenuDefault = document.querySelector('#race-menu-default');
const raceConfirmation = document.querySelector('#race-menu-confirmation');
const racePrompt = document.querySelector('#race-prompt');
const raceActionError = document.querySelector('#race-action-error');
const raceConfirm = document.querySelector('#race-confirm');
const raceRetire = document.querySelector('#race-retire');
const raceResume = document.querySelector('#race-resume');
let confirmationAction = null;
let pauseStarted = null;
let pausedTime = 0;

function translateRaceDialog() {
  racePrompt.textContent = confirmationAction
    ? translate(confirmationAction === 'retire' ? 'confirmRetire' : 'confirmMain') : '';
}

function openRaceMenu() {
  if (raceMenu.open || !ready || !setup.hidden || (!soloActive && !onlineRace.active())) return;
  clearKeys();
  pauseStarted = onlineRace.active() ? null : performance.now();
  if (pauseStarted !== null) raceAudio.setPaused(true);
  document.querySelector('#race-online-note').hidden = !onlineRace.active() || raceClosed;
  document.querySelector('#race-menu-online').hidden = !onlineRace.active();
  raceRetire.disabled = raceTerminal(car) || raceClosed;
  raceMenu.showModal();
}

function showRaceConfirmation(action) {
  confirmationAction = action;
  raceMenuDefault.hidden = Boolean(action);
  raceConfirmation.hidden = !action;
  raceActionError.hidden = true;
  translateRaceDialog();
  if (!raceMenu.open) return;
  if (action) document.querySelector('#race-cancel').focus();
  else raceResume.focus();
}

function closeRaceMenu() {
  if (pauseStarted !== null) raceAudio.setPaused(false);
  if (pauseStarted !== null) pausedTime += performance.now() - pauseStarted;
  pauseStarted = null;
  raceMenu.close();
  showRaceConfirmation(null);
  clearKeys();
  if (ready && setup.hidden && !gameApp.classList.contains('menu-scene')) canvas.focus({preventScroll:true});
}

function resetRaceMenu() {
  closeRaceMenu();
  pausedTime = 0;
  raceConfirm.disabled = false;
  document.querySelector('#race-cancel').disabled = false;
}

function dismissRaceMenu() {
  if (raceConfirm.disabled) return;
  if (confirmationAction) showRaceConfirmation(null);
  else closeRaceMenu();
}

raceMenu.addEventListener('cancel', event => {
  event.preventDefault();
  dismissRaceMenu();
});
raceResume.onclick = closeRaceMenu;
raceRetire.onclick = () => showRaceConfirmation('retire');
document.querySelector('#race-home').onclick = () => showRaceConfirmation('home');
document.querySelector('#race-cancel').onclick = dismissRaceMenu;
document.querySelector('#race-fullscreen').onclick = async () => {
  if (externalMenu) {
    onlineRace.requestFullscreen();
    return;
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {}
};
document.addEventListener('fullscreenchange', () => {
  if (externalMenu) return;
  expanded = Boolean(document.fullscreenElement);
  gameApp.dataset.expanded = String(expanded);
  gameApp.style.setProperty('--fullscreen-scale', expanded ? 1.25 : 1);
  updateRaceLanguage();
});
raceConfirm.onclick = async () => {
  const action = confirmationAction;
  if (!action) return;
  if (onlineRace.active()) {
    if (!raceTerminal(car) && !raceClosed) {
      const cancel = document.querySelector('#race-cancel');
      raceConfirm.disabled = cancel.disabled = true;
      raceActionError.hidden = true;
      const success = await onlineRace.retire();
      raceConfirm.disabled = cancel.disabled = false;
      if (confirmationAction !== action || !raceMenu.open) return;
      if (!success && !raceClosed && !raceTerminal(car)) {
        raceActionError.hidden = false;
        raceConfirm.focus();
        return;
      }
    }
    closeRaceMenu();
    if (action === 'home') onlineRace.returnHome();
    return;
  }
  closeRaceMenu();
  if (action === 'retire') {
    retireDriver(car);
    const now = performance.now() - pausedTime;
    start ||= now - 2000;
    raceClosed = bots.every(raceTerminal);
    updateRaceHud(now);
  } else if (externalMenu) {
    pauseForMenu();
    onlineRace.showMenu('main');
  } else {
    setup.hidden = false;
    reset();
    setupForm.querySelector('input:checked').focus();
  }
};

function updateRoomMenu({settings, fillBots, difficulty, message}) {
  document.querySelector('#race-rematch-settings').hidden = !settings;
  document.querySelector('#race-fill-bots').checked = fillBots;
  const level = document.querySelector('#race-bot-level');
  level.value = difficulty;
  level.disabled = !fillBots;
  const info = document.querySelector('#race-room-info');
  info.hidden = !message;
  info.textContent = message;
}
document.querySelector('#race-copy').onclick = () => onlineRace.roomAction('copy');
document.querySelector('#race-fill-bots').onchange = event => onlineRace.roomAction('fillBots',event.target.checked);
document.querySelector('#race-bot-level').onchange = event => onlineRace.roomAction('difficulty',event.target.value);

const dialScale = document.querySelector('#dial-scale');
const dialNeedle = document.querySelector('#speed-needle');
const dialMaximum = 220;
const angleAt = value => -128 + 256 * value / dialMaximum;
const dialPoint = (value,radius) => {
  const angle = angleAt(value) * Math.PI / 180;
  return [64 + radius * Math.sin(angle),64 - radius * Math.cos(angle)];
};
function dialElement(name, attributes, className) {
  const node = document.createElementNS('http://www.w3.org/2000/svg',name);
  node.setAttribute('class',className);
  for (const [key,value] of Object.entries(attributes)) node.setAttribute(key,value);
  dialScale.append(node);
  return node;
}
for (const [from,to,className] of [[0,220,'dial-track'],[180,220,'dial-track dial-band']]) {
  const [x,y] = dialPoint(from,53), [endX,endY] = dialPoint(to,53);
  dialElement('path',{d:'M'+x+' '+y+' A53 53 0 '+Number(to-from>155)+' 1 '+endX+' '+endY},className);
}
for (let value=0; value<=dialMaximum; value+=10) {
  const major = value % 40 === 0;
  const [x1,y1] = dialPoint(value,49), [x2,y2] = dialPoint(value,major?43:46);
  dialElement('line',{x1,y1,x2,y2},major?'dial-tick major':'dial-tick');
  if (major) {
    const [x,y] = dialPoint(value,36);
    dialElement('text',{x,y:y+2},'dial-number').textContent = value;
  }
}
let dialSpeed = 0;
function updateSpeedometer(speed,dt) {
  setHudText(speedEl,String(Math.round(speed)));
  dialSpeed += (Math.min(speed,dialMaximum)-dialSpeed) * (dt ? 1-Math.exp(-dt*19) : 1);
  dialNeedle.style.transform = 'rotate('+angleAt(dialSpeed).toFixed(2)+'deg)';
}
