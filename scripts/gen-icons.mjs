/* 生成 PWA 图标（纯 Node，无第三方依赖）：npm run icons
 * 图案 = 深色渐变底 + 未完成/已完成的进度环 + 对勾。
 * 用 3x3 超采样做抗锯齿，输出真彩色 PNG。
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons');
mkdirSync(OUT, { recursive: true });

const CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const cr = Buffer.alloc(4);
  cr.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, cr]);
}
function png(w, h, rgb) {
  const stride = w * 3;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function distSeg(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1, vy = y2 - y1;
  const wx = px - x1, wy = py - y1;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
}

function colorAt(nx, ny) {
  let c = mix([19, 20, 24], [40, 43, 50], ny);
  const glow = Math.max(0, 1 - Math.hypot(nx - 0.5, ny - 0.36) * 1.8);
  c = mix(c, [70, 78, 90], glow * 0.35);

  const r = Math.hypot(nx - 0.5, ny - 0.5);
  const rad = 0.268, thick = 0.058;
  if (Math.abs(r - rad) < thick / 2) {
    let ang = Math.atan2(ny - 0.5, nx - 0.5) + Math.PI / 2;
    if (ang < 0) ang += Math.PI * 2;
    c = ang <= 0.68 * Math.PI * 2 ? [216, 224, 235] : [76, 82, 93];
  }

  const d = Math.min(
    distSeg(nx, ny, 0.405, 0.505, 0.472, 0.57),
    distSeg(nx, ny, 0.472, 0.57, 0.60, 0.428)
  );
  if (d < 0.019) c = [242, 245, 250];
  return c;
}

function render(size) {
  const SS = 3;
  const rgb = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = colorAt((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = SS * SS, i = (y * size + x) * 3;
      rgb[i] = Math.round(r / n);
      rgb[i + 1] = Math.round(g / n);
      rgb[i + 2] = Math.round(b / n);
    }
  }
  return png(size, size, rgb);
}

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(resolve(OUT, name), render(size));
  console.log('generated', name, size + 'x' + size);
}
