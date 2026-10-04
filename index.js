/*
 SOULCHAIN — Web Audio Module 2.0
 First prototype: Seed -> Harmony -> Ghost -> Shadow -> Space -> Memory

 This file is intentionally dependency-light. It imports the official WAM SDK
 from jsDelivr so the plugin can be loaded directly from a public URL.
*/
import { WebAudioModule } from "https://cdn.jsdelivr.net/npm/@webaudiomodules/sdk@1.0.0/+esm";
import { createElement } from "./gui.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));

export default class Soulchain extends WebAudioModule {
  static get descriptor() {
    return {
      name: "Soulchain",
      vendor: "Seclorum",
      version: "0.1.0",
      identifier: "com.seclorum.soulchain",
      isInstrument: true,
      hasMidiInput: true,
      hasMidiOutput: false,
      thumbnail: "",
      keywords: ["instrument", "generative", "ambient", "chords", "mutation"]
    };
  }

  async createAudioNode() {
    const ctx = this.audioContext;

    // Output graph. All voices feed this gain, which is the WAM output node.
    const out = ctx.createGain();
    out.gain.value = 0.78;

    const master = ctx.createGain();
    master.gain.value = 0.72;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.18;

    const delay = ctx.createDelay(2.0);
    delay.delayTime.value = 0.31;

    const feedback = ctx.createGain();
    feedback.gain.value = 0.18;

    const wet = ctx.createGain();
    wet.gain.value = 0.22;

    master.connect(compressor);
    compressor.connect(out);

    master.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(out);

    this._ctx = ctx;
    this._out = out;
    this._master = master;
    this._voices = new Set();
    this._timers = new Set();
    this._playing = false;
    this._tempo = 82;
    this._root = 48;
    this._stage = 0;
    this._seed = [0, 3, 7, 10];
    this._step = 0;
    this._mutation = 0;
    this._level = 0.8;

    // State is communicated to the GUI through this callback.
    this._listeners = new Set();

    // MIDI is attached by WAM hosts that call scheduleEvent.
    return out;
  }

  async createGui() {
    return createElement(this);
  }

  getParamValue(paramId) {
    if (paramId === "tempo") return this._tempo;
    if (paramId === "level") return this._level;
    if (paramId === "stage") return this._stage;
    return 0;
  }

  getParamValueNormalized(paramId) {
    if (paramId === "tempo") return (this._tempo - 50) / 130;
    if (paramId === "level") return this._level;
    if (paramId === "stage") return this._stage / 5;
    return 0;
  }

  setParamValue(paramId, value) {
    if (paramId === "tempo") this._tempo = clamp(value, 50, 180);
    if (paramId === "level") this._level = clamp(value, 0, 1);
    if (paramId === "stage") this._stage = Math.round(clamp(value, 0, 5));
    this._notify();
  }

  setParamValueNormalized(paramId, value) {
    if (paramId === "tempo") this.setParamValue(paramId, 50 + clamp(value, 0, 1) * 130);
    else if (paramId === "level") this.setParamValue(paramId, value);
    else if (paramId === "stage") this.setParamValue(paramId, Math.round(clamp(value, 0, 1) * 5));
  }

  scheduleEvent(event) {
    // WAM MIDI events are commonly shaped as {type:"wam-midi", time, data}.
    if (!event || event.type !== "wam-midi") return;
    const d = event.data;
    if (!d) return;

    const status = d[0] & 0xf0;
    const note = d[1];
    const velocity = (d[2] ?? 0) / 127;

    if (status === 0x90 && velocity > 0) {
      this.noteOn(note, velocity);
    } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
      this.noteOff(note);
    }
  }

  _notify() {
    for (const fn of this._listeners) {
      try { fn(this.getState()); } catch {}
    }
  }

  onState(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  getState() {
    const names = ["SEED", "HARMONY", "GHOST", "SHADOW", "SPACE", "MEMORY"];
    return {
      playing: this._playing,
      tempo: this._tempo,
      level: this._level,
      stage: this._stage,
      stageName: names[this._stage],
      mutation: this._mutation,
      seed: [...this._seed]
    };
  }

  _freq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  _voice({freq, duration=1.0, type="sine", gain=0.12, detune=0, pan=0, filter=1800}) {
    const ctx = this._ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;

    const g = ctx.createGain();
    const p = ctx.createStereoPanner();
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setTargetAtTime(filter, now, 0.015);
    f.Q.value = 0.55;

    p.pan.value = clamp(pan, -1, 1);

    osc.connect(f);
    f.connect(g);
    g.connect(p);
    p.connect(this._master);

    const peak = clamp(gain * this._level, 0, 0.35);
    const attack = Math.min(0.12, Math.max(0.008, duration * 0.12));
    const release = Math.min(0.45, Math.max(0.06, duration * 0.3));
    const end = now + duration;

    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + attack);
    g.gain.setValueAtTime(Math.max(0.0002, peak), Math.max(now + attack, end - release));
    g.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.start(now);
    osc.stop(end + 0.03);

    const voice = {osc, g};
    this._voices.add(voice);
    osc.onended = () => this._voices.delete(voice);
    return voice;
  }

  _chord(root) {
    return [root, root + 3, root + 7, root + 10];
  }

  _playSeedBeat() {
    const dur = 60 / this._tempo * 1.8;
    const scale = [0, 2, 3, 5, 7, 10];
    const n = this._root + scale[this._seed[this._step % this._seed.length] % scale.length];
    this._voice({
      freq: this._freq(n),
      duration: dur * 0.8,
      type: "triangle",
      gain: 0.16,
      pan: -0.15,
      filter: 2200
    });
  }

  _playHarmonyBeat() {
    const dur = 60 / this._tempo * 2.5;
    const root = this._root + [0, 3, 5, 7][this._step % 4];
    this._chord(root).forEach((n, i) => this._voice({
      freq: this._freq(n),
      duration: dur,
      type: i % 2 ? "sine" : "triangle",
      gain: 0.055,
      detune: i === 2 ? 4 : -3,
      pan: (i - 1.5) / 3,
      filter: 1400 + i * 250
    }));
  }

  _playGhostBeat() {
    const dur = 60 / this._tempo * 1.7;
    const intervals = this._seed.map((x, i) => x + (i % 2 ? 12 : 0));
    const n = this._root + intervals[this._step % intervals.length];
    this._voice({
      freq: this._freq(n + 12),
      duration: dur * 0.75,
      type: "sine",
      gain: 0.13,
      detune: 7,
      pan: Math.sin(this._step * 0.9) * 0.65,
      filter: 3200
    });
  }

  _playShadowBeat() {
    const dur = 60 / this._tempo * 2;
    const n = this._root - 12 + [0, 0, 3, -2][this._step % 4];
    this._voice({
      freq: this._freq(n),
      duration: dur * 0.9,
      type: "sawtooth",
      gain: 0.12,
      filter: 520
    });
  }

  _playSpaceBeat() {
    const dur = 60 / this._tempo * 4;
    const n = this._root + 24 + [0, 7, 10, 12][this._step % 4];
    this._voice({
      freq: this._freq(n),
      duration: dur,
      type: "sine",
      gain: 0.035,
      detune: -11,
      pan: -0.75,
      filter: 900
    });
    this._voice({
      freq: this._freq(n + 12),
      duration: dur * 0.8,
      type: "sine",
      gain: 0.025,
      detune: 11,
      pan: 0.75,
      filter: 1300
    });
  }

  _playMemoryBeat() {
    const dur = 60 / this._tempo * 3.5;
    const n = this._root + [0, 3, 7, 10][this._step % 4] + 24;
    this._voice({
      freq: this._freq(n),
      duration: dur,
      type: "triangle",
      gain: 0.045,
      detune: this._mutation * 2,
      pan: Math.sin(this._step * 0.45),
      filter: 1700
    });
  }

  _tick() {
    if (!this._playing) return;
    this._playSeedBeat();
    if (this._stage >= 1) this._playHarmonyBeat();
    if (this._stage >= 2) this._playGhostBeat();
    if (this._stage >= 3) this._playShadowBeat();
    if (this._stage >= 4) this._playSpaceBeat();
    if (this._stage >= 5) this._playMemoryBeat();

    this._step++;
    this._notify();

    const ms = Math.max(80, (60 / this._tempo) * 1000 * 1.0);
    const id = setTimeout(() => {
      this._timers.delete(id);
      this._tick();
    }, ms);
    this._timers.add(id);
  }

  async start() {
    await this._ctx.resume();
    if (this._playing) return;
    this._playing = true;
    this._step = 0;
    this._tick();
  }

  stop() {
    this._playing = false;
    for (const id of this._timers) clearTimeout(id);
    this._timers.clear();

    const now = this._ctx.currentTime;
    for (const v of this._voices) {
      try {
        v.g.gain.cancelScheduledValues(now);
        v.g.gain.setTargetAtTime(0.0001, now, 0.025);
        v.osc.stop(now + 0.12);
      } catch {}
    }
    this._voices.clear();
    this._notify();
  }

  mutate() {
    // Musical mutation: rotate, transpose, and alter one interval.
    const next = [...this._seed];
    const shift = Math.random() < 0.5 ? 1 : -1;
    const idx = Math.floor(Math.random() * next.length);
    next[idx] = ((next[idx] + shift * (Math.random() < 0.5 ? 2 : 3)) + 12) % 12;
    next.push(next.shift());
    this._seed = next;
    this._mutation++;
    this._stage = Math.min(5, this._stage + 1);
    this._notify();
  }

  setStage(stage) {
    this._stage = clamp(Math.round(stage), 0, 5);
    this._notify();
  }

  noteOn(midi, velocity=0.8) {
    const n = Number(midi);
    if (!Number.isFinite(n)) return;
    this._voice({
      freq: this._freq(n),
      duration: 1.25,
      type: "triangle",
      gain: 0.18 * velocity,
      pan: Math.sin(n * 0.11) * 0.35,
      filter: 2400
    });
    // Add a soft fifth for the Soulchain character.
    this._voice({
      freq: this._freq(n + 7),
      duration: 1.1,
      type: "sine",
      gain: 0.055 * velocity,
      detune: 4,
      pan: -Math.sin(n * 0.11) * 0.25,
      filter: 1800
    });
  }

  noteOff() {
    // Voices are deliberately short and self-releasing in this prototype.
  }
}
