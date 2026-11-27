/* A sala usa a mesma física da corrida solo. Só o anfitrião simula o pelotão. */
const onlineRace = (() => {
  const step = 1 / 60;
  const duration = 180;
  const idle = { throttle: 0, steer: 0, drift: false };
  let port, match, host, field, frameNumber = 0, receivedFrame;
  let startAt, lastSend, accumulator, snapshotAt, finalResults;
  let hostStartEpoch, clockOffset, hasSyncedLaunch;
  let retirement = null, rematchKey = '';
  let inputSeq = 0, sentAt = 0, lastInput = '';
  const rematchButton = document.querySelector('#online-again');
  const rematchStatus = document.querySelector('#rematch-status');
  rematchButton.onclick = () => {
    if (!match || !done) return;
    rematchButton.disabled = true;
    rematchKey = 'rematchWaiting';
    translateStatus();
    send('rematch', { raceId: match.id });
  };
  const remoteInputs = new Map();

  function send(type, payload) {
    port?.postMessage({ type, payload });
  }

  function reportStart(id, success) {
    send(success ? 'race-started' : 'start-failed',{id});
  }

  function prepareStart(id, action) {
    if (!externalMenu) {
      action();
      return;
    }
    try {
      action();
      pendingRacePresentation=id;
    } catch (error) {
      console.error('Falha ao preparar a largada',error);
      reportStart(id,false);
      pauseForMenu();
    }
  }

  function prepare(nextMatch, isHost, id) {
    finishRetirement(false);
    match = nextMatch;
    host = isHost;
    difficulty = match.difficulty;
    reset();
    const botCount = match.fillBots ? 8 - match.players.length : 0;
    const names = racePlayerNames(match.players);
    field = createOpponents(difficulty, { count: botCount, reservedNames: names, assignNames: host });
    field.forEach((driver,index) => {
      const model = match.botModels?.[index];
      driver.carModel = OverdriveCars.isCarModel(model) ? model : OverdriveCars.carModels[index].id;
    });
    match.players.forEach((player, i) => {
      const id = 8 - i;
      const slot = botCount + match.players.length - 1 - i;
      field.push({ ...gridPosition(slot), id, spec: roadCar, name: names[i],
        carModel: OverdriveCars.isCarModel(player.carModel) ? player.carModel : OverdriveCars.defaultModel,
        paint: id === 8 ? playerPaint : opponentPaint[id - 1] });
    });
    car = field.find(driver => driver.id === id);
    bots = field.filter(driver => driver !== car);
    camera.x = car.x;
    camera.y = car.y;
    setup.hidden = true;
    if (externalMenu) gameApp.classList.remove('menu-scene');
    document.querySelector('.result-actions').hidden = true;
    document.querySelector('#online-result-actions').hidden = false;
    rematchButton.disabled = false;
    rematchKey = '';
    translateStatus();
    receivedFrame = -1;
    frameNumber = 0;
    accumulator = 0;
    lastSend = -Infinity;
    snapshotAt = 0;
    finalResults = null;
    remoteInputs.clear();
    startAt = performance.now() + 4500;
    hostStartEpoch = host ? performance.timeOrigin + startAt : null;
    clockOffset = null;
    hasSyncedLaunch = host;
    positionEl.textContent = (1 + bots.filter(driver => aheadInRace(driver, car)).length) + ' / ' + field.length;
    lastInput = '';
    sentAt = -Infinity;
    renderStandings(raceOrder(field), 0);
    canvas.focus();
  }

  function results() {
    return match.players.map((_, i) => {
      const driver = field.find(entry => entry.id === 8 - i);
      return { name: driver.name, id: driver.id, place: 1 + field.filter(other => aheadInRace(other, driver)).length,
        time: Number.isFinite(driver.finishedAt) ? driver.finishedAt : null };
    }).sort((a, b) => a.place - b.place);
  }

  function updateHud(now, remaining) {
    if (remaining <= 0 || isRetired(car)) updateRaceHud(now);
  }

  function drawLabels(ctx, local, opponents, left, top, width, height) {
    if (!field) return;
    ctx.save();
    const size = 12 * (window.devicePixelRatio || 1) / scale;
    ctx.font = '700 ' + size + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const driver of [local,...opponents]) {
      if (isRetired(driver) || !driver.name || driver.x < left || driver.x > left + width || driver.y < top || driver.y > top + height) continue;
      const label = driver === local ? driver.name + translate('youTag') : driver.name;
      const w = Math.min(ctx.measureText(label).width, size * 13) + size;
      const y = driver.y - 38 - size / 2;
      ctx.fillStyle = '#20312aee';
      ctx.beginPath();
      ctx.roundRect(driver.x - w / 2, y - size * .72, w, size * 1.44, size * .35);
      ctx.fill();
      ctx.strokeStyle = (driver.paint ?? playerPaint)[2];
      ctx.lineWidth = size * .10;
      ctx.stroke();
      ctx.fillStyle = '#fff4df';
      ctx.fillText(label, driver.x, y, w - size * .6);
    }
    ctx.restore();
  }

  function tick(dt, now) {
    if (!match) return false;
    const controls = raceControls();
    retryRetirement(now);
    if (host) {
      const remaining = Math.max(0, startAt - now);
      if (!remaining && !raceClosed) {
        accumulator += Math.min(dt, (now - startAt) / 1000);
        while (accumulator >= step) {
          elapsed += step;
          advanceRacers(field, driver => {
            if (driver === car) return done ? idle : controls;
            const input = remoteInputs.get(driver.id);
            return input && now - input.at < 850 && !raceTerminal(driver) ? input.controls : idle;
          }, step, elapsed);
          accumulator -= step;
        }
        collectIntervals(field, elapsed);
        raceClosed = elapsed >= duration || field.every(raceTerminal);
        if (!finalResults && (raceClosed || field.filter(driver => !driver.profile).every(raceTerminal))) {
          finalResults = results();
        }
      }
      if (now - lastSend >= (raceClosed ? 250 : 85)) {
        lastSend = now;
        const cars = field.map(({ id, name, x, y, a, vx, vy, spin, lane, progress, standing, finishedAt, retiredAt, checkpoint, drifting, motorLoad, steeringAngle, gap, gapTo, lapStartedAt, lapEndedAt, lastLapTime }) =>
          ({ id, name, x, y, a, vx, vy, spin, lane, progress, standing,
            finishedAt: Number.isFinite(finishedAt) ? finishedAt : null, retiredAt, checkpoint, drifting, motorLoad, steeringAngle, gap, gapTo, lapStartedAt, lapEndedAt, lastLapTime }));
        send('snapshot', { match, frame: frameNumber++, cars, remaining, startEpoch:hostStartEpoch,
          elapsed, raceClosed, results: finalResults });
      }
      updateHud(now, remaining);
    } else if (snapshotAt) {
      const remaining = Math.max(0, startAt - now);
      if (!raceClosed && now - snapshotAt < 450 && !done) {
        const signature = JSON.stringify(controls);
        if (now - sentAt > 250 || signature !== lastInput) {
          sentAt = now;
          lastInput = signature;
          send('input', { raceId: match.id, seq: ++inputSeq, controls });
        }
      }
      if (!remaining && !raceClosed && now - snapshotAt < 135) {
        const playable = Math.min(dt, (now - startAt) / 1000);
        const count = Math.max(1, Math.ceil(playable / step));
        for (let i = 0; i < count; i++) {
          const slice = playable / count;
          // Predict contact against moving cars too, so the guest cannot
          // drive through a rival between authoritative host snapshots.
          for (const driver of bots) {
            if(isRetired(driver)) continue;
            driver.x += driver.vx * slice;
            driver.y += driver.vy * slice;
          }
          if(isRetired(car)) continue;
          const {x,y}=car;
          driveCar(car, done ? idle : controls, slice);
          for (const driver of bots) if(!isRetired(driver)) carContact(car, driver);
          resolveRaceEnvironment(car,x,y);
          car.lane=TRACK.offsetAt(car.x,car.y);
        }
      }

      updateHud(now, remaining);
    }
    return true;
  }

  function receiveSnapshot(payload) {
    if (!match || payload.match.id !== match.id || payload.frame <= receivedFrame) return;
    const now = performance.now();
    const smooth = snapshotAt > 0 && now - snapshotAt < 500 && !payload.remaining;
    if (!snapshotAt) startAt = now + payload.remaining;
    if (Number.isFinite(payload.startEpoch)) {
      hostStartEpoch = payload.startEpoch;
      syncLaunch(now);
    }
    if (!payload.remaining && !hasSyncedLaunch) startAt = Math.min(startAt, now);
    receivedFrame = payload.frame;
    snapshotAt = now;
    elapsed = payload.elapsed;
    finalResults = payload.results;
    raceClosed = payload.raceClosed ?? Boolean(finalResults);
    for (const state of payload.cars) {
      const driver = field.find(entry => entry.id === state.id);
      if (!driver) continue;
      const { x, y, a } = driver;
      Object.assign(driver, state, { finishedAt: state.finishedAt ?? Infinity });
      if (driver===car && (raceTerminal(driver) || raceClosed)) finishRetirement(true);
      if (smooth) {
        // Keep the last drawn pose while applying the host state immediately.
        smoothCarCorrection(driver, state.x - x, state.y - y, angleBetween(state.a, a), 90);
      } else {
        driver.viewOffsetX = driver.viewOffsetY = driver.viewOffsetAngle = 0;
      }
    }
  }

  function syncLaunch(now) {
    if (!Number.isFinite(hostStartEpoch) || !Number.isFinite(clockOffset)) return;
    // Keep the final instant stable once the last lamp is about to change.
    if (hasSyncedLaunch && startAt - now < 300) return;
    startAt = hostStartEpoch - clockOffset - performance.timeOrigin;
    hasSyncedLaunch = true;
  }

  addEventListener('message', async event => {
    if (port || event.source !== parent || event.origin !== location.origin || event.data?.type !== 'vr-connect') return;
    port = event.ports[0];
    if (!port) return;
    port.onmessage = async ({ data }) => {
      if (!ready && !(await gameReady)) return;
      if (data.type === 'solo-start' && externalMenu) {
        const {id, difficulty, bots, carModel = OverdriveCars.defaultModel} = data.payload ?? {};
        if (Object.hasOwn(difficultySettings,difficulty) && Number.isInteger(bots) && bots>=0 && bots<=opponentPaint.length
            && OverdriveCars.isCarModel(carModel)) {
          prepareStart(id,()=>{
            stop();
            beginSolo(difficulty,bots,carModel);
          });
        } else {
          reportStart(id,false);
        }
      }
      if (data.type === 'return-menu' && externalMenu) pauseForMenu();
      if (data.type === 'preferences' && externalMenu && data.payload) setRacePreferences(data.payload);
      if (data.type === 'start') {
        const {match: nextMatch, host, id} = data.payload;
        prepareStart(nextMatch.id,()=>prepare(nextMatch,host,id));
      }
      if (data.type === 'snapshot' && !host) receiveSnapshot(data.payload);
      if (data.type === 'clock' && !host && data.payload.raceId === match?.id &&
          Number.isFinite(data.payload.offset)) {
        clockOffset = data.payload.offset;
        syncLaunch(performance.now());
      }
      if (data.type === 'rematch-status' && data.payload.accepted === false) {
        rematchButton.disabled = false;
        rematchKey = 'rematchFailed';
        translateStatus();
      }
      if (data.type === 'race-room-menu') updateRoomMenu(data.payload);
      if (data.type === 'open-race-menu') openRaceMenu();
      if (data.type === 'retire' && host && !raceClosed && data.payload.raceId === match?.id) {
        const driver = field.find(entry => entry.id === data.payload.id && !entry.profile);
        if (driver) retireDriver(driver);
      }
      if (data.type === 'input' && host && data.payload.raceId === match?.id) {
        const input = data.payload;
        if (input.seq > (remoteInputs.get(input.id)?.seq ?? 0)) {
          remoteInputs.set(input.id, { seq: input.seq, at: performance.now(), controls: input.controls });
        }
      }
    };
    if (externalMenu) send('loading-progress',{progress:preparationProgress});
    if (ready || await gameReady) send('connected');
    else send('load-failed');
  });

  function stop() {
    finishRetirement(false);
    match = field = null;
    remoteInputs.clear();
  }

  function translateStatus() {
    rematchStatus.hidden = !rematchKey;
    rematchStatus.textContent = rematchKey ? translate(rematchKey) : '';
  }

  function finishRetirement(success) {
    retirement?.resolve(success);
    retirement = null;
  }

  function retryRetirement(now) {
    if (!retirement) return;
    if (now > retirement.deadline) { finishRetirement(false); return; }
    if (now - retirement.sent < 300) return;
    retirement.sent = now;
    send('retire', { raceId: match.id });
  }

  function retire() {
    if (!match || raceClosed || raceTerminal(car)) return Promise.resolve(true);
    if (host) { retireDriver(car); return Promise.resolve(true); }
    return new Promise(resolve => {
      const now = performance.now();
      retirement = { resolve, deadline: now + 4800, sent: -Infinity };
      retryRetirement(now);
    });
  }

  return { tick, drawLabels, stop, translateStatus, retire, active: () => Boolean(match),
    returnHome: () => send('race-home', { raceId: match?.id }),
    roomAction: (action, value) => send('race-room-action', { action, value }),
    reportStart, reportLoading: progress => send('loading-progress',{progress}),
    showMenu: screen => send('menu',{screen}),
    requestFullscreen: () => send('fullscreen'),
    launchTime: () => match && (host || snapshotAt) ? startAt : 0 };
})();
