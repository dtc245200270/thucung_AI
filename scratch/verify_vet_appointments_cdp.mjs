import fs from 'fs';
import path from 'path';

const debugPort = 9222;
const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
const listData = await listRes.json();
const pageTarget = listData.find(t => t.type === 'page' && t.url.includes('5173')) || listData.find(t => t.type === 'page');

if (!pageTarget) {
  console.error('Target page not found!');
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

// Helper to evaluate in page
async function evalPage(expression) {
  const res = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  return res?.result?.value;
}

// 1. Authenticate doctor tester@petcare.ai via backend API
const loginRes = await fetch('http://127.0.0.1:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'tester@petcare.ai', password: 'Doctor@123' })
});
const loginData = await loginRes.json();
console.log('Doctor login status:', loginData.success ? 'OK' : 'FAIL', loginData.user?.name);

// 2. Set doctor session in browser localStorage and navigate to #/clinic
await evalPage(`
  (() => {
    const user = ${JSON.stringify(loginData.user)};
    const token = ${JSON.stringify(loginData.token)};
    localStorage.setItem('petcare_token', token);
    localStorage.setItem('petcare_auth_token', token);
    localStorage.setItem('petcare_active_user', JSON.stringify(user));
    localStorage.setItem('petcare_current_user', JSON.stringify(user));
    localStorage.setItem('petcare_auth_session_v1', JSON.stringify(user));
    localStorage.setItem('petcare_is_authenticated', 'true');
    localStorage.setItem('petcare_current_portal', 'CLINIC');
    window.location.hash = '#/clinic';
    window.location.reload();
  })()
`);

// Wait for page to reload
await new Promise(r => setTimeout(r, 2500));

// Switch to 'appointments' tab in Clinic Workspace
await evalPage(`
  (() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const apptBtn = btns.find(b => b.innerText.includes('Lịch khám'));
    if (apptBtn) {
      apptBtn.click();
    }
  })()
`);

await new Promise(r => setTimeout(r, 1200));

// Check state of appointments tab
const checkState = await evalPage(`
  (() => {
    const headerTitle = document.querySelector('h2')?.innerText || '';
    const badgeText = document.querySelector('h2 span.rounded-full')?.innerText || '';
    const statusButtons = Array.from(document.querySelectorAll('button')).filter(b => {
      const txt = b.innerText;
      return txt.includes('Tất cả trạng thái') || txt.includes('Chờ xác nhận') || txt.includes('Đã xác nhận') || txt.includes('Đang khám') || txt.includes('Đã hoàn tất') || txt.includes('Đã hủy');
    }).map(b => b.innerText.replace(/\\s+/g, ' '));
    
    return {
      title: document.title,
      hash: window.location.hash,
      headerTitle,
      badgeText,
      statusButtons
    };
  })()
`);
console.log('\n--- Initial Appointments Tab State ---');
console.log(JSON.stringify(checkState, null, 2));

// Test 1: Click "Hôm nay"
await evalPage(`
  (() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const todayBtn = btns.find(b => b.innerText.trim() === 'Hôm nay');
    if (todayBtn) todayBtn.click();
  })()
`);
await new Promise(r => setTimeout(r, 600));
const stateToday = await evalPage(`
  (() => {
    const badgeText = document.querySelector('h2 span.rounded-full')?.innerText || '';
    const statusButtons = Array.from(document.querySelectorAll('button')).filter(b => {
      const txt = b.innerText;
      return txt.includes('Tất cả trạng thái') || txt.includes('Đã xác nhận') || txt.includes('Đã hủy');
    }).map(b => b.innerText.replace(/\\s+/g, ' '));
    const emptyNotice = document.querySelector('.space-y-3 h3')?.innerText || '';
    return { badgeText, statusButtons, emptyNotice };
  })()
`);
console.log('\n--- State Today (27/10) ---');
console.log(JSON.stringify(stateToday, null, 2));

const shotToday = await send('Page.captureScreenshot', { format: 'png' });
if (shotToday?.data) {
  fs.writeFileSync('scratch/vet_appts_today_verified.png', Buffer.from(shotToday.data, 'base64'));
}

// Test 2: Click "Ngày mai"
await evalPage(`
  (() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const tmrBtn = btns.find(b => b.innerText.trim() === 'Ngày mai');
    if (tmrBtn) tmrBtn.click();
  })()
`);
await new Promise(r => setTimeout(r, 600));
const stateTomorrow = await evalPage(`
  (() => {
    const badgeText = document.querySelector('h2 span.rounded-full')?.innerText || '';
    const statusButtons = Array.from(document.querySelectorAll('button')).filter(b => {
      const txt = b.innerText;
      return txt.includes('Tất cả trạng thái') || txt.includes('Đã xác nhận') || txt.includes('Đã hủy');
    }).map(b => b.innerText.replace(/\\s+/g, ' '));
    const cardTitle = document.querySelector('strong.text-base')?.innerText || '';
    const cardCode = document.querySelector('.font-mono.text-xs')?.innerText || '';
    return { badgeText, statusButtons, cardTitle, cardCode };
  })()
`);
console.log('\n--- State Tomorrow (28/10) ---');
console.log(JSON.stringify(stateTomorrow, null, 2));

const shotTomorrow = await send('Page.captureScreenshot', { format: 'png' });
if (shotTomorrow?.data) {
  fs.writeFileSync('scratch/vet_appts_tomorrow_verified.png', Buffer.from(shotTomorrow.data, 'base64'));
}

// Test 3: Set Custom Date "2026-10-29"
await evalPage(`
  (() => {
    const dateInput = document.querySelector('input[type="date"]');
    if (dateInput) {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(dateInput, '2026-10-29');
      dateInput.dispatchEvent(new Event('input', { bubbles: true }));
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  })()
`);
await new Promise(r => setTimeout(r, 600));
const stateCustom29 = await evalPage(`
  (() => {
    const badgeText = document.querySelector('h2 span.rounded-full')?.innerText || '';
    const statusButtons = Array.from(document.querySelectorAll('button')).filter(b => {
      const txt = b.innerText;
      return txt.includes('Tất cả trạng thái') || txt.includes('Đã xác nhận') || txt.includes('Đã hủy');
    }).map(b => b.innerText.replace(/\\s+/g, ' '));
    return { badgeText, statusButtons };
  })()
`);
console.log('\n--- State Custom Date 29/10 (All Status) ---');
console.log(JSON.stringify(stateCustom29, null, 2));

// Switch to "Đã hủy" tab
await evalPage(`
  (() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const cancelledTab = btns.find(b => b.innerText.includes('Đã hủy'));
    if (cancelledTab) cancelledTab.click();
  })()
`);
await new Promise(r => setTimeout(r, 600));
const stateCancelled29 = await evalPage(`
  (() => {
    const badgeText = document.querySelector('h2 span.rounded-full')?.innerText || '';
    const cardCode = document.querySelector('.font-mono.text-xs')?.innerText || '';
    const cancelReasonText = Array.from(document.querySelectorAll('div')).find(d => d.innerText.includes('Lý do hủy:'))?.innerText || '';
    const hasConfirmBtn = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Xác nhận'));
    const hasExamBtn = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Bắt đầu khám'));
    return { badgeText, cardCode, cancelReasonText, hasConfirmBtn, hasExamBtn };
  })()
`);
console.log('\n--- State Custom Date 29/10 (Cancelled Tab) ---');
console.log(JSON.stringify(stateCancelled29, null, 2));

const shotCancelled29 = await send('Page.captureScreenshot', { format: 'png' });
if (shotCancelled29?.data) {
  fs.writeFileSync('scratch/vet_appts_cancelled29_verified.png', Buffer.from(shotCancelled29.data, 'base64'));
}

// Test 4: Click "Tất cả ngày"
await evalPage(`
  (() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const allDaysBtn = btns.find(b => b.innerText.trim() === 'Tất cả ngày');
    if (allDaysBtn) allDaysBtn.click();
  })()
`);
await new Promise(r => setTimeout(r, 600));
const stateAllDays = await evalPage(`
  (() => {
    const badgeText = document.querySelector('h2 span.rounded-full')?.innerText || '';
    const dateInputValue = document.querySelector('input[type="date"]')?.value || '';
    const statusButtons = Array.from(document.querySelectorAll('button')).filter(b => {
      const txt = b.innerText;
      return txt.includes('Tất cả trạng thái') || txt.includes('Đã xác nhận') || txt.includes('Đã hủy');
    }).map(b => b.innerText.replace(/\\s+/g, ' '));
    return { badgeText, dateInputValue, statusButtons };
  })()
`);
console.log('\n--- State "Tất cả ngày" ---');
console.log(JSON.stringify(stateAllDays, null, 2));

const shotAllDays = await send('Page.captureScreenshot', { format: 'png' });
if (shotAllDays?.data) {
  fs.writeFileSync('scratch/vet_appts_all_verified.png', Buffer.from(shotAllDays.data, 'base64'));
}

// Test 5: Click "Làm mới"
await evalPage(`
  (() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const refreshBtn = btns.find(b => b.innerText.includes('Làm mới'));
    if (refreshBtn) refreshBtn.click();
  })()
`);
await new Promise(r => setTimeout(r, 1200));
const stateAfterRefresh = await evalPage(`
  (() => {
    const badgeText = document.querySelector('h2 span.rounded-full')?.innerText || '';
    const hasErrorAlert = !!document.querySelector('.bg-rose-50');
    return { badgeText, hasErrorAlert };
  })()
`);
console.log('\n--- State After "Làm mới" ---');
console.log(JSON.stringify(stateAfterRefresh, null, 2));

ws.close();
console.log('\n✓ Browser UI verification completed successfully!');
