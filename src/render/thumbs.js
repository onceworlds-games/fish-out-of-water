// Little pictures for the locker: each hat and each fish rendered once, on the page's own renderer, into a small target
// that is read back and turned into an image (lit by the same sky as the world). Cached; cheap after the first time.

import * as THREE from 'three';
import { makeHat } from './hats.js';
import { createFishView } from './fish.js';

const S = 128;

export function createThumbs(renderer, world) {
  const cache = new Map();
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(26, 1, 0.005, 40);
  const key = new THREE.DirectionalLight(0xfff0d8, 2.4);
  key.position.set(2.2, 3.2, 2.6);
  const rim = new THREE.DirectionalLight(0xbfe4ff, 1.6);
  rim.position.set(-2.6, 1.4, -2.2);
  const hemi = new THREE.HemisphereLight(0xe2efff, 0x6a5038, 0.7);
  scene.add(key, rim, hemi);
  let rt = null;
  let float = false;
  let buf = null;
  const box = new THREE.Box3();
  const ctr = new THREE.Vector3();
  const size = new THREE.Vector3();
  const clear = new THREE.Color();

  function target() {
    if (rt) return rt;
    float = renderer.extensions.has('EXT_color_buffer_float');
    rt = new THREE.WebGLRenderTarget(S, S, { type: float ? THREE.FloatType : THREE.UnsignedByteType, samples: 4, depthBuffer: true });
    buf = float ? new Float32Array(S * S * 4) : new Uint8Array(S * S * 4);
    return rt;
  }

  /** Render an object, framed from the front and a little above, to a data URL. */
  function shoot(obj, dir = [0.62, 0.42, 1], fill = 1.0) {
    scene.environment = world.environment ?? null;
    scene.environmentIntensity = 0.9;
    scene.add(obj);
    obj.updateMatrixWorld(true);
    box.setFromObject(obj, true);
    box.getCenter(ctr);
    box.getSize(size);
    const r = Math.max(1e-3, size.length() / 2) * fill;
    const d = new THREE.Vector3(...dir).normalize();
    const dist = r / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2));
    cam.position.copy(ctr).addScaledVector(d, dist);
    cam.near = dist / 50;
    cam.far = dist * 4;
    cam.lookAt(ctr);
    cam.updateProjectionMatrix();
    const t = target();
    const prev = renderer.getRenderTarget();
    const prevAlpha = renderer.getClearAlpha();
    renderer.getClearColor(clear);
    const prevShadow = renderer.shadowMap.autoUpdate;
    let url = '';
    try {
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(t);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, true);
      renderer.render(scene, cam);
      renderer.readRenderTargetPixels(t, 0, 0, S, S, buf);
      url = toImage(buf, float);
    } catch {
      url = '';
    } finally {
      renderer.setRenderTarget(prev);
      renderer.setClearColor(clear, prevAlpha);
      renderer.shadowMap.autoUpdate = prevShadow;
      scene.remove(obj);
    }
    return url;
  }

  return {
    /** A hat on its own (empty for none). */
    hat(id) {
      const k = `hat:${id}`;
      if (!cache.has(k)) {
        const h = id && id !== 'none' ? makeHat(id, 1) : null;
        cache.set(k, h ? shoot(h, [0.55, 0.5, 1], 0.92) : '');
      }
      return cache.get(k);
    },
    /** A fish in a colourway, side on and a touch from above. */
    fish(sp, cw) {
      const k = `fish:${sp}:${cw}`;
      if (!cache.has(k)) {
        let url = '';
        try {
          const v = createFishView(sp, cw, { tag: false, lite: true });
          url = shoot(v.group, [0.15, 0.42, 1], 0.74);
          v.dispose();
        } catch {}
        cache.set(k, url);
      }
      return cache.get(k);
    },
    dispose() {
      rt?.dispose();
      rt = null;
    },
  };
}

// linear light → filmic (ACES fit) → sRGB, un-premultiplied over a clear background, rows flipped
const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
function toImage(buf, float) {
  if (!canvas) return '';
  canvas.width = S;
  canvas.height = S;
  const g = canvas.getContext('2d');
  const img = g.createImageData(S, S);
  const out = img.data;
  const k = float ? 1 : 1 / 255;
  const tone = (x) => {
    x *= 1.1;
    const y = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
    const c = Math.min(1, Math.max(0, y));
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = ((S - 1 - y) * S + x) * 4;
      const o = (y * S + x) * 4;
      const a = Math.min(1, buf[i + 3] * k);
      if (a <= 0.002) {
        out[o + 3] = 0;
        continue;
      }
      out[o] = tone((buf[i] * k) / a) * 255;
      out[o + 1] = tone((buf[i + 1] * k) / a) * 255;
      out[o + 2] = tone((buf[i + 2] * k) / a) * 255;
      out[o + 3] = a * 255;
    }
  }
  g.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}
