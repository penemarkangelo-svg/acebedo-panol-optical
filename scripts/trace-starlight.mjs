import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";

// Read-only contour extraction: the approved PNG is never edited here.
const png = await readFile("public/ar/starlight-aviator-black-demo.png");
let offset = 8, width, height; const parts = [];
while (offset < png.length) {
  const n = png.readUInt32BE(offset), type = png.toString("ascii", offset + 4, offset + 8), d = png.subarray(offset + 8, offset + 8 + n); offset += n + 12;
  if (type === "IHDR") { width = d.readUInt32BE(0); height = d.readUInt32BE(4); if (d[8] !== 8 || d[9] !== 6 || d[12] !== 0) throw Error("Expected RGBA source"); }
  if (type === "IDAT") parts.push(d);
}
const raw = inflateSync(Buffer.concat(parts)), stride = width * 4, pixels = Buffer.alloc(stride * height); offset = 0;
for (let y = 0; y < height; y++) {
  const filter = raw[offset++];
  for (let x = 0; x < stride; x++) {
    const i = y * stride + x, a = x >= 4 ? pixels[i - 4] : 0, b = y ? pixels[i - stride] : 0, c = y && x >= 4 ? pixels[i - stride - 4] : 0;
    let q = 0;
    if (filter === 1) q = a; else if (filter === 2) q = b; else if (filter === 3) q = (a + b) >> 1;
    else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); q = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
    pixels[i] = (raw[offset++] + q) & 255;
  }
}
export const pixelPoint = (x, y, z = 0) => [(x - width / 2) * 2.52 / width, (height * 0.44 - y) * 2.52 / width, z];
export function traceRim(side) {
  const cx = width * (side < 0 ? 0.242 : 0.758), cy = height * 0.50, rx = width * 0.185, ry = height * 0.365;
  return Array.from({ length: 128 }, (_, i) => {
    const angle = i / 128 * Math.PI * 2, dx = Math.cos(angle), dy = Math.sin(angle);
    const expected = 1 / Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2);
    let total = 0, weighted = 0;
    for (let r = expected * 0.85; r <= expected * 1.15; r += 0.5) {
      const x = Math.round(cx + dx * r), y = Math.round(cy + dy * r);
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const p = (y * width + x) * 4, alpha = pixels[p + 3], brightness = (pixels[p] + pixels[p + 1] + pixels[p + 2]) / 3;
      if (alpha < 150 || brightness > 100) continue;
      const weight = alpha * (1 - brightness / 110) * Math.exp(-(((r - expected) / 24) ** 2));
      total += weight; weighted += r * weight;
    }
    if (!total) throw Error(`Cannot trace rim ${side} angle ${i}; inspect reference`);
    const r = weighted / total;
    return pixelPoint(cx + dx * r, cy + dy * r);
  });
}
