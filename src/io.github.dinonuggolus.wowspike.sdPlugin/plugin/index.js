'use strict';
// THROWAWAY SPIKE. Proves: (1) a key press event reaches the plugin, (2) the plugin can set a key icon,
// (3) an Information panel can show a live value read from an external file. Sends no keystrokes.
const { spawn } = require('child_process'), path = require('path'), fs = require('fs'), readline = require('readline');

const options = {};
for (let i = 2; i < process.argv.length; i += 2) options[process.argv[i].replace(/^-+/, '')] = process.argv[i + 1];
if (!/^\d+$/.test(options.port || '') || !options.pluginUUID || !options.registerEvent) throw Error('Host launch arguments missing');

const STATE_FILE = process.env.WOWSPIKE_STATE || 'G:\\WoWFOREVER_ADDONS\\StreonorWoW\\state\\state.json';
const STALE_MS = 30000;
const logDir = path.join(__dirname, '..', 'logs');
fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, 'spike.jsonl');
function log(event, data) {
  try {
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 1e6) fs.renameSync(logFile, logFile + '.previous');
    fs.appendFileSync(logFile, JSON.stringify({ time: new Date().toISOString(), event, data }) + '\n');
  } catch (e) { console.error(e.message); }
}

const bridge = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
  '-File', path.join(__dirname, 'bridge.ps1'), '-Port', options.port], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
bridge.stderr.on('data', d => log('bridgeStderr', d.toString()));
bridge.on('exit', code => { log('bridgeExit', code); process.exit(code || 0); });
function send(obj) { if (!bridge.stdin.destroyed) bridge.stdin.write(JSON.stringify({ kind: 'send', message: JSON.stringify(obj) }) + '\n'); }
function setImage(context, svg) {
  send({ event: 'setImage', context, payload: { target: 0, image: 'data:image/svg+xml;charset=utf8,' + encodeURIComponent(svg) } });
}
const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

const keys = new Map();   // context -> { presses }
const panels = new Map(); // context -> { w, h }
let timer = null;

function keySvg(presses) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
<rect width="144" height="144" rx="14" fill="#1b2a1b"/><circle cx="72" cy="52" r="26" fill="#6ab04c"/>
<text x="72" y="62" font-family="Arial" font-size="30" font-weight="700" text-anchor="middle" fill="#0d1a0d">R</text>
<text x="72" y="112" font-family="Arial" font-size="26" font-weight="700" text-anchor="middle" fill="#e8f5e0">x${presses}</text>
<text x="72" y="134" font-family="Arial" font-size="12" text-anchor="middle" fill="#8fbf7a">SPIKE KEY</text></svg>`;
}
function readState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8').replace(/^﻿/, ''));
    const age = Date.now() - Date.parse(s.updated);
    return { gold: s.gold, freeSlots: s.freeSlots, stale: !(age >= 0 && age < STALE_MS), age };
  } catch (e) { return { error: e.message }; }
}
function panelSvg(st) {
  const body = st.error
    ? `<text x="72" y="80" font-family="Arial" font-size="16" text-anchor="middle" fill="#ff6b6b">NO DATA</text>`
    : `<text x="72" y="30" font-family="Arial" font-size="13" text-anchor="middle" fill="#9aa7b3">GOLD</text>
<text x="72" y="58" font-family="Arial" font-size="${String(st.gold).length > 9 ? 17 : 22}" font-weight="700" text-anchor="middle" fill="#ffd25a">${esc(st.gold)}</text>
<text x="72" y="92" font-family="Arial" font-size="13" text-anchor="middle" fill="#9aa7b3">FREE BAGS</text>
<text x="72" y="122" font-family="Arial" font-size="28" font-weight="700" text-anchor="middle" fill="#7fd7ff">${esc(st.freeSlots)}</text>`;
  const badge = st.stale ? `<rect x="0" y="0" width="144" height="16" fill="#7a2a2a"/><text x="72" y="12" font-family="Arial" font-size="11" text-anchor="middle" fill="#fff">STALE</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" fill="#0c1218"/>${body}${badge}</svg>`;
}
function drawPanels() { if (!panels.size) return; const svg = panelSvg(readState()); for (const c of panels.keys()) setImage(c, svg); }
function ensureTimer() { if (!timer && panels.size) timer = setInterval(drawPanels, 1000); if (timer && !panels.size) { clearInterval(timer); timer = null; } }

function handle(m) {
  const p = m.payload || {};
  log('event', { event: m.event, action: m.action, device: m.device, controller: p.controller, coordinates: p.coordinates, state: p.state });
  if (m.event === 'willAppear') {
    if (m.action === 'io.github.dinonuggolus.wowspike.key') { keys.set(m.context, { presses: 0 }); setImage(m.context, keySvg(0)); }
    if (m.action === 'io.github.dinonuggolus.wowspike.panel') { panels.set(m.context, {}); drawPanels(); ensureTimer(); }
  } else if (m.event === 'willDisappear') {
    keys.delete(m.context); panels.delete(m.context); ensureTimer();
  } else if (m.event === 'keyDown' && keys.has(m.context)) {
    const k = keys.get(m.context); k.presses++;
    setImage(m.context, keySvg(k.presses));
    log('keyPress', { presses: k.presses });
  }
}

readline.createInterface({ input: bridge.stdout }).on('line', line => {
  try {
    const m = JSON.parse(line);
    if (m.bridge === 'ready') { send_register(); log('launch', { info: options.info ? JSON.parse(options.info) : null }); }
    else if (m.bridge) log('bridge', m);
    else handle(m);
  } catch (e) { log('error', { message: e.message, line: line.slice(0, 200) }); }
});
function send_register() { send({ event: options.registerEvent, uuid: options.pluginUUID }); }
process.on('uncaughtException', e => { log('fatal', e.message); process.exit(1); });
