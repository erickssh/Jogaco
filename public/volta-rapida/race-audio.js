/* All positions and velocities use circuit units. Web Audio owns the fades. */
const engineFamilyOptions = Object.freeze({inlineFour:0,v6:1,v8:2});
const engineGearCeilings = [.24,.40,.57,.78,1.03];

class RaceAudio {
  constructor(button) {
    this.button = button;
    this.engines = new Map();
    this.crowds = new Map();
    this.samples = {};
    this.nextMix = 0;
    this.muted = false;
    this.volume = 1;
    this.paused = false;
    this.pauseTransition = Promise.resolve();
    this.language = 'pt-BR';
    try { this.muted = localStorage.getItem('volta-rapida-muted') === '1'; } catch {}
    const unlock = event => {
      if (event.isTrusted && event.target !== button && !this.muted && this.context?.state !== 'running') {
        void this.unlock();
      }
    };
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
    addEventListener('race-audio-unlock', () => { if (!this.muted) void this.unlock(); });
    button.addEventListener('click', async () => {
      if (this.context?.state === 'running' && !this.muted) this.muted = true;
      else {
        this.muted = false;
        await this.unlock();
      }
      try { localStorage.setItem('volta-rapida-muted', this.muted ? '1' : '0'); } catch {}
      this.updateButton();
    });
    this.updateButton();
  }

  updateButton() {
    const audible = !this.muted && this.context?.state === 'running';
    if (this.master) this.target(this.master.gain, audible ? .82*this.volume : 0, .035);
    this.button.textContent = OverdriveI18n.text(this.language,audible?'soundOn':'soundEnable');
    this.button.setAttribute('aria-pressed', String(audible));
    if (!(window.AudioContext || window.webkitAudioContext)) {
      this.button.textContent = OverdriveI18n.text(this.language,'soundUnavailable');
      this.button.disabled = true;
    }
  }

  setPreferences({ effectsVolume, muted, language }) {
    if (Number.isFinite(effectsVolume)) this.volume = Math.max(0,Math.min(1,effectsVolume));
    this.muted = muted === true;
    this.language = OverdriveI18n.normalizeLanguage(language);
    this.updateButton();
  }

  async unlock() {
    void this.preload();
    if (this.paused) return;
    try {
      if (this.context && this.context.state !== 'running') await this.context.resume();
    } catch {}
    this.updateButton();
  }

  setPaused(paused) {
    this.paused = paused;
    this.pauseTransition = this.pauseTransition.catch(() => {}).then(async () => {
      if (!this.context) return;
      if (this.paused && this.context.state === 'running') await this.context.suspend();
      else if (!this.paused && !this.muted && this.context.state === 'suspended') await this.context.resume();
    }).catch(() => {});
  }

  preload() {
    return this.preparation ??= this.prepareAudio();
  }

  async prepareAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      this.context = new AudioContext({ latencyHint:'interactive' });
      this.setup();
      this.context.onstatechange = () => this.updateButton();
    } catch {
      return;
    }
    // Decoding and module registration work while playback is suspended.
    const names = ['crowd', 'shutter', 'cheer-small', 'cheer-wide', 'handbrake'];
    const loadSample = async name => {
      const response = await fetch('./audio/' + name + '.wav');
      if (response.ok) this.samples[name] = await this.context.decodeAudioData(await response.arrayBuffer());
    };
    await Promise.allSettled([this.loadEngines(), ...names.map(loadSample)]);
  }

  setup() {
    const ctx = this.context;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const guard = ctx.createDynamicsCompressor();
    guard.threshold.value = -14;
    guard.knee.value = 14;
    guard.ratio.value = 3;
    guard.attack.value = .006;
    guard.release.value = .18;
    this.master.connect(guard).connect(ctx.destination);
    this.motorBus = ctx.createGain();
    this.motorBus.connect(this.master);
  }

  async loadEngines() {
    if (!this.context.audioWorklet || !window.AudioWorkletNode) return;
    await this.context.audioWorklet.addModule('./audio/engine-worklet.js?v=73');
    this.enginesReady = true;
  }

  target(param, value, timeConstant = .06) {
    param.setTargetAtTime(value, this.context.currentTime, timeConstant);
  }

  emitter(bus = this.master) {
    const gain = this.context.createGain();
    const pan = this.context.createStereoPanner?.();
    gain.gain.value = 0;
    if (pan) gain.connect(pan).connect(bus);
    else gain.connect(bus);
    return { gain, pan };
  }

  spatial(point, listener, reach, range) {
    const dx = point.x - listener.x;
    const dy = point.y - listener.y;
    const distance = Math.hypot(dx, dy);
    const falloff = Math.max(0, 1 - distance / range);
    return { volume: (falloff * falloff * (3 - 2 * falloff)) / (1 + (distance / reach) ** 2),
      pan: Math.max(-.86, Math.min(.86, dx / (reach * 1.25))) };
  }

  engine(driver, speed) {
    const ctx = this.context;
    const output = this.emitter(this.motorBus);
    const profile = engineFamilyOptions[driver.spec?.engineSound] ?? engineFamilyOptions.inlineFour;
    const processor = this.enginesReady ? new AudioWorkletNode(ctx, 'arcade-combustion', {
      numberOfInputs:0,
      numberOfOutputs:1,
      outputChannelCount:[1],
      processorOptions:{profile,seed:8011+driver.id*3719},
    }) : null;
    processor?.connect(output.gain);
    const tire = ctx.createGain();
    tire.gain.value = 0;
    tire.connect(output.pan || this.motorBus);
    return { ...output, processor, tire, skid:null, speed, gear:0, shift:0, acceleration:0, lastSeen:0 };
  }

  stopEngine(voice) {
    voice.skid?.stop();
    voice.processor?.port.postMessage({stop:true});
    voice.processor?.disconnect();
    voice.gain.disconnect();
    voice.tire.disconnect();
    voice.pan?.disconnect();
  }

  mixEngines(drivers, focus, listener, now, dt) {
    const nearby = drivers.map(driver => ({ driver, local:driver === focus,
      ...this.spatial(driver, listener, 280, 830) }));
    const rivals = nearby.filter(item => !item.local && item.volume > .012)
      .sort((a,b) => (b.volume + (this.engines.has(b.driver.id) ? .025 : 0)) -
        (a.volume + (this.engines.has(a.driver.id) ? .025 : 0))).slice(0,4);
    const mix = [...nearby.filter(item => item.local), ...rivals];
    const rivalTrim = 1 / Math.sqrt(Math.max(1, rivals.reduce((sum, item) => sum + item.volume, 0)));
    for (const {driver, local, volume, pan} of mix) {
      let voice = this.engines.get(driver.id);
      const speed = Math.hypot(driver.vx, driver.vy);
      if (!voice) {
        voice = this.engine(driver,speed);
        this.engines.set(driver.id, voice);
      }
      const {processor, tire, gain} = voice;
      voice.lastSeen = now;
      const spec = driver.spec ?? roadCar;
      const measured = (speed - voice.speed) / (dt * spec.acceleration);
      voice.speed = speed;
      voice.acceleration += (Math.max(-1.8,Math.min(1.5,measured)) - voice.acceleration) * (1 - Math.exp(-dt/.064));
      const speedRatio = Math.min(1, speed / spec.topSpeed);
      const previousGear = voice.gear;
      while (voice.gear < engineGearCeilings.length - 1 && speedRatio >= engineGearCeilings[voice.gear]) voice.gear++;
      while (voice.gear > 0 && speedRatio < engineGearCeilings[voice.gear-1] * .76) voice.gear--;
      voice.shift = previousGear === voice.gear ? Math.max(0,voice.shift-dt*5.5) : 1;
      processor?.port.postMessage({
        revs:speedRatio/engineGearCeilings[voice.gear],
        load:(driver.motorLoad ?? 0)*(1-voice.shift*.49),
        acceleration:voice.acceleration,
        shift:voice.shift,
      });
      const lateral = Math.abs(driver.vy * Math.cos(driver.a) - driver.vx * Math.sin(driver.a));
      const slip = driver.drifting ? Math.min(1, Math.max(0, (lateral - 18) / 82)) * Math.min(1, speed / 168) : 0;
      this.target(gain.gain, (local ? .64 : .27 * volume * rivalTrim) * (1 - slip*.16));
      if (voice.pan) this.target(voice.pan.pan, local ? pan * .2 : pan);
      if (!voice.skid && slip && this.samples.handbrake) {
        const source = this.context.createBufferSource();
        source.buffer = this.samples.handbrake;
        source.loop = true;
        source.loopStart = .30;
        source.loopEnd = 1.14;
        source.connect(tire);
        source.start();
        voice.skid = source;
      }
      this.target(tire.gain, slip ** .68 * (local ? .87 : .39 * volume * rivalTrim), slip ? .045 : .09);
    }
    for (const [id, voice] of this.engines) {
      const idle = now - voice.lastSeen;
      if (idle > 420) {
        this.stopEngine(voice);
        this.engines.delete(id);
      } else if (idle > 0) {
        this.target(voice.gain.gain, 0);
        this.target(voice.tire.gain, 0);
      }
    }
  }

  mixCrowd({ id, x, y, activity }, listener, now) {
    const audio = this.samples.crowd;
    if (!audio) return;
    const ctx = this.context;
    const {volume, pan} = this.spatial({x,y}, listener, 550, 1170);
    const level = activity * volume * (id === 'finish' ? .52 : .42);
    let voice = this.crowds.get(id);
    if (!voice && level > .006) {
      const output = this.emitter(), source = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1800;
      source.buffer = audio;
      source.loop = true;
      source.playbackRate.value = id === 'finish' ? 1 : .97;
      source.connect(filter).connect(output.gain);
      source.start(0, now * .0017 % audio.duration);
      voice = { ...output, source, filter, lastHeard:now, cheered:false };
      this.crowds.set(id, voice);
    }
    if (!voice) return;
    if (!voice.cheered && activity>.34 && level>.023) {
      const shout = this.samples[id === 'finish' ? 'cheer-wide' : 'cheer-small'];
      if (shout) {
        voice.cheered = true;
        const source = ctx.createBufferSource(), layer = ctx.createGain();
        source.buffer = shout;
        source.playbackRate.value = .94 + Math.random()*.13;
        layer.gain.value = id === 'finish' ? .56 : .58;
        source.connect(layer).connect(voice.filter);
        source.onended = () => layer.disconnect();
        source.start();
      }
    }
    if (level > .003) voice.lastHeard = now;
    this.target(voice.gain.gain, level, .17);
    this.target(voice.filter.frequency, 950 + 4100 * volume, .16);
    if (voice.pan) this.target(voice.pan.pan, pan, .14);
    if (now - voice.lastHeard > 1300) {
      voice.source.stop();
      voice.gain.disconnect();
      voice.pan?.disconnect();
      this.crowds.delete(id);
    }
  }

  mix({ now, drivers, focus, listener, crowds }) {
    if (this.context?.state !== 'running') return;
    if (now < this.nextMix) return;
    const dt = Math.min(.1, (now - this.nextMix + 32) / 1000);
    this.nextMix = now + 32;
    this.mixEngines(this.muted ? [] : drivers, focus, listener, now, dt);
    for (const crowd of crowds) this.mixCrowd(this.muted ? {...crowd, activity:0} : crowd, listener, now);
  }

  signal(phase) {
    if (this.muted || this.context?.state !== 'running') return;
    const ctx = this.context;
    const at = ctx.currentTime;
    const green = phase === 'green';
    const base = phase === 'red' ? 440 : phase === 'amber' ? 552 : 744;
    const notes = green ? [[1,.245,1],[1.5,.21,.42],[2,.09,.21]] : [[1,.135,1],[2,.061,.23]];
    for (const [ratio,length,volume] of notes) {
      const tone = ctx.createOscillator(), envelope = ctx.createGain();
      tone.frequency.setValueAtTime(base * ratio, at);
      tone.frequency.exponentialRampToValueAtTime(base * ratio * (green ? 1.035 : .991), at + length);
      envelope.gain.setValueAtTime(.0001, at);
      envelope.gain.exponentialRampToValueAtTime(.25 * volume, at + .009);
      envelope.gain.exponentialRampToValueAtTime(.0001, at + length);
      tone.connect(envelope).connect(this.master);
      tone.start(at);
      tone.stop(at + length + .01);
    }
  }

  shutter(position, listener, shot) {
    if (this.muted || this.context?.state !== 'running' || !this.samples.shutter) return;
    const {volume, pan} = this.spatial(position, listener, 490, 1000);
    if (volume < .008) return;
    const output = this.emitter();
    const source = this.context.createBufferSource();
    source.buffer = this.samples.shutter;
    source.playbackRate.value = [1,1.04,.98][shot];
    output.gain.gain.value = .55 * volume;
    if (output.pan) output.pan.pan.value = pan;
    source.connect(output.gain);
    source.onended = () => { output.gain.disconnect(); output.pan?.disconnect(); };
    source.start();
  }
}
