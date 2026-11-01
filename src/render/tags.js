// The fish-market price tag, drawn on canvases: the atlas of tags spiked in the ice, and the tag every fish wears.

import * as THREE from 'three';

const PRICES = ['4.90', '12.50', '7.20', '9.80', '3.40', '15.00', '6.60', '8.90'];
let atlas = null;

export const TAG_FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';
export const SLAB_FONT = '"Alfa Slab One", Georgia, serif';

export function tagPath(g, x, y, w, h, r = 10) {
  // a tag: rounded rectangle with a clipped top-left corner and a hole
  g.beginPath();
  g.moveTo(x + r * 1.6, y);
  g.lineTo(x + w - r, y);
  g.arcTo(x + w, y, x + w, y + r, r);
  g.lineTo(x + w, y + h - r);
  g.arcTo(x + w, y + h, x + w - r, y + h, r);
  g.lineTo(x + r, y + h);
  g.arcTo(x, y + h, x, y + h - r, r);
  g.lineTo(x, y + r * 1.6);
  g.closePath();
}

export function tagAtlas() {
  if (atlas) return atlas;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 256);
  for (let i = 0; i < 8; i++) {
    const x = (i % 4) * 128, y = Math.floor(i / 4) * 128;
    g.save();
    tagPath(g, x + 8, y + 22, 112, 84, 12);
    g.fillStyle = '#1a1d22';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = '#2c3038';
    g.stroke();
    g.fillStyle = '#f4efe6';
    g.font = `800 50px ${TAG_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(PRICES[i], x + 64, y + 66);
    g.beginPath();
    g.arc(x + 22, y + 36, 5, 0, Math.PI * 2);
    g.fillStyle = '#e4432d';
    g.fill();
    g.restore();
  }
  atlas = new THREE.CanvasTexture(c);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 4;
  return atlas;
}
