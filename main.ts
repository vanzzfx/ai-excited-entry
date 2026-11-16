const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 1024, H = 1024;
const buf = Buffer.alloc(W * H * 4);

function setPx(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
}
function blendPx(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  const aa = Math.max(0, Math.min(1, a));
  const ia = 1 - aa;
  buf[i] = Math.round(r * aa + buf[i] * ia);
  buf[i + 1] = Math.round(g * aa + buf[i + 1] * ia);
  buf[i + 2] = Math.round(b * aa + buf[i + 2] * ia);
  buf[i + 3] = 255;
}
function clamp(v, lo = 0, hi = 255) { return v < lo ? lo : v > hi ? hi : v | 0; }
function lerp(a, b, t) { return a + (b - a) * t; }

function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(0xC0FFEE42);
function rrange(a,b){ return a + (b-a)*rnd(); }

function fillBackground() {
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    let r,g,b;
    if (t < 0.55) {
      const k = t / 0.55;
      r = lerp(6, 20, k); g = lerp(8, 10, k); b = lerp(28, 60, k);
    } else {
      const k = (t - 0.55) / 0.45;
      r = lerp(20, 35, k); g = lerp(10, 8, k); b = lerp(60, 40, k);
    }
    // horizon haze
    const hz = Math.exp(-Math.pow((t - 0.62) / 0.08, 2));
    r = lerp(r, 80, hz * 0.35); g = lerp(g, 30, hz * 0.25); b = lerp(b, 90, hz * 0.25);
    for (let x = 0; x < W; x++) {
      let rr = r, gg = g, bb = b;
      // subtle stars
      if (y < 620) {
        const s = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        const sv = s < 0 ? s + 1 : s;
        if (sv > 0.9986) {
          const tw = 0.6 + 0.4 * Math.sin((x+y)*0.3);
          rr += 120*tw; gg += 130*tw; bb += 150*tw;
        }
      }
      setPx(x, y, clamp(rr), clamp(gg), clamp(bb), 255);
    }
  }
}

function drawMoon() {
  const cx = 820, cy = 150, rad = 58;
  for (let y = -rad-10; y <= rad+10; y++) for (let x = -rad-10; x <= rad+10; x++) {
    const d = Math.hypot(x, y);
    if (d <= rad) {
      const shade = 0.9 - 0.15 * ((x+20)/rad);
      blendPx(cx+x, cy+y, 255*shade, 240*shade, 210*shade, 1);
    } else if (d < rad + 12) {
      blendPx(cx+x, cy+y, 255, 120, 80, (1 - (d-rad)/12) * 0.18);
    }
  }
}

function drawBuildings() {
  let x = -20;
  while (x < W + 40) {
    const bw = Math.floor(rrange(36, 92));
    const bh = Math.floor(rrange(180, 520));
    const bx = Math.floor(x);
    const by = H - bh;
    const hue = rnd();
    let br=18,bg=16,bb=28;
    if (hue < 0.33) { br=10; bg=18; bb=30; }
    else if (hue < 0.66) { br=20; bg=10; bb=26; }
    for (let yy = by; yy < H; yy++) for (let xx = bx; xx < bx+bw; xx++) {
      const edge = (xx===bx||xx===bx+bw-1) ? 8 : 0;
      setPx(xx, yy, clamp(br+edge), clamp(bg+edge), clamp(bb+edge), 255);
    }
    // neon edge
    const neon = [[0,255,255],[255,0,180],[255,120,0],[120,255,80]][Math.floor(rnd()*4)];
    for (let yy = by; yy < H; yy+=2) {
      blendPx(bx, yy, neon[0], neon[1], neon[2], 0.7);
      blendPx(bx+bw-1, yy, neon[0], neon[1], neon[2], 0.7);
    }
    // windows
    for (let wy = by + 12; wy < H - 20; wy += Math.floor(rrange(10,16))) {
      for (let wx = bx + 6; wx < bx + bw - 6; wx += Math.floor(rrange(8,14))) {
        if (rnd() < 0.35) continue;
        const lit = rnd();
        let wr,wg,wb,a=0.9;
        if (lit < 0.5) { wr=0; wg=220; wb=255; }
        else if (lit < 0.8) { wr=255; wg=60; wb=180; }
        else { wr=255; wg=200; wb=80; }
        const ww = Math.floor(rrange(3,6)), wh = Math.floor(rrange(4,7));
        for (let j=0;j<wh;j++) for (let i=0;i<ww;i++) blendPx(wx+i, wy+j, wr, wg, wb, a*(0.7+0.3*rnd()));
      }
    }
    // antenna/sign
    if (rnd() < 0.4) {
      const ax = bx + Math.floor(bw/2);
      const ah = Math.floor(rrange(20,70));
      for (let yy=by-ah; yy<by; yy++) blendPx(ax, yy, neon[0], neon[1], neon[2], 0.8);
      for (let r=0;r<4;r++) for (let a=0;a<Math.PI*2;a+=0.4) blendPx(Math.round(ax+Math.cos(a)*r), Math.round(by-ah+Math.sin(a)*r), 255,80,80,0.9);
    }
    x += bw + rrange(-6, 10);
  }
}

function glowCircle(cx, cy, radius, r,g,b, intensity) {
  const r2 = radius*radius;
  for (let y = -radius; y <= radius; y++) for (let x = -radius; x <= radius; x++) {
    const d2 = x*x + y*y;
    if (d2 <= r2) {
      const d = Math.sqrt(d2);
      const a = Math.pow(1 - d/radius, 2) * intensity;
      blendPx(cx+x, cy+y, r,g,b,a);
    }
  }
}

function drawDragon() {
  // body curve points
  const pts = [];
  for (let i=0;i<=60;i++){
    const t=i/60;
    const x = lerp(160, 860, t) + Math.sin(t*3.2)*70;
    const y = lerp(520, 240, t) + Math.sin(t*5.0)*40 - Math.sin(t*Math.PI)*60;
    pts.push({x,y});
  }
  // fiery aura under/around
  for (let i=0;i<2600;i++){
    const t = rnd();
    const p = pts[Math.floor(t*(pts.length-1))];
    const ang = rrange(0, Math.PI*2);
    const rad = Math.pow(rnd(),0.5)*rrange(20,120);
    const x = Math.round(p.x + Math.cos(ang)*rad + rrange(-30,30));
    const y = Math.round(p.y + Math.sin(ang)*rad*0.7 + rrange(-20,30));
    const heat = 1 - rad/140;
    const rr = 255, gg = clamp(80 + heat*160), bb = clamp(heat*60);
    blendPx(x,y,rr,gg,bb, clampFloat(heat*0.08));
  }
  function clampFloat(v){ return v<0?0:v>1?1:v; }

  // thick body
  for (let i=0;i<pts.length-1;i++){
    const p = pts[i], q = pts[i+1];
    const t = i/(pts.length-1);
    const thick = lerp(42, 16, t);
    const steps = Math.ceil(Math.hypot(q.x-p.x,q.y-p.y)*2);
    for (let s=0;s<=steps;s++){
      const k=s/steps;
      const x = lerp(p.x,q.x,k), y = lerp(p.y,q.y,k);
      for (let oy=-thick; oy<=thick; oy++) for (let ox=-thick; ox<=thick; ox++){
        const d = Math.hypot(ox,oy);
        if (d <= thick) {
          const edge = d/thick;
          const core = 1-edge;
          const rr = clamp(120 + core*135);
          const gg = clamp(20 + core*120 - edge*10);
          const bb = clamp(10 + core*30);
          blendPx(Math.round(x+ox), Math.round(y+oy), rr,gg,bb, 0.95);
          if (core>0.7) blendPx(Math.round(x+ox), Math.round(y+oy), 255,220,120, (core-0.7)*0.5);
        }
      }
    }
  }
  // belly/scales highlight
  for (let i=2;i<pts.length-2;i+=2){
    const p=pts[i];
    const t=i/(pts.length-1);
    if (rnd()<0.5) continue;
    glowCircle(Math.round(p.x+rrange(-6,6)), Math.round(p.y+rrange(4,10)), Math.round(lerp(10,4,t)), 255,180,60, 0.12);
  }
  // wings
  function wing(side){
    const base = pts[22];
    const tipx = base.x + (side*220);
    const tipy = base.y - 180;
    const midx = base.x + (side*120);
    const midy = base.y - 40;
    for (let i=0;i<9000;i++){
      const u=rnd(), v=rnd()*(1-u);
      const w=1-u-v;
      const x = base.x*u + midx*v + tipx*w + rrange(-8,8);
      const y = base.y*u + midy*v + tipy*w + rrange(-8,8);
      const membrane = 0.25 + 0.35*rnd();
      blendPx(Math.round(x),Math.round(y), 80,20,30, membrane);
      if (rnd()<0.08) blendPx(Math.round(x),Math.round(y), 255,120,40, 0.25);
    }
    // wing bones
    for (let b=0;b<4;b++){
      const tx = lerp(base.x, tipx, 0.4 + b*0.18) + side*b*10;
      const ty = lerp(base.y, tipy, 0.3 + b*0.22);
      const steps=80;
      for (let s=0;s<=steps;s++){
        const k=s/steps;
        const x=lerp(base.x,tx,k), y=lerp(base.y,ty,k);
        for (let r=-2;r<=2;r++) blendPx(Math.round(x),Math.round(y+r), 255,150,60, 0.5);
      }
    }
  }
  wing(-1); wing(1);

  // head
  const head = pts[pts.length-1];
  for (let y=-34;y<=34;y++) for (let x=-34;x<=46;x++){
    const d = Math.hypot(x*0.85,y);
    if (d<30){
      const c = 1-d/30;
      blendPx(Math.round(head.x+x), Math.round(head.y+y), clamp(150+c*105), clamp(40+c*140), clamp(20+c*50), 0.98);
    }
  }
  // snout/jaw
  for (let i=0;i<1200;i++){
    const x = head.x + rrange(10,60);
    const y = head.y + rrange(-8,14) + (x-head.x)*0.08;
    if (Math.abs(y - (head.y + (x-head.x)*0.06)) < 10) blendPx(Math.round(x),Math.round(y), 220,90,30, 0.5);
  }
  // horns
  for (const dir of [-1,1]){
    let hx=head.x-5, hy=head.y-18;
    for (let s=0;s<40;s++){
      hx += -2 + dir*0.8; hy += -2.2;
      for (let r=-3;r<=3;r++) blendPx(Math.round(hx+r*0.3), Math.round(hy), 255,210,120, 0.8 - s/60);
    }
  }
  // eye
  glowCircle(Math.round(head.x+12), Math.round(head.y-6), 10, 255,240,120, 0.9);
  glowCircle(Math.round(head.x+12), Math.round(head.y-6), 4, 255,80,0, 0.9);

  // fire breath
  const mx = head.x + 52, my = head.y + 2;
  for (let i=0;i<8000;i++){
    const t = Math.pow(rnd(), 0.7);
    const len = t * 420;
    const spread = (10 + t*110) * (rnd()-0.5);
    const x = Math.round(mx + len + rrange(-10,20));
    const y = Math.round(my + spread + Math.sin(len*0.03)*8);
    const heat = 1-t;
    const rr=255, gg=clamp(60 + heat*180 + rrange(-20,20)), bb=clamp(heat*80);
    blendPx(x,y,rr,gg,bb, clampFloat(0.02 + heat*0.18));
  }
  for (let i=0;i<1200;i++){
    const t=rnd();
    glowCircle(Math.round(mx + t*220 + rrange(-15,15)), Math.round(my + (rnd()-0.5)*t*90), Math.round(8 + (1-t)*18), 255,140,20, 0.05);
  }
}

function drawForeground() {
  // reflective wet street
  for (let y = 760; y < H; y++) {
    const t = (y-760)/(H-760);
    for (let x=0;x<W;x++){
      const base = 10 + t*18;
      let r=base, g=base*0.6, b=base*1.2;
      const nx = Math.sin(x*0.08 + y*0.02);
      if (nx > 0.97) { r+=60; g+=20; b+=80; }
      blendPx(x,y,clamp(r),clamp(g),clamp(b), 0.55);
    }
  }
  // neon reflections streaks
  for (let i=0;i<180;i++){
    const x0 = Math.floor(rrange(0,W));
    const col = [[0,255,255],[255,0,180],[255,120,0]][Math.floor(rnd()*3)];
    const w = Math.floor(rrange(2,18));
    for (let y=780;y<H;y+=2){
      const dx = Math.sin(y*0.15 + x0)*6;
      const a = 0.08 * (1-(y-780)/(H-780));
      for (let xx=-w;xx<=w;xx++) blendPx(Math.round(x0+dx+xx), y, col[0],col[1],col[2], a);
    }
  }
}

function encodePNG(rgba, width, height) {
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type);
    const crcBuf = Buffer.concat([t, data]);
    let crc = 0xffffffff;
    for (let i=0;i<crcBuf.length;i++){
      crc ^= crcBuf[i];
      for (let k=0;k<8;k++) crc = (crc>>>1) ^ (0xedb88320 & -(crc&1));
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const c = Buffer.alloc(4); c.writeUInt32BE(crc,0);
    return Buffer.concat([len,t,data,c]);
  }
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width,0); ihdr.writeUInt32BE(height,4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
  const stride = width*4;
  const raw = Buffer.alloc((stride+1)*height);
  for (let y=0;y<height;y++){
    raw[y*(stride+1)] = 0;
    rgba.copy(raw, y*(stride+1)+1, y*stride, y*stride+stride);
  }
  const idat = zlib.deflateSync(raw, {level:9});
  return Buffer.concat([sig, chunk('IHDR',ihdr), chunk('IDAT',idat), chunk('IEND',Buffer.alloc(0))]);
}

fillBackground();
drawMoon();
drawBuildings();
drawDragon();
drawForeground();

const outDir = path.join(__dirname, 'output');
fs.mkdirSync(outDir, {recursive:true});
fs.writeFileSync(path.join(outDir,'entry.png'), encodePNG(buf,W,H));
