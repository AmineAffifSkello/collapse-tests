const PORT = 9223; // port CDP
const URL_PAGE = 'http://localhost:8765/acme/widget-service/pull/42/changes/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch {}
    await sleep(250);
  }
  throw new Error('chrome injoignable: ' + url);
}

await waitFor(`http://localhost:${PORT}/json/version`);
const tab = await (await fetch(`http://localhost:${PORT}/json/new?${encodeURIComponent(URL_PAGE)}`, { method: 'PUT' })).json();

const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const problems = [];

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    problems.push('EXCEPTION | ' + (d.exception?.description || d.text));
  }
  if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
    problems.push('CONSOLE ' + msg.params.type.toUpperCase() + ' | ' + msg.params.args.map((a) => a.value ?? a.description).join(' '));
  }
  if (msg.method === 'Log.entryAdded' && ['error', 'warning'].includes(msg.params.entry.level)) {
    problems.push('LOG ' + msg.params.entry.level.toUpperCase() + ' | ' + msg.params.entry.text);
  }
});

const send = (method, params = {}) => new Promise((res) => {
  const n = ++id;
  pending.set(n, res);
  ws.send(JSON.stringify({ id: n, method, params }));
});

await new Promise((r) => ws.addEventListener('open', r));
await send('Runtime.enable');
await send('Log.enable');

let results = null;
for (let i = 0; i < 80; i++) {
  await sleep(500);
  const r = await send('Runtime.evaluate', { expression: 'window.__RESULTS__ || null', returnByValue: true });
  const v = r.result?.result?.value;
  if (v) { results = v; break; }
}

console.log(results || 'TIMEOUT: le harness n a pas termine');
console.log('\n--- erreurs et avertissements console ---');
console.log(problems.length ? problems.join('\n') : 'aucun');
ws.close();
process.exit(0);
