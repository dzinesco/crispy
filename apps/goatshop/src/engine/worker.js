/** Pixel filters for Goatshop. Runs off the main thread. */

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function clampByte(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

function buildSat(src, w, h, channel) {
  const stride = w + 1;
  const sat = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += src[(y * w + x) * 4 + channel];
      sat[(y + 1) * stride + (x + 1)] = row + sat[y * stride + (x + 1)];
    }
  }
  return sat;
}

function satArea(sat, stride, x0, y0, x1, y1) {
  return sat[y1 * stride + x1] - sat[y0 * stride + x1] - sat[y1 * stride + x0] + sat[y0 * stride + x0];
}

function boxBlur(src, w, h, radius) {
  const r = Math.max(1, Math.round(radius));
  const stride = w + 1;
  const out = new Uint8ClampedArray(src.length);
  const sats = [0, 1, 2, 3].map((channel) => buildSat(src, w, h, channel));
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const count = (x1 - x0) * (y1 - y0);
      const o = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) out[o + c] = satArea(sats[c], stride, x0, y0, x1, y1) / count;
    }
  }
  return out;
}

function gaussian(src, w, h, radius) {
  const sigma = Math.max(0.4, Number(radius) || 1);
  const box = Math.max(1, Math.round(sigma * 0.75));
  let cur = src;
  for (let i = 0; i < 3; i++) cur = boxBlur(cur, w, h, box);
  return cur;
}

function sample(src, w, h, x, y, channel) {
  const xx = clamp(x, 0, w - 1);
  const yy = clamp(y, 0, h - 1);
  const x0 = Math.floor(xx);
  const y0 = Math.floor(yy);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = xx - x0;
  const fy = yy - y0;
  const i00 = (y0 * w + x0) * 4 + channel;
  const i10 = (y0 * w + x1) * 4 + channel;
  const i01 = (y1 * w + x0) * 4 + channel;
  const i11 = (y1 * w + x1) * 4 + channel;
  const a = src[i00] + (src[i10] - src[i00]) * fx;
  const b = src[i01] + (src[i11] - src[i01]) * fx;
  return a + (b - a) * fy;
}

function copySrc(src) {
  return new Uint8ClampedArray(src);
}

function eachPixel(src, w, h, fn) {
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const px = fn(src[i], src[i + 1], src[i + 2], src[i + 3], x, y, i);
      out[i] = clampByte(px[0]);
      out[i + 1] = clampByte(px[1]);
      out[i + 2] = clampByte(px[2]);
      out[i + 3] = clampByte(px[3]);
    }
  }
  return out;
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  return [h, s, l];
}

function hue2rgb(p, q, t) {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
}

function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function convolve(src, w, h, kernel, bias = 0, scale = 1) {
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let ki = 0;
      for (let ky = -1; ky <= 1; ky++) {
        const yy = clamp(y + ky, 0, h - 1);
        for (let kx = -1; kx <= 1; kx++) {
          const xx = clamp(x + kx, 0, w - 1);
          const i = (yy * w + xx) * 4;
          const kv = kernel[ki++];
          r += src[i] * kv;
          g += src[i + 1] * kv;
          b += src[i + 2] * kv;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = clampByte(r * scale + bias);
      out[o + 1] = clampByte(g * scale + bias);
      out[o + 2] = clampByte(b * scale + bias);
      out[o + 3] = src[o + 3];
    }
  }
  return out;
}

function screenChannel(dst, src) {
  return 255 - ((255 - dst) * (255 - src)) / 255;
}

function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0);
  const b = hash2(x0 + 1, y0);
  const c = hash2(x0, y0 + 1);
  const d = hash2(x0 + 1, y0 + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x, y) {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < 5; i++) {
    v += a * valueNoise(x * f, y * f);
    f *= 2;
    a *= 0.5;
  }
  return v;
}

function applyFilter(name, src, w, h, params) {
  const p = params || {};
  if (name === 'invert') {
    return eachPixel(src, w, h, (r, g, b, a) => [255 - r, 255 - g, 255 - b, a]);
  }
  if (name === 'desaturate') {
    return eachPixel(src, w, h, (r, g, b, a) => {
      const y = luminance(r, g, b);
      return [y, y, y, a];
    });
  }
  if (name === 'threshold') {
    const t = p.threshold ?? 128;
    return eachPixel(src, w, h, (r, g, b, a) => {
      const y = luminance(r, g, b) >= t ? 255 : 0;
      return [y, y, y, a];
    });
  }
  if (name === 'posterize') {
    const levels = Math.max(2, p.levels | 0 || 4);
    return eachPixel(src, w, h, (r, g, b, a) => {
      const q = (v) => Math.round((Math.round((v / 255) * (levels - 1)) * 255) / (levels - 1));
      return [q(r), q(g), q(b), a];
    });
  }
  if (name === 'brightness') {
    const add = (p.brightness || 0) * 2.55;
    const cf = (100 + (p.contrast || 0)) / 100;
    return eachPixel(src, w, h, (r, g, b, a) => [
      (r - 128) * cf + 128 + add,
      (g - 128) * cf + 128 + add,
      (b - 128) * cf + 128 + add,
      a,
    ]);
  }
  if (name === 'hue') {
    const dh = (p.hue || 0) / 360;
    const ds = (p.saturation || 0) / 100;
    const dl = (p.lightness || 0) / 100;
    return eachPixel(src, w, h, (r, g, b, a) => {
      const [h0, s0, l0] = rgbToHsl(r, g, b);
      const [nr, ng, nb] = hslToRgb((h0 + dh + 1) % 1, clamp(s0 + ds, 0, 1), clamp(l0 + dl, 0, 1));
      return [nr, ng, nb, a];
    });
  }
  if (name === 'balance') {
    const tones = [p.shadows || [0, 0, 0], p.midtones || [0, 0, 0], p.highlights || [0, 0, 0]];
    return eachPixel(src, w, h, (r, g, b, a) => {
      const lum = luminance(r, g, b) / 255;
      const weights = [Math.max(0, 1 - lum * 2), 1 - Math.abs(lum - 0.5) * 2, Math.max(0, lum * 2 - 1)];
      let cr = 0;
      let mg = 0;
      let yb = 0;
      for (let i = 0; i < 3; i++) {
        cr += weights[i] * tones[i][0];
        mg += weights[i] * tones[i][1];
        yb += weights[i] * tones[i][2];
      }
      let nr = r + cr * 1.4;
      let ng = g + mg * 1.4;
      let nb = b + yb * 1.4;
      if (p.preserve) {
        const l0 = luminance(r, g, b);
        const l1 = luminance(nr, ng, nb) || 1;
        const s = l0 / l1;
        nr *= s;
        ng *= s;
        nb *= s;
      }
      return [nr, ng, nb, a];
    });
  }
  if (name === 'levels') {
    const inB = p.inBlack ?? 0;
    const inW = p.inWhite ?? 255;
    const gamma = p.gamma || 1;
    const outB = p.outBlack ?? 0;
    const outW = p.outWhite ?? 255;
    const map = (v) => {
      if (inW === inB) return outB;
      let t = clamp((v - inB) / (inW - inB), 0, 1);
      t = Math.pow(t, 1 / gamma);
      return outB + t * (outW - outB);
    };
    return eachPixel(src, w, h, (r, g, b, a) => [map(r), map(g), map(b), a]);
  }
  if (name === 'curves') {
    const lut = p.lut || [];
    const map = (v) => (lut.length === 256 ? lut[v | 0] : v);
    return eachPixel(src, w, h, (r, g, b, a) => [map(r), map(g), map(b), a]);
  }
  if (name === 'gaussian') return gaussian(src, w, h, p.radius ?? 2);
  if (name === 'motion') {
    const dist = Math.max(1, Math.round(p.distance ?? 12));
    const ang = ((p.angle || 0) * Math.PI) / 180;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const out = new Uint8ClampedArray(src.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        for (let s = 0; s < dist; s++) {
          const t = s - dist / 2;
          r += sample(src, w, h, x + dx * t, y + dy * t, 0);
          g += sample(src, w, h, x + dx * t, y + dy * t, 1);
          b += sample(src, w, h, x + dx * t, y + dy * t, 2);
          a += sample(src, w, h, x + dx * t, y + dy * t, 3);
        }
        const o = (y * w + x) * 4;
        out[o] = r / dist;
        out[o + 1] = g / dist;
        out[o + 2] = b / dist;
        out[o + 3] = a / dist;
      }
    }
    return out;
  }
  if (name === 'unsharp') {
    const blurred = gaussian(src, w, h, p.radius ?? 1.5);
    const amount = (p.amount ?? 100) / 100;
    const threshold = p.threshold ?? 0;
    const out = new Uint8ClampedArray(src.length);
    for (let i = 0; i < src.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const diff = src[i + c] - blurred[i + c];
        out[i + c] = Math.abs(diff) >= threshold ? clampByte(src[i + c] + diff * amount) : src[i + c];
      }
      out[i + 3] = src[i + 3];
    }
    return out;
  }
  if (name === 'noise') {
    const amount = (p.amount ?? 20) * 2.55;
    const mono = !!p.monochrome;
    const out = copySrc(src);
    let seed = p.seed || 1;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < out.length; i += 4) {
      if (mono) {
        const n = (rand() - 0.5) * amount;
        out[i] = clampByte(out[i] + n);
        out[i + 1] = clampByte(out[i + 1] + n);
        out[i + 2] = clampByte(out[i + 2] + n);
      } else {
        out[i] = clampByte(out[i] + (rand() - 0.5) * amount);
        out[i + 1] = clampByte(out[i + 1] + (rand() - 0.5) * amount);
        out[i + 2] = clampByte(out[i + 2] + (rand() - 0.5) * amount);
      }
    }
    return out;
  }
  if (name === 'emboss') {
    return convolve(src, w, h, [-2, -1, 0, -1, 1, 1, 0, 1, 2], 128, 1);
  }
  if (name === 'edges') {
    const gray = new Uint8ClampedArray(src.length);
    for (let i = 0; i < src.length; i += 4) {
      const y = luminance(src[i], src[i + 1], src[i + 2]);
      gray[i] = gray[i + 1] = gray[i + 2] = y;
      gray[i + 3] = src[i + 3];
    }
    const mag = new Uint8ClampedArray(src.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const at = (xx, yy) => gray[(clamp(yy, 0, h - 1) * w + clamp(xx, 0, w - 1)) * 4];
        const gx = -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1) + at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
        const gy = -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
        const v = 255 - clamp(Math.hypot(gx, gy), 0, 255);
        const o = (y * w + x) * 4;
        mag[o] = mag[o + 1] = mag[o + 2] = v;
        mag[o + 3] = src[o + 3];
      }
    }
    return mag;
  }
  if (name === 'mosaic') {
    const cell = Math.max(2, Math.round(p.size ?? 8));
    const out = copySrc(src);
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        let n = 0;
        const y1 = Math.min(h, y + cell);
        const x1 = Math.min(w, x + cell);
        for (let yy = y; yy < y1; yy++) {
          for (let xx = x; xx < x1; xx++) {
            const i = (yy * w + xx) * 4;
            r += src[i];
            g += src[i + 1];
            b += src[i + 2];
            a += src[i + 3];
            n++;
          }
        }
        r /= n;
        g /= n;
        b /= n;
        a /= n;
        for (let yy = y; yy < y1; yy++) {
          for (let xx = x; xx < x1; xx++) {
            const i = (yy * w + xx) * 4;
            out[i] = r;
            out[i + 1] = g;
            out[i + 2] = b;
            out[i + 3] = a;
          }
        }
      }
    }
    return out;
  }
  if (name === 'twirl') {
    const ang = ((p.angle ?? 90) * Math.PI) / 180;
    const radius = p.radius || Math.min(w, h) * 0.45;
    const cx = p.cx ?? w / 2;
    const cy = p.cy ?? h / 2;
    const out = new Uint8ClampedArray(src.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.hypot(dx, dy);
        let sx = x;
        let sy = y;
        if (dist < radius && dist > 0) {
          const a = Math.atan2(dy, dx) + ang * (1 - dist / radius);
          sx = cx + Math.cos(a) * dist;
          sy = cy + Math.sin(a) * dist;
        }
        const o = (y * w + x) * 4;
        for (let c = 0; c < 4; c++) out[o + c] = sample(src, w, h, sx, sy, c);
      }
    }
    return out;
  }
  if (name === 'spherize') {
    const k = (p.amount ?? 50) / 100;
    const radius = Math.min(w, h) * 0.5 * (p.radiusScale || 1);
    const cx = p.cx ?? w / 2;
    const cy = p.cy ?? h / 2;
    const out = new Uint8ClampedArray(src.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.hypot(dx, dy) / radius;
        let sx = x;
        let sy = y;
        if (r > 0 && r < 1) {
          const sphere = Math.asin(Math.min(1, r)) / (Math.PI / 2);
          const factor = (1 - k) + k * (sphere / r);
          sx = cx + dx * factor;
          sy = cy + dy * factor;
        }
        const o = (y * w + x) * 4;
        for (let c = 0; c < 4; c++) out[o + c] = sample(src, w, h, sx, sy, c);
      }
    }
    return out;
  }
  if (name === 'clouds') {
    const scale = Math.max(8, p.scale || 70);
    const fg = p.fg || [255, 255, 255];
    const bg = p.bg || [0, 0, 0];
    const out = new Uint8ClampedArray(src.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = clamp(fbm(x / scale, y / scale), 0, 1);
        const o = (y * w + x) * 4;
        out[o] = bg[0] + (fg[0] - bg[0]) * n;
        out[o + 1] = bg[1] + (fg[1] - bg[1]) * n;
        out[o + 2] = bg[2] + (fg[2] - bg[2]) * n;
        out[o + 3] = 255;
      }
    }
    return out;
  }
  if (name === 'lensflare') return lensFlare(src, w, h, p);
  return copySrc(src);
}

function lensFlare(src, w, h, p) {
  const out = copySrc(src);
  const cx = p.cx ?? w * 0.62;
  const cy = p.cy ?? h * 0.38;
  const bright = (p.brightness ?? 110) / 100;
  const ix = w / 2;
  const iy = h / 2;
  const vx = ix - cx;
  const vy = iy - cy;
  const minSide = Math.min(w, h);
  const ghosts = [
    { t: -0.25, r: 0.045, color: [255, 244, 210], a: 0.35, kind: 'glow' },
    { t: 0.22, r: 0.05, color: [190, 255, 170], a: 0.32, kind: 'glow' },
    { t: 0.45, r: 0.11, color: [90, 140, 255], a: 0.28, kind: 'ring' },
    { t: 0.62, r: 0.07, color: [255, 170, 70], a: 0.34, kind: 'hex' },
    { t: 0.84, r: 0.09, color: [255, 70, 60], a: 0.26, kind: 'glow' },
    { t: 1.12, r: 0.13, color: [170, 80, 255], a: 0.2, kind: 'ring' },
    { t: 1.38, r: 0.05, color: [255, 255, 220], a: 0.3, kind: 'glow' },
  ];
  const coreR = minSide * 0.2;
  const streakLen = minSide * 0.55;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rr = 0;
      let gg = 0;
      let bb = 0;
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      const core = Math.exp(-(d * d) / (2 * (coreR * 0.28) * (coreR * 0.28)));
      rr += 255 * core * 1.35 * bright;
      gg += 236 * core * 1.2 * bright;
      bb += 180 * core * bright;
      const ringD = Math.abs(d - coreR * 0.72);
      const ring = Math.exp(-(ringD * ringD) / (2 * 7 * 7));
      rr += 255 * ring * 0.45 * bright;
      gg += 220 * ring * 0.35 * bright;
      bb += 140 * ring * 0.2 * bright;
      const streak = Math.exp(-(dy * dy) / (2 * 2.2 * 2.2)) * Math.exp(-Math.abs(dx) / streakLen);
      const streak2 = Math.exp(-((dy + dx * 0.15) ** 2) / 18) * Math.exp(-Math.abs(dx) / (streakLen * 0.7));
      rr += 255 * (streak * 0.55 + streak2 * 0.25) * bright;
      gg += 255 * (streak * 0.5 + streak2 * 0.2) * bright;
      bb += 230 * (streak * 0.45 + streak2 * 0.18) * bright;
      for (const ghost of ghosts) {
        const gx = cx + vx * ghost.t * 2;
        const gy = cy + vy * ghost.t * 2;
        const gdx = x - gx;
        const gdy = y - gy;
        const gd = Math.hypot(gdx, gdy);
        const gr = minSide * ghost.r;
        let amt = 0;
        if (ghost.kind === 'glow') amt = Math.exp(-(gd * gd) / (2 * gr * gr * 0.35));
        else if (ghost.kind === 'ring') {
          const band = Math.abs(gd - gr);
          amt = Math.exp(-(band * band) / (2 * (gr * 0.12) * (gr * 0.12)));
        } else {
          const ang = Math.atan2(gdy, gdx);
          const hex = 0.62 + 0.38 * Math.cos(ang * 6);
          const band = Math.abs(gd - gr * hex);
          amt = Math.exp(-(band * band) / (2 * (gr * 0.16) * (gr * 0.16))) * hex;
        }
        amt *= ghost.a * bright;
        rr += ghost.color[0] * amt;
        gg += ghost.color[1] * amt;
        bb += ghost.color[2] * amt;
      }
      const o = (y * w + x) * 4;
      out[o] = screenChannel(out[o], clampByte(rr));
      out[o + 1] = screenChannel(out[o + 1], clampByte(gg));
      out[o + 2] = screenChannel(out[o + 2], clampByte(bb));
    }
  }
  return out;
}

self.onmessage = (event) => {
  const { id, name, width, height, params, buffer } = event.data;
  try {
    const src = new Uint8ClampedArray(buffer);
    const out = applyFilter(name, src, width, height, params);
    self.postMessage({ id, buffer: out.buffer }, [out.buffer]);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
