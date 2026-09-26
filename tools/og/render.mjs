// Renders the 1200×630 share cards in assets/og/ from tools/og/card.html.
//
//   node tools/og/render.mjs            # every card
//   node tools/og/render.mjs vision     # just the named ones
//
// Needs Node 22+ (built-in WebSocket) and Google Chrome. Serves the repo on a
// throwaway local port, drives headless Chrome over the DevTools protocol, and
// writes assets/og/<name>.png. Add a line to CARDS for every new page.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CARDS = {
  home:     { kind: 'home' },
  vision:   { label: 'The Vision', title: 'What if the moral code the age of AI is searching for has already been written?' },
  faith:    { label: 'The Vision · Chapter I', title: "The Bahá'í Faith, at a glance" },
  prophecy: { label: 'The Vision · Chapter II', title: 'Every tradition was waiting for someone.' },
  pattern:  { label: 'The Vision · Chapter III', title: "The pattern of rejection — and why we'd follow it again" },
  trilemma: { label: 'The Vision · Chapter IV', title: 'Liar, lunatic — or what He claimed to be?' },
  numbers:  { label: 'The Vision · Chapter V', title: 'Numbers all the way down' },
  hour:     { label: 'The Vision · Chapter VI', title: '“There shall suddenly appear…”' },
  letters:  { label: 'An illustration', title: 'Twenty-Seven Letters' },
  journey:  { label: 'The Journey', title: 'This is a story most people have never heard.' },
};

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const OUT = path.join(ROOT, 'assets/og');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = () => 20000 + Math.floor(Math.random() * 20000);

const only = process.argv.slice(2);
const names = only.length ? only : Object.keys(CARDS);
for (const n of names) if (!CARDS[n]) { console.error('unknown card:', n); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const WEB = port(), CDP = port();
const server = spawn('python3', ['-m', 'http.server', String(WEB), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'og-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--window-size=1200,630', 'about:blank'], { stdio: 'ignore' });
const stop = () => { for (const p of [chrome, server]) try { p.kill('SIGTERM'); } catch (e) {} };
process.on('exit', stop);

let target;
for (let i = 0; i < 100 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json()).find((t) => t.type === 'page'); } catch (e) {}
  if (!target) await sleep(150);
}
if (!target) throw new Error('Chrome did not start');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });

for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${WEB}/`); break; } catch (e) { await sleep(100); } }

for (const name of names) {
  const url = `http://127.0.0.1:${WEB}/tools/og/card.html?${new URLSearchParams(CARDS[name])}`;
  await send('Page.navigate', { url });
  for (let i = 0; i < 100; i++) { if (await evaluate("document.readyState === 'complete'").catch(() => false)) break; await sleep(100); }
  await evaluate('document.fonts.ready.then(() => true)');
  await sleep(250);
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(shot.data, 'base64'));
  console.log('wrote', path.relative(ROOT, path.join(OUT, `${name}.png`)));
}
stop();
process.exit(0);
