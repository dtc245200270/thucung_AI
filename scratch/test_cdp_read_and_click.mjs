import fs from 'fs';
import path from 'path';

const debugPort = 9222;

const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
const listData = await listRes.json();
const pageTarget = listData.find(t => t.type === 'page' && t.url.includes('5173'));

if (!pageTarget) {
  console.error('Target page http://localhost:5173 not found among pages:', listData);
  process.exit(1);
}

console.log('Target found:', pageTarget.title, pageTarget.webSocketDebuggerUrl);

const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

let idCounter = 1;
const callbacks = new Map();
const consoleLogs = [];
const consoleErrors = [];

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
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
    consoleLogs.push(`[CONSOLE ${msg.params.type.toUpperCase()}]: ${text}`);
  }
};

await new Promise(r => ws.onopen = r);
console.log('Connected to Page WebSocket');

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

// 1. Read current page state
const pageInfo = await evaluate(`
  (() => {
    return {
      title: document.title,
      url: window.location.href,
      bodyTextSnippet: document.body.innerText.slice(0, 500),
      hasLoginForm: !!document.querySelector('input[type="email"], input[type="password"]'),
      buttons: Array.from(document.querySelectorAll('button')).slice(0, 15).map(b => b.innerText.trim()).filter(Boolean)
    };
  })()
`);

console.log('=== PAGE INFO ===');
console.log(JSON.stringify(pageInfo, null, 2));

// Capture initial screenshot
const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
const screenshotPath = path.resolve('scratch/step0_connected.png');
fs.writeFileSync(screenshotPath, Buffer.from(screenshotRes.data, 'base64'));
console.log('✓ Screenshot captured to:', screenshotPath);

// Disconnect
ws.close();
