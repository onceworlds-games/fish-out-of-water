// Materials and the small canvas textures they use: terracotta tiles, quay cobbles, planks, plaster, awning stripes.
// One shared set, so a course merges into a few draw calls.

import * as THREE from 'three';

const cache = new Map();
let anisotropy = 4;
export function setAnisotropy(n) {
  anisotropy = n;
}

function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, k);
  return `#${c.getHexString()}`;
}

// ---------------------------------------------------------------- textures (one metre of world = `per` texture repeats)

export const TEX = {
  tiles: () =>
    canvasTex(256, 256, (g, w) => {
      const r = rng(7);
      g.fillStyle = '#8d4a2a';
      g.fillRect(0, 0, w, w);
      const n = 4;
      const s = w / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          g.fillStyle = shade('#c8683d', (r() - 0.5) * 0.1);
          g.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
          g.fillStyle = 'rgba(255,255,255,0.05)';
          g.fillRect(i * s + 3, j * s + 3, s - 6, 6);
        }
    }),
  cobbles: () =>
    canvasTex(256, 256, (g, w) => {
      const r = rng(11);
      g.fillStyle = '#7d7268';
      g.fillRect(0, 0, w, w);
      const rows = 6;
      const rh = w / rows;
      for (let j = 0; j < rows; j++) {
        let x = j % 2 ? -rh * 0.6 : 0;
        while (x < w) {
          const len = rh * (1.2 + r() * 0.8);
          g.fillStyle = shade('#b9ab98', (r() - 0.5) * 0.12);
          roundRect(g, x + 2, j * rh + 2, len - 4, rh - 4, 6);
          g.fill();
          x += len;
        }
      }
    }),
  planks: () =>
    canvasTex(256, 256, (g, w) => {
      const r = rng(5);
      const n = 5;
      const s = w / n;
      for (let i = 0; i < n; i++) {
        g.fillStyle = shade('#b9884f', (r() - 0.5) * 0.12);
        g.fillRect(0, i * s, w, s);
        g.fillStyle = 'rgba(60,30,10,0.35)';
        g.fillRect(0, i * s, w, 2);
        for (let k = 0; k < 6; k++) {
          g.fillStyle = `rgba(90,50,20,${0.08 + r() * 0.1})`;
          g.fillRect(r() * w, i * s + 4 + r() * (s - 8), 20 + r() * 60, 1.5);
        }
      }
    }),
  plaster: () =>
    canvasTex(128, 128, (g, w) => {
      const r = rng(3);
      g.fillStyle = '#f4efe6';
      g.fillRect(0, 0, w, w);
      for (let i = 0; i < 260; i++) {
        g.fillStyle = `rgba(${150 + r() * 60},${130 + r() * 50},${110 + r() * 40},${r() * 0.07})`;
        const s = 2 + r() * 10;
        g.fillRect(r() * w, r() * w, s, s);
      }
    }),
  stripes: (a, c) =>
    canvasTex(64, 8, (g, w, h) => {
      g.fillStyle = a;
      g.fillRect(0, 0, w, h);
      g.fillStyle = c;
      g.fillRect(0, 0, w / 2, h);
    }),
  sand: () =>
    canvasTex(128, 128, (g, w) => {
      const r = rng(13);
      g.fillStyle = '#e9c88f';
      g.fillRect(0, 0, w, w);
      for (let i = 0; i < 900; i++) {
        g.fillStyle = `rgba(${170 + r() * 80},${130 + r() * 70},${80 + r() * 50},${0.15 + r() * 0.25})`;
        g.fillRect(r() * w, r() * w, 1 + r() * 2, 1 + r() * 2);
      }
    }),
  ice: () =>
    canvasTex(128, 128, (g, w) => {
      const r = rng(17);
      g.fillStyle = '#d9eff7';
      g.fillRect(0, 0, w, w);
      for (let i = 0; i < 140; i++) {
        g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.5})`;
        const s = 3 + r() * 9;
        g.beginPath();
        g.ellipse(r() * w, r() * w, s, s * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = `rgba(120,190,215,${r() * 0.25})`;
        g.fillRect(r() * w, r() * w, 2, 2);
      }
    }),
  grass: () =>
    canvasTex(128, 128, (g, w) => {
      const r = rng(19);
      g.fillStyle = '#6aa64a';
      g.fillRect(0, 0, w, w);
      for (let i = 0; i < 700; i++) {
        g.fillStyle = `rgba(${60 + r() * 60},${120 + r() * 60},${40 + r() * 30},0.5)`;
        g.fillRect(r() * w, r() * w, 1, 3 + r() * 4);
      }
    }),
  steel: () =>
    canvasTex(128, 128, (g, w) => {
      const r = rng(23);
      g.fillStyle = '#c7ccd1';
      g.fillRect(0, 0, w, w);
      for (let i = 0; i < 120; i++) {
        g.fillStyle = `rgba(255,255,255,${r() * 0.15})`;
        g.fillRect(0, r() * w, w, 1);
      }
    }),
  gravel: () =>
    canvasTex(128, 128, (g, w) => {
      const r = rng(37);
      g.fillStyle = '#d8cbb0';
      g.fillRect(0, 0, w, w);
      for (let i = 0; i < 1400; i++) {
        g.fillStyle = `rgba(${150 + r() * 80},${140 + r() * 70},${120 + r() * 60},${0.4 + r() * 0.5})`;
        const s = 1 + r() * 3;
        g.fillRect(r() * w, r() * w, s, s);
      }
    }),
  gingham: () =>
    canvasTex(64, 64, (g, w) => {
      g.fillStyle = '#f4efe6';
      g.fillRect(0, 0, w, w);
      g.fillStyle = 'rgba(228,67,45,0.55)';
      for (let i = 0; i < 4; i++) {
        g.fillRect(i * 16, 0, 8, w);
        g.fillRect(0, i * 16, w, 8);
      }
    }),
  // a kitchen floor: black and cream squares, half a metre each
  checker: () =>
    canvasTex(128, 128, (g, w) => {
      const r = rng(29);
      const s = w / 2;
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          g.fillStyle = (i + j) % 2 ? shade('#3a3f47', (r() - 0.5) * 0.04) : shade('#ece3d2', (r() - 0.5) * 0.04);
          g.fillRect(i * s, j * s, s, s);
        }
      g.fillStyle = 'rgba(120,110,95,0.5)';
      g.fillRect(0, 0, w, 1.5);
      g.fillRect(0, s, w, 1.5);
      g.fillRect(0, 0, 1.5, w);
      g.fillRect(s, 0, 1.5, w);
    }),
  // white wall tiles laid like bricks
  subway: () =>
    canvasTex(128, 128, (g, w) => {
      const r = rng(31);
      g.fillStyle = '#b9bfc4';
      g.fillRect(0, 0, w, w);
      const rows = 8, th = w / rows, tw = w / 2;
      for (let j = 0; j < rows; j++) {
        const off = j % 2 ? tw / 2 : 0;
        for (let i = -1; i < 3; i++) {
          g.fillStyle = shade('#f6f3ec', (r() - 0.5) * 0.03);
          g.fillRect(i * tw + off + 1.5, j * th + 1.5, tw - 3, th - 3);
          g.fillStyle = 'rgba(255,255,255,0.6)';
          g.fillRect(i * tw + off + 3, j * th + 2, tw - 8, 2);
        }
      }
    }),
  grate: () =>
    canvasTex(64, 64, (g, w) => {
      g.fillStyle = '#1a1d22';
      g.fillRect(0, 0, w, w);
      g.fillStyle = '#4d545c';
      g.fillRect(0, 0, w, w);
      g.fillStyle = '#23272d';
      for (let i = 0; i < 8; i++) g.fillRect(i * 8 + 3, 4, 2, w - 8);
    }),
};

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function tex(name, ...args) {
  const key = `${name}:${args.join(',')}`;
  if (!cache.has(key)) cache.set(key, TEX[name](...args));
  return cache.get(key);
}

// ---------------------------------------------------------------- materials

const mats = new Map();
function mat(key, make) {
  if (!mats.has(key)) mats.set(key, make());
  return mats.get(key);
}

export const M = {
  wettile: () => mat('wettile', () => new THREE.MeshStandardMaterial({ map: tex('tiles'), color: 0xd9a080, roughness: 0.28, metalness: 0.0, envMapIntensity: 1.2 })),
  tile: () => mat('tile', () => new THREE.MeshStandardMaterial({ map: tex('tiles'), roughness: 0.8 })),
  quay: () => mat('quay', () => new THREE.MeshStandardMaterial({ map: tex('cobbles'), roughness: 0.85 })),
  quayside: () => mat('quayside', () => new THREE.MeshStandardMaterial({ color: 0xa89a86, roughness: 0.9 })),
  planks: () => mat('planks', () => new THREE.MeshStandardMaterial({ map: tex('planks'), roughness: 0.75 })),
  crate: () => mat('crate', () => new THREE.MeshStandardMaterial({ color: 0xd4a464, roughness: 0.78 })),
  crateDark: () => mat('crateDark', () => new THREE.MeshStandardMaterial({ color: 0x9c6b3c, roughness: 0.8 })),
  counterWood: () => mat('counterWood', () => new THREE.MeshStandardMaterial({ map: tex('planks'), color: 0x9e7350, roughness: 0.7 })),
  blue: () => mat('blue', () => new THREE.MeshStandardMaterial({ color: 0x0b5cad, roughness: 0.55 })),
  blueDeep: () => mat('blueDeep', () => new THREE.MeshStandardMaterial({ color: 0x08467f, roughness: 0.6 })),
  red: () => mat('red', () => new THREE.MeshStandardMaterial({ color: 0xe4432d, roughness: 0.6 })),
  lemonPaint: () => mat('lemonPaint', () => new THREE.MeshStandardMaterial({ color: 0xffc93c, roughness: 0.6 })),
  white: () => mat('white', () => new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.75 })),
  plaster: () => mat('plaster', () => new THREE.MeshStandardMaterial({ map: tex('plaster'), roughness: 0.92 })),
  terracotta: () => mat('terracotta', () => new THREE.MeshStandardMaterial({ color: 0xcb6b3f, roughness: 0.85 })),
  ice: () => mat('ice', () => new THREE.MeshStandardMaterial({ map: tex('ice'), color: 0xeefaff, roughness: 0.12, metalness: 0.0, emissive: 0x3a8fb0, emissiveIntensity: 0.12, envMapIntensity: 1.4 })),
  iron: () => mat('iron', () => new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.45, metalness: 0.6 })),
  slate: () => mat('slate', () => new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.6 })),
  window: () => mat('window', () => new THREE.MeshStandardMaterial({ color: 0x1f2a36, roughness: 0.15, metalness: 0.2, envMapIntensity: 1.5 })),
  lemon: () => mat('lemon', () => new THREE.MeshStandardMaterial({ color: 0xffc93c, roughness: 0.45, emissive: 0x3a2a00, emissiveIntensity: 0.15 })),
  leaf: () => mat('leaf', () => new THREE.MeshStandardMaterial({ color: 0x4f8a3c, roughness: 0.7 })),
  pink: () => mat('pink', () => new THREE.MeshStandardMaterial({ color: 0xe0559a, roughness: 0.7 })),
  barrel: () => mat('barrel', () => new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.75 })),
  rope: () => mat('rope', () => new THREE.MeshStandardMaterial({ color: 0xc9b08a, roughness: 0.95 })),
  net: () => mat('net', () => new THREE.MeshStandardMaterial({ color: 0x2f6b5f, roughness: 0.9 })),
  awningRed: () => mat('awningRed', () => new THREE.MeshStandardMaterial({ map: tex('stripes', '#f4efe6', '#e4432d'), roughness: 0.8, side: THREE.DoubleSide })),
  awningBlue: () => mat('awningBlue', () => new THREE.MeshStandardMaterial({ map: tex('stripes', '#f4efe6', '#0b5cad'), roughness: 0.8, side: THREE.DoubleSide })),
  sand: () => mat('sand', () => new THREE.MeshStandardMaterial({ map: tex('sand'), roughness: 0.95 })),
  wetsand: () => mat('wetsand', () => new THREE.MeshStandardMaterial({ map: tex('sand'), color: 0xd2b386, roughness: 0.3, envMapIntensity: 1.2 })),
  grass: () => mat('grass', () => new THREE.MeshStandardMaterial({ map: tex('grass'), roughness: 0.9 })),
  steel: () => mat('steel', () => new THREE.MeshStandardMaterial({ map: tex('steel'), roughness: 0.3, metalness: 0.75, envMapIntensity: 1.3 })),
  tyre: () => mat('tyre', () => new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 })),
  shell: () => mat('shell', () => new THREE.MeshStandardMaterial({ color: 0x2a2c3a, roughness: 0.3, metalness: 0.2 })),
  coral: () => mat('coral', () => new THREE.MeshStandardMaterial({ color: 0xff7a5c, roughness: 0.6 })),
  fabric: (hex) => mat(`fabric${hex}`, () => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85 })),
  skin: (hex) => mat(`skin${hex}`, () => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.7 })),
  tagSlate: () => mat('tagSlate', () => new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.5 })),
  warmwall: () => mat('warmwall', () => new THREE.MeshStandardMaterial({ map: tex('plaster'), color: 0xf6dc94, roughness: 0.9 })),
  bluetile: () => mat('bluetile', () => new THREE.MeshStandardMaterial({ color: 0x0b5cad, roughness: 0.25, envMapIntensity: 1.1 })),
  driftwood: () => mat('driftwood', () => new THREE.MeshStandardMaterial({ map: tex('planks'), color: 0xa89884, roughness: 0.9 })),
  sandcastle: () => mat('sandcastle', () => new THREE.MeshStandardMaterial({ map: tex('sand'), color: 0xe0b878, roughness: 0.95 })),
  rock: () => mat('rock', () => new THREE.MeshStandardMaterial({ color: 0x8a8f94, roughness: 0.85 })),
  dune: () => mat('dune', () => new THREE.MeshStandardMaterial({ color: 0x9caf5a, roughness: 0.9 })),
  weed: () => mat('weed', () => new THREE.MeshStandardMaterial({ color: 0x3f5a2a, roughness: 0.6 })),
  gravel: () => mat('gravel', () => new THREE.MeshStandardMaterial({ map: tex('gravel'), roughness: 0.95 })),
  gingham: () => mat('gingham', () => { const t = tex('gingham'); t.repeat.set(4, 4); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }); }),
  mow: () => mat('mow', () => new THREE.MeshStandardMaterial({ color: 0xf2ffd8, roughness: 0.9, transparent: true, opacity: 0.13, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })),
  hedge: () => mat('hedge', () => new THREE.MeshStandardMaterial({ color: 0x3f7a35, roughness: 0.85 })),
  soil: () => mat('soil', () => new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.95 })),
  bark: () => mat('bark', () => new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.9 })),
  brass: () => mat('brass', () => new THREE.MeshStandardMaterial({ color: 0xd9b45a, roughness: 0.25, metalness: 0.85, envMapIntensity: 1.4 })),
  kfloor: () => mat('kfloor', () => new THREE.MeshStandardMaterial({ map: tex('checker'), roughness: 0.32, envMapIntensity: 1.1 })),
  subway: () => mat('subway', () => new THREE.MeshStandardMaterial({ map: tex('subway'), roughness: 0.25, envMapIntensity: 1.1 })),
  grate: () => mat('grate', () => new THREE.MeshStandardMaterial({ map: tex('grate'), roughness: 0.4, metalness: 0.6 })),
  hotplate: () => mat('hotplate', () => new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.5, metalness: 0.3 })),
  glow: () => mat('glow', () => new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff3a0a, emissiveIntensity: 1.6, roughness: 0.5 })),
  lamp: () => mat('lamp', () => new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff9a2a, emissiveIntensity: 1.4, roughness: 0.4 })),
  copper: () => mat('copper', () => new THREE.MeshStandardMaterial({ color: 0xc8703f, roughness: 0.3, metalness: 0.85, envMapIntensity: 1.4 })),
  burlap: () => mat('burlap', () => new THREE.MeshStandardMaterial({ color: 0xc4a170, roughness: 0.95 })),
  tomato: () => mat('tomato', () => new THREE.MeshStandardMaterial({ color: 0xe0321e, roughness: 0.35 })),
  onion: () => mat('onion', () => new THREE.MeshStandardMaterial({ color: 0xe8c9a0, roughness: 0.5 })),
  china: () => mat('china', () => new THREE.MeshStandardMaterial({ color: 0xfbfaf6, roughness: 0.2, envMapIntensity: 1.2 })),
  water: () =>
    mat('water', () => new THREE.MeshStandardMaterial({ color: 0x5fd8ee, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85, emissive: 0x0d6d8a, emissiveIntensity: 0.3, envMapIntensity: 2.0 })),
  suds: () => mat('suds', () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x9ad8e8, emissiveIntensity: 0.15 })),
  puddle: () =>
    mat('puddle', () => new THREE.MeshStandardMaterial({ color: 0x4cd3ec, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.78, emissive: 0x0d6d8a, emissiveIntensity: 0.35, envMapIntensity: 2.0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })),
  puddleRim: () => mat('puddleRim', () => new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })),
};

export function setEnvIntensity(scale) {
  for (const m of mats.values()) if (m.envMapIntensity !== undefined) m.userData.baseEnv ??= m.envMapIntensity;
  for (const m of mats.values()) if (m.userData.baseEnv !== undefined) m.envMapIntensity = m.userData.baseEnv * scale;
}
