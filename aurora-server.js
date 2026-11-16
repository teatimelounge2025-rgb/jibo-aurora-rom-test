'use strict';

// Minimal Aurora skill test for a Jibo ROM endpoint.
// Standalone demonstration using the public rom-control package.
// No wake word, 5x1 cloud integration, wallet, or other Re-Commander skills.

const express = require('express');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { Client } = require('rom-control');

let ROBOT_HOST = (process.env.JIBO_HOST || '').trim();
const ROBOT_PORT = Number(process.env.JIBO_PORT || 8160);
const APP_PORT = Number(process.env.PORT || 3000);
const CDN_BASE = (process.env.SIRV_CDN_BASE || 'https://whitejiboone.sirv.com').replace(/\/$/, '');

if (![ROBOT_PORT, APP_PORT].every(p => Number.isInteger(p) && p > 0 && p <= 65535)) {
  console.error('Invalid JIBO_PORT or PORT.');
  process.exit(1);
}

let jibo;

function createClient() {
  jibo = new Client({
  host: ROBOT_HOST,
  port: ROBOT_PORT,
  autoReconnect: true,
  reconnectDelay: 3000,
  autoHeartbeat: true,
  heartbeatInterval: 9000,
  autoSubscribe: false,
  });
}

function attachClientListeners() {
jibo.on('ready', () => console.log('[ROM] session ready'));
jibo.on('disconnect', () => console.warn('[ROM] disconnected'));
jibo.on('error', err => console.error('[ROM] error:', err?.message || err));
}


function getAuroraEyeUrl(kp) {
  let file = 'Eye_kp0.png';
  if (kp >= 5) file = 'Eye_kp5.png';
  else if (kp >= 4) file = 'Eye_kp4.png';
  else if (kp >= 3) file = 'Eye_kp3.png';
  else if (kp >= 2) file = 'Eye_kp2_ok.png';
  else if (kp >= 1) file = 'Eye_kp1.png';

  return `${CDN_BASE}/Eye/${file}` +
    `?text.0.text=${encodeURIComponent('KP ' + kp)}` +
    '&text.0.position.gravity=northwest' +
    '&text.0.position.x=3%25' +
    '&text.0.position.y=3%25' +
    '&text.0.font.size=22';
}

function getAuroraSpeech(kp) {
  if (kp >= 5) return 'Auroral activity is high. Weather permitting, this could be a very good night for northern lights.';
  if (kp >= 4) return 'Auroral activity is active. There may be a good chance to see northern lights in northern Norway.';
  if (kp >= 3) return 'Auroral activity is moderate. In places like Tromso or Senja, you may have a chance if the sky is clear.';
  if (kp >= 2) return 'Auroral activity is low, but there can still be faint displays far north if the sky is clear.';
  return 'Auroral activity is very low right now. It may not be the best moment for northern lights.';
}

async function getKp() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch('https://api.auroras.live/v1/?type=ace&data=kp', {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Aurora API HTTP ${response.status}`);
    const data = await response.json();
    const kp = Number(data.kp);
    if (!Number.isFinite(kp) || kp < 0 || kp > 9) throw new Error('Invalid KP value');
    return { kp, fallback: false };
  } catch (err) {
    console.warn('[Aurora] live data unavailable; using KP 2:', err.message);
    return { kp: 2, fallback: true };
  } finally {
    clearTimeout(timer);
  }
}

let busy = false;
let restoreTimer;

async function runAurora() {
  busy = true;
  try {
    await jibo.behavior.say(
      "<anim cat='excited' nonBlocking='true' endNeutral='true'/> Let me check the northern lights forecast."
    );
    const { kp, fallback } = await getKp();
    console.log(`[Aurora] KP=${kp}; fallback=${fallback}`);
    await jibo.display.showImage(getAuroraEyeUrl(kp));
    const fallbackText = fallback
      ? 'The live aurora service is not responding, so I will demonstrate the display using a placeholder KP value. '
      : '';
    await jibo.behavior.say(
      "<anim cat='happy' nonBlocking='true' endNeutral='true'/> " +
      fallbackText + `The current KP index is ${kp}. ${getAuroraSpeech(kp)}`
    );
    // Restore the eye after the forecast, as in the original skill.
    clearTimeout(restoreTimer);
    restoreTimer = setTimeout(() => {
      jibo.display.showEye().catch(err => console.error('[Aurora] restore eye:', err.message));
    }, 9000);
    console.log('[Aurora] speech and image commands completed');
  } catch (err) {
    console.error('[Aurora] skill failed:', err);
    try { await jibo.display.showEye(); } catch (_) {}
  } finally {
    busy = false;
  }
}

const app = express();
app.disable('x-powered-by');
app.get('/status', (_req, res) => {
  res.json({ ok: true, robot: ROBOT_HOST, port: ROBOT_PORT, connected: !!jibo.connected, busy });
});
app.get('/aurora/start', (_req, res) => {
  if (!jibo.connected) return res.status(503).json({ ok: false, error: 'ROM session not ready' });
  if (busy) return res.status(409).json({ ok: false, error: 'Aurora already running' });
  res.json({ ok: true, message: 'Aurora skill started' });
  void runAurora();
});

async function main() {
  if (!ROBOT_HOST) {
    if (!stdin.isTTY) {
      console.error('Missing JIBO_HOST. Set it to Casper’s Jibo IP address.');
      process.exitCode = 1;
      return;
    }
    const rl = readline.createInterface({ input: stdin, output: stdout });
    try {
      ROBOT_HOST = (await rl.question('Casper, enter your Jibo IP address (e.g. 192.168.1.50): ')).trim();
    } finally {
      rl.close();
    }
  }
  if (!ROBOT_HOST || /[\s/:]/.test(ROBOT_HOST)) {
    console.error('Invalid JIBO_HOST. Enter an IPv4 address or hostname without http:// or a port.');
    process.exitCode = 1;
    return;
  }
  createClient();
  attachClientListeners();
  const server = app.listen(APP_PORT, '127.0.0.1', () => {
  console.log(`Aurora test server: http://127.0.0.1:${APP_PORT}`);
  console.log(`Connecting to Jibo ROM at ${ROBOT_HOST}:${ROBOT_PORT}`);
  jibo.connect().then(() => console.log('[ROM] CONNECTED OK'))
    .catch(err => console.error('[ROM] initial connection failed:', err.message));
});

function shutdown() {
  clearTimeout(restoreTimer);
  server.close();
  try { jibo.destroy?.(); } catch (err) { console.error(err.message); }
  setTimeout(() => process.exit(0), 250).unref();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
}

main().catch(err => { console.error('Startup failed:', err); process.exitCode = 1; });
