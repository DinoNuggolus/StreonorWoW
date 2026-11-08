'use strict';
// Minimal zero-dependency PNG decode / box-downscale / encode (build-time only).
// Supports 8-bit, non-interlaced greyscale, grey+alpha, palette, RGB and RGBA inputs.
const zlib = require('node:zlib');
const MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// Returns {width, height, data: Uint8Array RGBA}. Throws on unsupported or malformed input.
function decode(buf, maxPixels = 4096 * 4096) {
  if (buf.length < 33 || !buf.subarray(0, 8).equals(MAGIC)) throw new Error('not a PNG');
  let pos = 8, ihdr = null, palette = null, trns = null; const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('latin1', pos + 4, pos + 8);
    if (pos + 12 + len > buf.length) throw new Error('truncated PNG');
    const d = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') ihdr = { w: d.readUInt32BE(0), h: d.readUInt32BE(4), depth: d[8], ct: d[9], inter: d[12] };
    else if (type === 'PLTE') palette = d;
    else if (type === 'tRNS') trns = d;
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (!ihdr) throw new Error('missing IHDR');
  const { w, h, depth, ct, inter } = ihdr;
  if (depth !== 8 || inter !== 0) throw new Error('unsupported PNG (need 8-bit, non-interlaced)');
  if (!w || !h || w * h > maxPixels) throw new Error('bad PNG size');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct];
  if (!channels) throw new Error('unsupported colour type');
  const stride = w * channels, raw = zlib.inflateSync(Buffer.concat(idat));
  if (raw.length < (stride + 1) * h) throw new Error('short PNG data');
  const px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[dst + x - channels] : 0, b = y ? px[dst - stride + x] : 0, c = x >= channels && y ? px[dst - stride + x - channels] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      else if (f !== 0) throw new Error('bad filter');
      px[dst + x] = v & 255;
    }
  }
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let r, g, b, a = 255;
    if (ct === 6) { r = px[i * 4]; g = px[i * 4 + 1]; b = px[i * 4 + 2]; a = px[i * 4 + 3]; }
    else if (ct === 2) { r = px[i * 3]; g = px[i * 3 + 1]; b = px[i * 3 + 2]; }
    else if (ct === 0) { r = g = b = px[i]; }
    else if (ct === 4) { r = g = b = px[i * 2]; a = px[i * 2 + 1]; }
    else { const k = px[i]; if (!palette || k * 3 + 2 >= palette.length) throw new Error('bad palette'); r = palette[k * 3]; g = palette[k * 3 + 1]; b = palette[k * 3 + 2]; if (trns && k < trns.length) a = trns[k]; }
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = a;
  }
  return { width: w, height: h, data: out };
}

// Area-average (box) downscale to exactly size x size, alpha-weighted.
function resize(img, size) {
  const { width: w, height: h, data } = img, out = new Uint8Array(size * size * 4);
  for (let oy = 0; oy < size; oy++) {
    const y0 = oy * h / size, y1 = (oy + 1) * h / size;
    for (let ox = 0; ox < size; ox++) {
      const x0 = ox * w / size, x1 = (ox + 1) * w / size;
      let r = 0, g = 0, b = 0, a = 0, wt = 0;
      for (let y = Math.floor(y0); y < Math.min(h, Math.ceil(y1)); y++) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0);
        for (let x = Math.floor(x0); x < Math.min(w, Math.ceil(x1)); x++) {
          const wgt = wy * (Math.min(x + 1, x1) - Math.max(x, x0)), i = (y * w + x) * 4, al = data[i + 3] * wgt;
          r += data[i] * al; g += data[i + 1] * al; b += data[i + 2] * al; a += al; wt += wgt;
        }
      }
      const o = (oy * size + ox) * 4;
      if (a > 0) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); }
      out[o + 3] = wt ? Math.round(a / wt) : 0;
    }
  }
  return { width: size, height: size, data: out };
}

// Encode as RGB when fully opaque (smaller) else RGBA. Per-row filter chosen by min abs-sum.
// `shift` drops low bits per channel (0 = lossless) to help deflate on small tiles.
function encode(img, shift = 0) {
  const { width: w, height: h, data } = img;
  let opaque = true; for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) { opaque = false; break; }
  const ch = opaque ? 3 : 4, stride = w * ch, mask = (0xff << shift) & 0xff;
  const px = Buffer.alloc(stride * h);
  for (let i = 0; i < w * h; i++) for (let c = 0; c < ch; c++) { let v = data[i * 4 + c]; if (shift && c < 3) v = Math.min(255, (v & mask) | (v >> (8 - shift))); px[i * ch + c] = v; }
  const rows = [];
  for (let y = 0; y < h; y++) {
    let best = null, bestScore = Infinity;
    for (let f = 0; f <= 4; f++) {
      const row = Buffer.alloc(stride + 1); row[0] = f; let score = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= ch ? px[y * stride + x - ch] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= ch && y ? px[(y - 1) * stride + x - ch] : 0, v = px[y * stride + x];
        let p = 0; if (f === 1) p = a; else if (f === 2) p = b; else if (f === 3) p = (a + b) >> 1;
        else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        const d = (v - p) & 255; row[x + 1] = d; score += d < 128 ? d : 256 - d;
      }
      if (score < bestScore) { bestScore = score; best = row; }
    }
    rows.push(best);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = opaque ? 2 : 6;
  return Buffer.concat([MAGIC, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const shrink = (buf, size, shift = 0) => encode(resize(decode(buf), size), shift);
module.exports = { decode, resize, encode, shrink, crc32 };
