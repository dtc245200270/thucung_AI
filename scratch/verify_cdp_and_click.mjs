import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = 9222;
const profileDir = path.resolve('scratch/cdp_test_profile_headed');

// Check if Chrome is already running on 9222
let isAlive = false;
try {
  const check = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
  if (check.ok) isAlive = true;
} catch {}

let chromeProc = null;
if (!isAlive) {
  console.log('[1] Khởi chạy Chrome với remote debugging port 9222 và profile riêng biệt...');
  chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,900',
    'http://localhost:5173'
  ], {
    detached: false
  });

  // Chờ Chrome CDP sẵn sàng
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 600));
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (res.ok) {
        isAlive = true;
        break;
      }
    } catch {}
  }
}

if (!isAlive) {
  console.error('Không thể kết nối Chrome qua CDP cổng 9222!');
  process.exit(1);
}

console.log('[2] Kết nối thành công tới Chrome qua CDP!');
const versionRes = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
const versionData = await versionRes.json();
console.log('    Trình duyệt:', versionData.Browser);

// Lấy danh sách tabs/pages
const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
const listData = await listRes.json();
const targetPage = listData.find(t => t.type === 'page' && t.url.includes('5173')) || listData.find(t => t.type === 'page');

if (!targetPage) {
  console.error('Không tìm thấy tab trang http://localhost:5173!');
  process.exit(1);
}

console.log('[3] Tìm thấy tab mục tiêu:', targetPage.title, targetPage.url);
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
};

await new Promise(r => ws.onopen = r);
await send('Runtime.enable');
await send('Page.enable');
await send('DOM.enable');

// Đợi 1 giây để trang render ổn định
await new Promise(r => setTimeout(r, 1200));

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  return res?.result?.value;
}

// 4. Đọc thông tin trang thực tế
console.log('[4] Đọc cấu trúc trang hiện tại...');
const pageState = await evaluate(`
  (() => {
    const buttons = Array.from(document.querySelectorAll('button')).map((b, idx) => ({
      index: idx,
      text: b.innerText.trim().replace(/\\s+/g, ' '),
      title: b.title,
      className: b.className,
      disabled: b.disabled,
      isVisible: b.offsetParent !== null
    })).filter(b => b.isVisible);

    const inputs = Array.from(document.querySelectorAll('input, select, textarea')).map(i => ({
      tag: i.tagName.toLowerCase(),
      type: i.type,
      name: i.name,
      placeholder: i.placeholder,
      value: i.value,
      isVisible: i.offsetParent !== null
    })).filter(i => i.isVisible);

    return {
      title: document.title,
      url: window.location.href,
      visibleButtonsCount: buttons.length,
      buttonsSnippet: buttons.slice(0, 8),
      visibleInputsCount: inputs.length,
      inputsSnippet: inputs.slice(0, 5)
    };
  })()
`);

console.log('    Tiêu đề:', pageState.title);
console.log('    URL:', pageState.url);
console.log('    Số nút hiển thị:', pageState.visibleButtonsCount);
console.log('    Danh sách một số nút:', pageState.buttonsSnippet.map(b => `[${b.index}] "${b.text}"`).join(' | '));
console.log('    Số input hiển thị:', pageState.visibleInputsCount);

// 5. Chụp ảnh màn hình trước khi bấm
const snapBefore = await send('Page.captureScreenshot', { format: 'png' });
const snapBeforePath = path.resolve('scratch/step1_before_click.png');
fs.writeFileSync(snapBeforePath, Buffer.from(snapBefore.data, 'base64'));
console.log('[5] Đã chụp ảnh trước khi bấm:', snapBeforePath);

// 6. Thao tác bấm 1 nút trên giao diện để xác minh điều khiển
// Tìm một nút an toàn để bấm (ví dụ nút chuyển tab Đăng nhập / Đăng ký hoặc nút đầu tiên)
const clickResult = await evaluate(`
  (() => {
    const buttons = Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null && !b.disabled);
    if (buttons.length === 0) return { success: false, reason: 'Không tìm thấy nút bấm nào trên màn hình' };

    // Ưu tiên tìm nút chuyển tab hoặc nút xem chi tiết
    const targetBtn = buttons.find(b => 
      b.innerText.includes('Đăng ký') || 
      b.innerText.includes('Đăng nhập') || 
      b.innerText.includes('Khám phá') ||
      b.innerText.includes('Xem')
    ) || buttons[0];

    const prevText = targetBtn.innerText.trim();
    targetBtn.click();
    return {
      success: true,
      clickedButtonText: prevText,
      clickedButtonTag: targetBtn.tagName
    };
  })()
`);

console.log('[6] Kết quả bấm nút:', clickResult);

// Đợi giao diện cập nhật sau khi bấm
await new Promise(r => setTimeout(r, 1000));

// 7. Chụp ảnh màn hình sau khi bấm
const snapAfter = await send('Page.captureScreenshot', { format: 'png' });
const snapAfterPath = path.resolve('scratch/step1_after_click.png');
fs.writeFileSync(snapAfterPath, Buffer.from(snapAfter.data, 'base64'));
console.log('[7] Đã chụp ảnh sau khi bấm:', snapAfterPath);

// Kiểm tra trạng thái mới
const newPageState = await evaluate(`
  (() => {
    return {
      url: window.location.href,
      activeElement: document.activeElement ? (document.activeElement.tagName + ' ' + (document.activeElement.innerText || document.activeElement.placeholder || '')) : null
    };
  })()
`);
console.log('[8] Trạng thái sau khi bấm:', newPageState);

// Ngắt kết nối WebSocket (giữ Chrome tiếp tục chạy)
ws.close();
console.log('✓ XÁC MINH HOÀN TẤT: Đã kết nối CDP, đọc DOM trang web và bấm nút thành công trên Chrome!');
