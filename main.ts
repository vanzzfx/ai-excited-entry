import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

const W = 1024;
const H = 1024;
const SEED = 1337;

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
function rand(a = 0, b = 1) { return a + (b - a) * rnd(); }

function clamp(v: number, lo = 0, hi = 255) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function smooth(t: number) { return t * t * (3 - 2 * t); }

// value noise
const perm: number[] = new Array(512);
{
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}
function hash2(x: number, y: number) { return perm[(perm[x & 255] + (y & 255)) & 255] / 255; }
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x: number, y: number, oct = 5) {
  let v = 0, amp = 0.5, freq = 1, sum = 0;
  for (let i = 0; i < oct; i++) { v += amp * vnoise(x * freq, y * freq); sum += amp; amp *= 0.5; freq *= 2; }
  return v / sum;
}

const img = new Uint8Array(W * H * 3);
function idx(x: number, y: number) { return (y * W + x) * 3; }
function setPix(x: number, y: number, r: number, g: number, b: number, a = 1) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = idx(x|0, y|0);
  if (a >= 1) { img[i] = clamp(r); img[i + 1] = clamp(g); img[i + 2] = clamp(b); }
  else { img[i] = clamp(img[i] + (r - img[i]) * a); img[i + 1] = clamp(img[i + 1] + (g - img[i + 1]) * a); img[i + 2] = clamp(img[i + 2] + (b - img[i + 2]) * a); }
}
function addPix(x: number, y: number, r: number, g: number, b: number, a = 1) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = idx(x|0, y|0);
  img[i] = clamp(img[i] + r * a); img[i + 1] = clamp(img[i + 1] + g * a); img[i + 2] = clamp(img[i + 2] + b * a);
}
function getPix(x: number, y: number) { const i = idx(x, y); return [img[i], img[i + 1], img[i + 2]]; }

function drawSky() {
  for (let y = 0; y < H; y++) {
    const t = y / H;
    let r = lerp(5, 20, t), g = lerp(5, 10, t), b = lerp(25, 60, t);
    const n = fbm(y * 0.01, 3.7, 4);
    r += n * 8; b += n * 20;
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      img[i] = clamp(r); img[i + 1] = clamp(g); img[i + 2] = clamp(b);
    }
  }
}

function drawStars() {
  const starRnd = mulberry32(SEED + 1);
  for (let i = 0; i < 400; i++) {
    const x = (starRnd() * W) | 0, y = (starRnd() * (H * 0.55)) | 0;
    const b = 150 + starRnd() * 105;
    setPix(x, y, b, b, 255, 0.9);
    if (starRnd() > 0.7) { setPix(x + 1, y, b, b, 255, 0.4); setPix(x, y + 1, b, b, 255, 0.4); }
  }
}

function drawMoon() {
  const cx = 820, cy = 140, rad = 70;
  for (let y = cy - rad - 10; y <= cy + rad + 10; y++) {
    for (let x = cx - rad - 10; x <= cx + rad + 10; x++) {
      const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d < rad) {
        const shade = 1 - (d / rad) * 0.2;
        setPix(x, y, 240 * shade, 230 * shade, 210 * shade, 1);
      } else if (d < rad + 15) {
        const a = 1 - (d - rad) / 15;
        addPix(x, y, 120 * a, 110 * a, 180 * a, 1);
      }
    }
  }
}

function drawBuildings() {
  const br = mulberry32(SEED + 2);
  const baseY = 620;
  for (let i = 0; i < 40; i++) {
    const bw = 30 + br() * 60;
    const bh = 80 + br() * 350;
    const bx = br() * W - bw * 0.3;
    const by = baseY + br() * 40;
    const hue = br();
    const r0 = 10 + br() * 20, g0 = 10 + br() * 25, b0 = 20 + br() * 40;
    for (let y = Math.max(0, (by - bh) | 0); y < Math.min(H, by | 0); y++) {
      for (let x = Math.max(0, bx | 0); x < Math.min(W, (bx + bw) | 0); x++) {
        setPix(x, y, r0, g0, b0, 1);
      }
    }
    // neon windows
    for (let wy = by - bh + 10; wy < by - 10; wy += 14 + br() * 10) {
      for (let wx = bx + 6; wx < bx + bw - 6; wx += 10 + br() * 8) {
        if (br() > 0.35) {
          const wc = hue < 0.33 ? [0, 255, 255] : hue < 0.66 ? [255, 0, 200] : [255, 200, 0];
          const lit = 0.5 + br() * 0.5;
          for (let dy = 0; dy < 6; dy++) for (let dx = 0; dx < 5; dx++) setPix(wx + dx, wy + dy, wc[0] * lit, wc[1] * lit, wc[2] * lit, 1);
        }
      }
    }
    // roof neon edge
    const edgeC = hue < 0.5 ? [0, 255, 255] : [255, 0, 255];
    const ry = (by - bh) | 0;
    for (let x = Math.max(0, bx | 0); x < Math.min(W, (bx + bw) | 0); x++) {
      addPix(x, ry, edgeC[0] * 0.6, edgeC[1] * 0.6, edgeC[2] * 0.6, 1);
      addPix(x, ry - 1, edgeC[0] * 0.3, edgeC[1] * 0.3, edgeC[2] * 0.3, 1);
    }
  }
}

function drawGround() {
  for (let y = 620; y < H; y++) {
    const t = (y - 620) / (H - 620);
    for (let x = 0; x < W; x++) {
      const wet = fbm(x * 0.05, y * 0.05, 3);
      const r = lerp(8, 18, t) + wet * 10;
      const g = lerp(8, 12, t) + wet * 5;
      const b = lerp(20, 30, t) + wet * 25;
      setPix(x, y, r, g, b, 1);
      // reflections of neon vertical streaks
      if (wet > 0.55 && (x % 7 < 2)) {
        const rc = (x * 13 % 3 === 0) ? [0, 120, 140] : (x * 13 % 3 === 1) ? [140, 0, 120] : [120, 80, 0];
        addPix(x, y, rc[0] * (1 - t) * 0.4, rc[1] * (1 - t) * 0.4, rc[2] * (1 - t) * 0.4, 1);
      }
    }
  }
}

function glowCircle(cx: number, cy: number, rad: number, r: number, g: number, b: number, intensity = 1) {
  const r2 = rad * rad;
  for (let y = Math.max(0, (cy - rad) | 0); y < Math.min(H, (cy + rad) | 0); y++) {
    for (let x = Math.max(0, (cx - rad) | 0); x < Math.min(W, (cx + rad) | 0); x++) {
      const dx = x - cx, dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r2) {
        const t = 1 - Math.sqrt(d2) / rad;
        addPix(x, y, r * t * t * intensity, g * t * t * intensity, b * t * t * intensity, 1);
      }
    }
  }
}

function drawFireBreath() {
  // cone from dragon mouth roughly (360,330) toward left/down
  const mx = 360, my = 330;
  const fr = mulberry32(SEED + 10);
  for (let i = 0; i < 5000; i++) {
    const t = fr();
    const ang = Math.PI * 0.75 + (fr() - 0.5) * 0.9;
    const dist = t * 520;
    const spread = t * 120 * (0.3 + fr() * 0.7);
    const nx = Math.cos(ang + Math.PI / 2), ny = Math.sin(ang + Math.PI / 2);
    const px = mx + Math.cos(ang) * dist + nx * (fr() - 0.5) * 2 * spread;
    const py = my + Math.sin(ang) * dist + ny * (fr() - 0.5) * 2 * spread;
    const heat = 1 - t;
    let rr, gg, bb;
    if (heat > 0.7) { rr = 255; gg = 240; bb = 180; }
    else if (heat > 0.4) { rr = 255; gg = 140 + heat * 100; bb = 20; }
    else { rr = 220; gg = 40 + heat * 80; bb = 0; }
    const a = (1 - t) * 0.6;
    addPix(px, py, rr * a, gg * a, bb * a, 1);
    if (fr() > 0.7) addPix(px + 1, py, rr * a * 0.5, gg * a * 0.5, bb * a * 0.5, 1);
  }
  glowCircle(mx - 80, my + 80, 220, 255, 120, 20, 0.35);
  glowCircle(mx - 200, my + 150, 180, 255, 60, 0, 0.25);
}

function drawDragon() {
  // stylized dragon using ellipses and curves approximated by distance fields
  const body = (x: number, y: number) => {
    // main body arc
    let d = 1e9;
    // body segments along a curve
    const pts = [[520,380],[480,360],[440,350],[400,345],[360,350],[330,370],[310,400],[320,430],[350,450],[390,445],[430,430],[470,410]];
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1];
      const vx = bx - ax, vy = by - ay;
      const t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy + 1e-6), 0, 1);
      const cx = ax + vx * t, cy = ay + vy * t;
      const rad = 38 - i * 1.2;
      const dd = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) - rad;
      d = Math.min(d, dd);
    }
    // tail
    const tail = [[470,410],[520,430],[560,420],[590,390],[610,350],[600,310],[570,290]];
    for (let i = 0; i < tail.length - 1; i++) {
      const ax = tail[i][0], ay = tail[i][1], bx = tail[i + 1][0], by = tail[i + 1][1];
      const vx = bx - ax, vy = by - ay;
      const t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy + 1e-6), 0, 1);
      const cx = ax + vx * t, cy = ay + vy * t;
      const rad = 18 - i * 2;
      d = Math.min(d, Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) - rad);
    }
    // neck/head
    const head = [[360,350],[330,330],[310,320],[300,335],[320,355]];
    for (let i = 0; i < head.length - 1; i++) {
      const ax = head[i][0], ay = head[i][1], bx = head[i + 1][0], by = head[i + 1][1];
      const vx = bx - ax, vy = by - ay;
      const t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy + 1e-6), 0, 1);
      const cx = ax + vx * t, cy = ay + vy * t;
      const rad = 22 - i * 1.5;
      d = Math.min(d, Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) - rad);
    }
    // jaw
    const jaw = [[310,335],[285,345],[295,355],[320,350]];
    for (let i = 0; i < jaw.length - 1; i++) {
      const ax = jaw[i][0], ay = jaw[i][1], bx = jaw[i + 1][0], by = jaw[i + 1][1];
      const vx = bx - ax, vy = by - ay;
      const t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy + 1e-6), 0, 1);
      const cx = ax + vx * t, cy = ay + vy * t;
      d = Math.min(d, Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) - 10);
    }
    return d;
  };

  const wing = (x: number, y: number, side: number) => {
    // side: -1 upper/back wing, 1 front wing
    const ox = 430, oy = 360;
    const pts = side < 0 ? [[ox,oy],[380,260],[300,180],[220,160],[260,240],[320,300],[380,340]] : [[ox,oy],[470,240],[520,140],[600,120],[560,220],[500,300],[460,350]];
    // distance to polygon-ish wing membrane via triangles fan
    let inside = false;
    for (let i = 1, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-6) + xi);
      if (intersect) inside = !inside;
    }
    // edge distance
    let d = 1e9;
    for (let i = 0; i < pts.length; i++) {
      const ax = pts[i][0], ay = pts[i][1], bx = pts[(i + 1) % pts.length][0], by = pts[(i + 1) % pts.length][1];
      const vx = bx - ax, vy = by - ay;
      const t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy + 1e-6), 0, 1);
      const cx = ax + vx * t, cy = ay + vy * t;
      d = Math.min(d, Math.sqrt((x - cx) ** 2 + (y - cy) ** 2));
    }
    return inside ? -d : d;
  };

  const x0 = 180, x1 = 700, y0 = 120, y1 = 520;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const db = body(x, y);
      const dw1 = wing(x, y, -1);
      const dw2 = wing(x, y, 1);
      if (dw1 < 0) {
        const edge = Math.min(1, -dw1 / 12);
        const n = fbm(x * 0.08, y * 0.08, 3);
        const glow = 0.6 + 0.4 * n;
        setPix(x, y, 40 + 180 * glow, 10 + 40 * glow, 5, 0.85 * edge + 0.15);
        if (-dw1 < 4) addPix(x, y, 255, 120, 20, 0.8);
      }
      if (db < 0) {
        const edge = Math.min(1, -db / 10);
        const n = fbm(x * 0.12 + 10, y * 0.12, 4);
        const scales = 0.5 + 0.5 * Math.sin(x * 0.4 + n * 3) * Math.sin(y * 0.4 + n * 2);
        const hot = Math.max(0, 1 - (Math.sqrt((x - 330) ** 2 + (y - 340) ** 2) / 120));
        let r = lerp(50, 180, scales) + hot * 80;
        let g = lerp(10, 50, scales) + hot * 120;
        let b = lerp(5, 20, scales) + hot * 40;
        setPix(x, y, r, g, b, 0.9);
        if (-db < 3) addPix(x, y, 255, 180, 50, 0.9);
      }
      if (dw2 < 0) {
        const edge = Math.min(1, -dw2 / 12);
        const n = fbm(x * 0.08 + 5, y * 0.08, 3);
        const glow = 0.6 + 0.4 * n;
        setPix(x, y, 60 + 195 * glow, 15 + 60 * glow, 5, 0.95);
        if (-dw2 < 4) addPix(x, y, 255, 160, 40, 0.9);
        // membrane veins
        if (Math.abs(Math.sin((x - y) * 0.12)) < 0.08) addPix(x, y, 255, 200, 80, 0.4);
      }
    }
  }
  // eye
  glowCircle(298, 328, 12, 255, 200, 50, 1.2);
  setPix(297, 328, 255, 255, 220, 1); setPix(298, 328, 255, 255, 255, 1); setPix(299, 328, 255, 255, 220, 1);
  // horns/spikes
  for (const [hx, hy, dx, dy] of [[300,310,-10,-25],[320,305,0,-28],[350,340,15,-30],[390,340,20,-28],[430,350,25,-22]]) {
    for (let t = 0; t <= 1; t += 0.02) {
      const px = hx + dx * t, py = hy + dy * t;
      const rad = (1 - t) * 4;
      for (let oy = -rad; oy <= rad; oy++) for (let ox = -rad; ox <= rad; ox++) if (ox*ox+oy*oy <= rad*rad) setPix(px+ox, py+oy, 80+120*(1-t), 30+60*(1-t), 10, 1);
    }
  }
  glowCircle(430, 380, 120, 255, 80, 10, 0.18);
}

function drawLightning() {
  const lr = mulberry32(SEED + 20);
  for (let b = 0; b < 3; b++) {
    let x = 150 + lr() * 700, y = 0;
    const tx = x + (lr() - 0.5) * 200;
    while (y < 350) {
      const nx = x + (lr() - 0.5) * 40 + (tx - x) * 0.05;
      const ny = y + 10 + lr() * 20;
      // draw segment
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = (x + (nx - x) * t) | 0, py = (y + (ny - y) * t) | 0;
        addPix(px, py, 180, 200, 255, 0.9);
        addPix(px + 1, py, 120, 150, 255, 0.5);
        addPix(px - 1, py, 120, 150, 255, 0.5);
      }
      x = nx; y = ny;
      if (lr() > 0.85) {
        let bx = x, by = y;
        for (let j = 0; j < 5; j++) { bx += (lr()-0.5)*30; by += 10+lr()*15; addPix(bx,by,120,140,220,0.5); }
      }
    }
  }
}

function drawEmbers() {
  const er = mulberry32(SEED + 30);
  for (let i = 0; i < 600; i++) {
    const x = er() * W, y = er() * H;
    // bias toward fire area
    const dx = x - 200, dy = y - 380;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 500 * er() + 150) {
      const hot = Math.max(0, 1 - d / 650);
      const s = er() > 0.8 ? 2 : 1;
      const r = 255, g = 100 + hot * 155, bcol = hot * 100;
      for (let oy = 0; oy < s; oy++) for (let ox = 0; ox < s; ox++) addPix(x + ox, y + oy, r, g, bcol, 0.5 + hot * 0.5);
    }
  }
}

function drawTitleGlow() {
  // subtle cinematic vignette
  const cx = W / 2, cy = H / 2, maxd = Math.sqrt(cx * cx + cy * cy);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy) / maxd;
      if (d > 0.6) {
        const v = (d - 0.6) / 0.4 * 0.45;
        const i = idx(x, y);
        img[i] = clamp(img[i] * (1 - v)); img[i + 1] = clamp(img[i + 1] * (1 - v)); img[i + 2] = clamp(img[i + 2] * (1 - v));
      }
    }
  }
}

function encodePNG(width: number, height: number, data: Uint8Array): Buffer {
  function crc32(buf: Uint8Array) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type: string, payload: Uint8Array) {
    const len = Buffer.alloc(4); len.writeUInt32BE(payload.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.concat([t, Buffer.from(payload)]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(crcBuf), 0);
    return Buffer.concat([len, t, Buffer.from(payload), crc]);
  }
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    Buffer.from(data.buffer, data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function main() {
  drawSky();
  drawStars();
  drawMoon();
  drawLightning();
  drawBuildings();
  drawGround();
  drawFireBreath();
  drawDragon();
  drawEmbers();
  drawTitleGlow();

  const outDir = path.join(process.cwd(), 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const png = encodePNG(W, H, img);
  fs.writeFileSync(path.join(outDir, 'entry.png'), png);
  console.log(`wrote output/entry.png ${png.length} bytes`);
}

main();
