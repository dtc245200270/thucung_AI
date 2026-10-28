import fs from 'fs';
import path from 'path';

const debugPort = 9222;
const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
const listData = await listRes.json();
console.log('Tabs on 9222:', listData.map(t => ({ id: t.id, title: t.title, url: t.url, type: t.type })));

const pageTarget = listData.find(t => t.type === 'page');
if (!pageTarget) {
  console.log('No page target found');
  process.exit(1);
}

const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
let idCounter = 1;
const callbacks = new Map();
function send(method, params = {}) {
  return new Promise(r => {
    const id = idCounter++;
    callbacks.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
ws.onmessage = e => {
  const msg = JSON.parse(e.data);
  if (msg.id && callbacks.has(msg.id)) {
    callbacks.get(msg.id)(msg.result);
    callbacks.delete(msg.id);
  }
};
await new Promise(r => ws.onopen = r);
await send('Page.enable');

const snap = await send('Page.captureScreenshot', { format: 'png' });
const snapPath = path.resolve('scratch/step_user_current_view.png');
fs.writeFileSync(snapPath, Buffer.from(snap.data, 'base64'));
console.log('Current view screenshot saved to:', snapPath);

const evalRes = await send('Runtime.evaluate', {
  expression: `(() => {
    return {
      url: window.location.href,
      title: document.title,
      inputs: Array.from(document.querySelectorAll('input')).map(i => ({ type: i.type, val: i.value })),
      hasPets: document.body.innerText.includes('Cún Kiểm Thử')
    };
  })()`,
  returnByValue: true
});
console.log('Page eval:', evalRes?.result?.value);
ws.close();
