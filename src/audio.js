// Sound, all made here with Web Audio: wet slaps, splashes, bells, a foghorn, gulls, and a tarantella that speeds up
// when you're drying out; each place has its own air (water lapping on the quay, the market's murmur, the kitchen's hum
// and sizzle in a tiled room's echo, waves on the beach, birdsong in the park). Started on the first input (browsers
// ask for a gesture). Never throws into the game.

const SURF_SOUND = {
  slap: { f: 1400, q: 1.2, len: 0.09, thump: 150, vol: 0.9 },
  wet: { f: 1800, q: 0.9, len: 0.14, thump: 130, vol: 1.0, splash: 0.4 },
  thud: { f: 600, q: 1.4, len: 0.08, thump: 110, vol: 0.9 },
  plink: { f: 2600, q: 6, len: 0.06, thump: 0, vol: 0.6, ping: 1900 },
  ice: { f: 3400, q: 3, len: 0.1, thump: 0, vol: 0.6, ping: 2600 },
  sand: { f: 700, q: 0.6, len: 0.16, thump: 70, vol: 0.6 },
  gravel: { f: 1200, q: 0.5, len: 0.14, thump: 80, vol: 0.7 },
  grass: { f: 900, q: 0.6, len: 0.1, thump: 90, vol: 0.5 },
  sizzle: { f: 4200, q: 0.4, len: 0.45, thump: 120, vol: 0.55 },
  plush: { f: 500, q: 1, len: 0.12, thump: 80, vol: 0.6 },
  boing: { f: 900, q: 1, len: 0.06, thump: 0, vol: 0.5, boing: true },
  net: { f: 1100, q: 2, len: 0.08, thump: 60, vol: 0.5 },
  splash: { f: 1500, q: 0.5, len: 0.3, thump: 90, vol: 1.0, splash: 1 },
};

// A tarantella in A minor, 6/8: 16 bars of six eighths (MIDI notes, -1 rest).
const MELODY = [
  [76, 81, 76, 72, 69, 72], [76, 81, 83, 84, 83, 81], [80, 76, 80, 83, 80, 76], [83, 84, 83, 81, 80, 81],
  [83, 80, 76, 74, 71, 74], [76, 74, 72, 71, 69, 68], [69, 72, 76, 81, 76, 72], [81, -1, 76, 81, -1, -1],
  [74, 77, 81, 77, 74, 77], [81, 79, 77, 76, 74, 72], [76, 72, 69, 72, 76, 81], [84, 83, 81, 79, 77, 76],
  [80, 83, 86, 83, 80, 76], [77, 76, 74, 72, 71, 68], [69, 72, 76, 72, 69, 64], [69, -1, -1, 57, -1, -1],
];
const CHORDS = ['Am', 'Am', 'E', 'E', 'E', 'E', 'Am', 'Am', 'Dm', 'Dm', 'Am', 'Am', 'E', 'E', 'Am', 'Am'];
const CHORD_NOTES = { Am: [57, 60, 64], E: [56, 59, 64], Dm: [57, 62, 65] };
const BASS = { Am: [45, 52], E: [40, 47], Dm: [50, 45] };
const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Each place's air: steady beds (filtered noise, a hum) and things that happen now and then; `rev` is how much echo.
const PLACES = {
  quay: { lap: 0.07, wind: 0.025, gulls: 0.16, rev: 0.1 },
  market: { lap: 0.04, murmur: 0.075, gulls: 0.1, rev: 0.14 },
  kitchen: { hum: 0.05, fan: 0.035, sizzle: 0.35, clatter: 0.12, rev: 0.34 },
  beach: { waves: 0.17, wind: 0.04, gulls: 0.22, rev: 0.05 },
  park: { birds: 0.45, wind: 0.03, trickle: 0.03, rev: 0.07 },
};

export function createAudio() {
  let ctx = null;
  let master = null;
  let sfx = null;
  let music = null;
  let noiseBuf = null;
  let started = false;
  let amb = null;
  let revSend = null;
  let bedBuf = null;
  const state = { mood: 'calm', tempo: 1, musicOn: true, nextStep: 0, step: 0, low: false, place: null, air: null, next: {} };

  function init() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.8;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master.connect(comp);
      comp.connect(ctx.destination);
      sfx = ctx.createGain();
      sfx.gain.value = 0.9;
      sfx.connect(master);
      music = ctx.createGain();
      music.gain.value = 0.32;
      music.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // a longer, gently brown noise for the beds (a short loop would be heard repeating)
      bedBuf = ctx.createBuffer(1, ctx.sampleRate * 6, ctx.sampleRate);
      const bd = bedBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < bd.length; i++) bd[i] = last = last * 0.6 + (Math.random() * 2 - 1) * 0.4;
      // the echo: a convolver with a made-up room, fed by a send that each place sets
      try {
        const rev = ctx.createConvolver();
        const len = Math.floor(ctx.sampleRate * 1.4);
        const ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
          const ch = ir.getChannelData(c);
          for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
        }
        rev.buffer = ir;
        revSend = ctx.createGain();
        revSend.gain.value = 0.1;
        sfx.connect(revSend);
        music.connect(revSend);
        revSend.connect(rev);
        rev.connect(master);
      } catch {
        revSend = null;
      }
      amb = ctx.createGain();
      amb.gain.value = 0.9;
      amb.connect(master);
      if (state.place) setAir(state.place);
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function noise(at, len, f, q, vol, type = 'bandpass', dest = sfx, sweepTo = 0) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(f, at);
    if (sweepTo) filt.frequency.exponentialRampToValueAtTime(sweepTo, at + len);
    filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    src.connect(filt);
    filt.connect(g);
    g.connect(dest);
    src.start(at, Math.random() * 0.5);
    src.stop(at + len + 0.02);
  }

  function tone(at, freq, len, vol, type = 'sine', dest = sfx, freqTo = 0, attack = 0.004) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (freqTo) o.frequency.exponentialRampToValueAtTime(freqTo, at + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(g);
    g.connect(dest);
    o.start(at);
    o.stop(at + len + 0.02);
    return o;
  }

  function safe(fn) {
    return (...args) => {
      if (!ctx || ctx.state !== 'running') return;
      try {
        fn(ctx.currentTime, ...args);
      } catch {}
    };
  }

  // ---------------------------------------------------------------- the air of each place

  /** A steady bed: looping noise through a filter into a gain (returned so it can swell). */
  function bed(type, f, q, vol, hp = 0) {
    const src = ctx.createBufferSource();
    src.buffer = bedBuf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = f;
    filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(vol, ctx.currentTime, 0.6);
    src.connect(filt);
    let tail = filt;
    if (hp) {
      const h = ctx.createBiquadFilter();
      h.type = 'highpass';
      h.frequency.value = hp;
      filt.connect(h);
      tail = h;
    }
    tail.connect(g);
    g.connect(amb);
    src.start(ctx.currentTime, Math.random() * 5);
    return { src, filt, g, vol, stop: (at) => src.stop(at) };
  }
  function hum(f, vol) {
    const o = ctx.createOscillator();
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(vol, ctx.currentTime, 0.6);
    o.connect(g);
    g.connect(amb);
    o.start();
    return { g, vol, stop: (at) => o.stop(at) };
  }

  /** Changes the air to a place's (crossfading), and its echo. */
  function setAir(id) {
    const p = PLACES[id] ?? PLACES.quay;
    const now = ctx.currentTime;
    if (state.air) for (const b of state.air.beds) {
      b.g.gain.setTargetAtTime(0.0001, now, 0.4);
      try {
        b.stop(now + 2);
      } catch {}
    }
    const beds = [];
    const air = { id, p, beds };
    if (p.lap) beds.push((air.lap = bed('lowpass', 420, 0.7, p.lap)));
    if (p.murmur) beds.push((air.murmur = bed('bandpass', 620, 0.9, p.murmur, 240)));
    if (p.wind) beds.push((air.wind = bed('lowpass', 260, 0.5, p.wind)));
    if (p.waves) beds.push((air.waves = bed('lowpass', 500, 0.6, p.waves * 0.3)));
    if (p.fan) beds.push(bed('lowpass', 900, 0.5, p.fan, 140));
    if (p.trickle) beds.push(bed('bandpass', 3200, 1.2, p.trickle));
    if (p.hum) {
      beds.push(hum(50, p.hum));
      beds.push(hum(100, p.hum * 0.45));
    }
    if (revSend) revSend.gain.setTargetAtTime(p.rev, now, 0.3);
    state.air = air;
    state.next = {};
  }

  /** What happens now and then: waves coming in, gulls, birds, the murmur rising and falling, a pan, a sizzle. */
  function airEvents() {
    const air = state.air;
    if (!air) return;
    const t = ctx.currentTime;
    const p = air.p;
    const due = (k, gap) => {
      if (state.next[k] === undefined) state.next[k] = t + Math.random() * gap;
      if (t < state.next[k]) return false;
      state.next[k] = t + gap * (0.6 + Math.random() * 0.8);
      return true;
    };
    if (air.waves && due('wave', 6.5)) {
      // a wave: swells in, breaks bright, draws back over the shingle
      const g = air.waves.g.gain, f = air.waves.filt.frequency;
      g.cancelScheduledValues(t);
      g.setTargetAtTime(p.waves, t, 0.9);
      g.setTargetAtTime(p.waves * 0.25, t + 2.2, 1.2);
      f.cancelScheduledValues(t);
      f.setTargetAtTime(1500, t + 1.2, 0.5);
      f.setTargetAtTime(420, t + 2.4, 1.0);
    }
    if (air.lap && due('lap', 2.2)) air.lap.g.gain.setTargetAtTime(p.lap * (0.5 + Math.random()), t, 0.5);
    if (air.wind && due('wind', 4)) air.wind.g.gain.setTargetAtTime(p.wind * (0.4 + Math.random() * 1.2), t, 1.5);
    if (air.murmur && due('murmur', 1.6)) air.murmur.g.gain.setTargetAtTime(p.murmur * (0.6 + Math.random() * 0.8), t, 0.4);
    if (p.gulls && due('gull', 9)) {
      const v = p.gulls * (0.4 + Math.random() * 0.6) * 0.5;
      for (let i = 0, n = 1 + Math.floor(Math.random() * 3); i < n; i++) {
        const o = tone(t + i * 0.3, 1450 + Math.random() * 200, 0.26, v, 'sawtooth', amb, 900, 0.02);
        o.detune.value = Math.random() * 120;
      }
    }
    if (p.birds && due('bird', 2.4)) {
      // a little song: a few quick sweeps, sometimes answered
      const base = 2600 + Math.random() * 1800;
      const n = 2 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) tone(t + i * 0.09, base * (1 + (i % 2) * 0.18), 0.07, p.birds * 0.05, 'sine', amb, base * (1.3 + Math.random() * 0.3), 0.01);
      if (Math.random() < 0.4) for (let i = 0; i < 3; i++) tone(t + 0.8 + i * 0.12, base * 0.8, 0.09, p.birds * 0.035, 'sine', amb, base * 1.1, 0.01);
    }
    if (p.sizzle && due('sizzle', 3.5)) noise(t, 1.2 + Math.random(), 5200, 0.4, p.sizzle * 0.12, 'highpass', amb);
    if (p.clatter && due('clatter', 7)) {
      const f = 900 + Math.random() * 1400;
      tone(t, f, 0.5, p.clatter * 0.3, 'triangle', amb, f * 0.98);
      tone(t, f * 2.7, 0.25, p.clatter * 0.12, 'sine', amb);
      noise(t, 0.05, 2500, 1, p.clatter * 0.4, 'bandpass', amb);
    }
  }

  // ---------------------------------------------------------------- music: a lookahead sequencer
  function schedule() {
    if (!ctx || !state.musicOn || ctx.state !== 'running') return;
    const race = state.mood === 'race';
    const bpm = (race ? 152 : 118) * state.tempo; // dotted quarters a minute
    const eighth = 60 / bpm / 3;
    if (state.nextStep < ctx.currentTime - 0.2) state.nextStep = ctx.currentTime + 0.05;
    while (state.nextStep < ctx.currentTime + 0.15) {
      const at = state.nextStep;
      const bar = Math.floor(state.step / 6) % 16;
      const e = state.step % 6;
      const chord = CHORDS[bar];
      const note = MELODY[bar][e];
      // bass on 1 and 4
      if (e === 0 || e === 3) tone(at, mtof(BASS[chord][e === 0 ? 0 : 1]), eighth * 2.2, race ? 0.32 : 0.24, 'triangle', music);
      // accordion stabs on the off-eighths
      if (e !== 0 && e !== 3 && (race || e === 1 || e === 4)) {
        for (const n of CHORD_NOTES[chord]) {
          const o = tone(at, mtof(n), eighth * 0.8, race ? 0.05 : 0.035, 'square', music);
          o.detune.value = 6;
        }
      }
      // the tune: a plucked mandolin (tremolo in the race)
      if (note > 0 && (race || bar % 2 === 0 || e % 3 === 0)) {
        const v = race ? 0.11 : 0.08;
        tone(at, mtof(note), eighth * 1.6, v, 'triangle', music);
        if (race) tone(at + eighth * 0.5, mtof(note), eighth * 0.9, v * 0.6, 'triangle', music);
      }
      // tambourine
      if (race) noise(at, e === 0 || e === 3 ? 0.09 : 0.04, 7000, 0.8, e === 0 || e === 3 ? 0.12 : 0.05, 'highpass', music);
      // a heartbeat knock when drying out
      if (state.low && (e === 0 || e === 3)) tone(at, 70, 0.12, 0.35, 'sine', music, 45);
      state.nextStep += eighth;
      state.step++;
    }
  }
  setInterval(() => {
    schedule();
    try {
      if (ctx && ctx.state === 'running') airEvents();
    } catch {}
  }, 50);

  const api = {
    get ready() {
      return !!ctx && ctx.state === 'running';
    },
    /** Call from a user gesture. */
    unlock() {
      if (!init()) return;
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
      if (!started) {
        started = true;
        state.nextStep = ctx.currentTime + 0.1;
      }
    },
    suspend(on) {
      if (!ctx) return;
      try {
        if (on) ctx.suspend();
        else ctx.resume();
      } catch {}
    },
    /** The place you're in (a course id or 'quay'): its air and its echo. */
    place(id) {
      if (state.place === id) return;
      state.place = id;
      if (!ctx) return;
      try {
        setAir(id);
      } catch {}
    },
    mood(m) {
      if (state.mood !== m) {
        state.mood = m;
        state.step = 0;
      }
    },
    setLow(low) {
      state.low = low;
      state.tempo = low ? 1.12 : 1;
    },
    musicVolume(v) {
      if (music) music.gain.value = v;
    },
    flop: safe((t, charge = 0.5, slap = false) => {
      noise(t, 0.08 + charge * 0.05, 1100 - charge * 400, 1.2, 0.5 + charge * 0.4, 'bandpass');
      tone(t, 210 - charge * 70, 0.12, 0.5, 'sine', sfx, 70);
      if (slap) {
        noise(t, 0.05, 5200, 0.7, 0.75, 'highpass');
        tone(t + 0.01, 1700, 0.08, 0.18, 'triangle', sfx, 2300);
      }
    }),
    land: safe((t, surf = 'slap', speed = 5) => {
      const s = SURF_SOUND[surf] ?? SURF_SOUND.slap;
      const k = Math.min(1, speed / 9);
      if (k < 0.12) return;
      const v = s.vol * (0.35 + k * 0.65);
      noise(t, s.len, s.f * (0.9 + Math.random() * 0.2), s.q, v * 0.7, 'bandpass');
      if (s.thump) tone(t, s.thump * (1 + Math.random() * 0.1), 0.12, v * 0.55, 'sine', sfx, s.thump * 0.55);
      if (s.ping) tone(t, s.ping * (0.95 + Math.random() * 0.1), 0.18, v * 0.18, 'triangle');
      if (s.splash) noise(t + 0.02, 0.25 + s.splash * 0.2, 2600, 0.4, v * 0.35 * s.splash, 'lowpass', sfx, 600);
      if (s.boing) {
        const o = tone(t, 180, 0.32, 0.4, 'sine', sfx, 520);
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = 22;
        lg.gain.value = 30;
        lfo.connect(lg);
        lg.connect(o.frequency);
        lfo.start(t);
        lfo.stop(t + 0.34);
      }
    }),
    bonk: safe((t) => {
      tone(t, 320, 0.08, 0.45, 'triangle', sfx, 200);
      noise(t, 0.05, 900, 2, 0.4);
    }),
    refill: safe((t) => {
      for (let i = 0; i < 3; i++) tone(t + i * 0.07, 320 + i * 120 + Math.random() * 60, 0.07, 0.22, 'sine', sfx, 600 + i * 150);
    }),
    gasp: safe((t) => {
      tone(t, 900, 0.14, 0.12, 'sine', sfx, 560);
    }),
    dry: safe((t) => {
      tone(t, 760, 0.7, 0.2, 'triangle', sfx, 180);
      noise(t, 0.4, 3000, 0.6, 0.15, 'bandpass');
    }),
    knock: safe((t, kind = 'cat') => {
      if (kind === 'cat') {
        noise(t, 0.32, 5200, 0.5, 0.35, 'highpass');
        noise(t + 0.05, 0.16, 900, 0.8, 0.4, 'bandpass', sfx, 2400);
      } else if (kind === 'pan') {
        tone(t, 220, 1.1, 0.4, 'square', sfx);
        tone(t, 331, 0.9, 0.25, 'triangle');
        noise(t, 0.08, 1800, 1, 0.5);
      } else if (kind === 'boule') {
        tone(t, 2100, 0.12, 0.3, 'triangle', sfx, 1800);
        tone(t, 3170, 0.08, 0.12, 'sine');
        tone(t + 0.02, 90, 0.16, 0.5, 'sine', sfx, 45);
      } else {
        tone(t, 90, 0.16, 0.6, 'sine', sfx, 45);
        noise(t, 0.08, 500, 1, 0.45);
      }
    }),
    clack: safe((t, vol = 0.25) => {
      tone(t, 2400, 0.07, vol, 'triangle', sfx, 2000);
      tone(t + 0.09, 2250, 0.05, vol * 0.5, 'triangle', sfx, 1900);
      noise(t, 0.05, 3000, 1, vol * 0.5, 'bandpass');
    }),
    stomp: safe((t, vol = 0.3) => {
      tone(t, 75, 0.14, vol, 'sine', sfx, 40);
      noise(t, 0.06, 400, 1, vol * 0.5, 'lowpass');
    }),
    swipe: safe((t) => {
      noise(t, 0.2, 700, 1, 0.22, 'bandpass', sfx, 3000);
    }),
    gull: safe((t, vol = 0.18) => {
      const o = tone(t, 1500, 0.32, vol, 'sawtooth', sfx, 950, 0.02);
      o.detune.value = Math.random() * 100;
      tone(t + 0.36, 1350, 0.26, vol * 0.8, 'sawtooth', sfx, 900, 0.02);
    }),
    finish: safe((t) => {
      noise(t, 0.9, 3500, 0.4, 0.9, 'lowpass', sfx, 400);
      tone(t, 120, 0.3, 0.6, 'sine', sfx, 50);
      for (const [f, d] of [[880, 1.6], [1320, 1.2], [2200, 0.8]]) tone(t + 0.18, f, d, 0.16, 'sine');
    }),
    bell: safe((t, hi = false) => {
      const f = hi ? 990 : 660;
      tone(t, f, 1.3, 0.3, 'sine');
      tone(t, f * 2.51, 0.7, 0.1, 'sine');
      tone(t, f * 4.2, 0.35, 0.05, 'sine');
    }),
    horn: safe((t) => {
      for (const f of [110, 111.5, 165]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = 520;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(f > 150 ? 0.08 : 0.2, t + 0.08);
        g.gain.setValueAtTime(f > 150 ? 0.08 : 0.2, t + 0.75);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);
        o.connect(filt);
        filt.connect(g);
        g.connect(sfx);
        o.start(t);
        o.stop(t + 1.1);
      }
    }),
    click: safe((t) => {
      tone(t, 1300, 0.04, 0.12, 'triangle');
    }),
    medal: safe((t) => {
      [72, 76, 79, 84].forEach((n, i) => tone(t + i * 0.09, mtof(n + 12), 0.5, 0.14, 'triangle'));
    }),
    /** A water drop taken: a bright plip, climbing a scale while drops come quickly one after another. */
    drip: safe((t, step = 0) => {
      const n = [76, 79, 81, 83, 84, 86, 88, 91][Math.min(7, step)];
      tone(t, mtof(n), 0.09, 0.2, 'sine', sfx, mtof(n) * 1.9);
      tone(t + 0.035, mtof(n + 12), 0.12, 0.08, 'sine');
      noise(t, 0.04, 6000, 2, 0.08, 'bandpass');
    }),
    /** A golden scale: a glassy shimmer and a chord. */
    scale: safe((t) => {
      [81, 85, 88, 93].forEach((n, i) => tone(t + i * 0.055, mtof(n), 0.9 - i * 0.1, 0.12, 'triangle'));
      for (let i = 0; i < 6; i++) tone(t + 0.25 + i * 0.045, mtof(96 + (i % 3) * 3), 0.25, 0.04, 'sine');
      noise(t, 0.5, 8000, 1, 0.07, 'highpass');
    }),
    /** A slap in a Flow chain: a rising pluck per link (pentatonic), brighter when perfect. */
    slapNote: safe((t, chain = 1, perfect = false) => {
      const steps = [69, 72, 74, 76, 79, 81, 84];
      const n = steps[Math.min(steps.length - 1, Math.max(0, chain - 1))];
      tone(t, mtof(n), 0.22, 0.16, 'triangle', sfx, 0, 0.003);
      tone(t, mtof(n + 7), 0.16, 0.06, 'sine');
      if (perfect) {
        tone(t + 0.04, mtof(n + 12), 0.4, 0.12, 'sine');
        tone(t + 0.08, mtof(n + 19), 0.32, 0.06, 'sine');
      }
    }),
    /** A springy slap: a sproing. */
    sproing: safe((t) => {
      const o = tone(t, 240, 0.42, 0.32, 'sine', sfx, 760);
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 26;
      lg.gain.value = 40;
      lfo.connect(lg);
      lg.connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + 0.44);
    }),
    /** The chain broke after a good run: a falling slide. */
    flowEnd: safe((t, chain = 2) => {
      tone(t, mtof(69 + Math.min(12, chain * 2)), 0.32, 0.08, 'triangle', sfx, mtof(57));
    }),
    /** Something just missed: a whoosh past the ear. */
    whoosh: safe((t) => {
      noise(t, 0.32, 500, 1.4, 0.34, 'bandpass', sfx, 3600);
      tone(t + 0.12, mtof(88), 0.18, 0.06, 'sine', sfx, mtof(93));
    }),
    /** The results ticking up. */
    tick: safe((t, k = 0) => {
      tone(t, 1800 + k * 600, 0.03, 0.06, 'triangle');
    }),
    /** A level gained: a little fanfare. */
    levelUp: safe((t) => {
      [[72, 0], [76, 0.1], [79, 0.2], [84, 0.32], [88, 0.32]].forEach(([n, d]) => tone(t + d, mtof(n), 0.7, 0.13, 'triangle'));
      tone(t + 0.32, mtof(60), 0.8, 0.12, 'sine');
      noise(t + 0.3, 0.8, 7000, 1, 0.05, 'highpass');
    }),
    cheer: safe((t) => {
      noise(t, 1.2, 1600, 0.3, 0.25, 'bandpass', sfx, 900);
    }),
  };
  return api;
}
