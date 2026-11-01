// Materials. The world's surfaces use CC0 photo-scanned sets (colour, normal, AO/roughness/metal) mapped by world position:
// every merged box, wall and floor gets its texture at the right size with no UV work, a slow colour drift that hides the
// tiling, grime at the foot of walls, and an optional painted finish (the texture's light and shade under a new colour).
// Small canvas textures cover what no scan does: awning stripes, ice, grates.

import * as THREE from 'three';

let anisotropy = 4;
export function setAnisotropy(n) {
  anisotropy = n;
  for (const t of files.values()) t.anisotropy = n;
}

// ---------------------------------------------------------------- the scanned textures

const loader = new THREE.TextureLoader();
const files = new Map();
const pending = [];
const BASE = './tex/';
// mean linear luminance of each colour map (for painted finishes)
const LUM = { qtiles: 0.025, brushed: 0.299, piazza: 0.191, concrete: 0.25, rustmetal: 0.12, mshutter: 0.2, mosaic: 0.2, bplaster: 0.3, rplaster: 0.25, bluewood: 0.122, cobbles: 0.268, denim: 0.156, gingham: 0.264, grass: 0.241, gravel: 0.261, hessian: 0.201, ktiles: 0.578, linen: 0.404, planks: 0.058, plaster: 0.168, plate: 0.03, quaystone: 0.206, roof: 0.119, sand: 0.179, sandstone: 0.085, shutter: 0.087, stucco: 0.664, tablewood: 0.036, terracotta2: 0.049, terracotta: 0.027, terry: 0.068, wetsand: 0.122, wornplanks: 0.123 };
const HAS_ARM = new Set(['qtiles', 'brushed', 'piazza', 'bplaster', 'rplaster', 'bluewood', 'cobbles', 'grass', 'gravel', 'ktiles', 'planks', 'plaster', 'plate', 'quaystone', 'roof', 'sand', 'sandstone', 'shutter', 'stucco', 'tablewood', 'terracotta2', 'terracotta', 'wetsand', 'wornplanks']);

function file(name, srgb) {
  if (files.has(name)) return files.get(name);
  const t = new THREE.Texture();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  files.set(name, t);
  // a flaky connection gets two more tries before the surface is left plain
  pending.push(
    new Promise((resolve) => {
      const go = (tries) =>
        loader.load(
          `${BASE}${name}.webp`,
          (img) => {
            t.image = img.image;
            t.needsUpdate = true;
            resolve();
          },
          undefined,
          () => (tries > 0 ? setTimeout(() => go(tries - 1), 600) : resolve()),
        );
      go(2);
    }),
  );
  return t;
}

/** Resolves once every texture asked for so far has loaded (or failed). */
export function texturesReady() {
  return Promise.all(pending);
}

// Each merged piece carries two numbers in its uv: the ground height under it (grime starts there) and a paint index
// (one material paints every house in its own colour).
const WORLD_VERT_PARS = /* glsl */ `
varying vec3 vWPos;
varying vec3 vWNrm;
varying vec2 vPiece;
`;
const WORLD_VERT = /* glsl */ `
vPiece = uv;
#ifdef USE_INSTANCING
  vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
  vWNrm = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
#else
  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vWNrm = normalize(mat3(modelMatrix) * objectNormal);
#endif
`;
const WORLD_FRAG_PARS = /* glsl */ `
varying vec3 vWPos;
varying vec3 vWNrm;
varying vec2 vPiece;
uniform vec3 uPal[8];
uniform float uUsePal;
uniform float uGroundUv;
uniform float uSize;
uniform float uRot;
uniform float uMacro;
uniform float uGrime;
uniform float uGrimeH;
uniform float uWet;
uniform float uPaint;
uniform float uLum;
uniform float uCon;
uniform float uSideSize;
float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1, 0)), f.x), mix(wHash(i + vec2(0, 1)), wHash(i + vec2(1, 1)), f.x), f.y);
}
`;
// The face's dominant axis picks the projection: floors from above, walls from the side, upright.
const WORLD_UV = /* glsl */ `
vec3 wAn = abs(vWNrm);
bool wTop = wAn.y > max(wAn.x, wAn.z) * 0.9;
vec2 wUv = wTop ? vWPos.xz : (wAn.x > wAn.z ? vec2(vWPos.z * sign(vWNrm.x), vWPos.y) : vec2(-vWPos.x * sign(vWNrm.z), vWPos.y));
wUv /= wTop ? uSize : uSideSize;
float wc = cos(uRot), ws = sin(uRot);
if (wTop) wUv = vec2(wc * wUv.x - ws * wUv.y, ws * wUv.x + wc * wUv.y);
`;
const WORLD_MAP = /* glsl */ `
${WORLD_UV}
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, wUv );
  float wLum = 1.0 + (dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) / uLum - 1.0) * uCon;
  diffuseColor.rgb *= mix(sampledDiffuseColor.rgb, vec3(clamp(wLum, 0.0, 2.5)), uPaint);
#endif
// slow drift in colour over metres, so a repeat never reads as a grid
float wDrift = wNoise(vWPos.xz * 0.23 + vWPos.y * 0.31) * 0.65 + wNoise(vWPos.xz * 1.1) * 0.35;
diffuseColor.rgb *= 1.0 + (wDrift - 0.5) * uMacro;
if (uUsePal > 0.5) diffuseColor.rgb *= uPal[int(mod(vPiece.y + 0.5, 8.0))];
// grime: darker toward the foot of anything upright (from the ground under the piece)
float wGr = (1.0 - smoothstep(0.0, uGrimeH, vWPos.y - vPiece.x * uGroundUv)) * (1.0 - wAn.y);
diffuseColor.rgb *= 1.0 - wGr * uGrime;
diffuseColor.rgb *= 1.0 - uWet * 0.32;
`;

/**
 * A world-mapped material from a scanned set. opts: { size (m per repeat on floors), side (m per repeat on walls),
 * color (a tint, or with paint the paint), paint (0..1: the texture's light and shade under `color`), rough, metal,
 * normal (strength), macro (colour drift), grime, grimeH, wet (0..1), rot, env, ao, emissive, faces: THREE side }
 */
function world(name, opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: opts.color ?? 0xffffff,
    map: file(`${name}_d`, true),
    normalMap: file(`${name}_n`, false),
    normalScale: new THREE.Vector2(opts.normal ?? 1, opts.normal ?? 1),
    roughness: opts.rough ?? 1,
    metalness: opts.metal ?? 0,
    envMapIntensity: opts.env ?? 1,
    side: opts.faces ?? THREE.FrontSide,
  });
  if (HAS_ARM.has(name)) {
    const arm = file(`${name}_r`, false);
    m.roughnessMap = arm;
    m.aoMap = arm;
    m.aoMapIntensity = opts.ao ?? 0.5;
    if (opts.metal) m.metalnessMap = arm;
  }
  if (opts.emissive) {
    m.emissive = new THREE.Color(opts.emissive);
    m.emissiveIntensity = opts.emissiveIntensity ?? 1;
  }
  const u = {
    uSize: { value: opts.size ?? 1 },
    uSideSize: { value: opts.side ?? opts.size ?? 1 },
    uRot: { value: opts.rot ?? 0 },
    uMacro: { value: opts.macro ?? 0.16 },
    uGrime: { value: opts.grime ?? 0 },
    uGrimeH: { value: opts.grimeH ?? 0.7 },
    uWet: { value: opts.wet ?? 0 },
    uPaint: { value: opts.paint ?? 0 },
    uLum: { value: LUM[name] ?? 0.2 },
    uCon: { value: opts.con ?? 1 },
    uPal: { value: Array.from({ length: 8 }, (_, i) => new THREE.Color(opts.pal?.[i % opts.pal.length] ?? 0xffffff)) },
    uUsePal: { value: opts.pal ? 1 : 0 },
    uGroundUv: { value: 1 },
  };
  m.userData.world = u;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${WORLD_VERT_PARS}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${WORLD_VERT}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${WORLD_FRAG_PARS}`)
      .replace('#include <map_fragment>', WORLD_MAP)
      .replace('#include <roughnessmap_fragment>', THREE.ShaderChunk.roughnessmap_fragment.replace(/vRoughnessMapUv/g, 'wUv') + '\nroughnessFactor = mix(roughnessFactor, 0.06, uWet);')
      .replace('#include <metalnessmap_fragment>', THREE.ShaderChunk.metalnessmap_fragment.replace(/vMetalnessMapUv/g, 'wUv'))
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace(/vNormalMapUv/g, 'wUv'))
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace(/vNormalMapUv/g, 'wUv'))
      .replace('#include <aomap_fragment>', THREE.ShaderChunk.aomap_fragment.replace(/vAoMapUv/g, 'wUv'));
  };
  m.customProgramCacheKey = () => 'world1';
  return m;
}

// ---------------------------------------------------------------- canvas textures (what no scan covers)

function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
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

const canvases = new Map();
function ctex(key, make) {
  if (!canvases.has(key)) canvases.set(key, make());
  return canvases.get(key);
}

const TEX = {
  // awning canvas: stripes with a little weave
  stripes: (a, c) =>
    ctex(`stripes:${a}:${c}`, () =>
      canvasTex(128, 32, (g, w, h) => {
        g.fillStyle = a;
        g.fillRect(0, 0, w, h);
        g.fillStyle = c;
        g.fillRect(0, 0, w / 2, h);
        g.globalAlpha = 0.08;
        for (let i = 0; i < w; i += 2) {
          g.fillStyle = i % 4 ? '#000' : '#fff';
          g.fillRect(i, 0, 1, h);
        }
      }),
    ),
  ice: () =>
    ctex('ice', () =>
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
    ),
  // sailcloth: a plain weave with a hem
  canvas: (hex) =>
    ctex(`canvas:${hex}`, () =>
      canvasTex(128, 128, (g, w, h) => {
        g.fillStyle = hex;
        g.fillRect(0, 0, w, h);
        g.globalAlpha = 0.035;
        for (let i = 0; i < w; i += 2) {
          g.fillStyle = i % 4 ? '#000' : '#fff';
          g.fillRect(i, 0, 1, h);
          g.fillRect(0, i, w, 1);
        }
      }),
    ),
  grate: () =>
    ctex('grate', () =>
      canvasTex(64, 64, (g, w) => {
        g.fillStyle = '#4d545c';
        g.fillRect(0, 0, w, w);
        g.fillStyle = '#16191d';
        for (let i = 0; i < 8; i++) g.fillRect(i * 8 + 3, 4, 2, w - 8);
      }),
    ),
};

// ---------------------------------------------------------------- the palette

const mats = new Map();
function mat(key, make) {
  if (!mats.has(key)) mats.set(key, make());
  return mats.get(key);
}
const W = (key, name, opts) => () => mat(key, () => world(name, opts));
const plainStd = (key, o) => () => mat(key, () => new THREE.MeshStandardMaterial(typeof o === 'function' ? o() : o));

export const M = {
  // floors
  tile: W('tile', 'terracotta', { size: 1.4, color: 0xd88a5e, paint: 0.82, normal: 1.1, macro: 0.2 }),
  wettile: W('wettile', 'terracotta', { size: 1.4, color: 0xd88a5e, paint: 0.82, normal: 0.8, wet: 0.75, env: 1.3, macro: 0.2 }),
  quay: W('quay', 'cobbles', { size: 1.6, color: 0xfff2e2, normal: 1.2, macro: 0.2, grime: 0.15 }),
  quayside: W('quayside', 'quaystone', { size: 2.2, normal: 1.1, grime: 0.35, grimeH: 0.9 }),
  planks: W('planks', 'planks', { size: 2.4, color: 0xffe6cc, macro: 0.18 }),
  sand: W('sand', 'sand', { size: 2.6, color: 0xfff0d4, normal: 1.1, macro: 0.2 }),
  wetsand: W('wetsand', 'wetsand', { size: 2.4, color: 0xf2e2c8, wet: 0.45, env: 1.2 }),
  grass: W('grass', 'grass', { size: 2.2, color: 0x78b245, paint: 0.8, con: 1.15, macro: 0.34 }),
  gravel: W('gravel', 'gravel', { size: 1.6, normal: 1.1 }),
  kfloor: W('kfloor', 'qtiles', { size: 1.8, color: 0xffeee6, normal: 1.0, rough: 0.9, env: 1.0, wet: 0.12, macro: 0.12, grime: 0.1, grimeH: 0.3 }),
  // the town: one plaster paints every house its own colour (the paint index in each piece), stone, shutters and doors
  house: W('house', 'plaster', { size: 2.4, color: 0xffffff, paint: 0.85, con: 0.4, normal: 0.55, macro: 0.14, grime: 0.42, grimeH: 1.6, pal: [0xf3e3c3, 0xeec27a, 0xe9a184, 0xbfd6e0, 0xc9d3a8, 0xf6d98a, 0xf0b9a0, 0xf8f1e4] }),
  houseOld: W('houseOld', 'rplaster', { size: 2.6, color: 0xffffff, paint: 0.7, con: 0.55, normal: 0.8, macro: 0.12, grime: 0.4, grimeH: 1.6, pal: [0xf3d8c0, 0xe8b490, 0xf0dcc0, 0xdcc6a8] }),
  trim: W('trim', 'stucco', { size: 1.5, color: 0xfbf7ee, normal: 0.6, macro: 0.06, grime: 0.15, grimeH: 0.6 }),
  stone: W('stone', 'quaystone', { size: 1.6, color: 0xf2e8d8, normal: 1.1, macro: 0.16, grime: 0.25, grimeH: 0.5 }),
  steps: W('steps', 'sandstone', { size: 1.8, color: 0xf0e2cc, normal: 1.2, macro: 0.18 }),
  cobbles: W('cobbles', 'cobbles', { size: 1.5, color: 0xf6ece0, normal: 1.25, wet: 0.55, env: 1.3, macro: 0.22 }),
  flags: W('flags', 'piazza', { size: 3.2, color: 0xfff1de, normal: 1.25, macro: 0.2, grime: 0.12 }),
  concrete: W('concrete', 'concrete', { size: 3, color: 0xd8d4cc, normal: 1.1, wet: 0.35, env: 1.15, macro: 0.25, grime: 0.2 }),
  mosaic: W('mosaic', 'mosaic', { size: 2.4, normal: 0.9, macro: 0.15 }),
  rust: W('rust', 'rustmetal', { size: 1.6, color: 0xffffff, normal: 1.1, metal: 0.3, rough: 0.8, macro: 0.2, grime: 0.3, grimeH: 1.2 }),
  rollshutter: W('rollshutter', 'mshutter', { size: 1.4, color: 0xffffff, paint: 0.5, normal: 1, pal: [0x8aa6b8, 0x6f8f6a, 0xb86a4a, 0xa0a4a8] }),
  shutterPal: W('shutterPal', 'shutter', { size: 1, color: 0xffffff, paint: 0.85, macro: 0.1, pal: [0x2f8a6a, 0x2a6fa8, 0x3d9a9a, 0x6a4a32, 0x7a8f99, 0x2c5f4a, 0x8a3a2a, 0x3a7ab8] }),
  doorPal: W('doorPal', 'bluewood', { size: 1.2, color: 0xffffff, paint: 0.8, normal: 0.8, macro: 0.1, pal: [0x1f4f3f, 0x6e2222, 0x1d3f6e, 0x2a6a6e, 0x5a3a24, 0xb8862a, 0x3f2a4a, 0x22303a] }),
  potClay: W('potClay', 'terracotta', { size: 0.6, color: 0xc8653a, paint: 0.7, normal: 0.6 }),
  // walls and paint
  white: W('white', 'stucco', { size: 2, color: 0xfaf4ea, normal: 0.7, macro: 0.08, grime: 0.28, grimeH: 0.8 }),
  plaster: W('plaster', 'plaster', { size: 2.2, color: 0xfbf3e2, paint: 0.85, con: 0.4, normal: 0.55, grime: 0.3, grimeH: 0.9 }),
  kplaster: W('kplaster', 'stucco', { size: 2.2, color: 0xf1ead9, normal: 0.45, macro: 0.08, grime: 0.18, grimeH: 0.5 }),
  ceiling: W('ceiling', 'stucco', { size: 1.6, color: 0xfffdf8, normal: 0.3, macro: 0.05, emissive: 0x6e655a, emissiveIntensity: 0.55 }),
  lightPanel: plainStd('lightPanel', { color: 0xffffff, emissive: 0xfff6e4, emissiveIntensity: 2.4, roughness: 0.4 }),
  daylight: plainStd('daylight', { color: 0xffffff, emissive: 0xe8f2ff, emissiveIntensity: 1.6, roughness: 0.2 }),
  warmwall: W('warmwall', 'plaster', { size: 2.2, color: 0xf6d690, paint: 0.85, con: 0.4, normal: 0.55, grime: 0.3, grimeH: 0.9 }),
  terracotta: W('terracotta', 'plaster', { size: 1.2, color: 0xc8653a, paint: 0.6, normal: 0.6 }),
  roof: W('roof', 'roof', { size: 1.6, color: 0xffd8c0, normal: 1.1 }),
  subway: W('subway', 'ktiles', { size: 1.2, rough: 0.6, env: 1.1 }),
  blue: W('blue', 'bluewood', { size: 1.4, color: 0x2a78c8, paint: 0.8, normal: 0.9, macro: 0.12, grime: 0.2 }),
  blueDeep: W('blueDeep', 'bluewood', { size: 1.4, color: 0x14508f, paint: 0.8, normal: 0.9, macro: 0.12 }),
  red: W('red', 'bluewood', { size: 1.4, color: 0xe4432d, paint: 0.8, normal: 0.9, macro: 0.12, grime: 0.2 }),
  lemonPaint: W('lemonPaint', 'bluewood', { size: 1.4, color: 0xffc93c, paint: 0.8, normal: 0.9, macro: 0.12, grime: 0.2 }),
  shutter: W('shutter', 'shutter', { size: 1, color: 0x2f8a6a, paint: 0.85 }),
  // wood
  crate: W('crate', 'wornplanks', { size: 0.9, color: 0xffe2b8 }),
  crateDark: W('crateDark', 'wornplanks', { size: 0.9, color: 0xb88a60 }),
  counterWood: W('counterWood', 'tablewood', { size: 1.2, color: 0xffe4c8, normal: 0.9 }),
  driftwood: W('driftwood', 'planks', { size: 1.6, color: 0xd8d0c4, paint: 0.5 }),
  barrel: W('barrel', 'wornplanks', { size: 0.8, color: 0xc88a5a }),
  bark: W('bark', 'wornplanks', { size: 0.6, color: 0x8a6a4a, paint: 0.6, normal: 1.2 }),
  // metal
  steel: W('steel', 'brushed', { size: 1.1, color: 0xf2f4f6, metal: 1, rough: 0.85, env: 1.25, macro: 0.08 }),
  iron: W('iron', 'plate', { size: 1.2, color: 0x3a3e44, paint: 0.5, metal: 0.6, rough: 0.8 }),
  grate: plainStd('grate', () => ({ map: TEX.grate(), roughness: 0.45, metalness: 0.6 })),
  hotplate: plainStd('hotplate', { color: 0x15171b, roughness: 0.5, metalness: 0.3 }),
  brass: plainStd('brass', { color: 0xd9b45a, roughness: 0.25, metalness: 0.9, envMapIntensity: 1.4 }),
  copper: plainStd('copper', { color: 0xc8703f, roughness: 0.3, metalness: 0.9, envMapIntensity: 1.4 }),
  // stone
  rock: W('rock', 'sandstone', { size: 1.4, color: 0xd8d0c4, normal: 1.3 }),
  sandcastle: W('sandcastle', 'sand', { size: 1.2, color: 0xffe0a8, normal: 1.4 }),
  slate: plainStd('slate', { color: 0x1a1d22, roughness: 0.6 }),
  // fabric
  gingham: W('gingham', 'gingham', { size: 0.5, faces: THREE.DoubleSide }),
  burlap: W('burlap', 'hessian', { size: 0.6, color: 0xfff0d8, normal: 1.2 }),
  awningRed: plainStd('awningRed', () => ({ map: TEX.stripes('#f4efe6', '#e4432d'), roughness: 0.85, side: THREE.DoubleSide })),
  awningBlue: plainStd('awningBlue', () => ({ map: TEX.stripes('#f4efe6', '#0b5cad'), roughness: 0.85, side: THREE.DoubleSide })),
  awningLemon: plainStd('awningLemon', () => ({ map: TEX.stripes('#f4efe6', '#f2b51e'), roughness: 0.85, side: THREE.DoubleSide })),
  awningGreen: plainStd('awningGreen', () => ({ map: TEX.stripes('#f4efe6', '#2f8a6a'), roughness: 0.85, side: THREE.DoubleSide })),
  // (sunlight comes through a sail: it glows a little from below)
  sailCream: plainStd('sailCream', () => ({ map: TEX.canvas('#efe4cc'), roughness: 0.9, side: THREE.DoubleSide, emissive: 0xb8a888, emissiveIntensity: 0.45, emissiveMap: TEX.canvas('#efe4cc') })),
  sailBlue: plainStd('sailBlue', () => ({ map: TEX.canvas('#3f7fb8'), roughness: 0.9, side: THREE.DoubleSide, emissive: 0x5a8ac0, emissiveIntensity: 0.4, emissiveMap: TEX.canvas('#3f7fb8') })),
  fabric: (hex) => mat(`fabric${hex}`, () => world('linen', { size: 0.5, color: hex, paint: 0.6, normal: 0.8 })),
  // food, plants, things
  ice: plainStd('ice', () => ({ map: TEX.ice(), color: 0xa9cddc, roughness: 0.12, emissive: 0x1d5a78, emissiveIntensity: 0.1, envMapIntensity: 1.3 })),
  iceLump: plainStd('iceLump', { color: 0xe6f6fb, roughness: 0.18, metalness: 0.0, emissive: 0x3a8aa8, emissiveIntensity: 0.12, envMapIntensity: 1.6, flatShading: true }),
  iceChunk: plainStd('iceChunk', { color: 0xc8eaf5, roughness: 0.06, metalness: 0.1, emissive: 0x2a7090, emissiveIntensity: 0.15, envMapIntensity: 2.2, transparent: true, opacity: 0.88, flatShading: true }),
  window: plainStd('window', { color: 0x1c2733, roughness: 0.06, metalness: 0.3, envMapIntensity: 1.7 }),
  glass: plainStd('glass', { color: 0x223040, roughness: 0.04, metalness: 0.5, envMapIntensity: 2.2 }),
  dark: plainStd('dark', { color: 0x14100c, roughness: 0.95 }),
  wroughtIron: plainStd('wroughtIron', { color: 0x23262a, roughness: 0.55, metalness: 0.6, envMapIntensity: 0.8 }),
  pipe: plainStd('pipe', { color: 0x8a8d90, roughness: 0.5, metalness: 0.4 }),
  flowerRed: plainStd('flowerRed', { color: 0xe0302a, roughness: 0.65 }),
  flowerPink: plainStd('flowerPink', { color: 0xe85a9a, roughness: 0.65 }),
  flowerWhite: plainStd('flowerWhite', { color: 0xf8f4ee, roughness: 0.7 }),
  flowerPurple: plainStd('flowerPurple', { color: 0xb04ad8, roughness: 0.7 }),
  foliage: plainStd('foliage', { color: 0x3f7a35, roughness: 0.75 }),
  foliageLight: plainStd('foliageLight', { color: 0x6aa43f, roughness: 0.75 }),
  lemon: plainStd('lemon', { color: 0xffc93c, roughness: 0.42, emissive: 0x3a2a00, emissiveIntensity: 0.12 }),
  leaf: plainStd('leaf', { color: 0x4f8a3c, roughness: 0.7 }),
  pink: plainStd('pink', { color: 0xe0559a, roughness: 0.7 }),
  rope: W('rope', 'hessian', { size: 0.25, color: 0xe8d0a8, normal: 1.4 }),
  net: plainStd('net', { color: 0x2f6b5f, roughness: 0.9 }),
  tyre: plainStd('tyre', { color: 0x222222, roughness: 0.9 }),
  shell: plainStd('shell', { color: 0x2a2c3a, roughness: 0.3, metalness: 0.2 }),
  coral: plainStd('coral', { color: 0xff7a5c, roughness: 0.6 }),
  skin: (hex) => mat(`skin${hex}`, () => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.7 })),
  tagSlate: plainStd('tagSlate', { color: 0x1a1d22, roughness: 0.5 }),
  bluetile: W('bluetile', 'ktiles', { size: 0.8, color: 0x2a6fc0, paint: 0.6, rough: 0.5, env: 1.1 }),
  dune: W('dune', 'grass', { size: 2, color: 0xa8b860, paint: 0.8 }),
  weed: plainStd('weed', { color: 0x3f5a2a, roughness: 0.6 }),
  wrack: plainStd('wrack', { color: 0x5a4a1e, roughness: 0.35, envMapIntensity: 1.2 }),
  mow: plainStd('mow', { color: 0xeaffc8, roughness: 0.9, transparent: true, opacity: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
  hedge: plainStd('hedge', { color: 0x3f7a35, roughness: 0.85 }),
  soil: W('soil', 'gravel', { size: 1.2, color: 0x7a5a40, paint: 0.7 }),
  glow: plainStd('glow', { color: 0xff5a1f, emissive: 0xff3a0a, emissiveIntensity: 1.6, roughness: 0.5 }),
  lamp: plainStd('lamp', { color: 0xffb347, emissive: 0xff9a2a, emissiveIntensity: 1.4, roughness: 0.4 }),
  tomato: plainStd('tomato', { color: 0xe0321e, roughness: 0.35 }),
  onion: plainStd('onion', { color: 0xe8c9a0, roughness: 0.5 }),
  china: plainStd('china', { color: 0xfbfaf6, roughness: 0.15, envMapIntensity: 1.2 }),
  water: plainStd('water', { color: 0x5fd8ee, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85, emissive: 0x0d6d8a, emissiveIntensity: 0.3, envMapIntensity: 2.0 }),
  // jelly: glossy, lit from inside (no transmission pass: that would draw the scene twice)
  jellyRed: () => mat('jellyRed', () => new THREE.MeshPhysicalMaterial({ color: 0xd81e34, roughness: 0.18, emissive: 0x8a0a18, emissiveIntensity: 0.55, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.4, sheenColor: new THREE.Color(0xff8a8a), envMapIntensity: 1.5 })),
  jellyGreen: () => mat('jellyGreen', () => new THREE.MeshPhysicalMaterial({ color: 0x4cc832, roughness: 0.18, emissive: 0x1f6a0a, emissiveIntensity: 0.55, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.4, sheenColor: new THREE.Color(0xc8ff9a), envMapIntensity: 1.5 })),
  cream: plainStd('cream', { color: 0xfffaf0, roughness: 0.55, emissive: 0x403a30, emissiveIntensity: 0.12 }),
  jarGlass: plainStd('jarGlass', { color: 0xdff3f0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, envMapIntensity: 2.2, depthWrite: false }),
  spiceRed: plainStd('spiceRed', { color: 0xb8361e, roughness: 0.9 }),
  spiceYellow: plainStd('spiceYellow', { color: 0xe8a81e, roughness: 0.9 }),
  spiceGreen: plainStd('spiceGreen', { color: 0x5a7a2a, roughness: 0.9 }),
  spiceBrown: plainStd('spiceBrown', { color: 0x6a4024, roughness: 0.9 }),
  curtain: plainStd('curtain', { color: 0xbfe0e8, roughness: 0.2, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }),
  suds: plainStd('suds', { color: 0xffffff, roughness: 0.6, emissive: 0x9ad8e8, emissiveIntensity: 0.15 }),
  // the harbour: plastic fish boxes, fish on ice, tarps, a painted hull
  plasticBlue: plainStd('plasticBlue', { color: 0x1f6fb8, roughness: 0.42, envMapIntensity: 1.1 }),
  plasticRed: plainStd('plasticRed', { color: 0xd8432f, roughness: 0.42, envMapIntensity: 1.1 }),
  plasticWhite: plainStd('plasticWhite', { color: 0xeef0ea, roughness: 0.45, envMapIntensity: 1.1 }),
  plasticGreen: plainStd('plasticGreen', { color: 0x2f8a5a, roughness: 0.42, envMapIntensity: 1.1 }),
  plasticOrange: plainStd('plasticOrange', { color: 0xf08a24, roughness: 0.42, envMapIntensity: 1.1 }),
  fishSilver: plainStd('fishSilver', { color: 0xc4d2d8, roughness: 0.22, metalness: 0.75, envMapIntensity: 1.8 }),
  fishBack: plainStd('fishBack', { color: 0x284c5e, roughness: 0.3, metalness: 0.5, envMapIntensity: 1.4 }),
  fishRed: plainStd('fishRed', { color: 0xe0583a, roughness: 0.3, metalness: 0.35, envMapIntensity: 1.4 }),
  tarpBlue: plainStd('tarpBlue', () => ({ map: TEX.canvas('#2a6db5'), roughness: 0.75, side: THREE.DoubleSide })),
  tarpRed: plainStd('tarpRed', () => ({ map: TEX.canvas('#cf4630'), roughness: 0.75, side: THREE.DoubleSide })),
  tarpGreen: plainStd('tarpGreen', () => ({ map: TEX.canvas('#2f7d5c'), roughness: 0.75, side: THREE.DoubleSide })),
  hullRed: W('hullRed', 'bluewood', { size: 1.6, color: 0xa8302a, paint: 0.85, normal: 0.7, macro: 0.12, grime: 0.3, grimeH: 0.5 }),
  hullBlue: W('hullBlue', 'bluewood', { size: 1.6, color: 0x1d5b9a, paint: 0.85, normal: 0.7, macro: 0.12 }),
  hullWhite: W('hullWhite', 'bluewood', { size: 1.6, color: 0xf3efe6, paint: 0.85, normal: 0.6, macro: 0.08 }),
  rubber: plainStd('rubber', { color: 0x1d2024, roughness: 0.75 }),
  // the beach: people (one material per part, the colour from each piece's paint index), huts, marram, paling
  skinPal: W('skinPal', 'plaster', { size: 1, color: 0xffffff, paint: 1, con: 0.1, normal: 0.15, macro: 0.04, rough: 0.66, pal: [0xf2c9a8, 0xe0b090, 0xc98e66, 0xa86a48, 0x7a4a32, 0x5a3424, 0xf6d8c0, 0xd9a07a] }),
  clothPal: W('clothPal', 'linen', { size: 0.5, color: 0xffffff, paint: 0.85, con: 0.4, normal: 0.6, macro: 0.05, pal: [0xe4432d, 0x1f6fb8, 0xffc93c, 0x2f8a6a, 0xe0559a, 0x23262a, 0xf4efe6, 0xff8a3a] }),
  hairPal: W('hairPal', 'plaster', { size: 0.4, color: 0xffffff, paint: 1, con: 0.3, normal: 0.3, macro: 0.05, rough: 0.6, pal: [0x2a1a10, 0x5a3a20, 0xd8b060, 0x8a4a20, 0x151515, 0xbdbdbd, 0xa86a30, 0x3a2418] }),
  hutPal: W('hutPal', 'bluewood', { size: 1.4, color: 0xffffff, paint: 0.82, normal: 0.9, macro: 0.1, grime: 0.15, grimeH: 0.5, pal: [0xe4432d, 0x7ec8e3, 0xffd25a, 0x9fd46a, 0xf4a6b8, 0x2a78c8, 0xf6f1e4, 0xff9a52] }),
  paling: plainStd('paling', { color: 0x9a7a58, roughness: 0.85 }),
  marram: plainStd('marram', { vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }),
  kiteA: plainStd('kiteA', { color: 0xe4432d, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x5a1008, emissiveIntensity: 0.3 }),
  kiteB: plainStd('kiteB', { color: 0xffc93c, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x5a4008, emissiveIntensity: 0.3 }),
  kiteC: plainStd('kiteC', { color: 0x1f6fb8, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x08204a, emissiveIntensity: 0.3 }),
  string: plainStd('string', { color: 0xf4efe6, roughness: 0.8 }),
  barnacle: plainStd('barnacle', { color: 0xe8e2d4, roughness: 0.9 }),
  mussel: plainStd('mussel', { color: 0x1d2440, roughness: 0.35, metalness: 0.3 }),
  anemone: plainStd('anemone', { color: 0xc81e3a, roughness: 0.3, emissive: 0x400010, emissiveIntensity: 0.3 }),
  starfish: plainStd('starfish', { color: 0xf07a3a, roughness: 0.7 }),
  wetrock: W('wetrock', 'sandstone', { size: 1.2, color: 0xc8b8a0, normal: 1.4, wet: 0.3, env: 1.0, macro: 0.25, grime: 0.3, grimeH: 0.18 }),
  algae: plainStd('algae', { color: 0x3a5a24, roughness: 0.5 }),
  copperGreen: plainStd('copperGreen', { color: 0x5fa890, roughness: 0.45, metalness: 0.3 }),
  coneWafer: plainStd('coneWafer', { color: 0xd8a35a, roughness: 0.8 }),
  scoopPink: plainStd('scoopPink', { color: 0xf4a6c0, roughness: 0.55 }),
  scoopChoc: plainStd('scoopChoc', { color: 0x6a3a22, roughness: 0.5 }),
  scoopVanilla: plainStd('scoopVanilla', { color: 0xfff4dc, roughness: 0.55 }),
  // the park: leaves (one material, a palette of greens, blossom and copper), inflatables, canvas, the pond and its ducks
  leaves: W('leaves', 'grass', { size: 0.55, color: 0xffffff, paint: 0.72, con: 1.4, normal: 1.1, macro: 0.22, rough: 0.9, pal: [0x2a5222, 0x3a6e28, 0x55902f, 0x7aa23a, 0xe890b4, 0xf6c4d8, 0x6a2826, 0x223f24] }),
  birch: plainStd('birch', { color: 0xe8e2d6, roughness: 0.8 }),
  pvcRed: plainStd('pvcRed', { color: 0xe0302a, roughness: 0.3, envMapIntensity: 1.3 }),
  pvcYellow: plainStd('pvcYellow', { color: 0xffc21a, roughness: 0.3, envMapIntensity: 1.3 }),
  pvcBlue: plainStd('pvcBlue', { color: 0x1f78d8, roughness: 0.3, envMapIntensity: 1.3 }),
  pvcSky: plainStd('pvcSky', { color: 0x5ab8f0, roughness: 0.3, envMapIntensity: 1.3 }),
  pvcGreen: plainStd('pvcGreen', { color: 0x3ab84a, roughness: 0.3, envMapIntensity: 1.3 }),
  canvasRed: plainStd('canvasRed', { color: 0xd8352a, roughness: 0.8, side: THREE.DoubleSide }),
  canvasWhite: plainStd('canvasWhite', { color: 0xf6efe2, roughness: 0.8, side: THREE.DoubleSide }),
  parkGreen: plainStd('parkGreen', { color: 0x1f4a36, roughness: 0.45, metalness: 0.35, envMapIntensity: 0.9 }),
  pond: plainStd('pond', { color: 0x2f7470, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.84, emissive: 0x06302e, emissiveIntensity: 0.35, envMapIntensity: 1.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  pondBed: plainStd('pondBed', { color: 0x26341f, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 }),
  lily: plainStd('lily', { color: 0x4a8a34, roughness: 0.4, side: THREE.DoubleSide }),
  reed: plainStd('reed', { color: 0x6f8f3a, roughness: 0.7 }),
  bulrush: plainStd('bulrush', { color: 0x5a3a22, roughness: 0.85 }),
  duckBrown: plainStd('duckBrown', { color: 0x9a7650, roughness: 0.7 }),
  duckGreen: plainStd('duckGreen', { color: 0x1a6a3a, roughness: 0.3, metalness: 0.25 }),
  duckBill: plainStd('duckBill', { color: 0xf0a820, roughness: 0.5 }),
  frisbee: plainStd('frisbee', { color: 0xff5a2a, roughness: 0.35 }),
  balloon: plainStd('balloon', { color: 0xe8263a, roughness: 0.18, envMapIntensity: 1.4 }),
  yellowSteel: W('yellowSteel', 'plate', { size: 1.2, color: 0xf2b51e, paint: 0.85, metal: 0.3, rough: 0.55 }),
  puddle: plainStd('puddle', { color: 0x4cd3ec, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.78, emissive: 0x0d6d8a, emissiveIntensity: 0.35, envMapIntensity: 2.0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  puddleRim: () => mat('puddleRim', () => new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })),
};

export function setEnvIntensity(scale) {
  for (const m of mats.values()) if (m.envMapIntensity !== undefined) m.userData.baseEnv ??= m.envMapIntensity;
  for (const m of mats.values()) if (m.userData.baseEnv !== undefined) m.envMapIntensity = m.userData.baseEnv * scale;
}

export { world };
