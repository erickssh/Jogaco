// Four-stroke firing events excite an original exhaust and intake model.
const rate = sampleRate;
const decay = seconds => Math.exp(-1 / (seconds * rate));
const smooth = seconds => 1 - decay(seconds);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

const profiles = [
  {
    banks: [0, 0, 0, 0], intervals: [1, 1, 1, 1], strength: [1, .91, .97, .83],
    idle: 850, redline: 5740, attack: .00026, tail: .00130,
    reflections: [.0022, .0045, .0038, .0061], tuning: [154, 331, 645],
    tone: [.55, .86, .50], texture: .18, exhaust: 1.07, intake: .32,
    color: 1380, level: 1.42, jitter: .013,
  },
  {
    banks: [0, 1, 0, 1, 0, 1], intervals: [1, 1, 1, 1, 1, 1],
    strength: [1, .93, .97, .95, .89, 1],
    idle: 770, redline: 5120, attack: .00034, tail: .00185,
    reflections: [.0026, .0059, .0040, .0074], tuning: [133, 264, 512],
    tone: [.81, .68, .38], texture: .128, exhaust: .93, intake: .40,
    color: 1120, level: 1.48, jitter: .010,
  },
  {
    banks: [0, 1, 0, 0, 1, 0, 1, 1], intervals: [.99, 1.01, .98, 1.02, 1.01, .99, 1, 1],
    strength: [1, .89, 1.04, .86, .98, .82, 1.06, .86],
    idle: 680, redline: 4380, attack: .00045, tail: .00265,
    reflections: [.0037, .0080, .0061, .0106], tuning: [95, 190, 405],
    tone: [1.07, .83, .28], texture: .15, exhaust: .99, intake: .19,
    color: 915, level: 1.35, jitter: .016,
  },
];

class Resonance {
  constructor(frequency, q) {
    const omega = 2 * Math.PI * frequency / rate;
    const alpha = Math.sin(omega) / (2 * q);
    this.b = alpha / (1 + alpha);
    this.r1 = 2 * Math.cos(omega) / (1 + alpha);
    this.r2 = (alpha - 1) / (1 + alpha);
    this.z1 = 0;
    this.z2 = 0;
  }

  process(input) {
    const impulse = this.b * input;
    const value = impulse + this.z1;
    this.z1 = this.r1 * value + this.z2;
    this.z2 = this.r2 * value - impulse;
    return value;
  }
}

// A warm idle comes from the pressure of each firing, with a lightly audible
// mechanical tick. These use the same firing events as the driving voice.
class InlineFourIdle {
  constructor() {
    this.rise = decay(.00115);
    this.fall = decay(.0055);
    this.tickDecay = decay(.0019);
    this.dcResponse = smooth(1 / (2 * Math.PI * 58));
    this.tickResponse = smooth(1 / (2 * Math.PI * 720));
    this.body = new Resonance(92, .77);
    this.muffler = new Resonance(184, .72);
    this.fast = this.slow = this.tick = this.dc = this.tickColor = 0;
  }

  fire(force, variation) {
    const pressure = force * (1 + .085 * variation);
    this.fast += pressure;
    this.slow += pressure;
    this.tick += pressure;
  }

  process(noise) {
    this.fast *= this.rise;
    this.slow *= this.fall;
    this.tick *= this.tickDecay;
    const pulse = this.slow - this.fast;
    this.dc += this.dcResponse * (pulse - this.dc);
    const pressure = pulse - this.dc;
    this.tickColor += this.tickResponse * (this.tick * noise - this.tickColor);
    return .30 * pressure + .16 * this.body.process(pressure)
      + .075 * this.muffler.process(pressure) + .09 * this.tickColor;
  }
}

class CombustionVoice {
  constructor(profile, seed) {
    this.profile = profile;
    this.idleVoice = profile === profiles[0] ? new InlineFourIdle() : null;
    this.seed = seed;
    this.attack = decay(profile.attack);
    this.expansion = decay(profile.tail);
    this.intakeDecay = decay(.00145);
    this.lowBody = new Resonance(profile.tuning[0], 1.1);
    this.midBody = new Resonance(profile.tuning[1], .92);
    this.upperBody = new Resonance(profile.tuning[2], .80);
    this.highPass = smooth(1 / (2 * Math.PI * 47));
    this.lowPass = smooth(1 / (2 * Math.PI * profile.color));
    this.airLowPass = smooth(1 / (2 * Math.PI * 1430));
    this.airHighPass = smooth(1 / (2 * Math.PI * 410));
    this.rpmResponse = smooth(.091);
    this.loadResponse = smooth(.055);
    this.hissResponse = smooth(.047);
    this.bankA = new Float32Array(2048);
    this.bankB = new Float32Array(2048);
    this.reflections = profile.reflections.map(seconds => Math.round(seconds * rate));
    this.fastA = 0;
    this.fastB = 0;
    this.tailA = 0;
    this.tailB = 0;
    this.intakePulse = 0;
    this.smoothedLoad = 0;
    this.smoothedMotion = 0;
    this.rpm = profile.idle;
    this.exhaustDC = 0;
    this.exhaustColor = 0;
    this.airLow = 0;
    this.airHigh = 0;
    this.firingOrder = 0;
    this.untilNextFire = 0;
    this.write = 0;
  }

  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 2147483648 - 1;
  }

  aim(revs, throttle, acceleration, shift, immediate = false) {
    const { idle, redline } = this.profile;
    this.targetRPM = idle + (redline - idle) * clamp(revs * .91 + throttle * .051, 0, 1);
    this.targetLoad = clamp(throttle * .76 + Math.max(0, acceleration) * .24, 0, 1);
    this.targetMotion = clamp(-acceleration * .40 + shift * .11, 0, .62);
    if (immediate) {
      this.rpm = this.targetRPM;
      this.smoothedLoad = this.targetLoad;
      this.smoothedMotion = this.targetMotion;
    }
  }

  process() {
    const p = this.profile;
    this.rpm += this.rpmResponse * (this.targetRPM - this.rpm);
    this.smoothedLoad += this.loadResponse * (this.targetLoad - this.smoothedLoad);
    this.smoothedMotion += this.hissResponse * (this.targetMotion - this.smoothedMotion);
    const load = this.smoothedLoad;
    const revs = (this.rpm - p.idle) / (p.redline - p.idle);

    this.untilNextFire -= this.rpm * p.banks.length / (120 * rate);
    if (this.untilNextFire <= 0) {
      const i = this.firingOrder;
      // Minor differences in cylinders and combustion keep the exhaust breathing.
      const variation = this.random();
      const force = p.strength[i] * (1 + variation * (.06 - .029 * load));
      this.idleVoice?.fire(force, variation);
      if (p.banks[i]) {
        this.fastB += force;
        this.tailB += force;
      } else {
        this.fastA += force;
        this.tailA += force;
      }
      this.intakePulse += force * (.45 + load * .55);
      this.untilNextFire += p.intervals[i] + this.random() * p.jitter;
      this.firingOrder = (i + 1) % p.banks.length;
    }

    this.fastA *= this.attack;
    this.fastB *= this.attack;
    this.tailA *= this.expansion;
    this.tailB *= this.expansion;
    this.intakePulse *= this.intakeDecay;

    const a = this.tailA - this.fastA;
    const b = this.tailB - this.fastB;
    const [aNear, aFar, bNear, bFar] = this.reflections;
    const i = this.write;
    // Positive and negative reflections from unequal paths in the exhaust.
    const outlet = .9 * a + .84 * b
      - .36 * this.bankA[(i - aNear) & 2047] + .22 * this.bankA[(i - aFar) & 2047]
      - .34 * this.bankB[(i - bNear) & 2047] + .24 * this.bankB[(i - bFar) & 2047];
    this.bankA[i] = a;
    this.bankB[i] = b;
    this.write = (i + 1) & 2047;

    this.exhaustDC += this.highPass * (outlet - this.exhaustDC);
    const pressure = outlet - this.exhaustDC;
    this.exhaustColor += this.lowPass * (pressure - this.exhaustColor);
    const body = p.tone[0] * this.lowBody.process(pressure)
      + p.tone[1] * this.midBody.process(pressure)
      + p.tone[2] * this.upperBody.process(pressure) * (.60 + .40 * load);

    const noise = this.random();
    const turbulence = noise * this.intakePulse;
    this.airLow += this.airLowPass * (turbulence - this.airLow);
    this.airHigh += this.airHighPass * (this.airLow - this.airHigh);
    const air = this.airLow - this.airHigh;

    const exhaust = (this.exhaustColor * p.exhaust + body)
      * (.18 + .56 * load + .095 * this.smoothedMotion) / (1 + .35 * revs);
    const intake = air * (p.texture + p.intake * load * (.5 + .5 * revs));
    const sound = p.level * (exhaust + intake);
    const driving = sound / (1 + .38 * Math.abs(sound));
    if (!this.idleVoice) return driving;
    const idle = this.idleVoice.process(noise);
    // Smoothstep leaves the driving voice exactly as it was above the
    // first few km/h, and eases back into idle as RPM falls again.
    const blend = clamp((revs + load * .028 - .022) / .085, 0, 1);
    if (blend === 1) return driving;
    const drivingWeight = blend * blend * (3 - 2 * blend);
    return idle + (driving - idle) * drivingWeight;
  }
}

class ArcadeCombustion extends AudioWorkletProcessor {
  constructor({ processorOptions: { profile, seed } }) {
    super();
    this.voice = new CombustionVoice(profiles[profile] ?? profiles[0], seed);
    this.voice.aim(0, 0, 0, 0, true);
    this.port.onmessage = ({ data }) => {
      if (data.stop) {
        this.stopped = true;
        return;
      }
      this.voice.aim(data.revs, data.load, data.acceleration, data.shift);
    };
  }

  process(_inputs, outputs) {
    if (this.stopped) return false;
    const out = outputs[0][0];
    if (!out) return true;
    for (let i = 0; i < out.length; i++) out[i] = this.voice.process() * .8;
    return true;
  }
}

registerProcessor('arcade-combustion', ArcadeCombustion);
