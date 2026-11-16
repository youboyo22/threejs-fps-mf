// capture.mjs — how screenshots/ is made: `node tools/capture.mjs [name ...]`.
// Opens each scene of shots.json in headless Chrome over the DevTools protocol, straight
// from game/ on disk (no server, no network), waits for the game to render and saves the
// frame as it is. The page's console errors are printed, so this doubles as a smoke test
// of the browser build.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9337, PAGE = 'file://' + root + 'game/index.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const wanted = process.argv.slice(2);
const shots = JSON.parse(readFileSync(root + 'shots.json', 'utf8')).filter((s) => !wanted.length || wanted.some((w) => s.name.includes(w)));
if (process.env.SMOKE) shots.push({ name: 'smoke.jpg', query: process.env.SMOKE, wait: Number(process.env.SMOKE_WAIT || 12000) });   // any other URL, e.g. ?auto
const outDir = process.env.SHOT_DIR || root + 'screenshots/';
mkdirSync(outDir, { recursive: true });

const chrome = spawn(CHROME, ['--headless=new', '--no-first-run', '--disable-extensions', '--hide-scrollbars', '--mute-audio',
  '--user-data-dir=' + root + '.chrome-profile', '--remote-debugging-port=' + DEBUG_PORT, '--window-size=1280,720',
  '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });

let failed = false;
try {
  let target = null;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ }
  }
  if (!target) throw new Error('Chrome did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let nextId = 1;
  const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id) { pending.get(msg.id)?.(msg.result); pending.delete(msg.id); return; }
    if (msg.method === 'Runtime.exceptionThrown') { failed = true; console.log('  PAGE ERROR', msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text); }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type !== 'log') console.log('  console.' + msg.params.type, msg.params.args.map((a) => a.value ?? a.description).join(' '));
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') { failed = true; console.log('  LOG', msg.params.entry.text, msg.params.entry.url || ''); }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, resolve);
    setTimeout(() => reject(new Error(method + ' timed out: is the page stuck?')), 15000).unref();
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

  for (const shot of shots) {
    const nav = await send('Page.navigate', { url: PAGE + shot.query });
    if (nav.errorText) { failed = true; console.log('  NAVIGATION', nav.errorText); }
    await sleep(shot.wait || 2500);
    const probe = await send('Runtime.evaluate', { expression: 'location.href + " | " + document.title + " | " + document.querySelectorAll("canvas").length + " canvases"' });
    console.log('  page:', probe.result.value);
    const { data } = await send('Page.captureScreenshot', shot.name.endsWith('.png') ? { format: 'png' } : { format: 'jpeg', quality: 90 });
    writeFileSync(outDir + shot.name, Buffer.from(data, 'base64'));
    console.log('saved', shot.name, Math.round(data.length * 0.75 / 1024) + ' KiB');
  }
  ws.close();
} catch (error) {
  failed = true; console.log(String(error));
} finally {
  chrome.kill('SIGKILL');
}
process.exit(failed ? 1 : 0);
