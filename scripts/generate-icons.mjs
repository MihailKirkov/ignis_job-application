// Rasterize the single brand mark (src/app/icon.svg) into the full icon set.
//
//   npm run icons
//
// Outputs (committed to the repo so the Vercel build needs no native step):
//   src/app/favicon.ico   multi-size .ico (16 / 32 / 48)  — auto-served by Next
//   src/app/apple-icon.png 180×180 apple-touch-icon        — auto-served by Next
//   public/icon-192.png    PWA manifest icon (any)
//   public/icon-512.png    PWA manifest icon (any)
//   public/maskable-512.png PWA manifest icon (maskable, safe-zone padded)
//
// Everything is flattened onto the dark base (#060A12) so there is no stray
// transparency in browser tabs / home screens; the chamfered cyan frame in the
// SVG carries the HUD silhouette.
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SVG = path.join(root, 'src/app/icon.svg');
const BG = '#060a12'; // --color-bg
const VIEWBOX = 32; // icon.svg viewBox is 0 0 32 32

const svg = await readFile(SVG);

// Render the mark to a transparent PNG buffer, rasterizing the SVG at a high
// enough density that the target size is sharp (librsvg renders at intrinsic
// size × density/72, so scale density to the requested pixels).
async function renderMark(px) {
  const density = Math.ceil((72 * px) / VIEWBOX);
  return sharp(svg, { density })
    .resize(px, px, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

// Compose the mark (sized `markPx`) centered on a solid dark square (`px`).
async function plate(px, markPx = px) {
  const mark = await renderMark(markPx);
  return sharp({
    create: { width: px, height: px, channels: 4, background: BG },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function write(rel, buf) {
  const out = path.join(root, rel);
  await writeFile(out, buf);
  console.log(`  ${rel}  (${buf.length.toLocaleString()} bytes)`);
}

console.log('Generating icons from src/app/icon.svg …');

// favicon.ico — embed 16 / 32 / 48 PNGs.
const ico = await pngToIco([await plate(16), await plate(32), await plate(48)]);
await write('src/app/favicon.ico', ico);

// apple-touch-icon — opaque, no rounding (iOS applies its own mask).
await write('src/app/apple-icon.png', await plate(180));

// PWA "any" icons.
await write('public/icon-192.png', await plate(192));
await write('public/icon-512.png', await plate(512));

// PWA "maskable" icon — mark held inside the ~70% safe zone for the circle crop.
await write('public/maskable-512.png', await plate(512, Math.round(512 * 0.7)));

console.log('Done.');
