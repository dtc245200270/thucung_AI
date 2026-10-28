import fs from 'fs';
import path from 'path';

const debugPort = 9222;

const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
const listData = await listRes.json();
const targetPage = listData.find(t => t.type === 'page' && t.url.includes('5173')) || listData.find(t => t.type === 'page');

if (!targetPage) {
  console.error('Không tìm thấy tab!');
  process.exit(1);
}

const ws = new WebSocket(targetPage.webSocketDebuggerUrl);

let idCounter = 1;
const callbacks = new Map();
const consoleLogs = [];
const consoleErrors = [];

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = idCounter++;
    callbacks.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && callbacks.has(msg.id)) {
    callbacks.get(msg.id)(msg.result);
    callbacks.delete(msg.id);
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = msg.params.args.map(a => a.value ?? a.description ?? JSON.stringify(a)).join(' ');
    if (msg.params.type === 'error') {
      consoleErrors.push(text);
    }
    consoleLogs.push(`[${msg.params.type.toUpperCase()}] ${text}`);
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(JSON.stringify(msg.params.exceptionDetails));
  }
};

await new Promise(r => ws.onopen = r);
await send('Runtime.enable');
await send('Page.enable');
await send('DOM.enable');

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  return res?.result?.value;
}

const state = await evaluate(`
  (() => {
    return {
      url: window.location.href,
      title: document.title,
      isLoggedIn: !document.querySelector('input[type="password"]'),
      bodySnippet: document.body.innerText.slice(0, 400),
      petCards: Array.from(document.querySelectorAll('*')).filter(el => el.innerText && (el.innerText.includes('Cún Kiểm Thử') || el.innerText.includes('Mèo Kiểm Thử'))).slice(0, 3).map(el => el.innerText.slice(0, 100))
    };
  })()
`);

console.log('Current Page State:', JSON.stringify(state, null, 2));

const snap = await send('Page.captureScreenshot', { format: 'png' });
const snapPath = path.resolve('scratch/step_initial_after_login.png');
fs.writeFileSync(snapPath, Buffer.from(snap.data, 'base64'));
console.log('Screenshot saved to:', snapPath);

ws.close();
