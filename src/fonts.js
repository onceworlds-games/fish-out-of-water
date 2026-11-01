// The two faces, loaded before anything draws text on a canvas (price tags in the world, posters).

export async function loadFonts(timeout = 2500) {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  const faces = ['400 40px "Alfa Slab One"', '800 40px "Barlow Condensed"', '600 40px "Barlow Condensed"'];
  await Promise.race([Promise.all(faces.map((f) => document.fonts.load(f).catch(() => null))), new Promise((r) => setTimeout(r, timeout))]);
}
