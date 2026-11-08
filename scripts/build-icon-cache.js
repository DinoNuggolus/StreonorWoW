#!/usr/bin/env node
'use strict';
// Build the private icon cache for the StreonorDock plugin.
//
//   node scripts/build-icon-cache.js [--pack <dir>] [--cache <dir>] [--export <StreonorDock.lua>] [--size 72] [--force]
//                                    [--ids <file>] [--listfile <csv>] [--dry-run]
//
// Reads every iconFileID from the StreonorDock SavedVariables export (read-only), plus an optional
// ID list file (numbers separated by whitespace/commas, # comments), finds each icon in the
// community pack (read-only) and writes only the needed ones, shrunk to --size px (default 72, 0 = no
// resize; the plugin refuses cache files > 12 KB), to <cache>/<ID>.png. Existing small cache files are skipped. The pack is never modified or deleted from. Blizzard artwork stays local:
// the cache folder is git-ignored and must never be committed or published.
//
// Pack layout (auto-detected): files named <FileDataID>.png are used directly; files named by icon
// name (inv_misc_food_01.png) need --listfile (wow-listfile community-listfile.csv, "FileDataID;path").
const fs = require('node:fs'), path = require('node:path');
const { shrink } = require('./png');
const { parse } = require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/luatable');

const ROOT = path.join(__dirname, '..');
const DEFAULTS = {
  pack: 'G:\\WoWFOREVER_ADDONS\\_staging\\icon-pack\\png\\png_icons',
  cache: path.join(ROOT, 'icon-cache'),
  gamePath: 'G:\\World of Warcraft\\_forever_',
};
const MAX_ICON_BYTES = 512 * 1024; // pack files above this are refused
const MAX_EMBED_BYTES = 12 * 1024; // keep in sync with lib/icons.js: cache files must be this small
const DEFAULT_SIZE = 72; // px; shrunken icons are ~4-9 KB so a whole tile stays well under 15 KB
const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const validId = n => Number.isInteger(n) && n > 0 && n <= 2147483647;

// Latest-modified StreonorDock.lua under WTF\Account\*\SavedVariables.
function locateExport(gamePath) {
  const base = path.join(gamePath, 'WTF', 'Account');
  const found = [];
  for (const e of fs.readdirSync(base, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const file = path.join(base, e.name, 'SavedVariables', 'StreonorDock.lua');
    try { const st = fs.statSync(file); if (st.isFile()) found.push({ file, t: st.mtimeMs }); } catch { /* none */ }
  }
  if (!found.length) throw new Error('No StreonorDock.lua found under ' + base);
  return found.sort((a, b) => b.t - a.t)[0].file;
}

// Every iconFileID anywhere in the export (all pages, all tables), read-only.
function idsFromExport(file) {
  const st = fs.statSync(file);
  if (st.size > 5 * 1024 * 1024) throw new Error('Export too large');
  const ids = new Set();
  const walk = (v, depth) => {
    if (!v || typeof v !== 'object' || depth > 12) return;
    for (const [k, x] of Object.entries(v)) {
      if (k === 'iconFileID' && validId(x)) ids.add(x);
      else walk(x, depth + 1);
    }
  };
  walk(parse(fs.readFileSync(file, 'utf8')), 0);
  return ids;
}

function idsFromList(file) {
  const ids = new Set();
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    for (const tok of line.replace(/#.*/, '').split(/[\s,;]+/)) {
      if (/^\d+$/.test(tok) && validId(+tok)) ids.add(+tok);
    }
  }
  return ids;
}

// Walk the pack (read-only), return Map<lowercase stem, absolute path> for .png files.
function indexPack(dir) {
  const byStem = new Map();
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile() && /\.png$/i.test(e.name)) {
        const stem = e.name.slice(0, -4).toLowerCase();
        if (!byStem.has(stem)) byStem.set(stem, p);
      }
    }
  }
  return byStem;
}

// community-listfile.csv: "FileDataID;interface/icons/inv_misc_food_01.blp" -> Map<id, lowercase stem>
function loadListfile(file, wanted) {
  const map = new Map();
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf(';');
    if (i < 1) continue;
    const id = +line.slice(0, i);
    if (!wanted.has(id)) continue;
    const rel = line.slice(i + 1).trim().toLowerCase().replace(/\\/g, '/');
    if (!rel.startsWith('interface/icons/')) continue;
    map.set(id, rel.slice(rel.lastIndexOf('/') + 1).replace(/\.[a-z0-9]+$/, ''));
  }
  return map;
}

function isPng(file) {
  const fd = fs.openSync(file, 'r');
  try { const b = Buffer.alloc(8); fs.readSync(fd, b, 0, 8, 0); return b.equals(PNG_MAGIC); } finally { fs.closeSync(fd); }
}

function build(opts) {
  const cache = opts.cache;
  const ids = new Set();
  if (opts.exportFile) for (const id of idsFromExport(opts.exportFile)) ids.add(id);
  if (opts.idsFile) for (const id of idsFromList(opts.idsFile)) ids.add(id);
  const sorted = [...ids].sort((a, b) => a - b);
  const index = indexPack(opts.pack);
  const names = opts.listfile ? loadListfile(opts.listfile, ids) : new Map();
  const report = { total: sorted.length, copied: [], existing: [], unresolved: [], rejected: [] };
  if (!opts.dryRun) fs.mkdirSync(cache, { recursive: true });
  for (const id of sorted) {
    const dest = path.join(cache, id + '.png');
    if (!opts.force && fs.existsSync(dest) && fs.statSync(dest).size <= MAX_EMBED_BYTES) { report.existing.push(id); continue; }
    let src = index.get(String(id));
    let via = 'id';
    if (!src && names.has(id)) { src = index.get(names.get(id)); via = 'name'; }
    if (!src) { report.unresolved.push({ id, reason: opts.listfile || index.has(String(id)) ? 'not in pack' : 'not in pack by ID (name map needed?)' }); continue; }
    const st = fs.statSync(src);
    if (st.size > MAX_ICON_BYTES) { report.rejected.push({ id, reason: 'larger than plugin limit (' + st.size + ' bytes)' }); continue; }
    if (!isPng(src)) { report.rejected.push({ id, reason: 'not a PNG' }); continue; }
    const size = opts.size === undefined ? DEFAULT_SIZE : opts.size;
    let out;
    try { out = size > 0 ? shrink(fs.readFileSync(src), size) : fs.readFileSync(src); } catch (e) { report.rejected.push({ id, reason: 'cannot shrink: ' + e.message }); continue; }
    if (out.length > MAX_EMBED_BYTES) { report.rejected.push({ id, reason: 'still ' + out.length + ' bytes after resize (limit ' + MAX_EMBED_BYTES + ')' }); continue; }
    if (!opts.dryRun) fs.writeFileSync(dest, out);
    report.copied.push({ id, via, bytes: out.length });
  }
  return report;
}

function parseArgs(argv) {
  const o = { dryRun: false };
  const need = (i) => { if (argv[i + 1] === undefined) throw new Error('Missing value for ' + argv[i]); return argv[i + 1]; };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--pack': o.pack = need(i++); break;
      case '--cache': o.cache = need(i++); break;
      case '--export': o.exportFile = need(i++); break;
      case '--ids': o.idsFile = need(i++); break;
      case '--listfile': o.listfile = need(i++); break;
      case '--game': o.gamePath = need(i++); break;
      case '--size': o.size = Number(need(i++)); if (!Number.isInteger(o.size) || o.size < 0 || o.size > 256) throw new Error('--size must be 0-256'); break;
      case '--force': o.force = true; break;
      case '--dry-run': o.dryRun = true; break;
      default: throw new Error('Unknown argument ' + argv[i]);
    }
  }
  return o;
}

function main(argv) {
  const o = parseArgs(argv);
  const opts = {
    pack: o.pack || DEFAULTS.pack, cache: o.cache || DEFAULTS.cache,
    idsFile: o.idsFile, listfile: o.listfile, dryRun: o.dryRun, size: o.size, force: o.force,
    exportFile: o.exportFile || (o.idsFile ? undefined : locateExport(o.gamePath || DEFAULTS.gamePath)),
  };
  console.log('export :', opts.exportFile || '(none)');
  console.log('pack   :', opts.pack, '(read-only)');
  console.log('cache  :', opts.cache, opts.dryRun ? '(dry run)' : '');
  const r = build(opts);
  console.log(`IDs wanted ${r.total}: copied ${r.copied.length}, already cached ${r.existing.length}, unresolved ${r.unresolved.length}, rejected ${r.rejected.length}`);
  for (const u of r.unresolved) console.log('  unresolved', u.id, '-', u.reason);
  for (const u of r.rejected) console.log('  rejected  ', u.id, '-', u.reason);
  return r.unresolved.length || r.rejected.length ? 2 : 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error('error:', e.message); process.exitCode = 1; }
}
module.exports = { build, idsFromExport, idsFromList, indexPack, loadListfile, locateExport, parseArgs };
