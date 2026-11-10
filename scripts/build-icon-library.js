#!/usr/bin/env node
'use strict';
// Build the FULL pre-resized icon library: one <FileDataID>.png for every icon in the community pack
// that the community listfile maps to an ID (interface/icons/<name>.blp). Re-runnable and
// incremental: valid existing files are skipped. Pack is read-only. Runs in parallel (worker_threads).
//
//   node scripts/build-icon-library.js [--size 72|144] [--listfile <csv>] [--pack <dir>] [--library <dir>] [--workers N] [--force]
//   --size 144 (full-bleed keys): palette PNGs <= 20 KB into icon-library-144; --size 72 (default) = the fallback set.
//
// Each output is <= 12 KB (the plugin's embed limit; aim ~9.5 KB) so a whole tile message stays small.
// If a 72px PNG is too big the encoder steps down: fewer colour bits, then smaller sizes.
// Blizzard artwork: the library is local-only and git-ignored. Never commit or publish it.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const { shrink, shrinkPalette } = require('./png');

const ROOT = path.join(__dirname, '..');
const DEFAULTS = {   // no machine paths: the pack and listfile must be given with --pack / --listfile
  pack: null,
  listfile: null,
  library: path.join(ROOT, 'icon-library'),
  library144: path.join(ROOT, 'icon-library-144'),
};
const MAX_EMBED_BYTES = 12 * 1024; // hard limit for the 72 px set
const TARGET_BYTES = 9500;         // preferred size (72 px)
const MAX_EMBED_BYTES_144 = 20 * 1024; // hard limit for the 144 px set = lib/icons.js MAX_EMBED_BYTES
const TARGET_BYTES_144 = 14 * 1024;
const PALETTE_LADDER = [256, 192, 128, 96, 64, 32]; // colours; a 144 px palette PNG is ~10 KB at 256
const limitFor = size => (size >= 144 ? MAX_EMBED_BYTES_144 : MAX_EMBED_BYTES);
const MAX_PACK_BYTES = 512 * 1024;
const LADDER = [[72, 0], [72, 2], [72, 3], [64, 0], [64, 3], [56, 3], [48, 3], [40, 4]]; // [px, dropped bits]

// Smallest-effort encoding that meets TARGET_BYTES; else the smallest rung under the hard limit.
function encodeSmall(srcBuf, size = 72) {
  if (size >= 144) {   // palette PNG ladder; null (no file) if even 32 colours exceed the cap -> runtime uses the 72 px set
    let b = null;
    for (const n of PALETTE_LADDER) { const out = shrinkPalette(srcBuf, 144, n); if (!b || out.length < b.length) b = out; if (out.length <= TARGET_BYTES_144) return out; }
    return b.length <= MAX_EMBED_BYTES_144 ? b : null;
  }
  let best = null;
  for (const [size, shift] of LADDER) {
    const out = shrink(srcBuf, size, shift);
    if (!best || out.length < best.length) best = out;
    if (out.length <= TARGET_BYTES) return out;
  }
  return best.length <= MAX_EMBED_BYTES ? best : null;
}

function okExisting(file, max = MAX_EMBED_BYTES) { try { const st = fs.statSync(file); return st.isFile() && st.size > 0 && st.size <= max; } catch { return false; } }

// listfile -> Map<lowercase stem, number[] ids> for exactly interface/icons/<name>.blp
function readListfile(file) {
  const byStem = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf(';'); if (i < 1) continue;
    const id = +line.slice(0, i); if (!Number.isInteger(id) || id <= 0 || id > 2147483647) continue;
    const m = /^interface\/icons\/([^/]+)\.blp$/i.exec(line.slice(i + 1).trim().replace(/\\/g, '/'));
    if (!m) continue;
    const stem = m[1].toLowerCase();
    (byStem.get(stem) || byStem.set(stem, []).get(stem)).push(id);
  }
  return byStem;
}

function readPack(dir) {
  const files = new Map();
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isFile() && /\.png$/i.test(e.name)) files.set(e.name.slice(0, -4).toLowerCase(), path.join(dir, e.name));
  }
  return files;
}

// Process tasks [{src, ids}] -> summary. Used by workers and by tests (in-process).
function processTasks(tasks, library, force, size = 72) {
  const r = { written: 0, filesSkipped: 0, packIconsWritten: 0, packIconsSkipped: 0, rejected: [], bytes: 0, ladderUsed: 0 };
  for (const t of tasks) {
    const need = t.ids.filter(id => force || !okExisting(path.join(library, id + '.png'), limitFor(size)));
    if (!need.length) { r.packIconsSkipped++; r.filesSkipped += t.ids.length; continue; }
    try {
      const st = fs.statSync(t.src);
      if (st.size > MAX_PACK_BYTES) throw new Error('pack file over ' + MAX_PACK_BYTES + ' bytes');
      const out = encodeSmall(fs.readFileSync(t.src), size);
      if (!out) throw new Error('cannot get under ' + limitFor(size) + ' bytes');
      for (const id of need) fs.writeFileSync(path.join(library, id + '.png'), out);
      r.written += need.length; r.filesSkipped += t.ids.length - need.length; r.packIconsWritten++; r.bytes += out.length * need.length;
      if (out.length > (size >= 144 ? TARGET_BYTES_144 : TARGET_BYTES)) r.ladderUsed++;
    } catch (e) { r.rejected.push({ src: path.basename(t.src), ids: need, reason: String(e.message).slice(0, 120) }); }
  }
  return r;
}

function merge(a, b) {
  for (const k of ['written', 'filesSkipped', 'packIconsWritten', 'packIconsSkipped', 'bytes', 'ladderUsed']) a[k] += b[k];
  a.rejected.push(...b.rejected); return a;
}

async function build(opts) {
  const library = opts.library;
  const byStem = readListfile(opts.listfile), pack = readPack(opts.pack);
  const tasks = [], packNoId = [], idsNoPack = [];
  for (const [stem, src] of pack) { const ids = byStem.get(stem); if (ids) tasks.push({ src, ids }); else packNoId.push(stem); }
  let idsTotal = 0; for (const [stem, ids] of byStem) { idsTotal += ids.length; if (!pack.has(stem)) idsNoPack.push(...ids); }
  fs.mkdirSync(library, { recursive: true });
  const n = Math.max(1, Math.min(opts.workers || Math.max(1, os.cpus().length - 1), tasks.length || 1));
  const total = { written: 0, filesSkipped: 0, packIconsWritten: 0, packIconsSkipped: 0, rejected: [], bytes: 0, ladderUsed: 0 };
  if (n === 1 || tasks.length < 50) merge(total, processTasks(tasks, library, opts.force, opts.size));
  else {
    const chunks = Array.from({ length: n }, () => []); tasks.forEach((t, i) => chunks[i % n].push(t));
    let done = 0;
    await Promise.all(chunks.map(chunk => new Promise((resolve, reject) => {
      const w = new Worker(__filename, { workerData: { tasks: chunk, library, force: !!opts.force, size: opts.size || 72 } });
      w.on('message', m => { if (m.progress) { done += m.progress; if (opts.log && done % 2000 < 100) opts.log(`  ${done}/${tasks.length} pack icons`); } else { merge(total, m.result); } });
      w.on('error', reject); w.on('exit', c => c ? reject(new Error('worker exit ' + c)) : resolve());
    })));
  }
  return { ...total, packIcons: pack.size, packIconsWithId: tasks.length, packNoId, idsTotal, idsNoPack: idsNoPack.length, libraryFiles: fs.readdirSync(library).filter(f => /^\d+\.png$/.test(f)).length };
}

function dirSize(dir) { let s = 0; for (const f of fs.readdirSync(dir)) { try { s += fs.statSync(path.join(dir, f)).size; } catch { /* ignore */ } } return s; }

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const need = () => { if (argv[i + 1] === undefined) throw new Error('Missing value for ' + argv[i]); return argv[++i]; };
    switch (argv[i]) {
      case '--pack': o.pack = need(); break;
      case '--listfile': o.listfile = need(); break;
      case '--library': o.library = need(); break;
      case '--workers': o.workers = Number(need()); if (!Number.isInteger(o.workers) || o.workers < 1 || o.workers > 64) throw new Error('--workers 1-64'); break;
      case '--force': o.force = true; break;
      case '--size': o.size = Number(need()); if (o.size !== 72 && o.size !== 144) throw new Error('--size 72 or 144'); break;
      default: throw new Error('Unknown argument ' + argv[i]);
    }
  }
  return o;
}

async function main(argv) {
  const o = parseArgs(argv), size = o.size || 72, opts = { size, pack: o.pack || DEFAULTS.pack, listfile: o.listfile || DEFAULTS.listfile, library: o.library || (size >= 144 ? DEFAULTS.library144 : DEFAULTS.library), workers: o.workers, force: o.force, log: console.log };
  if (!opts.pack || !opts.listfile) throw new Error('--pack <folder with the .png files> and --listfile <community-listfile.csv> are required');
  console.log('pack    :', opts.pack, '(read-only)\nlistfile:', opts.listfile, '\nlibrary :', opts.library);
  const t0 = Date.now(), r = await build(opts);
  console.log(`pack icons ${r.packIcons}: with an ID ${r.packIconsWithId}, WITHOUT an ID ${r.packNoId.length}`);
  console.log(`listfile icon IDs ${r.idsTotal}: no pack file for ${r.idsNoPack}`);
  console.log(`this run: wrote ${r.written} files (${r.packIconsWritten} icons), skipped ${r.filesSkipped} existing, rejected ${r.rejected.length}`);
  for (const x of r.rejected.slice(0, 20)) console.log('  rejected', x.src, x.ids.join(','), '-', x.reason);
  const disk = dirSize(opts.library);
  console.log(`library now: ${r.libraryFiles} files, ${(disk / 1048576).toFixed(1)} MiB on disk, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  if (r.packNoId.length) console.log('pack icons with no ID (first 10):', r.packNoId.slice(0, 10).join(' '));
  return r.rejected.length ? 2 : 0;
}

if (isMainThread) {
  if (require.main === module) main(process.argv.slice(2)).then(c => { process.exitCode = c; }, e => { console.error('error:', e.message); process.exitCode = 1; });
} else {
  const { tasks, library, force, size } = workerData; let sent = 0; const total = { written: 0, filesSkipped: 0, packIconsWritten: 0, packIconsSkipped: 0, rejected: [], bytes: 0, ladderUsed: 0 };
  for (let i = 0; i < tasks.length; i += 100) { merge(total, processTasks(tasks.slice(i, i + 100), library, force, size)); sent = Math.min(100, tasks.length - i); parentPort.postMessage({ progress: sent }); }
  parentPort.postMessage({ result: total });
}
module.exports = { build, encodeSmall, readListfile, readPack, processTasks, parseArgs, MAX_EMBED_BYTES, TARGET_BYTES, MAX_EMBED_BYTES_144, TARGET_BYTES_144 };
