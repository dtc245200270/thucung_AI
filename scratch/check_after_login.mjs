import fs from 'fs';
import path from 'path';

const debugPort = 9222;
const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
const listData = await listRes.json();
console.log('List of targets:', listData.map(t => ({ id: t.id, title: t.title, url: t.url, type: t.type })));

const pageTarget = listData.find(t => t.type === 'page' && t.url.includes('5173')) || listData.find(t => t.type === 'page');

if (!pageTarget) {
  console.error('No page target found!');
  process.exit(1);
}

const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
let idCounter = 1;
const callbacks = new Map();

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
};

await new Promise(r => ws.onopen = r);
await send('Runtime.enable');
await send('Page.enable');
await send('DOM.enable');

const check = await send('Runtime.evaluate', {
  expression: `(() => {
    return {
      url: window.location.href,
      title: document.title,
      userInStorage: localStorage.getItem('petcare_auth_session_v1'),
      bodySnippet: document.body.innerText.slice(0, 500),
      petElements: Array.from(document.querySelectorAll('*')).filter(el => {
        return el.innerText && (el.innerText.includes('Cún Kiểm Thử') || el.innerText.includes('Mèo Kiểm Thử'));
      }).map(el => el.innerText.slice(0, 60))
    };
  })()`,
  returnByValue: true
});

console.log('Page state evaluation:');
console.log(JSON.stringify(check?.result?.value, null, 2));

const snap = await send('Page.captureScreenshot', { format: 'png' });
const snapPath = path.resolve('scratch/step_after_user_logged_in.png');
fs.writeFileSync(snapPath, Buffer.from(snap.data, 'base64'));
console.log('Screenshot saved to:', snapPath);

ws.close();
