// ============ Audio prosedural (WebAudio): musik santai, mesin, dan efek ============

const RELAXING_CHORDS = [
  [48, 55, 59, 64], // Cmaj7
  [43, 50, 54, 59], // G6
  [45, 52, 55, 60], // Am7
  [41, 48, 52, 57], // Fmaj7
];

function midiFrequency(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private musicGain: GainNode | null = null;
  private musicNextBeat = 0;
  private musicStep = 0;
  private musicOn = false;
  private volumes = { master: 0.8, engine: 0.7, sfx: 0.8, music: 0.35 };
  private engineOn = false;

  private ensure(): boolean {
    if (this.ctx) return true;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      // noise buffer untuk tabrakan
      const len = this.ctx.sampleRate * 0.6;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      this.noiseBuf = buf;
      return true;
    } catch {
      return false;
    }
  }

  setVolumes(master: number, engine: number, sfx: number, music = this.volumes.music * 100): void {
    this.volumes = { master: master / 100, engine: engine / 100, sfx: sfx / 100, music: music / 100 };
    if (this.engineGain) this.engineGain.gain.value = this.engineGainLevel();
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.musicGainLevel(), this.ctx?.currentTime ?? 0, 0.12);
  }

  private engineGainLevel(): number {
    return 0.05 * this.volumes.engine * this.volumes.master;
  }

  private musicGainLevel(): number {
    return 0.35 * this.volumes.music * this.volumes.master;
  }

  startMusic(): void {
    if (!this.ensure() || !this.ctx || this.musicOn) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicGainLevel();
    this.musicGain.connect(this.ctx.destination);
    this.musicNextBeat = this.ctx.currentTime + 0.12;
    this.musicStep = 0;
    this.musicOn = true;
    window.setInterval(() => this.scheduleMusic(), 80);
    this.scheduleMusic();
  }

  private scheduleMusic(): void {
    if (!this.ctx || !this.musicGain) return;
    const beatDuration = 60 / 72;
    const horizon = this.ctx.currentTime + 0.18;
    while (this.musicNextBeat < horizon) {
      const beat = this.musicStep % 16;
      const chord = RELAXING_CHORDS[Math.floor(beat / 4)];
      if (beat % 4 === 0) this.schedulePad(chord, this.musicNextBeat, beatDuration * 4);
      const arpeggio = [0, 2, 1, 3][beat % 4];
      this.schedulePluck(chord[arpeggio] + 12, this.musicNextBeat);
      this.musicStep++;
      this.musicNextBeat += beatDuration;
    }
  }

  private schedulePad(chord: number[], at: number, duration: number): void {
    if (!this.ctx || !this.musicGain || this.volumes.music <= 0 || this.volumes.master <= 0) return;
    for (const note of chord) {
      const osc = this.ctx.createOscillator();
      const envelope = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = midiFrequency(note);
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.linearRampToValueAtTime(0.11, at + 0.75);
      envelope.gain.setValueAtTime(0.11, at + duration - 0.9);
      envelope.gain.linearRampToValueAtTime(0.0001, at + duration);
      osc.connect(envelope).connect(this.musicGain);
      osc.start(at);
      osc.stop(at + duration + 0.03);
      osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
    }
  }

  private schedulePluck(note: number, at: number): void {
    if (!this.ctx || !this.musicGain || this.volumes.music <= 0 || this.volumes.master <= 0) return;
    const osc = this.ctx.createOscillator();
    const envelope = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = midiFrequency(note + 12);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.linearRampToValueAtTime(0.16, at + 0.025);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.8);
    osc.connect(envelope).connect(this.musicGain);
    osc.start(at);
    osc.stop(at + 0.82);
    osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
  }

  startEngine(): void {
    this.startMusic();
    if (!this.ensure() || !this.ctx || this.engineOn) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 40;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = this.ctx.createGain();
    gain.gain.value = this.engineGainLevel();
    osc.connect(filter).connect(gain).connect(this.ctx.destination);
    osc.start();
    this.engineOsc = osc;
    this.engineGain = gain;
    this.engineFilter = filter;
    this.engineOn = true;
  }

  stopEngine(): void {
    if (this.engineOsc && this.ctx) {
      try { this.engineOsc.stop(); } catch { /* sudah berhenti */ }
      this.engineOsc.disconnect();
    }
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.engineOn = false;
  }

  updateEngine(rpm: number, throttle: number, running: boolean): void {
    if (!this.engineOn || !this.ctx || !this.engineOsc || !this.engineGain || !this.engineFilter) return;
    const f = 32 + (rpm / 60) * 1.9;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
    this.engineFilter.frequency.setTargetAtTime(350 + rpm * 0.55, this.ctx.currentTime, 0.08);
    this.engineGain.gain.setTargetAtTime(
      running ? this.engineGainLevel() * (0.5 + throttle * 0.9) : this.engineGainLevel() * 0.35,
      this.ctx.currentTime, 0.08);
  }

  private blip(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2): void {
    if (!this.ensure() || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol * this.volumes.sfx * this.volumes.master, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  }

  sfxClick(): void { this.startMusic(); this.blip(880, 0.06, 'square', 0.12); }
  sfxDeny(): void { this.blip(160, 0.18, 'sawtooth', 0.15); }
  sfxSuccess(): void { this.blip(660, 0.1, 'sine', 0.2); setTimeout(() => this.blip(990, 0.16, 'sine', 0.2), 90); }
  sfxDeposit(): void { this.blip(520, 0.12, 'sine', 0.22); setTimeout(() => this.blip(780, 0.12, 'sine', 0.22), 100); setTimeout(() => this.blip(1040, 0.25, 'sine', 0.22), 200); }
  sfxLevelUp(): void { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'triangle', 0.18), i * 110)); }

  sfxCrash(strength: number): void {
    if (!this.ensure() || !this.ctx || !this.noiseBuf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300 + strength * 120;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.6, 0.15 + strength * 0.05) * this.volumes.sfx * this.volumes.master, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
    src.connect(filter).connect(g).connect(this.ctx.destination);
    src.start();
  }
}

