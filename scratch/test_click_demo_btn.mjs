import fs from 'fs';
import path from 'path';

const debugPort = 9222;

const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
const listData = await listRes.json();
const targetPage = listData.find(t => t.type === 'page' && t.url.includes('5173')) || listData.find(t => t.type === 'page');

const ws = new WebSocket(targetPage.webSocketDebuggerUrl);

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

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  return res?.result?.value;
}

// Bấm vào nút 'Chế độ Demo (Dành cho kiểm thử)' để mở menu tài khoản mẫu
const clickAction = await evaluate(`
  (() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const demoBtn = buttons.find(b => b.innerText.includes('Chế độ Demo') || b.innerText.includes('Demo'));
    if (!demoBtn) return { success: false, reason: 'Không tìm thấy nút Demo' };
    demoBtn.click();
    return { success: true, text: demoBtn.innerText.trim() };
  })()
`);

console.log('Action Click Demo Button:', clickAction);

// Chờ giao diện xổ dropdown menu Demo
await new Promise(r => setTimeout(r, 800));

// Chụp ảnh bằng chứng
const snap = await send('Page.captureScreenshot', { format: 'png' });
const snapPath = path.resolve('scratch/step2_demo_menu_clicked.png');
fs.writeFileSync(snapPath, Buffer.from(snap.data, 'base64'));
console.log('Screenshot saved to:', snapPath);

const menuItems = await evaluate(`
  (() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
  })()
`);
console.log('Buttons visible now:', menuItems);

ws.close();
