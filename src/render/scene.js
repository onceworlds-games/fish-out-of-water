// The renderer, the noon light, the sky and the sea. Quality follows the platform's Graphics setting.

import * as THREE from 'three';
import { setAnisotropy } from './materials.js';

export const SUN_DIR = new THREE.Vector3(-0.35, 0.82, 0.46).normalize(); // high, ahead of the camera (toward the sea)

export function createStage(canvas, opts = {}) {
  const quality = opts.quality ?? 'high';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.poster, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy?.() ?? 4));

  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(0xd7e9f2);
  scene.fog = new THREE.Fog(fogColor, 45, 190);
  scene.background = fogColor.clone();

  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.05, 900);

  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0xcb8a5f, 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.castShadow = true;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  const sc = sun.shadow.camera;
  sc.left = -16;
  sc.right = 16;
  sc.top = 16;
  sc.bottom = -16;
  sc.near = 1;
  sc.far = 90;
  scene.add(sun);
  scene.add(sun.target);

  const sky = makeSky();
  scene.add(sky);

  // An environment for reflections: the sky dome alone, prefiltered.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(makeSky(true));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9a7a62 }));
  ground.position.y = -2;
  envScene.add(ground);
  const env = pmrem.fromScene(envScene, 0.02).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.55;

  const stage = {
    renderer,
    scene,
    camera,
    sun,
    hemi,
    sky,
    quality,
    /** Point the sun's shadow box at what matters (the player). */
    focus(x, y, z) {
      sun.position.set(x + SUN_DIR.x * 40, y + SUN_DIR.y * 40, z + SUN_DIR.z * 40);
      sun.target.position.set(x, y, z);
      sky.position.set(x, 0, z);
    },
    setQuality(q, pixelRatio) {
      stage.quality = q;
      const size = q === 'high' ? 2048 : q === 'medium' ? 1024 : 0;
      renderer.shadowMap.enabled = size > 0;
      sun.castShadow = size > 0;
      if (size && sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
      const span = q === 'high' ? 16 : 13;
      sc.left = -span;
      sc.right = span;
      sc.top = span;
      sc.bottom = -span;
      sc.updateProjectionMatrix();
      if (pixelRatio) renderer.setPixelRatio(pixelRatio);
      scene.traverse((o) => {
        if (o.material && o.isMesh) o.material.needsUpdate = true;
      });
    },
    resize(w, h, pixelRatio) {
      if (pixelRatio) renderer.setPixelRatio(pixelRatio);
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      // keep about 62 degrees across on tall screens
      const hfov = 62;
      const vfov = camera.aspect >= 1.2 ? 56 : Math.min(84, (2 * Math.atan(Math.tan((hfov * Math.PI) / 360) / camera.aspect) * 180) / Math.PI);
      camera.fov = vfov;
      camera.updateProjectionMatrix();
    },
    render() {
      renderer.render(scene, camera);
    },
  };
  stage.setQuality(quality);
  return stage;
}

function makeSky(forEnv = false) {
  const g = new THREE.SphereGeometry(forEnv ? 300 : 600, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      sunDir: { value: SUN_DIR },
      top: { value: new THREE.Color(0x3b93e0) },
      mid: { value: new THREE.Color(0x8cc8f0) },
      horizon: { value: new THREE.Color(0xe4f2f8) },
      below: { value: new THREE.Color(forEnv ? 0x5f7f99 : 0xd7e9f2) },
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
      void main() {
        float y = vDir.y;
        vec3 c = y > 0.0 ? mix(horizon, mid, smoothstep(0.0, 0.25, y)) : below;
        c = y > 0.25 ? mix(mid, top, smoothstep(0.25, 0.9, y)) : c;
        float s = max(0.0, dot(normalize(vDir), sunDir));
        c += vec3(1.0, 0.95, 0.8) * (pow(s, 600.0) * 4.0 + pow(s, 12.0) * 0.18);
        // a few soft clouds
        float cl = sin(vDir.x * 9.0 + vDir.z * 3.0) * sin(vDir.z * 7.0 - vDir.x * 2.0);
        c = mix(c, vec3(1.0), smoothstep(0.55, 0.95, cl) * smoothstep(0.05, 0.2, y) * (1.0 - smoothstep(0.35, 0.6, y)) * 0.55);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

/** The sea: deep harbour blue, a glitter path toward the sun, waves, foam at the quay. */
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
        deep: { value: new THREE.Color(0x0a4f99) },
        shallow: { value: new THREE.Color(0x1f8fd6) },
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
      uniform vec3 sunDir, deep, shallow;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec2 p = vWorld.xz;
        float w = noise(p * 0.35 + vec2(time * 0.25, time * 0.1)) * 0.6 + noise(p * 1.1 - vec2(time * 0.4, -time * 0.3)) * 0.4;
        vec3 n = normalize(vec3((w - 0.5) * 0.9, 1.0, (noise(p * 0.7 + time * 0.2) - 0.5) * 0.9));
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(V, vec3(0, 1, 0)), 0.0), 3.0);
        vec3 col = mix(deep, shallow, 0.35 + 0.35 * w);
        col = mix(col, vec3(0.78, 0.9, 0.97), fres * 0.55);
        vec3 H = normalize(V + sunDir);
        float spec = pow(max(dot(n, H), 0.0), 160.0);
        // glitter: tiny sparkles that come and go
        vec2 cell = floor(p * 3.0);
        float sp = hash(cell + floor(time * 3.0 + hash(cell) * 7.0));
        float sparkle = step(0.965, sp) * pow(max(dot(n, H), 0.0), 18.0);
        col += vec3(1.0, 0.97, 0.88) * (spec * 2.2 + sparkle * 3.5 * glint);
        // foam along the quay wall
        float d = vWorld.z - foamZ;
        float foam = smoothstep(1.4, 0.0, d) * (0.55 + 0.45 * noise(p * 2.5 + time));
        col = mix(col, vec3(0.95, 0.98, 1.0), clamp(foam, 0.0, 1.0) * step(0.0, d) * 0.8);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
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
