// Effects: the arc preview (a dotted line of water drops and a landing ring that says what's there), splashes and
// sparkles, wet splats that dry, confetti, the player's halo.

import * as THREE from 'three';
import { contact } from '../sim/world.js';

const SURF_RING = {
  water: { color: 0x4cd3ec, icon: 'drop' },
  finish: { color: 0xffc93c, icon: 'wave' },
  ice: { color: 0xbfe9ff, icon: 'slide' },
  wet: { color: 0xffffff, icon: null },
  steel: { color: 0xffffff, icon: null },
  hot: { color: 0xe4432d, icon: 'hot' },
  sand: { color: 0xff9a5c, icon: 'hot' },
  bounce: { color: 0xffc93c, icon: 'bounce' },
  net: { color: 0xe4432d, icon: 'stop' },
  none: { color: 0xffffff, icon: null },
};

function iconTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  const icons = ['drop', 'wave', 'slide', 'hot', 'bounce', 'stop'];
  icons.forEach((name, i) => {
    const x = i * (512 / 6) + 512 / 12, y = 64;
    g.save();
    g.translate(x, y);
    g.lineWidth = 9;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = '#1a1d22';
    g.fillStyle = '#ffffff';
    if (name === 'drop') {
      g.beginPath();
      g.moveTo(0, -30);
      g.bezierCurveTo(18, -6, 24, 6, 22, 14);
      g.arc(0, 12, 22, 0.1, Math.PI - 0.1);
      g.bezierCurveTo(-24, 6, -18, -6, 0, -30);
      g.fill();
      g.stroke();
    } else if (name === 'wave') {
      g.beginPath();
      for (let k = -1; k <= 1; k++) {
        g.moveTo(-30, k * 16);
        g.bezierCurveTo(-15, k * 16 - 10, -5, k * 16 + 10, 10, k * 16);
        g.bezierCurveTo(18, k * 16 - 8, 25, k * 16 - 4, 30, k * 16);
      }
      g.strokeStyle = '#ffffff';
      g.lineWidth = 8;
      g.stroke();
    } else if (name === 'slide') {
      g.strokeStyle = '#ffffff';
      g.beginPath();
      for (const dx of [-14, 8]) {
        g.moveTo(dx - 8, -18);
        g.lineTo(dx + 8, 0);
        g.lineTo(dx - 8, 18);
      }
      g.stroke();
    } else if (name === 'hot') {
      g.strokeStyle = '#ffffff';
      g.beginPath();
      for (const dx of [-16, 0, 16]) {
        g.moveTo(dx, 26);
        g.bezierCurveTo(dx - 10, 12, dx + 10, 2, dx, -10);
        g.bezierCurveTo(dx - 8, -18, dx + 6, -24, dx, -30);
      }
      g.stroke();
    } else if (name === 'bounce') {
      g.strokeStyle = '#ffffff';
      g.beginPath();
      g.moveTo(-24, 20);
      g.lineTo(0, -20);
      g.lineTo(24, 20);
      g.moveTo(-12, 0);
      g.lineTo(0, -20);
      g.lineTo(12, 0);
      g.stroke();
    } else if (name === 'stop') {
      g.strokeStyle = '#ffffff';
      g.beginPath();
      g.moveTo(-18, -18);
      g.lineTo(18, 18);
      g.moveTo(18, -18);
      g.lineTo(-18, 18);
      g.stroke();
    }
    g.restore();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { tex: t, index: Object.fromEntries(icons.map((n, i) => [n, i])) };
}

export function createFx(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // ---------------------------------------------------------------- the arc
  const ARC_N = 120; // 3 s of flight at a drop every 3 steps
  const dropGeo = new THREE.SphereGeometry(1, 10, 8);
  const arcMat = new THREE.MeshStandardMaterial({ color: 0xdff8ff, emissive: 0x4cd3ec, emissiveIntensity: 0.55, roughness: 0.1, transparent: true, opacity: 0.95 });
  const arc = new THREE.InstancedMesh(dropGeo, arcMat, ARC_N);
  arc.frustumCulled = false;
  arc.count = 0;
  group.add(arc);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.36, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }));
  ring.renderOrder = 5;
  group.add(ring);
  const ringFill = new THREE.Mesh(new THREE.CircleGeometry(0.26, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }));
  group.add(ringFill);
  const icons = iconTexture();
  const iconGeo = new THREE.PlaneGeometry(0.34, 0.34).rotateX(-Math.PI / 2);
  const iconMesh = new THREE.Mesh(iconGeo, new THREE.MeshBasicMaterial({ map: icons.tex, transparent: true, depthWrite: false }));
  iconMesh.renderOrder = 6;
  group.add(iconMesh);
  const setIcon = (name) => {
    if (!name) {
      iconMesh.visible = false;
      return;
    }
    iconMesh.visible = true;
    const i = icons.index[name];
    const uv = iconGeo.attributes.uv;
    // plane uv after rotateX keeps its order: 0,1 / 1,1 / 0,0 / 1,0
    const u0 = i / 6, u1 = (i + 1) / 6;
    uv.setXY(0, u0, 1);
    uv.setXY(1, u1, 1);
    uv.setXY(2, u0, 0);
    uv.setXY(3, u1, 0);
    uv.needsUpdate = true;
  };
  ring.visible = ringFill.visible = iconMesh.visible = false;
  const m4 = new THREE.Matrix4();

  // ---------------------------------------------------------------- particles
  const P_N = 420;
  const pMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, emissive: 0x111111 });
  const parts = new THREE.InstancedMesh(dropGeo, pMat, P_N);
  parts.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(P_N * 3), 3);
  parts.frustumCulled = false;
  parts.count = 0;
  group.add(parts);
  const P = [];
  const col = new THREE.Color();

  // ---------------------------------------------------------------- wet splats (darken what they lie on)
  const S_N = 48;
  const splatMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.MultiplyBlending, premultipliedAlpha: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const splatGeo = new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2);
  const splats = new THREE.InstancedMesh(splatGeo, splatMat, S_N);
  splats.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(S_N * 3).fill(1), 3);
  splats.frustumCulled = false;
  splats.renderOrder = 2;
  group.add(splats);
  const S = [];
  let sNext = 0;

  // ---------------------------------------------------------------- splash crowns (the finish): a ring of water jets that
  // jump up and out round the fish and fall back, with a ring of foam left on the surface
  const JETS = 30;
  const jetGeo = new THREE.ConeGeometry(0.065, 1, 7, 1, true).translate(0, 0.5, 0).rotateY(Math.PI / 5);
  const foamGeo = new THREE.RingGeometry(0.7, 1, 36).rotateX(-Math.PI / 2);
  const crowns = [];
  for (let i = 0; i < 3; i++) {
    const jets = new THREE.InstancedMesh(jetGeo, new THREE.MeshStandardMaterial({ color: 0xeefaff, roughness: 0.15, transparent: true, opacity: 0.75, depthWrite: false, emissive: 0x6ab8d0, emissiveIntensity: 0.25 }), JETS);
    jets.frustumCulled = false;
    const foam = new THREE.Mesh(foamGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    jets.visible = foam.visible = false;
    group.add(jets, foam);
    const tilt = [];
    for (let j = 0; j < JETS; j++) tilt.push(0.55 + ((j * 7) % 5) * 0.1 + ((j * 13) % 3) * 0.08);
    crowns.push({ jets, foam, tilt, age: 9, size: 1, x: 0, y: 0, z: 0, spin: 0 });
  }
  let crownNext = 0;
  const jetM = new THREE.Matrix4();
  const jetQ = new THREE.Quaternion();
  const jetE = new THREE.Euler(0, 0, 0, 'YXZ');
  const jetP = new THREE.Vector3();
  const jetS = new THREE.Vector3();

  // ---------------------------------------------------------------- the halo under the player
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.44, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.85, depthWrite: false }));
  halo.renderOrder = 4;
  group.add(halo);
  halo.visible = false;

  // ---------------------------------------------------------------- glints: sparkles drawn as soft four-point stars, facing the camera
  const G_N = 160;
  const glintMat = new THREE.MeshBasicMaterial({ map: glintTexture(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const glints = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), glintMat, G_N);
  glints.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(G_N * 3), 3);
  glints.frustumCulled = false;
  glints.count = 0;
  glints.renderOrder = 8;
  group.add(glints);
  const GL = [];
  const camQ = new THREE.Quaternion();
  const gq = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const tmpV = new THREE.Vector3();
  const tmpS = new THREE.Vector3();
  const tmpE = new THREE.Euler();

  // ---------------------------------------------------------------- the slap ring: where you come down, a ring closing on
  // it to the moment you touch (let go then); gold inside the window
  const ringMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });
  const slapAim = new THREE.Mesh(new THREE.RingGeometry(0.27, 0.36, 48).rotateX(-Math.PI / 2), ringMat());
  const slapClose = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64).rotateX(-Math.PI / 2), ringMat());
  slapAim.renderOrder = slapClose.renderOrder = 7;
  slapAim.visible = slapClose.visible = false;
  group.add(slapAim, slapClose);

  // ---------------------------------------------------------------- shock rings: a slap, a perfect, a scale
  const shocks = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2), ringMat());
    m.visible = false;
    m.renderOrder = 7;
    group.add(m);
    shocks.push({ m, age: 9, life: 0.4, size: 1 });
  }
  let shockNext = 0;

  const CONFETTI = [0xffc93c, 0xe4432d, 0x4cd3ec, 0xf4efe6, 0x0b5cad];
  function pushP(x, y, z, vx, vy, vz, life, size, color, kind, g) {
    if (P.length >= P_N) P.shift();
    P.push({ x, y, z, vx, vy, vz, life, age: 0, size, color, kind, g });
  }
  // a column of water (the geyser and whale-spout finishes): a burst of spray from the surface for a second or so
  const geyser = { age: 9, x: 0, y: 0, z: 0, h: 3, spout: false, acc: 0 };

  const fx = {
    reduced: false,
    lowQuality: false,
    group,
    /** The camera the glints face (set by the page). */
    camera: null,
    /**
     * The slap ring at `land` ({ x, y, z }) with `left` seconds to touchdown; `win` the slap window (s); `holding`: the
     * player is holding (a slap is coming), so it's drawn bold. null hides it.
     */
    slapRing(land, left = 1, win = 0.1, holding = false) {
      if (!land) {
        slapAim.visible = slapClose.visible = false;
        return;
      }
      const y = land.y - 0.13;
      const inWin = left <= win;
      const col = inWin ? 0xffc93c : 0xffffff;
      slapAim.visible = slapClose.visible = true;
      slapAim.position.set(land.x, y, land.z);
      slapClose.position.set(land.x, y + 0.002, land.z);
      slapAim.material.color.setHex(col);
      slapClose.material.color.setHex(inWin ? 0xffc93c : 0x4cd3ec);
      const r = 0.36 + Math.min(2.2, Math.max(0, left) * 2.6);
      slapClose.scale.setScalar(r);
      const k = holding ? 1 : 0.45;
      slapAim.material.opacity = 0.95 * k;
      slapClose.material.opacity = Math.min(1, 0.35 + (1 - Math.min(1, left / 0.8)) * 0.65) * k;
      slapAim.scale.setScalar(inWin ? 1.15 : 1);
    },
    /** An expanding ring on the ground. */
    shock(x, y, z, size = 1, color = 0xffffff, life = 0.4) {
      if (fx.reduced) size *= 0.7;
      const s = shocks[shockNext++ % shocks.length];
      s.age = 0;
      s.life = life;
      s.size = size;
      s.m.position.set(x, y + 0.01, z);
      s.m.material.color.setHex(color);
      s.m.visible = true;
    },
    /** Star glints (a slap, a scale, a perfect). */
    glint(x, y, z, n = 8, color = 0xffffff, power = 1) {
      if (fx.lowQuality) n = Math.ceil(n * 0.5);
      for (let i = 0; i < n; i++) {
        if (GL.length >= G_N) GL.shift();
        const a = Math.random() * Math.PI * 2;
        const sp = (0.6 + Math.random() * 1.6) * power;
        GL.push({ x, y, z, vx: Math.cos(a) * sp, vy: (0.8 + Math.random() * 2) * power, vz: Math.sin(a) * sp, age: 0, life: 0.35 + Math.random() * 0.4, size: (0.12 + Math.random() * 0.14) * Math.sqrt(power), color, spin: Math.random() * 6 });
      }
    },
    /** Draw the arc from a list of points [x,y,z,...] and the landing ring at `land` ({ x, y, z, surf, zone }). */
    arc(points, land, t) {
      if (!points || points.length < 6) {
        arc.count = 0;
        ring.visible = ringFill.visible = iconMesh.visible = false;
        return;
      }
      const n = Math.min(ARC_N, points.length / 3);
      for (let i = 0; i < n; i++) {
        const j = i * 3;
        const k = i / Math.max(1, n - 1);
        const s = 0.028 + 0.018 * Math.sin(k * Math.PI) + 0.01 * Math.sin(t * 8 - i * 0.7);
        m4.makeScale(s, s, s);
        m4.setPosition(points[j], points[j + 1] + 0.02, points[j + 2]);
        arc.setMatrixAt(i, m4);
      }
      arc.count = n;
      arc.instanceMatrix.needsUpdate = true;
      if (land && land.surf) {
        const kind = land.zone?.kind === 'finish' ? 'finish' : land.zone?.rate ? 'water' : land.surf;
        const st = SURF_RING[kind] ?? SURF_RING.none;
        ring.visible = ringFill.visible = true;
        ring.material.color.setHex(st.color);
        ringFill.material.color.setHex(st.color);
        const pulse = 1 + 0.08 * Math.sin(t * 9);
        const y = land.y - 0.14;
        ring.position.set(land.x, y, land.z);
        ring.scale.setScalar(pulse);
        ringFill.position.set(land.x, y - 0.001, land.z);
        iconMesh.position.set(land.x, y + 0.002, land.z);
        setIcon(st.icon);
      } else {
        ring.visible = ringFill.visible = iconMesh.visible = false;
      }
    },
    hideArc() {
      arc.count = 0;
      ring.visible = ringFill.visible = iconMesh.visible = false;
    },
    halo(x, y, z, on) {
      halo.visible = on;
      if (on) halo.position.set(x, y + 0.01, z);
    },
    /**
     * A cosmetic trail behind a fish in the air: call every frame with its position and speed. kind: drips | bubbles |
     * sparkle | confetti | ink | rainbow | gold. `state` is the caller's own little object (emission carry-over).
     */
    trail(state, kind, x, y, z, speed, dt) {
      if (!kind || speed < 1.5) return;
      const rate = fx.lowQuality ? 14 : 30;
      state.acc = (state.acc ?? 0) + dt * rate * Math.min(1.4, speed / 6);
      state.hue = ((state.hue ?? 0) + dt * 0.9) % 1;
      while (state.acc >= 1) {
        state.acc -= 1;
        const jx = (Math.random() - 0.5) * 0.12, jy = (Math.random() - 0.5) * 0.12, jz = (Math.random() - 0.5) * 0.12;
        if (kind === 'drips') pushP(x + jx, y + jy, z + jz, jx, -0.4, jz, 0.5, 0.022 + Math.random() * 0.014, 0xbff4ff, 'drip', 9);
        else if (kind === 'bubbles') pushP(x + jx, y + jy, z + jz, jx * 2, 0.5 + Math.random() * 0.4, jz * 2, 1 + Math.random() * 0.5, 0.03 + Math.random() * 0.03, 0xdff8ff, 'bubble', -0.3);
        else if (kind === 'sparkle') fx.glint(x + jx, y + jy, z + jz, 1, 0xffffff, 0.25);
        else if (kind === 'gold') fx.glint(x + jx, y + jy, z + jz, 1, Math.random() < 0.5 ? 0xffc93c : 0xffe7a0, 0.3);
        else if (kind === 'rainbow') fx.glint(x + jx, y + jy, z + jz, 1, col.setHSL((state.hue + Math.random() * 0.08) % 1, 0.9, 0.62).getHex(), 0.28);
        else if (kind === 'confetti') pushP(x + jx, y + jy, z + jz, jx * 6, 0.6 + Math.random(), jz * 6, 1.4 + Math.random(), 0.045, CONFETTI[(Math.random() * 5) | 0], 'confetti', 3);
        else if (kind === 'ink') pushP(x + jx, y + jy, z + jz, jx, 0.1, jz, 0.9 + Math.random() * 0.4, 0.05 + Math.random() * 0.04, 0x2a2440, 'ink', 0);
      }
    },
    /** The finish splash in a fish's style: plain | crown | fireworks | geyser | whale. */
    finishSplash(kind, x, y, z) {
      if (kind === 'crown') {
        fx.crown(x, y, z, 1.05);
        fx.glint(x, y + 0.4, z, 16, 0xffffff, 1.6);
        fx.shock(x, y, z, 2.4, 0xffffff, 0.7);
      } else if (kind === 'fireworks') {
        fx.crown(x, y, z, 0.75);
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * 6.28;
          const c = [0xffc93c, 0xe4432d, 0x4cd3ec, 0xf4efe6][i];
          setTimeout(() => fx.glint(x + Math.cos(a) * 1.2, y + 2.4 + Math.random(), z + Math.sin(a) * 1.2, 26, c, 2.2), 180 + i * 220);
        }
      } else if (kind === 'geyser') {
        fx.crown(x, y, z, 0.9);
        geyser.age = 0;
        geyser.x = x;
        geyser.y = y;
        geyser.z = z;
        geyser.h = 3.2;
      } else if (kind === 'whale') {
        fx.crown(x, y, z, 0.8);
        geyser.age = 0;
        geyser.x = x;
        geyser.y = y;
        geyser.z = z;
        geyser.h = 4.6;
        geyser.spout = true;
      } else fx.crown(x, y, z, 0.75);
    },
    /** A burst of drops. kind: 'splash' | 'sparkle' | 'sand' | 'dust' | 'confetti' | 'spray' */
    burst(x, y, z, n, kind = 'splash', power = 1, dir = null) {
      if (kind === 'sparkle') return fx.glint(x, y, z, Math.ceil(n * 0.6), 0xffffff, power);
      if (fx.lowQuality) n = Math.ceil(n * 0.5);
      if (fx.reduced && kind === 'confetti') n = Math.ceil(n * 0.4);
      for (let i = 0; i < n; i++) {
        if (P.length >= P_N) P.shift();
        const a = Math.random() * Math.PI * 2;
        const sp = (kind === 'sparkle' ? 0.8 : kind === 'confetti' ? 3 : 2.2) * power * (0.4 + Math.random() * 0.8);
        const up = (kind === 'sand' ? 1.6 : kind === 'sparkle' ? 1.2 : kind === 'confetti' ? 6 : 3.2) * power * (0.5 + Math.random() * 0.7);
        let c = 0xbff4ff;
        if (kind === 'sand') c = Math.random() < 0.5 ? 0xe9c88f : 0xd9b070;
        else if (kind === 'dust') c = 0xd8cfc0;
        else if (kind === 'confetti') c = [0xffc93c, 0xe4432d, 0x4cd3ec, 0xf4efe6, 0x0b5cad][i % 5];
        else if (kind === 'sparkle') c = 0xffffff;
        P.push({
          x, y, z,
          vx: Math.cos(a) * sp + (dir ? dir[0] * power : 0),
          vy: up,
          vz: Math.sin(a) * sp + (dir ? dir[1] * power : 0),
          life: kind === 'confetti' ? 2.5 + Math.random() : 0.5 + Math.random() * 0.5,
          age: 0,
          size: kind === 'confetti' ? 0.05 : kind === 'sparkle' ? 0.022 : 0.03 + Math.random() * 0.03,
          color: c,
          kind,
          g: kind === 'confetti' ? 3 : kind === 'sparkle' ? 2 : 12,
        });
      }
    },
    /** A splash crown at a water surface (y), `size` about its radius in metres. */
    crown(x, y, z, size = 0.5) {
      const c = crowns[crownNext++ % crowns.length];
      c.age = 0;
      c.size = size;
      c.x = x;
      c.y = y;
      c.z = z;
      c.spin = Math.random() * 6.28;
      c.foam.position.set(x, y + 0.02, z);
      c.jets.visible = c.foam.visible = true;
      fx.burst(x, y + 0.1, z, Math.round(18 + size * 30), 'splash', 1 + size);
    },
    splat(x, y, z, size = 0.35, wet = 1) {
      const i = sNext++ % S_N;
      S[i] = { x, y, z, size: size * (0.6 + 0.4 * wet), age: 0, life: 5 + wet * 2, rot: Math.random() * 6 };
    },
    update(dt) {
      // glints: drift up, slow, twinkle out
      if (fx.camera) camQ.copy(fx.camera.quaternion);
      let gn = 0;
      for (let i = GL.length - 1; i >= 0; i--) {
        const p = GL[i];
        p.age += dt;
        if (p.age >= p.life) {
          GL.splice(i, 1);
          continue;
        }
        p.vx *= 1 - dt * 3;
        p.vz *= 1 - dt * 3;
        p.vy = p.vy * (1 - dt * 3) - dt * 1.5;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
      }
      for (const p of GL) {
        if (gn >= G_N) break;
        const k = p.age / p.life;
        const s = p.size * Math.sin(Math.min(1, k * 1.15) * Math.PI);
        gq.setFromAxisAngle(zAxis, p.spin + p.age * 3);
        gq.premultiply(camQ);
        m4.compose(tmpV.set(p.x, p.y, p.z), gq, tmpS.set(s, s, s));
        glints.setMatrixAt(gn, m4);
        glints.setColorAt(gn, col.setHex(p.color));
        gn++;
      }
      glints.count = gn;
      glints.instanceMatrix.needsUpdate = true;
      if (glints.instanceColor) glints.instanceColor.needsUpdate = true;
      for (const sh of shocks) {
        if (!sh.m.visible) continue;
        sh.age += dt;
        const k = sh.age / sh.life;
        if (k >= 1) {
          sh.m.visible = false;
          continue;
        }
        const e = 1 - (1 - k) * (1 - k) * (1 - k);
        sh.m.scale.setScalar(0.2 + e * sh.size);
        sh.m.material.opacity = 0.85 * (1 - k);
      }
      if (geyser.age < 1.3) {
        geyser.age += dt;
        geyser.acc += dt * (fx.lowQuality ? 70 : 150);
        const v = Math.sqrt(2 * 12 * geyser.h);
        while (geyser.acc >= 1) {
          geyser.acc -= 1;
          const a = Math.random() * 6.28, r = Math.random() * 0.12;
          const spread = geyser.spout ? 1.6 : 0.5;
          pushP(geyser.x + Math.cos(a) * r, geyser.y, geyser.z + Math.sin(a) * r, Math.cos(a) * spread * Math.random(), v * (0.75 + Math.random() * 0.3) * (1 - geyser.age * 0.4), Math.sin(a) * spread * Math.random(), 0.9 + Math.random() * 0.5, 0.035 + Math.random() * 0.035, 0xeefaff, 'splash', 12);
        }
        if (geyser.age >= 1.3) geyser.spout = false;
      }
      // particles
      let n = 0;
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i];
        p.age += dt;
        if (p.age >= p.life) {
          P.splice(i, 1);
          continue;
        }
        p.vy -= p.g * dt;
        if (p.kind === 'bubble' || p.kind === 'ink') {
          p.vx *= 1 - dt * 2;
          p.vz *= 1 - dt * 2;
        }
        if (p.kind === 'confetti') {
          p.vx *= 1 - dt * 1.5;
          p.vz *= 1 - dt * 1.5;
          p.vy = Math.max(p.vy, -1.6);
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
      }
      for (const p of P) {
        if (n >= P_N) break;
        const k = 1 - p.age / p.life;
        const s = p.kind === 'ink' ? p.size * (1 + (1 - k) * 2.2) * Math.min(1, k * 3) : p.kind === 'bubble' ? p.size * (0.7 + 0.3 * Math.sin(p.age * 9)) * Math.min(1, k * 4) : p.size * (p.kind === 'confetti' ? 1 : 0.4 + 0.6 * k);
        if (p.kind === 'confetti') m4.makeRotationFromEuler(tmpE.set(p.age * 7, p.age * 5, 0)).scale(tmpS.set(s, s * 0.15, s * 0.7));
        else m4.makeScale(s, s, s);
        m4.setPosition(p.x, p.y, p.z);
        parts.setMatrixAt(n, m4);
        parts.setColorAt(n, col.setHex(p.color));
        n++;
      }
      parts.count = n;
      parts.instanceMatrix.needsUpdate = true;
      if (parts.instanceColor) parts.instanceColor.needsUpdate = true;
      // splats
      let sn = 0;
      for (let i = 0; i < S_N; i++) {
        const s = S[i];
        if (!s) continue;
        s.age += dt;
        if (s.age >= s.life) {
          S[i] = null;
          continue;
        }
        const k = s.age / s.life;
        const sc = s.size * (1 - k * 0.35);
        m4.makeRotationY(s.rot);
        m4.scale(tmpS.set(sc, 1, sc * 0.8));
        m4.setPosition(s.x, s.y + 0.004, s.z);
        splats.setMatrixAt(sn, m4);
        const v = 0.5 + 0.5 * k;
        splats.setColorAt(sn, col.setRGB(v, v * 1.02, v * 1.05));
        sn++;
      }
      splats.count = sn;
      splats.instanceMatrix.needsUpdate = true;
      if (splats.instanceColor) splats.instanceColor.needsUpdate = true;
      // crowns: the jets shoot up and lean out, then sink back; the foam ring spreads and fades
      for (const c of crowns) {
        if (c.age > 1.6) continue;
        c.age += dt;
        const k = c.age;
        if (k > 1.6) {
          c.jets.visible = c.foam.visible = false;
          continue;
        }
        const up = k < 0.2 ? k / 0.2 : Math.max(0, 1 - (k - 0.2) / 0.75);
        const lift = up * (2 - up);
        const ring = c.size * (0.45 + Math.min(1, k / 0.7) * 0.55);
        c.jets.visible = lift > 0.02;
        for (let j = 0; j < JETS; j++) {
          const a = c.spin + (j / JETS) * Math.PI * 2;
          const h = c.size * 1.25 * lift * c.tilt[j];
          // tilt toward +z, then turn to face out from the centre
          jetE.set(0.35 + k * 0.5, a, 0);
          jetQ.setFromEuler(jetE);
          jetP.set(c.x + Math.sin(a) * ring, c.y - 0.04, c.z + Math.cos(a) * ring);
          jetS.set(1 + c.size, Math.max(0.001, h), 1 + c.size);
          jetM.compose(jetP, jetQ, jetS);
          c.jets.setMatrixAt(j, jetM);
        }
        c.jets.instanceMatrix.needsUpdate = true;
        c.jets.material.opacity = 0.75 * Math.min(1, lift * 1.6);
        const fr = c.size * (0.85 + k * 1.1);
        c.foam.scale.set(fr, 1, fr);
        c.foam.material.opacity = 0.8 * Math.max(0, 1 - k / 1.6);
      }
    },
    clear() {
      P.length = 0;
      S.length = 0;
      GL.length = 0;
      for (const sh of shocks) sh.m.visible = false;
      slapAim.visible = slapClose.visible = false;
      for (const c of crowns) {
        c.age = 9;
        c.jets.visible = c.foam.visible = false;
      }
      fx.hideArc();
      geyser.age = 9;
    },
  };
  return fx;
}

let glintT = null;
/** A soft four-point star on black (drawn additively). */
function glintTexture() {
  if (glintT) return glintT;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  g.globalCompositeOperation = 'lighter';
  for (const [w, h] of [[30, 2.2], [2.2, 30]]) {
    const lg = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    lg.addColorStop(0, 'rgba(255,255,255,1)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg;
    g.beginPath();
    g.ellipse(32, 32, w, h, 0, 0, Math.PI * 2);
    g.fill();
  }
  glintT = new THREE.CanvasTexture(c);
  glintT.colorSpace = THREE.SRGBColorSpace;
  return glintT;
}

const probe = { nx: 0, ny: 0, nz: 0, depth: 0 };
/** The height of the first solid below a point (for the halo and shadows of things in the air), or null. */
export function groundBelow(world, x, y, z, max = 8) {
  for (let d = 0; d <= max; d += 0.2) {
    const yy = y - d;
    const list = world.query(x, yy, z, 0.05);
    for (const c of list) {
      if (contact(c, x, yy, z, 0.05, probe) && probe.ny > 0.5) {
        // refine
        let lo = yy, hi = yy + 0.2;
        for (let k = 0; k < 6; k++) {
          const mid = (lo + hi) / 2;
          if (contact(c, x, mid, z, 0.05, probe)) lo = mid;
          else hi = mid;
        }
        return lo - 0.05;
      }
    }
  }
  return null;
}
