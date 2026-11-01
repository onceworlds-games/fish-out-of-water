// The renderer, the light, the sky, the environment light and the post stack. Quality follows the platform's Graphics
// setting: low draws straight to the screen; medium adds bloom, the grade and SMAA; high adds ambient occlusion and MSAA.

import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode, SMAAEffect, Effect, BlendFunction, VignetteEffect } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { setAnisotropy } from './materials.js';
import { SUN } from '../sim/config.js';

// Toward the sun: high in the south-east, ahead and to the right of a fish heading for the sea (+z), so shadows fall
// back and to the left. The game's shade is these very shadows (the sim looks along the same line).
export const SUN_DIR = new THREE.Vector3(...SUN);

const SKY = {
  noon: { top: 0x2f7fd8, mid: 0x7db9ec, horizon: 0xdcecf2, sun: 0xfff0d2, fog: 0xcfe2ea, sunI: 3.5, hemiI: 0.7, envI: 0.75, exposure: 1.0 },
  // indoors: the 'sun' is the ceiling's lights, nearly overhead (so shadows sit under things), the room's own reflections
  kitchen: { top: 0x6aa8e0, mid: 0xa9d0ef, horizon: 0xf2ede2, sun: 0xfff1de, fog: 0xe9dfcf, sunI: 1.9, hemiI: 1.05, hemiSky: 0xfff6ea, hemiGround: 0xd9c4a8, envI: 1.0, exposure: 1.0, dir: [0.12, 1, 0.2], indoor: true },
};

/** The look's grade: warm highlights, cool shadows, a little more saturation and contrast. */
class GradeEffect extends Effect {
  constructor() {
    super(
      'GradeEffect',
      /* glsl */ `
      uniform float saturation;
      uniform vec3 shadowTint;
      uniform vec3 highTint;
      uniform float contrast;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, saturation);
        c = (c - 0.5) * contrast + 0.5;
        float hi = smoothstep(0.35, 1.0, l);
        c *= mix(shadowTint, highTint, hi);
        outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
      }`,
      {
        blendFunction: BlendFunction.NORMAL,
        uniforms: new Map([
          ['saturation', new THREE.Uniform(1.12)],
          ['shadowTint', new THREE.Uniform(new THREE.Vector3(0.96, 0.99, 1.04))],
          ['highTint', new THREE.Uniform(new THREE.Vector3(1.04, 1.0, 0.95))],
          ['contrast', new THREE.Uniform(1.06)],
        ]),
      },
    );
  }
}

export function createStage(canvas, opts = {}) {
  const quality = opts.quality ?? 'high';
  const poster = !!opts.poster;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: poster, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy?.() ?? 4));

  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(SKY.noon.fog);
  scene.fog = new THREE.Fog(fogColor, 45, 260);
  scene.background = fogColor.clone();

  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.04, 900);

  const hemi = new THREE.HemisphereLight(0xd8e6f6, 0xb0805a, SKY.noon.hemiI);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(SKY.noon.sun, SKY.noon.sunI);
  sun.castShadow = true;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  const sc = sun.shadow.camera;
  sc.near = 1;
  sc.far = 80;
  scene.add(sun);
  scene.add(sun.target);

  const sky = makeSky();
  scene.add(sky);

  // Reflections: the sky dome alone at first, then the photographed sky once it has loaded.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(makeSky(true));
  const envGround = new THREE.Mesh(new THREE.CircleGeometry(400, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9a8270 }));
  envGround.position.y = -2;
  envScene.add(envGround);
  let envTex = pmrem.fromScene(envScene, 0.02).texture;
  scene.environment = envTex;
  scene.environmentIntensity = SKY.noon.envI;
  scene.environmentRotation = new THREE.Euler(0, 0, 0);
  const envReady = new HDRLoader()
    .setDataType(THREE.HalfFloatType)
    .loadAsync(opts.envUrl ?? './env/sky.hdr')
    .then((hdr) => {
      // a photographed open sky over a sunlit stone ground of our own (so walls in the shade still catch warm bounce),
      // turned so its sun is where ours is
      const hs = new THREE.Scene();
      const dome = new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), new THREE.MeshBasicMaterial({ map: hdr, color: new THREE.Color(1, 0.94, 0.86), side: THREE.BackSide, toneMapped: false }));
      dome.rotation.y = -1.44;
      hs.add(dome);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(95, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.62, 0.52, 0.42), toneMapped: false }));
      floor.position.y = -1.2;
      hs.add(floor);
      // and a ring of sunlit houses round the horizon: a street's shade is lit by the walls across it, not the haze
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(92, 92, 26, 32, 1, true).translate(0, 11.8, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.42, 0.33), side: THREE.BackSide, toneMapped: false }));
      hs.add(ring);
      const t = pmrem.fromScene(hs, 0.01).texture;
      hdr.dispose();
      for (const m of [dome, floor, ring]) {
        m.geometry.dispose();
        m.material.dispose();
      }
      envTex?.dispose();
      envTex = t;
      if (!look.indoor) scene.environment = t;
    })
    .catch(() => {});

  // a room's reflections for indoors: cream walls, a red tiled floor, a white ceiling with bright light panels
  const lightDir = SUN_DIR.clone();
  let roomEnv = null;
  function indoorEnv() {
    if (roomEnv) return roomEnv;
    const rs = new THREE.Scene();
    const box = (w, h, d, x, y, z, color, mat = 'basic') => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: new THREE.Color(...color), side: THREE.BackSide, toneMapped: false }));
      m.position.set(x, y, z);
      rs.add(m);
      return m;
    };
    box(14, 4, 40, 0, 1.6, 0, [0.62, 0.58, 0.52]);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.12, 0.08), toneMapped: false }));
    floor.position.y = -0.39;
    rs.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.68, 0.64), toneMapped: false }));
    ceil.position.y = 3.58;
    rs.add(ceil);
    for (let z = -18; z <= 18; z += 4)
      for (const x of [-3, 3]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.0).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.7, 5.2), toneMapped: false }));
        p.position.set(x, 3.55, z);
        rs.add(p);
      }
    // the windows down the harbour side
    for (let z = -16; z <= 16; z += 6) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.6).rotateY(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.4, 3.8), toneMapped: false }));
      w.position.set(6.9, 2.0, z);
      rs.add(w);
    }
    roomEnv = pmrem.fromScene(rs, 0.02).texture;
    rs.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    return roomEnv;
  }

  // ---------------------------------------------------------------- post
  let composer = null;
  let built = '';
  function buildPost(q) {
    if (built === q) return;
    built = q;
    composer?.dispose();
    composer = null;
    if (q === 'low') {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = look.exposure;
      return;
    }
    renderer.toneMapping = THREE.NoToneMapping;
    composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: q === 'high' ? 4 : 0 });
    composer.addPass(new RenderPass(scene, camera));
    if (q === 'high') {
      const ao = new N8AOPostPass(scene, camera, 1, 1);
      ao.configuration.aoRadius = 0.9;
      ao.configuration.distanceFalloff = 0.6;
      ao.configuration.intensity = 2.2;
      ao.configuration.color = new THREE.Color(0x24130a);
      ao.configuration.halfRes = true;
      ao.configuration.depthAwareUpsampling = true;
      ao.setQualityMode('Medium');
      composer.addPass(ao);
    }
    const bloom = new BloomEffect({ luminanceThreshold: 0.92, luminanceSmoothing: 0.18, intensity: 0.55, mipmapBlur: true, radius: 0.72 });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    const grade = new GradeEffect();
    const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.42 });
    composer.addPass(new EffectPass(camera, bloom, tone, grade, vignette));
    if (q !== 'high') composer.addPass(new EffectPass(camera, new SMAAEffect()));
  }

  let look = SKY.noon;
  const stage = {
    renderer,
    scene,
    camera,
    sun,
    hemi,
    sky,
    quality,
    envReady,
    /** Point the sun's shadow box at what matters (the player). */
    focus(x, y, z) {
      const span = sc.right;
      // snap to shadow texels so the edges don't crawl
      const texel = (span * 2) / Math.max(1, sun.shadow.mapSize.x);
      const fx = Math.round(x / texel) * texel, fz = Math.round(z / texel) * texel;
      sun.position.set(fx + lightDir.x * 40, y + lightDir.y * 40, fz + lightDir.z * 40);
      sun.target.position.set(fx, y, fz);
      sky.position.set(x, 0, z);
    },
    /** Outdoor noon, or the kitchen (overhead light, the room's own reflections). */
    setLook(name) {
      const next = SKY[name] ?? SKY.noon;
      if (next === look && stage.lookSet) return;
      stage.lookSet = true;
      look = next;
      lightDir.set(...(look.dir ?? SUN_DIR.toArray())).normalize();
      sun.color.setHex(look.sun);
      sun.intensity = look.sunI;
      hemi.intensity = look.hemiI;
      hemi.color.setHex(look.hemiSky ?? 0xd8e6f6);
      hemi.groundColor.setHex(look.hemiGround ?? 0xb0805a);
      scene.environment = look.indoor ? indoorEnv() : envTex;
      scene.environmentIntensity = look.envI;
      fogColor.setHex(look.fog);
      scene.fog.color.copy(fogColor);
      scene.background.copy(fogColor);
      const u = sky.material.uniforms;
      u.top.value.setHex(look.top);
      u.mid.value.setHex(look.mid);
      u.horizon.value.setHex(look.horizon);
      if (renderer.toneMapping !== THREE.NoToneMapping) renderer.toneMappingExposure = look.exposure;
    },
    setQuality(q, pixelRatio) {
      stage.quality = q;
      // shade is gameplay, so even the lowest setting keeps a (small) shadow map
      const size = q === 'high' ? 2048 : q === 'medium' ? 1536 : 768;
      renderer.shadowMap.enabled = size > 0;
      sun.castShadow = size > 0;
      if (size && sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
      const span = q === 'high' ? 17 : q === 'medium' ? 15 : 11;
      sc.left = -span;
      sc.right = span;
      sc.top = span;
      sc.bottom = -span;
      sc.updateProjectionMatrix();
      if (pixelRatio) renderer.setPixelRatio(pixelRatio);
      buildPost(q);
      stage.resize(stage.w || 1280, stage.h || 720, pixelRatio);
      scene.traverse((o) => {
        if (o.material && o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true;
      });
    },
    w: 0,
    h: 0,
    resize(w, h, pixelRatio) {
      stage.w = w;
      stage.h = h;
      if (pixelRatio) renderer.setPixelRatio(pixelRatio);
      renderer.setSize(w, h, false);
      composer?.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      stage.fit();
    },
    /** Keep ~66 degrees across on tall screens; `fovKick` is added by the camera on big moments. */
    baseFov: 60,
    fovKick: 0,
    fit() {
      const hfov = 66;
      const base = camera.aspect >= 1.2 ? stage.baseFov : Math.min(86, (2 * Math.atan(Math.tan((hfov * Math.PI) / 360) / camera.aspect) * 180) / Math.PI);
      camera.fov = base + stage.fovKick;
      camera.updateProjectionMatrix();
    },
    render(dt = 1 / 60) {
      if (composer) composer.render(dt);
      else renderer.render(scene, camera);
    },
  };
  stage.setQuality(quality);
  return stage;
}

function makeSky(forEnv = false) {
  const g = new THREE.SphereGeometry(forEnv ? 300 : 600, 48, 24);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      sunDir: { value: SUN_DIR },
      top: { value: new THREE.Color(SKY.noon.top) },
      mid: { value: new THREE.Color(SKY.noon.mid) },
      horizon: { value: new THREE.Color(SKY.noon.horizon) },
      below: { value: new THREE.Color(forEnv ? 0x6f8aa0 : 0xcfe2ea) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * p;
        gl_Position.z = gl_Position.w * 0.99999;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir, top, mid, horizon, below;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
        return v;
      }
      void main() {
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 c = mix(horizon, mid, smoothstep(0.0, 0.22, y));
        c = mix(c, top, smoothstep(0.22, 0.85, y));
        if (y < 0.0) c = mix(horizon, below, smoothstep(0.0, 0.08, -y));
        float s = max(0.0, dot(d, sunDir));
        // fair-weather clouds: flattened toward the horizon, lit on the sun side
        vec2 cp = d.xz / max(0.08, y + 0.12) * 1.6;
        float n = fbm(cp * 0.9 + vec2(3.0, 1.0));
        float cl = smoothstep(0.56, 0.78, n) * smoothstep(0.02, 0.16, y) * (1.0 - smoothstep(0.55, 0.9, y));
        vec3 cloud = mix(vec3(0.82, 0.86, 0.92), vec3(1.0, 0.98, 0.94), smoothstep(0.5, 0.9, n) * 0.6 + pow(s, 3.0) * 0.4);
        c = mix(c, cloud, cl * 0.85);
        c += vec3(1.0, 0.92, 0.75) * (pow(s, 900.0) * 30.0 + pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.08);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

/** The sea: deep harbour blue to turquoise shallows, wind ripples, a glitter path toward the sun, foam at the edge. */
export function makeSea(opts) {
  const size = 1400;
  const g = new THREE.PlaneGeometry(size, size, 1, 1);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    fog: true,
    transparent: false,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        time: { value: 0 },
        sunDir: { value: SUN_DIR },
        deep: { value: new THREE.Color(0x0a4a86) },
        shallow: { value: new THREE.Color(0x1aa3c4) },
        sky: { value: new THREE.Color(0xbfdcef) },
        foamZ: { value: opts.z0 ?? 0 },
        glint: { value: 1 },
      },
    ]),
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float time, foamZ, glint;
      uniform vec3 sunDir, deep, shallow, sky;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float waves(vec2 p) {
        return noise(p * 0.35 + vec2(time * 0.22, time * 0.08)) * 0.5 + noise(p * 1.3 - vec2(time * 0.5, -time * 0.32)) * 0.3 + noise(p * 3.7 + vec2(time * 0.9, time * 0.6)) * 0.2;
      }
      void main() {
        vec2 p = vWorld.xz;
        float e = 0.08;
        float h0 = waves(p), hx = waves(p + vec2(e, 0.0)), hz = waves(p + vec2(0.0, e));
        vec3 n = normalize(vec3((h0 - hx) * 4.0, 1.0, (h0 - hz) * 4.0));
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(V, n), 0.0), 5.0);
        float d = vWorld.z - foamZ;
        vec3 water = mix(shallow, deep, smoothstep(2.0, 40.0, d) * 0.85 + 0.15 * h0);
        vec3 col = mix(water, sky, clamp(fres, 0.0, 1.0) * 0.75);
        vec3 H = normalize(V + sunDir);
        float nh = max(dot(n, H), 0.0);
        float spec = pow(nh, 220.0) * 5.0 + pow(nh, 40.0) * 0.25;
        vec2 cell = floor(p * 4.0);
        float sp = hash(cell + floor(time * 4.0 + hash(cell) * 7.0));
        float sparkle = step(0.955, sp) * pow(nh, 16.0) * 6.0;
        col += vec3(1.0, 0.96, 0.86) * (spec + sparkle * glint);
        float foam = smoothstep(1.6, 0.0, d) * (0.55 + 0.45 * noise(p * 2.5 + time)) * step(0.0, d);
        col = mix(col, vec3(0.95, 0.98, 1.0), clamp(foam, 0.0, 1.0) * 0.8);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(0, opts.y ?? -0.6, opts.z0 + size / 2 - 120);
  mesh.receiveShadow = false;
  mesh.userData.update = (t) => {
    m.uniforms.time.value = t;
  };
  return mesh;
}
