// Just enough of a 2D canvas, in plain JS, for Grudge to draw into without a browser: fillRect, drawImage
// (with flips and scaling), save/restore/translate/scale, globalAlpha, and image data. Nearest-neighbour only,
// like the game itself. Used by tools/snap.mjs to take pictures of levels.
import { deflateSync } from "node:zlib";

const colorCache = new Map();
function parseColor(c) {
  let v = colorCache.get(c);
  if (v) return v;
  const s = String(c).replace("#", "");
  const full = s.length <= 4 ? [...s].map((ch) => ch + ch).join("") : s;
  v = [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16), full.length >= 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1];
  colorCache.set(c, v);
  return v;
}

export class SoftCanvas {
  constructor(w = 300, h = 150) { this._w = w; this._h = h; this.data = new Uint8ClampedArray(w * h * 4); this.style = {}; this.classList = { toggle() {}, add() {}, remove() {} }; }
  get width() { return this._w; }
  set width(v) { this._w = v; this.data = new Uint8ClampedArray(v * this._h * 4); }
  get height() { return this._h; }
  set height(v) { this._h = v; this.data = new Uint8ClampedArray(this._w * v * 4); }
  getContext() { return (this.ctx ??= new SoftContext(this)); }
  addEventListener() {} focus() {} setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: this._w, height: this._h }; }
  toPNG(scale = 1) { return encodePNG(this._w, this._h, this.data, scale); }
}

class SoftContext {
  constructor(canvas) { this.canvas = canvas; this.fillStyle = "#000"; this.globalAlpha = 1; this.m = [1, 0, 0, 1, 0, 0]; this.stack = []; this.imageSmoothingEnabled = false; }
  save() { this.stack.push({ m: this.m.slice(), fillStyle: this.fillStyle, globalAlpha: this.globalAlpha }); }
  restore() { const s = this.stack.pop(); if (s) { this.m = s.m; this.fillStyle = s.fillStyle; this.globalAlpha = s.globalAlpha; } }
  translate(x, y) { const m = this.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
  scale(sx, sy) { const m = this.m; m[0] *= sx; m[1] *= sx; m[2] *= sy; m[3] *= sy; }
  setTransform(a, b, c, d, e, f) { this.m = [a, b, c, d, e, f]; }
  resetTransform() { this.m = [1, 0, 0, 1, 0, 0]; }
  // the box a rectangle covers on the canvas, in whole pixels (transforms here are only shifts and flips)
  box(x, y, w, h) {
    const m = this.m, x0 = m[0] * x + m[4], x1 = m[0] * (x + w) + m[4], y0 = m[3] * y + m[5], y1 = m[3] * (y + h) + m[5];
    return [Math.round(Math.min(x0, x1)), Math.round(Math.min(y0, y1)), Math.round(Math.max(x0, x1)), Math.round(Math.max(y0, y1))];
  }
  blend(i, r, g, b, a) {
    const D = this.canvas.data;
    if (a >= 1) { D[i] = r; D[i + 1] = g; D[i + 2] = b; D[i + 3] = 255; return; }
    if (a <= 0) return;
    D[i] = D[i] * (1 - a) + r * a; D[i + 1] = D[i + 1] * (1 - a) + g * a; D[i + 2] = D[i + 2] * (1 - a) + b * a;
    D[i + 3] = Math.min(255, D[i + 3] + a * 255);
  }
  fillRect(x, y, w, h) {
    const [r, g, b, ca] = parseColor(this.fillStyle), a = ca * this.globalAlpha, W = this.canvas._w, H = this.canvas._h;
    const [x0, y0, x1, y1] = this.box(x, y, w, h);
    for (let py = Math.max(0, y0); py < Math.min(H, y1); py++) for (let px = Math.max(0, x0); px < Math.min(W, x1); px++) this.blend((py * W + px) * 4, r, g, b, a);
  }
  clearRect(x, y, w, h) {
    const W = this.canvas._w, H = this.canvas._h, [x0, y0, x1, y1] = this.box(x, y, w, h), D = this.canvas.data;
    for (let py = Math.max(0, y0); py < Math.min(H, y1); py++) D.fill(0, (py * W + Math.max(0, x0)) * 4, (py * W + Math.min(W, x1)) * 4);
  }
  drawImage(img, ...a) {
    let sx = 0, sy = 0, sw = img.width, sh = img.height, dx, dy, dw, dh;
    if (a.length === 2) [dx, dy] = a, (dw = sw), (dh = sh);
    else if (a.length === 4) [dx, dy, dw, dh] = a;
    else [sx, sy, sw, sh, dx, dy, dw, dh] = a;
    if (!img.data || !sw || !sh) return;
    const S = img.data.slice ? (img === this.canvas ? img.data.slice() : img.data) : img.data;
    const m = this.m, flipX = m[0] < 0, flipY = m[3] < 0, W = this.canvas._w, H = this.canvas._h, IW = img.width;
    const [x0, y0, x1, y1] = this.box(dx, dy, dw, dh), bw = x1 - x0, bh = y1 - y0;
    for (let py = Math.max(0, y0); py < Math.min(H, y1); py++) {
      let v = (py - y0 + 0.5) / bh; if (flipY) v = 1 - v;
      const syy = Math.min(img.height - 1, Math.floor(sy + v * sh));
      for (let px = Math.max(0, x0); px < Math.min(W, x1); px++) {
        let u = (px - x0 + 0.5) / bw; if (flipX) u = 1 - u;
        const sxx = Math.min(IW - 1, Math.floor(sx + u * sw)), si = (syy * IW + sxx) * 4, sa = S[si + 3] / 255;
        if (sa > 0) this.blend((py * W + px) * 4, S[si], S[si + 1], S[si + 2], sa * this.globalAlpha);
      }
    }
  }
  createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }
  getImageData(x, y, w, h) {
    const out = this.createImageData(w, h), W = this.canvas._w;
    for (let r = 0; r < h; r++) out.data.set(this.canvas.data.subarray(((y + r) * W + x) * 4, ((y + r) * W + x + w) * 4), r * w * 4);
    return out;
  }
  putImageData(img, x, y) {
    const W = this.canvas._w;
    for (let r = 0; r < img.height; r++) this.canvas.data.set(img.data.subarray(r * img.width * 4, (r + 1) * img.width * 4), ((y + r) * W + x) * 4);
  }
}

// ---- a small PNG writer
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); out.write(type, 4, "ascii"); Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
export function encodePNG(w, h, rgba, k = 1) {
  const W = w * k, H = h * k, raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    for (let x = 0; x < W; x++) { const s = (((y / k) | 0) * w + ((x / k) | 0)) * 4, d = y * (W * 4 + 1) + 1 + x * 4; raw[d] = rgba[s]; raw[d + 1] = rgba[s + 1]; raw[d + 2] = rgba[s + 2]; raw[d + 3] = 255; }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
