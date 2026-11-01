// Collects geometry per material and merges it into one mesh each per 24 m square of the course (so what's behind the
// camera, or outside the sun's shadow box, is culled): a whole course in a few hundred draw calls at most.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();
const s = new THREE.Vector3();

const CHUNK = 24;
const box3 = new THREE.Box3();

export function createBatch() {
  const groups = new Map(); // material:chunk -> { material, geos: [], cast, receive }
  return {
    /** Add geometry (cloned, transformed) under a material. `t`: { p:[x,y,z], r:[x,y,z] (YXZ), s:[x,y,z] } or a Matrix4. */
    add(material, geo, t, opts = {}) {
      let g = geo.index ? geo.toNonIndexed() : geo.clone();
      if (t) {
        if (t.isMatrix4) g.applyMatrix4(t);
        else {
          e.set(t.r?.[0] ?? 0, t.r?.[1] ?? 0, t.r?.[2] ?? 0, 'YXZ');
          q.setFromEuler(e);
          v.set(t.p?.[0] ?? 0, t.p?.[1] ?? 0, t.p?.[2] ?? 0);
          s.set(t.s?.[0] ?? 1, t.s?.[1] ?? 1, t.s?.[2] ?? 1);
          m4.compose(v, q, s);
          g.applyMatrix4(m4);
        }
      }
      // keep only the attributes every piece has, so they merge
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
      // world-mapped materials read the uv as (ground height under the piece, paint index)
      if (material.userData?.world) {
        const pos = g.attributes.position;
        let ground = opts.ground;
        if (ground === undefined) {
          ground = Infinity;
          for (let i = 0; i < pos.count; i++) ground = Math.min(ground, pos.getY(i));
        }
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, ground, opts.paint ?? 0);
      }
      box3.setFromBufferAttribute(g.attributes.position);
      const key = `${material.uuid}:${Math.floor((box3.min.x + box3.max.x) / 2 / CHUNK)}:${Math.floor((box3.min.z + box3.max.z) / 2 / CHUNK)}`;
      let entry = groups.get(key);
      if (!entry) groups.set(key, (entry = { material, geos: [], cast: true, receive: true }));
      if (opts.cast === false) entry.cast = false;
      entry.geos.push(g);
    },
    build(name = 'batch') {
      const group = new THREE.Group();
      group.name = name;
      for (const entry of groups.values()) {
        const material = entry.material;
        if (!entry.geos.length) continue;
        const merged = mergeGeometries(entry.geos, false);
        for (const g of entry.geos) g.dispose();
        if (!merged) continue;
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, material);
        mesh.castShadow = entry.cast;
        mesh.receiveShadow = entry.receive;
        mesh.matrixAutoUpdate = false;
        group.add(mesh);
      }
      groups.clear();
      return group;
    },
  };
}

/** A box whose UVs repeat once per `tile` metres on every face (textures keep their size whatever the box's). */
export function tiledBox(w, h, d, tile = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // face order: +x, -x, +y, -y, +z, -z (4 vertices each)
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++)
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * dims[f][0]) / tile, (uv.getY(k) * dims[f][1]) / tile);
    }
  return g;
}
