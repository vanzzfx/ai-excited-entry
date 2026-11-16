import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

const W = 1024;
const H = 1024;

function clamp(v: number, lo = 0, hi = 255): number {
  return v < lo ? lo : v > hi ? hi : v | 0;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0 || 1)));
  return t * t * (3 - 2 * t);
}

// Deterministic hash/noise
function hash2(x: number, y: number, seed: number): number {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

function fbm(x: number, y: number, seed: number, oct = 5): number {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 1013);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function setPixel(buf: Uint8Array, x: number, y: number, r: number, g: number, b: number, a = 1) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  if (a >= 1) {
    buf[i] = clamp(r); buf[i + 1] = clamp(g); buf[i + 2] = clamp(b);
  } else {
    buf[i] = clamp(lerp(buf[i], r, a));
    buf[i + 1] = clamp(lerp(buf[i + 1], g, a));
    buf[i + 2] = clamp(lerp(buf[i + 2], b, a));
  }
}

function addPixel(buf: Uint8Array, x: number, y: number, r: number, g: number, b: number, a = 1) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = clamp(buf[i] + r * a);
  buf[i + 1] = clamp(buf[i + 1] + g * a);
  buf[i + 2] = clamp(buf[i + 2] + b * a);
}

function drawGlow(buf: Uint8Array, cx: number, cy: number, radius: number, r: number, g: number, b: number, intensity = 1) {
  const r2 = radius * radius;
  const minx = Math.max(0, Math.floor(cx - radius));
  const maxx = Math.min(W - 1, Math.ceil(cx + radius));
  const miny = Math.max(0, Math.floor(cy - radius));
  const maxy = Math.min(H - 1, Math.ceil(cy + radius));
  for (let y = miny; y <= maxy; y++) {
    for (let x = minx; x <= maxx; x++) {
      const dx = x - cx, dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const t = 1 - Math.sqrt(d2) / radius;
      const a = t * t * intensity;
      addPixel(buf, x, y, r, g, b, a);
    }
  }
}

function drawFirework(buf: Uint8Array, cx: number, cy: number, seed: number) {
  const rays = 36 + ((seed * 17) % 20);
  const len = 70 + hash2(seed, 1, 99) * 90;
  const huePick = hash2(seed, 2, 77);
  let cr = 255, cg = 220, cb = 120;
  if (huePick < 0.33) { cr = 255; cg = 80; cb = 60; }
  else if (huePick < 0.66) { cr = 80; cg = 255; cb = 180; }
  else { cr = 255; cg = 220; cb = 80; }
  drawGlow(buf, cx, cy, len * 0.6, cr, cg, cb, 0.5);
  for (let i = 0; i < rays; i++) {
    const ang = (i / rays) * Math.PI * 2 + hash2(i, seed, 3) * 0.2;
    const l = len * (0.6 + 0.4 * hash2(i, seed, 4));
    for (let s = 0; s < l; s += 1.2) {
      const t = s / l;
      const px = Math.round(cx + Math.cos(ang) * s);
      const py = Math.round(cy + Math.sin(ang) * s + t * t * 18);
      const fade = (1 - t) * (1 - t);
      addPixel(buf, px, py, cr, cg * (1 - t * 0.3) + 40 * t, cb * (1 - t * 0.5), fade);
      if (t > 0.7 && hash2(i, s | 0, seed) > 0.85) {
        addPixel(buf, px + 1, py, 255, 255, 200, fade * 0.6);
      }
    }
  }
}

function drawLightning(buf: Uint8Array, x0: number, y0: number, x1: number, y1: number, seed: number) {
  const pts: [number, number][] = [[x0, y0]];
  const segments = 18;
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const jx = (hash2(i, seed, 11) - 0.5) * 90 * (1 - Math.abs(t - 0.5) * 1.2);
    pts.push([lerp(x0, x1, t) + jx, lerp(y0, y1, t)]);
  }
  pts.push([x1, y1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay));
    for (let s = 0; s <= steps; s++) {
      const t = s / (steps || 1);
      const x = Math.round(lerp(ax, bx, t));
      const y = Math.round(lerp(ay, by, t));
      for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d <= 2) addPixel(buf, x + dx, y + dy, 180, 220, 255, 0.25);
      }
      addPixel(buf, x, y, 255, 255, 255, 0.9);
    }
  }
}

function render(): Uint8Array {
  const img = new Uint8Array(W * H * 3);

  // Sky gradient + nebula
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ny = y / H;
      const nx = x / W;
      let r = lerp(8, 30, ny) + lerp(0, 40, 1 - ny);
      let g = lerp(5, 10, ny) + lerp(0, 20, 1 - ny);
      let b = lerp(25, 60, ny) + lerp(20, 80, 1 - ny);
      const n1 = fbm(nx * 3.5, ny * 3.5, 42, 5);
      const n2 = fbm(nx * 6 + 10, ny * 6 + 3, 77, 4);
      r += (n1 - 0.5) * 40 + (n2 - 0.5) * 20;
      g += (n1 - 0.5) * 10;
      b += (n1 - 0.5) * 60 + n2 * 30;
      // magenta/orange horizon glow
      const hg = Math.exp(-Math.pow((ny - 0.62) * 4.5, 2));
      r += hg * 120; g += hg * 40; b += hg * 30;
      const i = (y * W + x) * 3;
      img[i] = clamp(r); img[i + 1] = clamp(g); img[i + 2] = clamp(b);
    }
  }

  // Stars
  for (let i = 0; i < 2200; i++) {
    const sx = Math.floor(hash2(i, 0, 7) * W);
    const sy = Math.floor(hash2(i, 1, 7) * H * 0.65);
    const bstar = hash2(i, 2, 7);
    const br = 120 + bstar * 135;
    setPixel(img, sx, sy, br, br, 255, 0.5 + bstar * 0.5);
    if (bstar > 0.92) { setPixel(img, sx + 1, sy, 255, 255, 255, 0.7); setPixel(img, sx, sy + 1, 255, 255, 255, 0.7); }
  }

  // Distant mountains silhouette
  for (let x = 0; x < W; x++) {
    const nx = x / W;
    const ridge = 0.58 + 0.05 * Math.sin(nx * 8.3) + 0.03 * Math.sin(nx * 19.7 + 1.2) + 0.02 * fbm(nx * 5, 0.3, 5, 3);
    const my = Math.floor(ridge * H);
    for (let y = my; y < H; y++) {
      const i = (y * W + x) * 3;
      const d = (y - my) / 120;
      const shade = Math.max(0, 20 - d * 10);
      img[i] = clamp(lerp(shade + 10, img[i], 0.2));
      img[i + 1] = clamp(lerp(shade, img[i + 1], 0.2));
      img[i + 2] = clamp(lerp(shade + 25, img[i + 2], 0.2));
    }
  }

  // Neon city
  const baseY = Math.floor(H * 0.72);
  for (let bld = 0; bld < 55; bld++) {
    const bx = Math.floor(hash2(bld, 0, 123) * W);
    const bw = 18 + Math.floor(hash2(bld, 1, 123) * 55);
    const bh = 60 + Math.floor(hash2(bld, 2, 123) * 260);
    const by = baseY - bh;
    const hue = hash2(bld, 3, 123);
    let nr = 0, ng = 200, nb = 255;
    if (hue < 0.33) { nr = 255; ng = 0; nb = 180; }
    else if (hue < 0.66) { nr = 0; ng = 255; nb = 200; }
    for (let y = Math.max(0, by); y < baseY; y++) {
      for (let x = bx; x < Math.min(W, bx + bw); x++) {
        const i = (y * W + x) * 3;
        const edge = (x === bx || x === bx + bw - 1 || y === by) ? 0.5 : 0;
        img[i] = clamp(lerp(12, img[i], 0.1) + edge * nr * 0.4);
        img[i + 1] = clamp(lerp(10, img[i + 1], 0.1) + edge * ng * 0.4);
        img[i + 2] = clamp(lerp(18, img[i + 2], 0.1) + edge * nb * 0.4);
        // windows
        const wx = x - bx, wy = y - by;
        if (wx > 3 && wx < bw - 3 && wy > 4 && wy < bh - 4 && wx % 7 < 4 && wy % 9 < 5) {
          const lit = hash2(Math.floor(bx / 7) + wx, Math.floor(by / 9) + wy, 55);
          if (lit > 0.35) {
            const warm = lit > 0.8;
            img[i] = clamp(img[i] + (warm ? 180 : 40) * lit);
            img[i + 1] = clamp(img[i + 1] + (warm ? 160 : 120) * lit);
            img[i + 2] = clamp(img[i + 2] + (warm ? 60 : 180) * lit);
          }
        }
      }
    }
    // rooftop glow
    drawGlow(img, bx + bw / 2, by, 30, nr, ng, nb, 0.25);
  }

  // Ground reflections band
  for (let y = baseY; y < H; y++) {
    const t = (y - baseY) / (H - baseY);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const ripple = Math.sin(x * 0.08 + y * 0.3) * 0.5 + 0.5;
      img[i] = clamp(lerp(img[i], 10 + ripple * 30, 0.7));
      img[i + 1] = clamp(lerp(img[i + 1], 15 + ripple * 40, 0.7));
      img[i + 2] = clamp(lerp(img[i + 2], 30 + ripple * 60, 0.7));
    }
  }

  // Fireworks behind dragon
  drawFirework(img, 180, 150, 17);
  drawFirework(img, 860, 130, 29);
  drawFirework(img, 520, 90, 43);
  drawFirework(img, 700, 220, 61);

  // Lightning
  drawLightning(img, 780, 0, 650, 260, 13);
  drawLightning(img, 760, 40, 820, 240, 19);

  // Giant fire dragon (procedural)
  const dcx = 520, dcy = 360;
  // body glow
  drawGlow(img, dcx, dcy, 260, 255, 80, 10, 0.35);
  drawGlow(img, dcx - 80, dcy - 40, 180, 255, 140, 20, 0.25);

  // wings
  for (let side = -1; side <= 1; side += 2) {
    for (let t = 0; t <= 1; t += 0.008) {
      const span = t * 320;
      const lift = Math.sin(t * Math.PI) * 180;
      const wx = dcx + side * (40 + span);
      const wy = dcy - 40 - lift + t * 60;
      const thick = (1 - t) * 26 + 4;
      for (let k = -thick; k <= thick; k += 1) {
        const py = Math.round(wy + k);
        const px = Math.round(wx + k * side * 0.2);
        const heat = 1 - t * 0.6;
        setPixel(img, px, py, 40 + 80 * heat, 20 + 20 * heat, 30, 0.95);
        if (Math.abs(k) > thick - 2) addPixel(img, px, py, 255 * heat, 120 * heat, 20, 0.8);
      }
      // wing membrane veins fire
      if (t > 0.15 && t < 0.95) {
        for (let m = 0; m < 3; m++) {
          const mt = t * (0.3 + m * 0.25);
          const mx = Math.round(dcx + side * (30 + mt * 280));
          const my = Math.round(dcy - 20 - Math.sin(mt * Math.PI) * 140);
          addPixel(img, mx, my, 255, 160, 30, 0.7 * (1 - t));
        }
      }
    }
  }

  // serpentine body
  for (let i = 0; i < 420; i++) {
    const t = i / 419;
    const ang = -1.1 + t * 2.4;
    const sx = dcx - 120 + Math.cos(ang) * 140 + Math.sin(t * 10) * 35;
    const sy = dcy + 40 + Math.sin(ang) * 90 + Math.cos(t * 8) * 20;
    const rad = 46 * (1 - t * 0.55) * (0.85 + 0.15 * Math.sin(t * 18));
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > rad) continue;
        const n = d / rad;
        const scaleTex = fbm((sx + dx) * 0.08, (sy + dy) * 0.08, 200, 3);
        let r = lerp(220, 60, n) + scaleTex * 40;
        let g = lerp(80, 20, n) + scaleTex * 20;
        let b = lerp(20, 15, n);
        // belly
        if (dx > rad * 0.2) { r = lerp(r, 255, 0.25); g = lerp(g, 170, 0.25); b = lerp(b, 40, 0.2); }
        setPixel(img, Math.round(sx + dx), Math.round(sy + dy), r, g, b, 1);
      }
    }
  }

  // neck/head
  for (let i = 0; i < 120; i++) {
    const t = i / 119;
    const nx = dcx + 90 + t * 110;
    const ny = dcy - 30 - t * 120 + Math.sin(t * 3) * 15;
    const rad = 34 * (1 - t * 0.45);
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      if (dx * dx + dy * dy > rad * rad) continue;
      const n = Math.sqrt(dx * dx + dy * dy) / rad;
      setPixel(img, Math.round(nx + dx), Math.round(ny + dy), lerp(230, 70, n), lerp(70, 25, n), 20, 1);
    }
  }
  // head
  const hx = dcx + 210, hy = dcy - 155;
  for (let dy = -30; dy <= 26; dy++) for (let dx = -36; dx <= 44; dx++) {
    const ex = dx / 38, ey = dy / 26;
    if (ex * ex + ey * ey > 1) continue;
    const jaw = dy > 8 ? (dy - 8) * 0.12 : 0;
    if (ex * ex + (ey - jaw) * (ey - jaw) > 1.05) continue;
    setPixel(img, Math.round(hx + dx), Math.round(hy + dy), 210 - Math.abs(dy), 60, 25, 1);
  }
  // horns
  for (let h = -1; h <= 1; h += 2) {
    for (let t = 0; t < 26; t++) {
      const px = Math.round(hx + h * (10 + t * 0.9));
      const py = Math.round(hy - 18 - t * 1.4);
      const r = Math.max(1, 4 - t * 0.12);
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (dx*dx+dy*dy<=r*r) setPixel(img, px+dx, py+dy, 255, 220, 120, 1);
    }
  }
  // eye
  drawGlow(img, hx + 14, hy - 4, 16, 255, 220, 50, 0.9);
  setPixel(img, Math.round(hx + 14), Math.round(hy - 4), 255, 255, 220, 1);
  setPixel(img, Math.round(hx + 15), Math.round(hy - 4), 40, 20, 0, 1);

  // fire breath
  for (let i = 0; i < 5000; i++) {
    const t = hash2(i, 0, 314);
    const spread = (hash2(i, 1, 314) - 0.5) * (40 + t * 220);
    const bx2 = hx + 40 + t * 420;
    const by2 = hy - 5 + spread + Math.sin(t * 12 + hash2(i,2,314)*6) * 25 * t;
    const heat = Math.pow(1 - t, 1.5);
    const n = fbm(bx2 * 0.03, by2 * 0.03, 99, 3);
    if (n < t * 0.7) continue;
    const rad = (1 - t) * 22 + 2;
    const cr = 255;
    const cg = clamp(120 + heat * 135 + n * 40);
    const cb = clamp(heat * 80);
    drawGlow(img, bx2, by2, rad * 2.2, cr, cg, cb, heat * 0.18);
    if (bx2 >= 0 && bx2 < W && by2 >= 0 && by2 < H) addPixel(img, Math.round(bx2), Math.round(by2), cr, cg, cb, heat);
  }
  drawGlow(img, hx + 60, hy, 50, 255, 240, 180, 0.8);

  // embers
  for (let i = 0; i < 900; i++) {
    const ex = Math.floor(hash2(i, 0, 500) * W);
    const ey = Math.floor(hash2(i, 1, 500) * H);
    const tw = hash2(i, 2, 500);
    if (tw < 0.4) continue;
    const hot = hash2(i, 3, 500);
    addPixel(img, ex, ey, 255, 120 + hot * 120, hot * 60, tw * 0.9);
  }

  // vignette and contrast boost
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
    const vig = 1 - Math.pow(dx * dx * 0.7 + dy * dy, 1.3) * 0.45;
    let r = img[i], g = img[i + 1], b = img[i + 2];
    r = (r - 128) * 1.12 + 128; g = (g - 128) * 1.12 + 128; b = (b - 128) * 1.15 + 128;
    img[i] = clamp(r * vig); img[i + 1] = clamp(g * vig); img[i + 2] = clamp(b * vig);
  }

  return img;
}

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.concat([t, Buffer.from(data)]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(crcBuf), 0);
  return Buffer.concat([len, t, Buffer.from(data), crc]);
}

function encodePNG(width: number, height: number, rgb: Uint8Array): Buffer {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    Buffer.from(rgb.buffer, rgb.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function main() {
  const img = render();
  const png = encodePNG(W, H, img);
  const outDir = path.join(process.cwd(), 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'entry.png');
  fs.writeFileSync(outPath, png);
  console.log(outPath);
}

main();
