// Generates the ShotDock toolbar icons as PNGs with zero dependencies.
// The mark: a lime rounded square, a downward capture arrow, and a dock bar.
// Rendered at 4x and box-filtered down for antialiasing.
//
// The brand lime is far too light to carry a white mark (1.4:1), so the arrow
// is the brand graphite — which also keeps the icon legible on the light and
// dark browser toolbars alike. Mirrors BRAND_LIME/BRAND_INK in shared/constants.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const SIZES = [16, 32, 48, 128];
const SS = 4; // supersampling factor

const BG_TOP = [190, 243, 70]; // lime, lifted
const BG_BOTTOM = [151, 210, 18]; // lime, deepened
const FG = [17, 24, 39]; // brand graphite

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function insideRoundedRect(px, py, x, y, w, h, r) {
  if (px < x || py < y || px > x + w || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function insideTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  const a = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / d;
  const b = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / d;
  return a >= 0 && b >= 0 && a + b <= 1;
}

/** Renders one icon into an RGBA buffer of `size` x `size`. */
function renderIcon(size) {
  const big = size * SS;
  const acc = new Float64Array(big * big * 4);

  for (let y = 0; y < big; y++) {
    for (let x = 0; x < big; x++) {
      // Normalised coordinates in a 0..1 square.
      const u = (x + 0.5) / big;
      const v = (y + 0.5) / big;
      const i = (y * big + x) * 4;

      if (!insideRoundedRect(u, v, 0, 0, 1, 1, 0.22)) continue;

      // Background gradient.
      const t = clamp01(v);
      acc[i] = BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t;
      acc[i + 1] = BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t;
      acc[i + 2] = BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t;
      acc[i + 3] = 255;

      // Foreground: arrow shaft, arrow head, dock bar.
      const shaft = insideRoundedRect(u, v, 0.44, 0.2, 0.12, 0.32, 0.06);
      const head = insideTriangle(u, v, 0.28, 0.46, 0.72, 0.46, 0.5, 0.72);
      const dock = insideRoundedRect(u, v, 0.22, 0.78, 0.56, 0.09, 0.045);
      if (shaft || head || dock) {
        acc[i] = FG[0];
        acc[i + 1] = FG[1];
        acc[i + 2] = FG[2];
      }
    }
  }

  // Box downsample to the target size.
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * big + (x * SS + sx)) * 4;
          const alpha = acc[i + 3] / 255;
          r += acc[i] * alpha;
          g += acc[i + 1] * alpha;
          b += acc[i + 2] * alpha;
          a += acc[i + 3];
        }
      }
      const n = SS * SS;
      const avgAlpha = a / n;
      const weight = avgAlpha > 0 ? (a / 255) : 1;
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / weight);
      out[o + 1] = Math.round(g / weight);
      out[o + 2] = Math.round(b / weight);
      out[o + 3] = Math.round(avgAlpha);
    }
  }
  return out;
}

// --- Minimal PNG writer -----------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const png = encodePng(renderIcon(size), size);
  writeFileSync(resolve(OUT_DIR, `icon-${size}.png`), png);
}
console.log(`ShotDock icons written to public/icons (${SIZES.join(', ')}px)`);
