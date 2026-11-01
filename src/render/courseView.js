// Turns a course (data) into a scene: merged solids, decor, puddles that read as water from far off, the sea, the
// lighthouse on the horizon, boats, and price tags spiked in the ice.

import * as THREE from 'three';
import { createBatch } from './batch.js';
import { drawCollider, drawDecor, createScatter, G } from './kit.js';
import { M } from './materials.js';
import { makeSea } from './scene.js';
import { tagAtlas } from './tags.js';
import { makeKites, makeSpout } from './beach.js';
import { makePond } from './park.js';
import { makeBoats } from './boats.js';

export function buildCourseView(course, camera = null) {
  const root = new THREE.Group();
  root.name = `course:${course.id}`;
  const batch = createBatch();
  const scatter = createScatter();
  const extras = { tags: [] };
  for (const col of course.builder.colliders) drawCollider(batch, scatter, col);
  for (const d of course.builder.decors) drawDecor(batch, scatter, d, extras);
  root.add(batch.build('solids'));
  scatter.build(root);

  // ---------------------------------------------------------------- puddles and sprays, running water, belts
  const waters = [];
  for (const z of course.builder.zones) {
    if (z.kind === 'updraft' && z.look === 'blowhole') waters.push(makeSpout(root, z));
    else if (z.kind === 'updraft' && z.look) waters.push(makeSteam(root, z));
    if (z.kind === 'drain') waters.push(makeDrain(root, z));
    if (!z.rate || z.look === 'spray-hidden' || z.look === 'tub') continue;
    if (z.kind === 'puddle') waters.push(z.look === 'pond' ? makePond(root, z) : makePuddle(root, z));
    else waters.push(makeSpray(root, z));
  }
  for (const col of course.builder.colliders) {
    if (col.look === 'runnel') waters.push(makeFlow(root, col));
    if (col.belt && col.look === 'belt') waters.push(makeBelt(root, col));
  }
  for (const d of course.builder.decors) if (d.look === 'fountain') waters.push(makeJets(root, d));
  for (const d of course.builder.decors)
    if (d.look === 'kites') {
      const k = makeKites(d.list);
      root.add(k.group);
      waters.push(k);
    }

  // ---------------------------------------------------------------- drops and golden scales
  const pickups = course.builder.items?.length ? makePickups(course.builder.items) : null;
  if (pickups) root.add(pickups.group);

  // ---------------------------------------------------------------- price tags in the ice (the signature, in the world)
  if (extras.tags.length) root.add(makeTags(extras.tags));

  // ---------------------------------------------------------------- the sea, the lighthouse, boats
  let sea = null;
  let boats = null;
  if (course.sea) {
    sea = makeSea(course.sea);
    root.add(sea);
    const lh = course.sea.lighthouse;
    if (lh) root.add(makeLighthouse(lh));
    boats = makeBoats(course);
    root.add(boats.group);
  }
  // the surf: a sheet of foam that runs up the sand and back
  const surf = course.surf ? makeSurf(course.surf) : null;
  if (surf) root.add(surf.group);
  // gulls wheeling over the water: seen over the rooftops from anywhere on the course, they show where the sea is
  const gulls = course.sea && course.id !== 'quay' ? makeGullRing(course) : null;
  if (gulls) root.add(gulls.group);
  // blue enamel signs: a wave and an arrow
  const signs = (course.builder.decors ?? []).filter((d) => d.look === 'sign');
  const signGroup = signs.length ? makeSigns(signs) : null;
  if (signGroup) root.add(signGroup);

  const view = {
    root,
    waters,
    sea,
    pickups,
    update(t) {
      sea?.userData.update(t);
      boats?.update(t);
      pickups?.update(t);
      for (const w of waters) w.update(t);
      gulls?.update(t);
      surf?.update(t);
      // a hanging sign the chase camera passes through steps out of the way
      if (signGroup && camera) for (const sg of signGroup.children) sg.visible = sg.position.distanceToSquared(camera.position) > 1.2;
    },
    dispose() {
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    },
  };
  return view;
}

function makeSurf(o) {
  const group = new THREE.Group();
  const sheets = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.PlaneGeometry(o.x1 - o.x0, 2.2 + i * 0.6, 40, 1);
    g.rotateX(-Math.PI / 2);
    // a ragged leading edge
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) if (pos.getZ(k) < 0) pos.setZ(k, pos.getZ(k) + Math.sin(pos.getX(k) * 0.7 + i * 2) * 0.35 + Math.sin(pos.getX(k) * 2.3) * 0.12);
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.x = (o.x0 + o.x1) / 2;
    group.add(mesh);
    sheets.push({ mesh, m, ph: i / 3 });
  }
  return {
    group,
    update(t) {
      for (const s of sheets) {
        const k = ((t / 5.5 + s.ph) % 1 + 1) % 1;
        const run = Math.sin(k * Math.PI);
        const z = o.z + 1.2 - run * 4.2;
        // ride the slope of the sand (y 0 at z0 - 8, down 0.9 over 14 m)
        const y = Math.min(0, -0.9 * (z - (o.z - 8)) / 14) + 0.03;
        s.mesh.position.set((o.x0 + o.x1) / 2, Math.max(-0.58, y), z);
        s.mesh.rotation.x = 0.064;
        s.m.opacity = 0.75 * Math.sin(k * Math.PI) ** 0.6;
      }
    },
  };
}

// ---------------------------------------------------------------- running water, fountain jets, belts

const flowMat = () =>
  M.flow ??
  (M.flow = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uT: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uT;
      float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec2 p = vec2(vUv.x * 3.0, vUv.y * 6.0 - uT * 3.2);
        float w = n(p * vec2(2.0, 1.0)) * 0.6 + n(p * vec2(5.0, 2.5) + 3.1) * 0.4;
        float streak = smoothstep(0.55, 0.85, w);
        float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
        vec3 c = mix(vec3(0.16, 0.55, 0.68), vec3(0.85, 0.97, 1.0), streak);
        gl_FragColor = vec4(c, (0.55 + 0.35 * streak) * edge);
      }`,
  }));

/** A sheet of water running down a channel (a ramp collider), drawn just over its top. */
function makeFlow(root, col) {
  const w = col.h[0] * 2 - 0.02, len = col.h[2] * 2;
  const g = new THREE.PlaneGeometry(w, len, 1, 1);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), (uv.getY(i) * len) / 2);
  g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, flowMat());
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(col.pitch, col.yaw, 0, 'YXZ'));
  mesh.quaternion.copy(q);
  mesh.position.set(...col.c).add(new THREE.Vector3(0, col.h[1] + 0.015, 0).applyQuaternion(q));
  mesh.renderOrder = 2;
  root.add(mesh);
  return { update(t) { mesh.material.uniforms.uT.value = t; } };
}

/** Water arcing from the fountain's finial into the bowl, and from the bowl's lip into the basin. */
function makeJets(root, d) {
  const [x, y, z] = d.at;
  const n = 160;
  const mesh = new THREE.InstancedMesh(G.sphere, new THREE.MeshStandardMaterial({ color: 0xd8f6ff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.8, emissive: 0x2a8fb0, emissiveIntensity: 0.25, envMapIntensity: 2 }), n);
  mesh.frustumCulled = false;
  root.add(mesh);
  const m = new THREE.Matrix4();
  return {
    update(t) {
      for (let i = 0; i < n; i++) {
        const top = i < 40;
        const k = ((t * (top ? 0.9 : 0.7) + i * 0.618) % 1 + 1) % 1;
        const a = i * 2.39996;
        let px, py, pz, s;
        if (top) {
          // up from the finial and over into the bowl
          const r = 0.75 * k;
          px = x + Math.cos(a) * r;
          pz = z + Math.sin(a) * r;
          py = y + 2.05 + 0.5 * k - 1.0 * k * k;
          s = 0.03;
        } else {
          // over the bowl's lip and down into the basin
          const r = 0.84 + 0.35 * k;
          px = x + Math.cos(a) * r;
          pz = z + Math.sin(a) * r;
          py = y + 1.48 - 1.3 * k * k;
          s = 0.022 + 0.01 * (1 - k);
        }
        m.makeScale(s, s * 2.2, s);
        m.setPosition(px, py, pz);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- steam over a pot or out of a vent, drains in the floor

let puffTex = null;
function puffTexture() {
  if (puffTex) return puffTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  // a soft lumpy puff: a few overlapping blobs
  for (const [x, y, r, a] of [[32, 34, 26, 0.5], [24, 28, 16, 0.45], [40, 26, 15, 0.45], [33, 40, 18, 0.35]]) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(255,255,255,${a})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  }
  puffTex = new THREE.CanvasTexture(c);
  return puffTex;
}

/** Steam rising in the column that lifts a fish: soft puffs that grow, drift and fade, and a shimmer at the base. */
function makeSteam(root, z) {
  const n = Math.round(26 + z.r * 22);
  const h = z.y1 - z.y0;
  const pos = new Float32Array(n * 3);
  const life = new Float32Array(n);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) seed[i] = Math.random();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const warm = z.look === 'hood' ? 0.0 : 1.0;
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uMap: { value: puffTexture() }, uScale: { value: 380 }, uR: { value: z.r } },
    vertexShader: `
      attribute float aLife; attribute float aSeed; varying float vA; varying float vRot; uniform float uScale; uniform float uR;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float size = (0.35 + uR * 0.5) * (0.5 + aLife * 1.6) * (0.8 + aSeed * 0.4);
        gl_PointSize = size * uScale / -mv.z;
        vA = smoothstep(0.0, 0.15, aLife) * (1.0 - smoothstep(0.55, 1.0, aLife));
        vRot = aSeed * 6.28 + aLife * 1.5;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uMap; varying float vA; varying float vRot;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float c = cos(vRot), s = sin(vRot);
        p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
        vec4 t = texture2D(uMap, p);
        gl_FragColor = vec4(vec3(0.97, 0.97 + ${warm.toFixed(1)} * 0.01, 1.0), t.a * vA * 0.55);
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 3;
  root.add(pts);
  const [cx, , cz] = z.c;
  return {
    update(t) {
      for (let i = 0; i < n; i++) {
        const k = ((t * (0.32 + seed[i] * 0.12) + seed[i] * 7.3) % 1 + 1) % 1;
        const a = seed[i] * 40 + t * (0.4 + seed[i]);
        const rr = z.r * (0.25 + 0.6 * k) * (0.5 + 0.5 * Math.sin(seed[i] * 13));
        pos[i * 3] = cx + Math.cos(a) * rr;
        pos[i * 3 + 1] = z.y0 + 0.1 + k * h;
        pos[i * 3 + 2] = cz + Math.sin(a) * rr;
        life[i] = k;
      }
      g.attributes.position.needsUpdate = true;
      g.attributes.aLife.needsUpdate = true;
    },
  };
}

let grateTex = null;
function grateTexture() {
  if (grateTex) return grateTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.translate(64, 64);
  // the rim, the dark hole, the bars
  g.fillStyle = '#5d646a';
  g.beginPath();
  g.arc(0, 0, 62, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#0c1116';
  g.beginPath();
  g.arc(0, 0, 52, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#8a9298';
  g.lineWidth = 7;
  for (let x = -42; x <= 42; x += 14) {
    const hh = Math.sqrt(Math.max(0, 52 * 52 - x * x));
    g.beginPath();
    g.moveTo(x, -hh);
    g.lineTo(x, hh);
    g.stroke();
  }
  g.strokeStyle = '#3a4046';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, 0, 57, 0, Math.PI * 2);
  g.stroke();
  grateTex = new THREE.CanvasTexture(c);
  grateTex.colorSpace = THREE.SRGBColorSpace;
  return grateTex;
}

/** A drain: a steel grate in the floor with water swirling into it. */
function makeDrain(root, z) {
  const grp = new THREE.Group();
  const grate = new THREE.Mesh(new THREE.CircleGeometry(z.r, 32), new THREE.MeshStandardMaterial({ map: grateTexture(), roughness: 0.4, metalness: 0.7, transparent: true, polygonOffset: true, polygonOffsetFactor: -3 }));
  grate.rotation.x = -Math.PI / 2;
  grate.receiveShadow = true;
  grp.add(grate);
  // the swirl: a ring of water drawn round and down into it
  const swirl = new THREE.Mesh(new THREE.RingGeometry(z.r * 0.95, z.r * 1.9, 40, 1), M.swirl ?? (M.swirl = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uT: { value: 0 } },
    vertexShader: `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vP; uniform float uT;
      void main() {
        float r = length(vP); float a = atan(vP.y, vP.x);
        float rr = clamp((r - 0.42) / 0.5, 0.0, 1.0);
        float s = sin(a * 3.0 + r * 14.0 + uT * 5.0) * 0.5 + 0.5;
        float edge = smoothstep(1.0, 0.6, rr) * smoothstep(0.0, 0.15, rr);
        vec3 c = mix(vec3(0.25, 0.6, 0.72), vec3(0.85, 0.97, 1.0), smoothstep(0.6, 0.95, s));
        gl_FragColor = vec4(c, edge * (0.35 + 0.35 * s));
      }`,
  })));
  // the swirl's shader works in a ring of radius ~0.45..0.9: scale it to the drain
  swirl.geometry.scale(0.45 / z.r, 0.45 / z.r, 1);
  swirl.scale.setScalar(z.r / 0.45);
  swirl.rotation.x = -Math.PI / 2;
  swirl.position.y = 0.004;
  swirl.renderOrder = 2;
  grp.add(swirl);
  grp.position.set(z.c[0], z.y0 + 0.3 + 0.012, z.c[2]);
  root.add(grp);
  return {
    update(t) {
      swirl.material.uniforms.uT.value = t;
    },
  };
}

/** A conveyor: the moving belt (its ribs slide along) on rollers in a steel frame. */
function makeBelt(root, col) {
  const w = col.h[0] * 2, len = col.h[2] * 2;
  const tex = beltTexture();
  const speed = Math.hypot(col.belt[0], col.belt[1]);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.1, envMapIntensity: 1.3 });
  const g = new THREE.PlaneGeometry(w - 0.12, len, 1, 1);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), (uv.getY(i) * len) / 0.6);
  g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(col.pitch, col.yaw, 0, 'YXZ'));
  mesh.quaternion.copy(q);
  mesh.position.set(...col.c).add(new THREE.Vector3(0, col.h[1] + 0.008, 0).applyQuaternion(q));
  root.add(mesh);
  return {
    update(t) {
      tex.offset.y = -((t * speed) / 0.6) % 1;
    },
  };
}

let beltTex = null;
function beltTexture() {
  if (beltTex) return beltTex.clone();
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2a3036';
  g.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 128; y += 16) {
    g.fillStyle = '#3e474f';
    g.fillRect(0, y, 64, 9);
    g.fillStyle = '#566069';
    g.fillRect(0, y, 64, 2);
  }
  // wet streaks
  g.globalAlpha = 0.15;
  g.fillStyle = '#9fe3f5';
  for (let i = 0; i < 12; i++) g.fillRect((i * 37) % 64, 0, 2, 128);
  beltTex = new THREE.CanvasTexture(c);
  beltTex.wrapS = beltTex.wrapT = THREE.RepeatWrapping;
  beltTex.colorSpace = THREE.SRGBColorSpace;
  return beltTex.clone();
}

// ---------------------------------------------------------------- drops and golden scales

function dropGeometry() {
  // a teardrop: round below, drawn to a point above
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * Math.PI;
    const y = -Math.cos(a);
    const r = Math.sin(a) * (y < 0 ? 1 : 1 - y * 0.82) * (1 - Math.max(0, y) * 0.1);
    pts.push(new THREE.Vector2(Math.max(0.0001, r), y * (y > 0 ? 1.55 : 1)));
  }
  return new THREE.LatheGeometry(pts, 14);
}

function scaleGeometry() {
  // a fish scale: a rounded shield, ridged, a little domed
  const s = new THREE.Shape();
  s.moveTo(0, -1);
  s.bezierCurveTo(0.9, -0.75, 1.05, 0.25, 0.8, 0.75);
  s.quadraticCurveTo(0, 1.25, -0.8, 0.75);
  s.bezierCurveTo(-1.05, 0.25, -0.9, -0.75, 0, -1);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3, curveSegments: 16 });
  g.translate(0, 0, -0.06);
  // ridges: push the front surface in rings
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const d = Math.hypot(x, y + 1);
    const bump = Math.cos(d * 9) * 0.035 + (1 - Math.min(1, Math.hypot(x, y) / 1.1)) * 0.12;
    p.setZ(i, z + Math.sign(z || 1) * bump);
  }
  g.computeVertexNormals();
  return g;
}

function makePickups(items) {
  const group = new THREE.Group();
  const drops = items.map((it, i) => ({ it, i })).filter((d) => d.it.kind === 'drop');
  const scales = items.map((it, i) => ({ it, i })).filter((d) => d.it.kind === 'scale');
  const dropMat = new THREE.MeshStandardMaterial({ color: 0x6fd6f2, roughness: 0.04, metalness: 0.05, transparent: true, opacity: 0.88, emissive: 0x1890c0, emissiveIntensity: 0.55, envMapIntensity: 2.6 });
  const dropMesh = new THREE.InstancedMesh(dropGeometry(), dropMat, Math.max(1, drops.length));
  dropMesh.castShadow = true;
  dropMesh.frustumCulled = false;
  group.add(dropMesh);
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffc93c, roughness: 0.22, metalness: 1, emissive: 0x7a4a00, emissiveIntensity: 0.6, envMapIntensity: 2.2 });
  const ghostMat = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.2, metalness: 0.2, transparent: true, opacity: 0.38, emissive: 0x3a7fa8, emissiveIntensity: 0.4, depthWrite: false });
  const sgeo = scaleGeometry();
  const glowTex = glowTexture();
  const scaleViews = scales.map(({ it, i }) => {
    const g = new THREE.Group();
    g.position.set(...it.p);
    const mesh = new THREE.Mesh(sgeo, goldMat);
    mesh.scale.setScalar(0.17);
    mesh.castShadow = true;
    g.add(mesh);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd36a, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(1.1);
    g.add(glow);
    group.add(g);
    return { g, mesh, glow, i, n: it.n, taken: false, ghost: false };
  });
  const taken = new Uint8Array(items.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  let pop = []; // drops being taken: { k, t0 }
  const api = {
    group,
    /** Hide pickup i (my fish took it). */
    take(i, t) {
      if (taken[i]) return;
      taken[i] = 1;
      const s = scaleViews.find((x) => x.i === i);
      if (s) {
        s.taken = true;
        s.t0 = t;
      } else pop.push({ i, t0: t });
    },
    /** Everything back (a new run). `kept`: scale numbers already in the collection (drawn as glass). */
    reset(kept = []) {
      taken.fill(0);
      pop = [];
      for (const s of scaleViews) {
        s.taken = false;
        s.g.visible = true;
        s.ghost = kept.includes(s.n);
        s.mesh.material = s.ghost ? ghostMat : goldMat;
        s.glow.visible = !s.ghost;
      }
    },
    update(t) {
      drops.forEach((d, k) => {
        const p = d.it.p;
        let s = 0.085;
        let y = p[1] + Math.sin(t * 2.4 + d.i * 0.7) * 0.035;
        if (taken[d.i]) {
          const pp = pop.find((x) => x.i === d.i);
          const a = pp ? (t - pp.t0) / 0.18 : 1;
          if (a >= 1) s = 0;
          else {
            s *= 1 + a * 0.8;
            y += a * 0.25;
          }
        }
        e.set(0, t * 1.6 + d.i, 0);
        q.setFromEuler(e);
        m.compose(v.set(p[0], y, p[2]), q, sc.set(s, s, s));
        dropMesh.setMatrixAt(k, m);
      });
      dropMesh.instanceMatrix.needsUpdate = true;
      for (const s of scaleViews) {
        if (s.taken) {
          const a = (t - s.t0) / 0.6;
          s.g.visible = a < 1;
          s.g.position.y = s.g.userData.y0 + a * 1.2;
          s.mesh.rotation.y += 0.5;
          s.g.scale.setScalar(1 + a * 0.6);
          continue;
        }
        s.g.userData.y0 ??= s.g.position.y;
        s.g.position.y = s.g.userData.y0 + Math.sin(t * 2 + s.n) * 0.06;
        s.mesh.rotation.y = t * 2.2 + s.n;
        s.glow.material.opacity = 0.55 + 0.25 * Math.sin(t * 5 + s.n);
      }
    },
  };
  api.reset();
  return api;
}

let glowT = null;
function glowTexture() {
  if (glowT) return glowT;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  glowT = new THREE.CanvasTexture(c);
  return glowT;
}

const rimGeo = new THREE.RingGeometry(0.9, 1.0, 40).rotateX(-Math.PI / 2);
const discGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
const rippleGeo = new THREE.RingGeometry(0.94, 1.0, 40).rotateX(-Math.PI / 2);

function makePuddle(root, z) {
  const g = new THREE.Group();
  // a fountain's basin is full nearly to the rim (a fish lying in it is under the water); its bowl a little less
  const lift = z.look === 'basin' ? 0.24 : z.look === 'bowlwater' ? 0.08 : 0.012;
  g.position.set(z.c[0], z.c[1] + lift, z.c[2]);
  const disc = new THREE.Mesh(discGeo, M.puddle());
  disc.scale.setScalar(z.r * 1.02);
  disc.receiveShadow = true;
  g.add(disc);
  const rim = new THREE.Mesh(rimGeo, M.puddleRim());
  rim.scale.setScalar(z.r * 1.04);
  rim.position.y = 0.004;
  g.add(rim);
  const ripples = [];
  for (let i = 0; i < 2; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    const r = new THREE.Mesh(rippleGeo, mat);
    r.position.y = 0.006;
    g.add(r);
    ripples.push(r);
  }
  root.add(g);
  const seed = (z.c[0] * 7.3 + z.c[2] * 1.7) % 3;
  return {
    zone: z,
    group: g,
    update(t) {
      for (let i = 0; i < ripples.length; i++) {
        const k = ((t * 0.55 + seed + i * 0.5) % 1 + 1) % 1;
        ripples[i].scale.setScalar(z.r * (0.25 + 0.75 * k));
        ripples[i].material.opacity = 0.55 * (1 - k) * k * 3.5;
      }
      rim.material.opacity = 0.65 + 0.25 * Math.sin(t * 3 + seed);
    },
  };
}

/** A spray (a hose, a sprinkler, a shower): drops falling in a column, a glossy wet patch below. */
function makeSpray(root, z) {
  const g = new THREE.Group();
  g.position.set(z.c[0], z.c[1], z.c[2]);
  const wet = new THREE.Mesh(discGeo, M.puddle());
  wet.scale.setScalar(z.r);
  wet.position.y = 0.01;
  wet.material = M.puddle();
  g.add(wet);
  const n = 40;
  const drops = new THREE.InstancedMesh(G.sphere, new THREE.MeshBasicMaterial({ color: 0xc8f4ff, transparent: true, opacity: 0.85 }), n);
  drops.frustumCulled = false;
  g.add(drops);
  const seeds = Array.from({ length: n }, (_, i) => [Math.sin(i * 12.9898) * 0.5 + 0.5, Math.sin(i * 78.233) * 0.5 + 0.5, Math.sin(i * 39.425) * 0.5 + 0.5]);
  const m = new THREE.Matrix4();
  const h = z.look === 'hose' ? 1.6 : 2.4;
  root.add(g);
  return {
    zone: z,
    group: g,
    update(t) {
      for (let i = 0; i < n; i++) {
        const s = seeds[i];
        const k = (t * (1.2 + s[2]) + s[0]) % 1;
        const a = s[1] * Math.PI * 2;
        const rr = z.r * (0.2 + 0.7 * s[0]) * (0.4 + 0.6 * k);
        m.makeScale(0.025, 0.06, 0.025);
        m.setPosition(Math.cos(a) * rr, h * (1 - k * k), Math.sin(a) * rr);
        drops.setMatrixAt(i, m);
      }
      drops.instanceMatrix.needsUpdate = true;
    },
  };
}

function makeTags(list) {
  const atlas = tagAtlas();
  const group = new THREE.Group();
  const quads = [];
  const pins = [];
  for (const tg of list) {
    const idx = Math.floor(tg.label * 8) % 8;
    // two faces back to back, so the price reads the right way from either side
    for (const flip of [0, Math.PI]) {
      const g = new THREE.PlaneGeometry(0.16, 0.11);
      const uv = g.attributes.uv;
      const u0 = (idx % 4) / 4, v0 = 1 - Math.floor(idx / 4) / 2 - 0.5;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / 4, v0 + uv.getY(i) / 2);
      g.translate(0, 0, 0.002);
      g.rotateY(tg.yaw + flip);
      g.translate(tg.p[0], tg.p[1] + 0.13, tg.p[2]);
      quads.push(g);
    }
    const pin = new THREE.CylinderGeometry(0.006, 0.006, 0.12, 5);
    pin.translate(tg.p[0], tg.p[1] + 0.04, tg.p[2]);
    pins.push(pin);
  }
  const merge = (geos) => {
    const out = new THREE.BufferGeometry();
    const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    const count = parts.reduce((a, g) => a + g.attributes.position.count, 0);
    for (const name of ['position', 'normal', 'uv']) {
      const size = parts[0].attributes[name].itemSize;
      const arr = new Float32Array(count * size);
      let o = 0;
      for (const g of parts) {
        arr.set(g.attributes[name].array, o);
        o += g.attributes[name].array.length;
      }
      out.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    return out;
  };
  const tagMesh = new THREE.Mesh(merge(quads), new THREE.MeshStandardMaterial({ map: atlas, transparent: false, alphaTest: 0.5, side: THREE.FrontSide, roughness: 0.55 }));
  tagMesh.castShadow = true;
  group.add(tagMesh);
  group.add(new THREE.Mesh(merge(pins), M.red()));
  return group;
}

function makeLighthouse(at) {
  const g = new THREE.Group();
  g.position.set(at[0], at[1] - 1, at[2]);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 3, 16), M.quayside());
  base.position.y = 1.5;
  g.add(base);
  const levels = 6;
  for (let i = 0; i < levels; i++) {
    const r0 = 2.2 - i * 0.18, r1 = 2.2 - (i + 1) * 0.18;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 3, 16), i % 2 ? M.white() : M.red());
    seg.position.y = 3 + i * 3 + 1.5;
    g.add(seg);
  }
  const top = 3 + levels * 3;
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.3, 16), M.iron());
  gallery.position.y = top + 0.15;
  g.add(gallery);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 12), new THREE.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xffd36a, emissiveIntensity: 1.2, roughness: 0.2 }));
  lamp.position.y = top + 1.1;
  g.add(lamp);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.2, 12), M.red());
  cap.position.y = top + 2.5;
  g.add(cap);
  return g;
}

// ---------------------------------------------------------------- gulls over the harbour

function gullGeometry() {
  // a white V with dark wing tips, made of two thin triangles per wing
  const g = new THREE.BufferGeometry();
  const v = [0, 0, 0, -0.9, 0.25, -0.15, -0.35, 0.05, 0.1, 0, 0, 0, 0.35, 0.05, 0.1, 0.9, 0.25, -0.15];
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  g.computeVertexNormals();
  return g;
}

function makeGullRing(course) {
  const group = new THREE.Group();
  const end = course.spine[course.spine.length - 1];
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, fog: false });
  const geo = gullGeometry();
  const birds = [];
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.scale.setScalar(1.6 + (i % 3) * 0.3);
    group.add(m);
    birds.push({ m, a: (i / 9) * Math.PI * 2, r: 9 + (i % 4) * 3, h: 17 + (i % 5) * 2.2, s: 0.22 + (i % 3) * 0.05, f: 5 + (i % 4) });
  }
  return {
    group,
    update(t) {
      for (const b of birds) {
        const a = b.a + t * b.s;
        b.m.position.set(end[0] + Math.cos(a) * b.r, b.h + Math.sin(t * 0.7 + b.a) * 1.2, end[2] + 6 + Math.sin(a) * b.r);
        b.m.rotation.set(0, -a, Math.sin(t * 0.5 + b.a) * 0.3);
        b.m.scale.y = (1.6 + (b.r % 3) * 0.1) * (0.7 + 0.3 * Math.sin(t * b.f + b.a));
      }
    },
  };
}

// ---------------------------------------------------------------- street signs to the harbour

function signTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 384;
  const g = c.getContext('2d');
  // older Safari has no roundRect: square corners there
  if (!g.roundRect) g.roundRect = (x, y, w, h) => g.rect(x, y, w, h);
  const draw = (y0, arrow) => {
    g.fillStyle = '#0b5cad';
    g.beginPath();
    g.roundRect(6, y0 + 6, 244, 116, 18);
    g.fill();
    g.strokeStyle = '#f4efe6';
    g.lineWidth = 7;
    g.beginPath();
    g.roundRect(16, y0 + 16, 224, 96, 12);
    g.stroke();
    // waves
    g.lineWidth = 8;
    g.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      g.beginPath();
      for (let x = 0; x <= 90; x += 3) g.lineTo(34 + x, y0 + 56 + k * 26 + Math.sin(x * 0.11) * 8);
      g.stroke();
    }
    // arrow
    g.fillStyle = '#ffc93c';
    g.save();
    g.translate(184, y0 + 64);
    g.rotate(arrow);
    g.beginPath();
    g.moveTo(0, -38);
    g.lineTo(30, -2);
    g.lineTo(11, -2);
    g.lineTo(11, 34);
    g.lineTo(-11, 34);
    g.lineTo(-11, -2);
    g.lineTo(-30, -2);
    g.closePath();
    g.fill();
    g.restore();
  };
  draw(0, 0);
  draw(128, -Math.PI / 2);
  draw(256, Math.PI / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const ARROW_ROW = { ahead: 0, left: 1, right: 2 };
function makeSigns(list) {
  const tex = signTexture();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.1 });
  const back = new THREE.MeshStandardMaterial({ color: 0x0b5cad, roughness: 0.4 });
  const iron = M.iron();
  const g = new THREE.Group();
  for (const d of list) {
    const s = new THREE.Group();
    s.position.set(d.at[0], d.at[1], d.at[2]);
    s.rotation.y = d.yaw ?? Math.PI;
    const geo = new THREE.PlaneGeometry(1.0, 0.5);
    const row = ARROW_ROW[d.arrow ?? 'ahead'] ?? 0;
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), 1 - (row + 1 - uv.getY(i)) / 3);
    const face = new THREE.Mesh(geo, mat);
    face.position.z = 0.016;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.52, 0.03), back);
    s.add(plate, face);
    if (d.hang) {
      for (const x of [-0.4, 0.4]) {
        const wire = new THREE.Mesh(new THREE.BoxGeometry(0.02, d.hang, 0.02), iron);
        wire.position.set(x, 0.25 + d.hang / 2, 0);
        s.add(wire);
      }
    }
    g.add(s);
  }
  return g;
}
