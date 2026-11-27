/* A sala usa a mesma física da corrida solo. Só o anfitrião simula o pelotão. */
const onlineRace = (() => {
  const step = 1 / 60;
  const duration = 180;
  const idle = { throttle: 0, steer: 0, drift: false };
  let port, match, host, ownId, field, frameNumber = 0, receivedFrame;
  let startAt, lastSend, accumulator, snapshotAt, finalResults;
  let inputSeq = 0, sentAt = 0, lastInput = '';
  let previousNotice = '';
  const rematchButton = document.querySelector('#online-again');
  const rematchStatus = document.querySelector('#rematch-status');
  rematchButton.onclick = () => {
    if (!match || !done) return;
    rematchButton.disabled = true;
    rematchStatus.textContent = 'Aguardando a confirmação dos outros jogadores.';
    rematchStatus.hidden = false;
    send('rematch', { raceId: match.id });
  };
  const remoteInputs = new Map();

  function send(type, payload) {
    port?.postMessage({ type, payload });
  }

  function prepare(nextMatch, isHost, id) {
    match = nextMatch;
    host = isHost;
    ownId = id;
    difficulty = match.difficulty;
    reset();
    const botCount = match.fillBots ? 8 - match.players.length : 0;
    field = createOpponents(difficulty).slice(0, botCount);
    match.players.forEach((player, i) => {
      const id = 8 - i;
      const slot = botCount + match.players.length - 1 - i;
      field.push({ ...gridPosition(slot), id, spec: roadCar, name: player.name,
        paint: id === 8 ? playerPaint : opponentPaint[id - 1] });
    });
    car = field.find(driver => driver.id === ownId);
    bots = field.filter(driver => driver !== car);
    camera.x = car.x;
    camera.y = car.y;
    setup.hidden = true;
    document.querySelector('.race-actions').hidden = true;
    document.querySelector('.result-actions').hidden = true;
    document.querySelector('#online-result-actions').hidden = false;
    rematchButton.disabled = false;
    rematchStatus.hidden = true;
    receivedFrame = -1;
    frameNumber = 0;
    accumulator = 0;
    lastSend = -Infinity;
    snapshotAt = 0;
    finalResults = null;
    remoteInputs.clear();
    startAt = performance.now() + 4500;
    positionEl.textContent = (1 + bots.filter(driver => aheadInRace(driver, car)).length) + ' / ' + field.length;
    previousNotice = lastInput = '';
    sentAt = -Infinity;
    renderStandings(raceOrder(field), 0);
    canvas.focus();
  }

  function results() {
    return match.players.map((player, i) => {
      const driver = field.find(entry => entry.id === 8 - i);
      return { name: player.name, id: driver.id, place: 1 + field.filter(other => aheadInRace(other, driver)).length,
        time: Number.isFinite(driver.finishedAt) ? driver.finishedAt : null };
    }).sort((a, b) => a.place - b.place);
  }

  function updateHud(now, remaining) {
    if (remaining > 0) {
      const seconds = Math.ceil(remaining / 1000);
      if (previousNotice !== String(seconds)) {
        raceNotice.textContent = 'Largada em ' + seconds;
        previousNotice = String(seconds);
      }
      raceNotice.hidden = false;
      return;
    }
    const clock = host || raceClosed ? elapsed : elapsed + Math.min(.15, (now - snapshotAt) / 1000);
    updateRaceHud(now, clock);
  }

  function drawLabels(ctx, local, opponents, left, top, width, height) {
    if (!field) return;
    ctx.save();
    const size = 12 * (window.devicePixelRatio || 1) / scale;
    ctx.font = '700 ' + size + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const driver of [local,...opponents]) {
      if (!driver.name || driver.x < left || driver.x > left + width || driver.y < top || driver.y > top + height) continue;
      const label = driver === local ? driver.name + ' (você)' : driver.name;
      const w = Math.min(ctx.measureText(label).width, size * 13) + size;
      const y = driver.y - 25 - size / 2;
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
    if (host) {
      const remaining = Math.max(0, startAt - now);
      if (!remaining && !raceClosed) {
        accumulator += dt;
        while (accumulator >= step) {
          elapsed += step;
          advanceRacers(field, driver => {
            if (driver === car) return done ? idle : controls;
            const input = remoteInputs.get(driver.id);
            return input && now - input.at < 850 && !Number.isFinite(driver.finishedAt) ? input.controls : idle;
          }, step, elapsed);
          accumulator -= step;
        }
        collectIntervals(field, elapsed);
        raceClosed = elapsed >= duration || field.every(driver => Number.isFinite(driver.finishedAt));
        if (!finalResults && (raceClosed || field.filter(driver => !driver.profile).every(driver => Number.isFinite(driver.finishedAt)))) {
          finalResults = results();
        }
      }
      if (now - lastSend >= (raceClosed ? 250 : 85)) {
        lastSend = now;
        const cars = field.map(({ id, x, y, a, vx, vy, spin, lane, progress, standing, finishedAt, checkpoint, drifting, missedLap, cutLap, gap, gapTo, lapStartedAt, lapEndedAt, lastLapTime }) =>
          ({ id, x, y, a, vx, vy, spin, lane, progress, standing,
            finishedAt: Number.isFinite(finishedAt) ? finishedAt : null, checkpoint, drifting, missedLap, cutLap, gap, gapTo, lapStartedAt, lapEndedAt, lastLapTime }));
        send('snapshot', { match, frame: frameNumber++, cars, remaining, elapsed, raceClosed, results: finalResults });
      }
      updateHud(now, remaining);
    } else if (snapshotAt) {
      const remaining = Math.max(0, startAt - now);
      if (!remaining && !raceClosed && now - snapshotAt < 450 && !done) {
        const signature = JSON.stringify(controls);
        if (now - sentAt > 250 || signature !== lastInput) {
          sentAt = now;
          lastInput = signature;
          send('input', { raceId: match.id, seq: ++inputSeq, controls });
        }
      }
      if (!remaining && !raceClosed && now - snapshotAt < 135) {
        const count = Math.max(1, Math.ceil(dt / step));
        for (let i = 0; i < count; i++) {
          const slice = dt / count;
          // Predict contact against moving cars too, so the guest cannot
          // drive through a rival between authoritative host snapshots.
          for (const driver of bots) {
            driver.x += driver.vx * slice;
            driver.y += driver.vy * slice;
          }
          driveCar(car, done ? idle : controls, slice);
          for (const driver of bots) carContact(car, driver);
          keepInsideMap(car);
          keepOutsideRails(car);
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
    receivedFrame = payload.frame;
    snapshotAt = now;
    startAt = snapshotAt + payload.remaining;
    elapsed = payload.elapsed;
    finalResults = payload.results;
    raceClosed = payload.raceClosed ?? Boolean(finalResults);
    for (const state of payload.cars) {
      const driver = field.find(entry => entry.id === state.id);
      if (!driver) continue;
      const { x, y, a } = driver;
      Object.assign(driver, state, { finishedAt: state.finishedAt ?? Infinity });
      if (smooth) {
        // Keep the last drawn pose while applying the host state immediately.
        smoothCarCorrection(driver, state.x - x, state.y - y, angleBetween(state.a, a), 90);
      } else {
        driver.viewOffsetX = driver.viewOffsetY = driver.viewOffsetAngle = 0;
      }
    }
  }

  addEventListener('message', event => {
    if (port || event.source !== parent || event.origin !== location.origin || event.data?.type !== 'vr-connect') return;
    port = event.ports[0];
    if (!port) return;
    port.onmessage = ({ data }) => {
      if (data.type === 'start') prepare(data.payload.match, data.payload.host, data.payload.id);
      if (data.type === 'snapshot' && !host) receiveSnapshot(data.payload);
      if (data.type === 'rematch-status' && data.payload.accepted === false) {
        rematchButton.disabled = false;
        rematchStatus.textContent = 'A confirmação falhou. Tente de novo.';
        rematchStatus.hidden = false;
      }
      if (data.type === 'input' && host && data.payload.raceId === match?.id) {
        const input = data.payload;
        if (input.seq > (remoteInputs.get(input.id)?.seq ?? 0)) {
          remoteInputs.set(input.id, { seq: input.seq, at: performance.now(), controls: input.controls });
        }
      }
    };
    send('connected');
  });

  return { tick, drawLabels };
})();
