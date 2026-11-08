#!/usr/bin/env node
'use strict';
// Report which icon IDs in the current StreonorDock export are present/missing in the icon library.
//   node scripts/check-icons.js [--export <StreonorDock.lua>] [--config <config.json>] [--dir <icon dir>]...
// Directories default to iconDir + iconFallbackDirs from the plugin's config.json (what the plugin uses).
const fs = require('node:fs'), path = require('node:path');
const { parse } = require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/luatable');
const { normalize } = require('../src/io.github.dinonuggolus.streonordock.sdPlugin/lib/exportReader');
const { locateExport } = require('./build-icon-cache');
const CONFIG = path.join(__dirname, '..', 'src', 'io.github.dinonuggolus.streonordock.sdPlugin', 'plugin', 'config.json');

function dirsFromConfig(file) {
  const c = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  return [c.iconDir, ...(Array.isArray(c.iconFallbackDirs) ? c.iconFallbackDirs : [])].filter(d => typeof d === 'string' && d);
}
function find(dirs, id) { for (const d of dirs) for (const ext of ['png', 'jpg', 'svg']) { const f = path.join(d, id + '.' + ext); try { if (fs.statSync(f).isFile()) return f; } catch { /* next */ } } return null; }

// rows: {where, id, file|null} for every key that has an icon id in the export (schema 2, or transitional schema 1)
function check(exportFile, dirs) {
  const e = (parse(fs.readFileSync(exportFile, 'utf8')).StreonorDockDB || {}).export || {}, rows = [];
  const view = normalize(e, 0);
  for (let i = 1; i <= 15; i++) {
    const id = view.icons[i]; if (!Number.isInteger(id)) continue;
    rows.push({ where: 'key ' + i, id, file: find(dirs, id) });
  }
  return rows;
}

function main(argv) {
  let exportFile, config = CONFIG; const extra = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--export' && argv[i + 1]) exportFile = argv[++i];
    else if (argv[i] === '--config' && argv[i + 1]) config = argv[++i];
    else if (argv[i] === '--dir' && argv[i + 1]) extra.push(argv[++i]);
    else throw new Error('Unknown/incomplete argument ' + argv[i]);
  }
  const dirs = extra.length ? extra : dirsFromConfig(config);
  exportFile = exportFile || locateExport(JSON.parse(fs.readFileSync(config, 'utf8')).gamePath);
  console.log('export:', exportFile, '\nicon dirs:', dirs.join(' | '));
  const rows = check(exportFile, dirs);
  for (const r of rows) console.log(`${r.file ? 'OK     ' : 'MISSING'} ${r.where.padEnd(10)} ${String(r.id).padEnd(9)}${r.file ? '' : '  (question-mark tile will be used)'}`);
  const missing = rows.filter(r => !r.file).length;
  console.log(`${rows.length - missing} present, ${missing} missing of ${rows.length}`);
  return missing ? 2 : 0;
}
if (require.main === module) { try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error('error:', e.message); process.exitCode = 1; } }
module.exports = { check, find, dirsFromConfig };
