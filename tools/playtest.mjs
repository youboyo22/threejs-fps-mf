// playtest.mjs — `node tools/playtest.mjs`: drives the real page in headless Chrome with
// real input events (the ?free flag stands in for pointer lock, which headless Chrome never
// grants: click to deploy, buy with a number key, walk, fire, reload) and
// checks the HUD reacts. A smoke test of the browser shell that selftest.mjs cannot reach.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9339;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, ['--headless=new', '--no-first-run', '--disable-extensions', '--mute-audio',
  '--user-data-dir=' + root + '.chrome-profile', '--remote-debugging-port=' + DEBUG_PORT, '--window-size=1280,720',
  '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });

const problems = [];
try {
  let target = null;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ }
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let nextId = 1;
  const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id) { pending.get(msg.id)?.(msg.result); pending.delete(msg.id); return; }
    if (msg.method === 'Runtime.exceptionThrown') problems.push('page error: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
  };
  const send = (method, params = {}) => new Promise((resolve) => { const id = nextId++; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
  const read = async (expression) => (await send('Runtime.evaluate', { expression })).result.value;
  const hud = () => read('["timer","phase","place","mag","res","money","weapon","hp"].map((id) => id + "=" + document.getElementById(id).textContent).join("  ")');
  const key = async (code, ms, text) => {
    const vk = code.startsWith('Key') ? code.charCodeAt(3) : code.startsWith('Digit') ? code.charCodeAt(5) : 0;
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: text || code, windowsVirtualKeyCode: vk });
    await sleep(ms);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: text || code, windowsVirtualKeyCode: vk });
  };
  const mouse = (type, extra = {}) => send('Input.dispatchMouseEvent', { type, x: 640, y: 360, button: 'left', clickCount: 1, ...extra });
  const expect = (what, ok) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) problems.push(what); };

  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'file://' + root + 'game/index.html?seed=11&free' });
  await sleep(2000);

  await mouse('mousePressed'); await mouse('mouseReleased');           // click to deploy
  await sleep(500);
  expect('menu is hidden and HUD shown', await read('document.getElementById("menu").classList.contains("hide") && !document.getElementById("hud").classList.contains("hide")'));
  console.log('     ' + await hud());
  expect('buy menu is open in the buy phase', await read('!document.getElementById("buy").classList.contains("hide")'));
  await key('Digit5', 80, '5');                                        // Plate Vest, $650 of the $800
  await sleep(300);
  expect('bought a vest with key 5', await read('document.getElementById("money").textContent') === '$150' && await read('document.getElementById("armor").textContent') === '100');

  for (let i = 0; i < 40 && await read('document.getElementById("phase").textContent') === 'BUY PHASE'; i++) await sleep(500);
  const before = await read('document.getElementById("place").textContent');
  await key('KeyW', 3500);                                             // run north off the quay
  const after = await read('document.getElementById("place").textContent');
  console.log('     ' + await hud());
  expect(`walking forward changes the callout (${before} -> ${after})`, before !== after);

  await mouse('mousePressed'); await sleep(120); await mouse('mouseReleased');
  await sleep(400);
  await mouse('mousePressed'); await sleep(120); await mouse('mouseReleased');
  await sleep(200);
  expect('two clicks fire two rounds of the semi-automatic sidearm', await read('document.getElementById("mag").textContent') === '10');
  await key('KeyR', 80, 'r');
  await sleep(300);
  expect('R starts a reload', await read('!document.getElementById("progress").classList.contains("hide")'));
  await sleep(1800);
  expect('reload refills the magazine from reserve', await read('document.getElementById("mag").textContent + document.getElementById("res").textContent') === '12/ 34');
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 700, y: 360, movementX: 400, movementY: 0 });
  console.log('     ' + await hud());
  ws.close();
} finally {
  chrome.kill('SIGKILL');
}
console.log(problems.length ? 'playtest FAILED: ' + problems.join('; ') : 'playtest ok');
process.exit(problems.length ? 1 : 0);
