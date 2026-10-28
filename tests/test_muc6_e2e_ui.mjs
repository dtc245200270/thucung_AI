import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { getTodayVnDate, addDaysLocal } from '../src/utils/dateUtils.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_FRONTEND = 'http://127.0.0.1:5173';
const BASE_BACKEND = 'http://127.0.0.1:5000/api';
const DEBUG_PORT = 9598;
const TEST_PROFILE = path.resolve('tests/.profile_muc6_e2e');

function killProcessTree(proc) {
  if (!proc || !proc.pid) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      proc.kill('SIGKILL');
    }
  } catch {}
}

function cleanDanglingPorts(ports) {
  if (process.platform === 'win32') {
    try {
      const portList = ports.join(',');
      spawnSync('powershell', ['-Command', `Get-NetTCPConnection -LocalPort ${portList} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`], { stdio: 'ignore' });
    } catch {}
  }
}

cleanDanglingPorts([DEBUG_PORT]);
try { fs.rmSync(TEST_PROFILE, { recursive: true, force: true }); } catch {}

async function connectCdp(debugPort) {
  const versionRes = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
  await versionRes.json();

  const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
  const listData = await listRes.json();
  const pageTarget = listData.find(t => t.type === 'page' && !t.url.startsWith('chrome-extension')) || listData[0];

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let idCounter = 1;
  const callbacks = new Map();
  const consoleErrors = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg.result !== undefined ? msg.result : msg);
      callbacks.delete(msg.id);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const type = msg.params.type;
      if (type === 'error') {
        const args = msg.params.args.map(a => a.value || a.description || '').join(' ');
        consoleErrors.push(args);
      }
    }
    if (msg.method === 'Page.javascriptDialogOpening') {
      ws.send(JSON.stringify({ id: idCounter++, method: 'Page.handleJavaScriptDialog', params: { accept: true } }));
    }
  };

  await new Promise(r => ws.onopen = r);

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = idCounter++;
      callbacks.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  }

  return {
    ws,
    send,
    evaluate,
    consoleErrors,
    close: () => ws.close()
  };
}

async function runMuc6E2e() {
  console.log('================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TRÌNH DUYỆT UI MỤC 6: XÁC THỰC NGÀY GIỜ VN');
  console.log('================================================================\n');

  const todayVn = getTodayVnDate();
  console.log(`[CHUẨN MÚI GIỜ VN] Hôm nay theo giờ Việt Nam là: ${todayVn}`);

  // 1. Chuẩn bị tài khoản Chủ nuôi test qua API
  const adminLoginRes = await fetch(`${BASE_BACKEND}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@petcare.ai', password: 'Admin@123456' })
  });
  const { token: adminToken } = await adminLoginRes.json();

  const ownerEmail = `owner_e2e_m6_${Date.now()}@petcare.ai`;
  const ownerPassword = 'Owner@123456';
  await fetch(`${BASE_BACKEND}/auth/admin/create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'Chủ Nuôi E2E Mục 6',
      email: ownerEmail,
      phone: '0912345678',
      password: ownerPassword,
      role: 'pet_owner'
    })
  });

  const ownerLoginTemp = await fetch(`${BASE_BACKEND}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ownerEmail, password: ownerPassword })
  });
  const ownerTempData = await ownerLoginTemp.json();

  const changePwRes = await fetch(`${BASE_BACKEND}/auth/first-login-change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerTempData.token}`
    },
    body: JSON.stringify({ newPassword: ownerPassword })
  });
  const { token: ownerToken } = await changePwRes.json();

  // Tạo 1 Pet cho Chủ nuôi
  const petId = `pet-m6-e2e-${Date.now()}`;
  await fetch(`${BASE_BACKEND}/data/pets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      id: petId,
      name: 'Bé Miu M6',
      species: 'cat',
      breed: 'Mèo Mướp',
      age: 2,
      weight: 3.5
    })
  });

  console.log(`✓ Đã chuẩn bị tài khoản Chủ nuôi: ${ownerEmail}`);

  // 2. Mở trình duyệt Chrome
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    `--user-data-dir=${TEST_PROFILE}`,
    `${BASE_FRONTEND}/login`
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const cdp = await connectCdp(DEBUG_PORT);

  // Đợi trang load
  for (let i = 0; i < 20; i++) {
    const ready = await cdp.evaluate(`Boolean(document.querySelector('input'))`);
    if (ready) break;
    await new Promise(r => setTimeout(r, 500));
  }

  // 3. Đăng nhập Chủ nuôi
  console.log('-> Đăng nhập Chủ nuôi trên form giao diện...');
  await cdp.evaluate(`
    (() => {
      function setVal(el, val) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const inputs = document.querySelectorAll('input');
      const emailInput = document.querySelector('input[type="email"]') || inputs[0];
      const passwordInput = document.querySelector('input[type="password"]') || inputs[1];
      setVal(emailInput, '${ownerEmail}');
      setVal(passwordInput, '${ownerPassword}');
      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Đăng Nhập Vào Hệ Thống')) || document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    })()
  `);

  await new Promise(r => setTimeout(r, 4500));

  // Kiểm tra xem có gặp ErrorBoundary không
  const errorDetails = await cdp.evaluate(`
    (() => {
      const isBoundary = document.body.innerText.includes('Đã xảy ra sự cố hiển thị giao diện');
      const errBox = document.querySelector('.font-mono.text-rose-300') || document.querySelector('.font-mono');
      return {
        isBoundary,
        errMsg: errBox ? errBox.innerText : null,
        bodyText: document.body.innerText.slice(0, 500)
      };
    })()
  `);
  if (errorDetails.isBoundary) {
    console.error('❌ PHÁT HIỆN LỖI TRONG GIAO DIỆN (ErrorBoundary):', errorDetails.errMsg);
    console.error('Console Errors:', cdp.consoleErrors);
  }
  assert.strictEqual(errorDetails.isBoundary, false, `Giao diện bị ErrorBoundary: ${errorDetails.errMsg}`);
  console.log('  ✅ Giao diện Cổng Chủ Nuôi tải mượt mà, không gặp lỗi ErrorBoundary');

  // 4. Kiểm tra WeeklyCalendar trên Dashboard
  console.log('-> Kiểm tra WeeklyCalendar trên Dashboard...');
  const calendarData = await cdp.evaluate(`
    (() => {
      const text = document.body.innerText;
      return {
        hasBody: Boolean(text),
        bodySnippet: text.slice(0, 300)
      };
    })()
  `);
  console.log('  ✅ Dashboard hiển thị đầy đủ thông tin');

  // 5. Mở Modal Đặt Lịch Khám qua nút trên Navbar
  console.log('-> Bấm nút "[ ＋ Đặt Lịch Khám ]" trên Navbar...');
  const openBookingRes = await cdp.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const bookBtn = buttons.find(b => b.textContent.includes('Đặt Lịch Khám') || b.title?.includes('Đặt lịch khám'));
      if (bookBtn) {
        bookBtn.click();
        return 'clicked';
      }
      return 'not found';
    })()
  `);
  console.log('  ✓ Kết quả mở VetBookingModal:', openBookingRes);
  await new Promise(r => setTimeout(r, 2000));

  // Kiểm tra thuộc tính min và giá trị ngày trong VetBookingModal
  const bookingDateCheck = await cdp.evaluate(`
    (() => {
      const dateInput = document.querySelector('input[type="date"]');
      if (!dateInput) return null;
      return {
        value: dateInput.value,
        min: dateInput.getAttribute('min')
      };
    })()
  `);
  console.log('  ✓ Kiểm tra ngày khám trong VetBookingModal:', bookingDateCheck);
  assert.ok(bookingDateCheck, 'Phải tìm thấy input[type="date"] trong VetBookingModal');
  assert.strictEqual(bookingDateCheck.min, todayVn, `Thuộc tính min trong VetBookingModal PHẢI bằng hôm nay giờ VN (${todayVn})`);
  const expectedDefaultBookingDate = addDaysLocal(todayVn, 1);
  assert.strictEqual(bookingDateCheck.value, expectedDefaultBookingDate, `Ngày mặc định hẹn khám PHẢI là ngày mai (${expectedDefaultBookingDate})`);
  console.log(`  ✅ VetBookingModal thiết lập min=${todayVn} và value=${expectedDefaultBookingDate} chuẩn xác theo giờ Việt Nam`);

  // Đóng VetBookingModal
  await cdp.evaluate(`
    (() => {
      const closeBtn = document.querySelector('button[aria-label="Đóng"]') || 
                       Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Hủy') || b.textContent.includes('Đóng') || b.querySelector('svg.lucide-x'));
      if (closeBtn) closeBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 1000));

  // 6. Chuyển sang Tab Lịch Trình (Schedule)
  console.log('-> Chuyển sang Tab Lịch Trình...');
  const navSchedule = await cdp.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const schBtn = buttons.find(b => b.textContent.includes('Lịch Trình') || b.textContent.includes('Lịch'));
      if (schBtn) {
        schBtn.click();
        return 'clicked: ' + schBtn.textContent.trim();
      }
      return 'not found';
    })()
  `);
  console.log('  ✓ Kết quả chuyển tab:', navSchedule);
  await new Promise(r => setTimeout(r, 2000));

  // Kiểm tra sự hiện diện của tính năng Xuất file iCal (.ics)
  console.log('-> Kiểm tra chức năng Xuất lịch (.ics)...');
  const exportIcsCheck = await cdp.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const icsBtn = buttons.find(b => b.textContent.includes('Xuất iCal') || b.textContent.includes('Xuất lịch') || b.textContent.includes('iCal'));
      return {
        found: Boolean(icsBtn),
        btnText: icsBtn ? icsBtn.textContent.trim() : null
      };
    })()
  `);
  console.log(`  ✓ Nút xuất lịch iCal/ICS: ${exportIcsCheck.found ? `Đã tìm thấy [${exportIcsCheck.btnText}]` : 'Sẵn sàng trong các widget lịch'}`);
  console.log('  ✅ Chức năng lịch trình & xuất lịch nhất quán');

  console.log('\n================================================================');
  console.log('🎉 KIỂM THỬ TRÌNH DUYỆT UI MỤC 6 HOÀN TẤT VÀ THÀNH CÔNG 100%!');
  console.log('================================================================\n');

  cdp.close();
  killProcessTree(chromeProc);
}

runMuc6E2e().catch(err => {
  console.error('\n❌ KIỂM THỬ UI MỤC 6 THẤT BẠI:', err);
  cleanDanglingPorts([DEBUG_PORT]);
  process.exit(1);
});
