// Hats, built from lathes and a few shaped parts. Made in a unit where the band is 1 wide and the hat sits on y = 0, then
// scaled to the fish's head. A hat can have an update(dt, t) for its moving parts (the propeller).

import * as THREE from 'three';

const cache = new Map();
const mats = new Map();

function mat(key, make) {
  if (!mats.has(key)) mats.set(key, make());
  return mats.get(key);
}
const std = (color, rough = 0.6, extra = {}) => mat(`${color}:${rough}:${JSON.stringify(extra)}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra }));

function canvasTex(key, w, h, draw, repeat) {
  return mat(`tex:${key}`, () => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeat) t.repeat.set(...repeat);
    t.anisotropy = 4;
    return t;
  });
}

/** A lathe from [radius, height] pairs, bottom to top. */
function lathe(pts, segs = 40) {
  return new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(r, y)),
    segs,
  );
}

function mesh(geo, material, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadow;
  return m;
}

/** A smooth curve through control points, sampled: for brims and crowns that should look sewn, not faceted. */
function smooth(ctrl, n = 24) {
  const curve = new THREE.SplineCurve(ctrl.map(([r, y]) => new THREE.Vector2(r, y)));
  return curve.getPoints(n).map((p) => [Math.max(0, p.x), p.y]);
}

const BUILD = {
  bucket() {
    const canvasT = canvasTex('canvas-olive', 128, 128, (g, w, h) => {
      g.fillStyle = '#7b8a52';
      g.fillRect(0, 0, w, h);
      g.globalAlpha = 0.18;
      for (let i = 0; i < w; i += 2) {
        g.fillStyle = i % 4 ? '#000' : '#fff';
        g.fillRect(i, 0, 1, h);
        g.fillRect(0, i, w, 1);
      }
    }, [6, 2]);
    const cloth = mat('bucket-cloth', () => new THREE.MeshStandardMaterial({ map: canvasT, roughness: 0.92, side: THREE.DoubleSide }));
    const g = new THREE.Group();
    g.add(mesh(lathe(smooth([[1.75, -0.18], [1.45, -0.02], [1.08, 0.12], [1.0, 0.2], [0.96, 0.6], [0.86, 0.92], [0.5, 1.02], [0.0, 1.04]])), cloth));
    const band = mesh(lathe([[1.02, 0.18], [1.03, 0.36], [1.0, 0.38]]), std('#4a3a26', 0.8));
    g.add(band);
    // stitched rings on the brim
    for (const r of [1.3, 1.55]) {
      const s = mesh(new THREE.TorusGeometry(r, 0.012, 4, 64), std('#5e6b3c', 0.9), false);
      s.rotation.x = Math.PI / 2;
      s.position.y = r === 1.3 ? 0.06 : -0.08;
      g.add(s);
    }
    return g;
  },
  beanie() {
    const knit = canvasTex('knit-orange', 128, 128, (g, w, h) => {
      g.fillStyle = '#e8622c';
      g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 8)
        for (let y = 0; y < h; y += 8) {
          g.fillStyle = 'rgba(0,0,0,0.18)';
          g.beginPath();
          g.ellipse(x + 2, y + 4, 2.2, 4, 0.5, 0, Math.PI * 2);
          g.fill();
          g.beginPath();
          g.ellipse(x + 6, y + 4, 2.2, 4, -0.5, 0, Math.PI * 2);
          g.fill();
        }
    }, [10, 3]);
    const m = mat('beanie', () => new THREE.MeshStandardMaterial({ map: knit, roughness: 0.95 }));
    const g = new THREE.Group();
    g.add(mesh(lathe(smooth([[1.04, 0.0], [1.08, 0.2], [1.02, 0.55], [0.86, 0.95], [0.5, 1.22], [0.0, 1.28]])), m));
    // the folded cuff, ribbed
    const cuff = lathe([[1.12, -0.02], [1.16, 0.06], [1.16, 0.38], [1.1, 0.44], [1.04, 0.44]], 48);
    const p = cuff.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const k = 1 + Math.cos(a * 40) * 0.02;
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
    cuff.computeVertexNormals();
    g.add(mesh(cuff, std('#d4541f', 0.95)));
    return g;
  },
  sailor() {
    const g = new THREE.Group();
    g.add(mesh(lathe(smooth([[0.98, 0], [1.02, 0.28], [1.25, 0.46], [1.32, 0.56], [1.0, 0.66], [0.4, 0.7], [0, 0.7]])), std('#f6f4ee', 0.55)));
    g.add(mesh(lathe([[1.0, 0.0], [1.04, 0.0], [1.06, 0.3], [1.0, 0.32]]), std('#1d2a4e', 0.5)));
    const pom = mesh(new THREE.SphereGeometry(0.24, 16, 12), std('#d93a2b', 0.95));
    pom.position.y = 0.78;
    pom.scale.y = 0.8;
    g.add(pom);
    return g;
  },
  lemon() {
    // a wedge of lemon, rind out, worn at a jaunty angle
    const g = new THREE.Group();
    const geo = new THREE.SphereGeometry(1.1, 32, 16, 0, Math.PI * 0.55, 0, Math.PI);
    const rind = mesh(geo, std('#f2cf2b', 0.45, { side: THREE.DoubleSide }));
    rind.scale.set(1, 0.8, 1);
    g.add(rind);
    const flesh = canvasTex('lemon-flesh', 128, 128, (c, w, h) => {
      c.fillStyle = '#fff6c9';
      c.fillRect(0, 0, w, h);
      c.translate(w / 2, h / 2);
      for (let i = 0; i < 9; i++) {
        c.fillStyle = '#ffe35a';
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, w * 0.44, (i / 9) * Math.PI * 2 + 0.05, ((i + 1) / 9) * Math.PI * 2 - 0.05);
        c.fill();
      }
    });
    for (const a of [0, Math.PI * 0.55]) {
      const face = mesh(new THREE.CircleGeometry(1.08, 32, Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ map: flesh, roughness: 0.35, side: THREE.DoubleSide }), false);
      face.rotation.y = a;
      face.scale.y = 0.8;
      g.add(face);
    }
    g.rotation.set(0, -0.6, 0.15);
    g.position.y = 0.2;
    return g;
  },
  straw() {
    const weave = canvasTex('straw', 128, 128, (c, w, h) => {
      c.fillStyle = '#e2c27a';
      c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 6)
        for (let x = 0; x < w; x += 12) {
          c.fillStyle = (x / 12 + y / 6) % 2 ? 'rgba(120,80,20,0.25)' : 'rgba(255,240,200,0.3)';
          c.fillRect(x + ((y / 6) % 2) * 6, y, 10, 5);
        }
    }, [8, 4]);
    const m = mat('straw', () => new THREE.MeshStandardMaterial({ map: weave, roughness: 0.85, side: THREE.DoubleSide }));
    const g = new THREE.Group();
    g.add(mesh(lathe(smooth([[2.3, 0.02], [2.0, 0.1], [1.3, 0.12], [1.02, 0.18], [1.0, 0.7], [0.82, 0.86], [0.0, 0.88]]), 56), m));
    g.add(mesh(lathe([[1.02, 0.18], [1.03, 0.42], [1.0, 0.44]]), std('#c8322a', 0.7)));
    return g;
  },
  party() {
    const stripes = canvasTex('party', 128, 128, (c, w, h) => {
      const cols = ['#ff4d6d', '#ffd23a', '#2ec4b6', '#7b5cff'];
      for (let i = 0; i < 8; i++) {
        c.fillStyle = cols[i % 4];
        c.fillRect((i * w) / 8, 0, w / 8 + 1, h);
      }
      c.fillStyle = '#fff';
      for (let i = 0; i < 30; i++) {
        c.beginPath();
        c.arc((i * 37) % w, (i * 53) % h, 3, 0, Math.PI * 2);
        c.fill();
      }
    });
    const g = new THREE.Group();
    const cone = new THREE.ConeGeometry(1.0, 2.2, 40, 1, true);
    cone.translate(0, 1.1, 0);
    g.add(mesh(cone, new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.5, side: THREE.DoubleSide })));
    const pom = mesh(new THREE.IcosahedronGeometry(0.28, 2), std('#fff3c4', 1));
    pom.position.y = 2.25;
    g.add(pom);
    g.add(mesh(new THREE.TorusGeometry(1.0, 0.08, 6, 40).rotateX(Math.PI / 2), std('#ffd23a', 0.4, { metalness: 0.6 })));
    return g;
  },
  captain() {
    const g = new THREE.Group();
    g.add(mesh(lathe(smooth([[1.0, 0], [1.02, 0.35], [1.38, 0.62], [1.42, 0.72], [1.1, 0.8], [0, 0.82]])), std('#fbfaf5', 0.4)));
    g.add(mesh(lathe([[1.01, 0.0], [1.04, 0.02], [1.05, 0.34], [1.01, 0.36]]), std('#14161c', 0.35)));
    // the peak
    const peak = new THREE.SphereGeometry(1.15, 32, 8, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.5, Math.PI * 0.12);
    const pk = mesh(peak, std('#0d0f14', 0.15, { side: THREE.DoubleSide }));
    pk.position.y = 0.12;
    g.add(pk);
    // a gold anchor badge with braid
    const gold = std('#e8b931', 0.25, { metalness: 0.9 });
    const badge = new THREE.Group();
    badge.add(mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 20), gold, false));
    const shaft = mesh(new THREE.BoxGeometry(0.05, 0.3, 0.04), gold, false);
    shaft.position.y = -0.05;
    badge.add(shaft);
    const bar = mesh(new THREE.BoxGeometry(0.22, 0.045, 0.04), gold, false);
    bar.position.y = 0.05;
    badge.add(bar);
    badge.position.set(0, 0.52, 1.18);
    badge.rotation.x = -0.4;
    badge.scale.setScalar(0.9);
    g.add(badge);
    const braid = mesh(new THREE.TorusGeometry(1.05, 0.025, 4, 40, Math.PI * 0.7), gold, false);
    braid.rotation.set(Math.PI / 2, 0, Math.PI * 0.15);
    braid.position.y = 0.3;
    g.add(braid);
    return g;
  },
  propeller() {
    const g = new THREE.Group();
    const quarters = ['#e4432d', '#ffd23a', '#2a8fd0', '#2ec27e'];
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.SphereGeometry(1.04, 12, 10, (i * Math.PI) / 2, Math.PI / 2, 0, Math.PI / 2);
      g.add(mesh(seg, std(quarters[i], 0.55)));
    }
    const brim = new THREE.SphereGeometry(1.3, 24, 4, -Math.PI * 0.35, Math.PI * 0.7, Math.PI * 0.5, Math.PI * 0.1);
    g.add(mesh(brim, std('#e4432d', 0.5, { side: THREE.DoubleSide })));
    const post = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), std('#c9ccd4', 0.3, { metalness: 0.8 }));
    post.position.y = 1.15;
    g.add(post);
    const prop = new THREE.Group();
    prop.position.y = 1.3;
    for (const s of [1, -1]) {
      const blade = mesh(new THREE.BoxGeometry(1.1, 0.03, 0.26), std(s > 0 ? '#ffd23a' : '#2a8fd0', 0.4));
      blade.position.x = s * 0.6;
      blade.rotation.x = s * 0.35;
      prop.add(blade);
    }
    g.add(prop);
    let spin = 6;
    g.userData.update = (dt, st) => {
      const want = st.flight ? 38 : st.joy > 0 ? 24 : 4;
      spin += (want - spin) * Math.min(1, dt * 3);
      prop.rotation.y += spin * dt;
    };
    return g;
  },
  tophat() {
    const g = new THREE.Group();
    const felt = std('#17181d', 0.42, { metalness: 0 });
    g.add(mesh(lathe(smooth([[1.55, 0.1], [1.42, 0.02], [1.05, 0.06], [1.0, 0.12], [0.94, 1.0], [1.02, 1.9], [0.98, 1.95], [0.0, 1.96]]), 48), felt));
    g.add(mesh(lathe([[0.97, 0.12], [1.0, 0.13], [0.98, 0.5], [0.95, 0.52]]), std('#7a1d2a', 0.35)));
    return g;
  },
  viking() {
    const g = new THREE.Group();
    const steel = std('#8f969e', 0.35, { metalness: 0.85 });
    g.add(mesh(lathe(smooth([[1.08, 0], [1.06, 0.4], [0.86, 0.95], [0.4, 1.2], [0, 1.24]])), steel));
    g.add(mesh(lathe([[1.1, -0.02], [1.14, 0.04], [1.14, 0.2], [1.08, 0.24]]), std('#6b4a2a', 0.7)));
    // horns: tapered tubes along a curve
    for (const s of [1, -1]) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(s * 0.9, 0.55, 0), new THREE.Vector3(s * 1.5, 0.75, 0.05), new THREE.Vector3(s * 1.8, 1.35, 0.1), new THREE.Vector3(s * 1.7, 1.9, 0.12)]);
      const tube = new THREE.TubeGeometry(curve, 24, 0.24, 12, false);
      const p = tube.attributes.position;
      // taper toward the tip: shrink each ring toward its centre
      const rings = 25, around = 13;
      for (let i = 0; i < rings; i++) {
        const c = curve.getPointAt(i / (rings - 1));
        const k = 1 - (i / (rings - 1)) * 0.92;
        for (let j = 0; j < around; j++) {
          const v = i * around + j;
          p.setXYZ(v, c.x + (p.getX(v) - c.x) * k, c.y + (p.getY(v) - c.y) * k, c.z + (p.getZ(v) - c.z) * k);
        }
      }
      tube.computeVertexNormals();
      g.add(mesh(tube, std('#efe6d0', 0.45)));
    }
    for (let i = 0; i < 10; i++) {
      const rivet = mesh(new THREE.SphereGeometry(0.06, 6, 4), steel, false);
      const a = (i / 10) * Math.PI * 2;
      rivet.position.set(Math.cos(a) * 1.15, 0.12, Math.sin(a) * 1.15);
      g.add(rivet);
    }
    return g;
  },
  chef() {
    const g = new THREE.Group();
    const cotton = std('#fbfbf8', 0.75);
    g.add(mesh(lathe([[1.0, 0], [1.02, 0.6], [1.0, 0.62]], 40), cotton));
    // the puff: a ruffled ball
    const puff = new THREE.SphereGeometry(1.25, 48, 24);
    const p = puff.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(z, x);
      const k = 1 + Math.sin(a * 9) * 0.05 * Math.max(0, y / 1.25 + 0.2);
      p.setXYZ(i, x * k, y * 0.75, z * k);
    }
    puff.computeVertexNormals();
    const pm = mesh(puff, cotton);
    pm.position.y = 1.25;
    g.add(pm);
    return g;
  },
  pirate() {
    const g = new THREE.Group();
    const felt = std('#1b1a20', 0.6, { side: THREE.DoubleSide });
    g.add(mesh(lathe(smooth([[1.0, 0], [0.98, 0.5], [0.7, 0.85], [0, 0.92]])), felt));
    // three upturned brims
    const brim = new THREE.RingGeometry(0.9, 1.9, 60, 3);
    const p = brim.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const r = Math.hypot(x, y), a = Math.atan2(y, x);
      const up = Math.pow(Math.max(0, Math.cos(a * 3)), 0.6) * (r - 0.9) * 1.0;
      p.setXYZ(i, x * (1 - 0.18 * Math.max(0, Math.cos(a * 3))), y * (1 - 0.18 * Math.max(0, Math.cos(a * 3))), up);
    }
    brim.computeVertexNormals();
    const b = mesh(brim, felt);
    b.rotation.x = -Math.PI / 2;
    b.position.y = 0.05;
    g.add(b);
    const trim = mesh(new THREE.TorusGeometry(1.0, 0.04, 4, 40).rotateX(Math.PI / 2), std('#e8b931', 0.3, { metalness: 0.8 }), false);
    trim.position.y = 0.06;
    g.add(trim);
    // a white skull-ish badge
    const skull = mesh(new THREE.SphereGeometry(0.2, 12, 8), std('#f4efe6', 0.5), false);
    skull.position.set(0, 0.5, 0.98);
    skull.scale.set(1, 1, 0.4);
    g.add(skull);
    return g;
  },
  crown() {
    const g = new THREE.Group();
    const gold = std('#f2c230', 0.2, { metalness: 1 });
    const n = 7;
    const shape = [];
    for (let i = 0; i <= n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      shape.push(a);
    }
    // a band with points: a cylinder whose top edge is lifted at the points
    const band = new THREE.CylinderGeometry(1.08, 1.0, 1, n * 8, 4, true);
    const p = band.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y <= -0.49) continue;
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const spike = Math.pow(Math.abs(Math.cos((a * n) / 2)), 3);
      const k = (y + 0.5) / 1;
      p.setY(i, -0.5 + k * (0.5 + spike * 0.75));
    }
    band.computeVertexNormals();
    band.translate(0, 0.5, 0);
    g.add(mesh(band, mat('crown-gold', () => new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.2, metalness: 1, side: THREE.DoubleSide }))));
    const gems = ['#e4432d', '#2a8fd0', '#2ec27e'];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const tip = mesh(new THREE.SphereGeometry(0.1, 10, 8), gold, false);
      tip.position.set(Math.cos(a) * 1.07, 1.28, Math.sin(a) * 1.07);
      g.add(tip);
      const gem = mesh(new THREE.OctahedronGeometry(0.13, 0), new THREE.MeshPhysicalMaterial({ color: gems[i % 3], roughness: 0.05, metalness: 0, clearcoat: 1, emissive: gems[i % 3], emissiveIntensity: 0.25 }), false);
      gem.position.set(Math.cos(a) * 1.07, 0.32, Math.sin(a) * 1.07);
      g.add(gem);
    }
    g.add(mesh(new THREE.TorusGeometry(1.03, 0.07, 6, 40).rotateX(Math.PI / 2), gold, false));
    return g;
  },
};

export const HAT_IDS = Object.keys(BUILD);

/**
 * A hat for a fish: `size` is the band's width in metres. Returns a Group sitting on y = 0 with its up along +y, or null.
 */
export function makeHat(id, size = 0.08) {
  const build = BUILD[id];
  if (!build) return null;
  const g = new THREE.Group();
  const inner = build();
  inner.scale.setScalar(size / 2);
  g.add(inner);
  g.userData.update = inner.userData.update;
  return g;
}
