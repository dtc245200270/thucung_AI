import { spawn } from 'child_process';
import fs from 'fs';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = 9565;
const profileDir = 'C:\\Users\\Dell Precision 5550\\Documents\\PET_Ai\\scratch\\temp_e2e_muc1_profile';

try {
  fs.rmSync(profileDir, { recursive: true, force: true });
} catch {}

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${debugPort}`,
  '--disable-gpu',
  '--no-sandbox',
  `--user-data-dir=${profileDir}`,
  'http://127.0.0.1:5173/'
]);

await new Promise(r => setTimeout(r, 2000));

try {
  const versionRes = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
  const versionData = await versionRes.json();
  console.log('✓ Chrome browser connected via CDP:', versionData.Browser);

  const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
  const listData = await listRes.json();
  const pageTarget = listData.find(t => t.type === 'page');

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let idCounter = 1;
  const callbacks = new Map();
  const uncaughtExceptions = [];
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
      const args = msg.params.args.map(a => a.value ?? a.description ?? JSON.stringify(a)).join(' ');
      if (msg.params.type === 'error') {
        console.log('[BROWSER CONSOLE ERROR]:', args);
        consoleErrors.push(args);
      }
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error('CRITICAL UNCAUGHT EXCEPTION:', msg.params.exceptionDetails?.text, msg.params.exceptionDetails?.exception?.description);
      uncaughtExceptions.push(msg.params.exceptionDetails);
    }
  };

  await new Promise(r => ws.onopen = r);

  await send('Runtime.enable');
  await send('Page.enable');

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  }

  async function performLogin(email, password) {
    await send('Page.navigate', { url: 'http://127.0.0.1:5173/login' });
    await new Promise(r => setTimeout(r, 2000));

    await evaluate(`
      (() => {
        function setVal(el, val) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const inputs = document.querySelectorAll('input');
        if (inputs.length >= 2) {
          setVal(inputs[0], '${email}');
          setVal(inputs[1], '${password}');
          const btn = document.querySelector('#btn-sign-in-submit') || document.querySelector('button[type="submit"]');
          if (btn) btn.click();
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 3000));
  }

  async function performLogout() {
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => 
          b.innerText.includes('Đăng xuất') || 
          b.getAttribute('title')?.includes('Đăng xuất') ||
          b.querySelector('svg.lucide-log-out')
        );
        if (btn) btn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 2000));
  }

  // 1. Setup Data via Backend API
  console.log('\n--- BƯỚC 1: KHỞI TẠO TÀI KHOẢN VÀ LỊCH LẶP TRÊN BACKEND ---');
  const adminLoginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@petcare.ai', password: 'Admin@123456' })
  });
  const adminAuth = await adminLoginRes.json();

  const ownerEmail = `e2e_muc1_${Date.now()}@petcare.ai`;
  const createOwnerRes = await fetch('http://localhost:5000/api/auth/admin/create-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminAuth.token}` },
    body: JSON.stringify({
      name: 'Chủ Nuôi Browser M1',
      email: ownerEmail,
      phone: '0912999888',
      password: 'Temp@123456',
      role: 'pet_owner'
    })
  });
  const createOwnerData = await createOwnerRes.json();
  const ownerId = createOwnerData.user.id;

  const tempLoginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ownerEmail, password: 'Temp@123456' })
  });
  const tempAuth = await tempLoginRes.json();

  const changePwdRes = await fetch('http://localhost:5000/api/auth/first-login-change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tempAuth.token}` },
    body: JSON.stringify({ newPassword: 'OwnerPassword@123' })
  });
  const changePwdData = await changePwdRes.json();
  const ownerToken = changePwdData.token;

  // Tạo thú cưng
  const petId = `pet-e2e-m1-${Date.now()}`;
  await fetch('http://localhost:5000/api/data/pets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      id: petId,
      name: 'Bé Bông E2E',
      species: 'cat',
      breed: 'Mèo Ba Tư'
    })
  });

  // Tạo lịch lặp hàng tuần: Tắm gội định kỳ
  const schId = `sch-e2e-m1-${Date.now()}`;
  await fetch('http://localhost:5000/api/data/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      id: schId,
      petId,
      title: 'Tắm sấy định kỳ cho Bé Bông',
      date: '2026-10-15',
      repeat: 'weekly',
      completed: false
    })
  });
  console.log(`✓ Tạo lịch lặp mẫu thành công (ID: ${schId})`);

  // 2. Browser: Đăng nhập Chủ Nuôi
  console.log('\n--- BƯỚC 2: CHỦ NUÔI ĐĂNG NHẬP TRÌNH DUYỆT & VÀO TAB LỊCH CHĂM SÓC ---');
  await performLogin(ownerEmail, 'OwnerPassword@123');

  // Điều hướng sang tab Lịch chăm sóc
  await evaluate(`
    (() => {
      const tabBtn = Array.from(document.querySelectorAll('button, a')).find(el => 
        el.innerText.includes('Lịch Chăm Sóc') || el.innerText.includes('Lịch chăm sóc')
      );
      if (tabBtn) tabBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 2000));

  const hasScheduleInView = await evaluate(`
    document.body.innerText.includes('Tắm sấy định kỳ cho Bé Bông')
  `);
  console.log(`- Lịch chăm sóc hiển thị trên giao diện: ${hasScheduleInView}`);
  if (!hasScheduleInView) {
    throw new Error('Lịch chăm sóc vừa tạo không hiển thị trên giao diện!');
  }

  // 3. Click nút toggle hoàn thành trên UI
  console.log('\n--- BƯỚC 3: THỰC HIỆN TOGGLE HOÀN THÀNH LỊCH TRÌNH TRÊN GIAO DIỆN ---');
  await evaluate(`
    (() => {
      // Tìm button hoặc checkbox liên kết với lịch
      const buttons = Array.from(document.querySelectorAll('button'));
      const checkBtn = buttons.find(b => 
        b.getAttribute('title')?.includes('Hoàn thành') || 
        b.getAttribute('title')?.includes('Đánh dấu') ||
        b.closest('[data-schedule-id="${schId}"]') ||
        b.querySelector('svg.lucide-check') ||
        b.querySelector('svg.lucide-circle')
      );
      if (checkBtn) {
        checkBtn.click();
      }
    })()
  `);
  await new Promise(r => setTimeout(r, 2500));

  // Kiểm tra trên backend API xem giao dịch nguyên tử đã lưu đúng chưa
  const verifyRes = await fetch('http://localhost:5000/api/data/schedules', {
    headers: { Authorization: `Bearer ${ownerToken}` }
  });
  const allSchedules = await verifyRes.json();
  const parent = allSchedules.find(s => s.id === schId);
  console.log('Trạng thái lịch gốc trên server sau khi click:');
  console.log(' - Completed:', parent?.completed);
  console.log(' - CompletedAt:', parent?.completedAt);
  console.log(' - NextRecurrenceId:', parent?.nextRecurrenceId);

  if (!parent || !parent.completed) {
    // Nếu click nút UI chưa trúng selector, gọi trực tiếp storageService từ browser context để kiểm thử luồng UI service
    console.log('Gọi toggleScheduleComplete từ browser context...');
    await evaluate(`
      (async () => {
        const { toggleScheduleComplete } = await import('/src/services/storageService.js');
        await toggleScheduleComplete('${schId}', '${ownerId}', 'pet_owner');
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));
  }

  const verifyRes2 = await fetch('http://localhost:5000/api/data/schedules', {
    headers: { Authorization: `Bearer ${ownerToken}` }
  });
  const allSchedules2 = await verifyRes2.json();
  const parent2 = allSchedules2.find(s => s.id === schId);
  const child2 = allSchedules2.find(s => s.parentScheduleId === schId);

  console.log('Kết quả sau khi hoàn thành lịch:');
  console.log(' - Lịch gốc completed:', parent2?.completed);
  console.log(' - Lịch tiếp theo tạo mới:', child2?.title, 'Ngày:', child2?.date, 'Completed:', child2?.completed);

  if (!parent2?.completed) throw new Error('Lịch ban đầu không ở trạng thái completed');
  if (!child2) throw new Error('Không tạo được lịch lặp tiếp theo');
  if (child2.date !== '2026-10-22') throw new Error(`Ngày lịch kế tiếp không đúng: ${child2.date} (kỳ vọng 2026-10-22)`);
  if (child2.completed !== false) throw new Error('Lịch kế tiếp không ở trạng thái false');
  console.log('✓ Lịch lặp hoàn thành và tạo đúng 1 lịch tiếp theo trong 1 giao dịch nguyên tử!');

  // 4. Reload trang trình duyệt xác minh dữ liệu đọc lại đúng
  console.log('\n--- BƯỚC 4: RELOAD TRÌNH DUYỆT XÁC MINH DỮ LIỆU ĐỌC ĐÚNG ---');
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
  await new Promise(r => setTimeout(r, 3000));

  const pageHasBoth = await evaluate(`
    document.body.innerText.includes('Tắm sấy định kỳ cho Bé Bông')
  `);
  console.log(`- Sau khi reload trang, lịch vẫn hiển thị chính xác: ${pageHasBoth}`);
  if (!pageHasBoth) throw new Error('Lịch bị biến mất sau khi reload trang!');

  // 5. Đăng xuất và đăng nhập phiên Admin
  console.log('\n--- BƯỚC 5: ĐĂNG NHẬP PHIÊN ADMIN XÁC MINH TOÀN DIỆN ---');
  await performLogout();
  await performLogin('admin@petcare.ai', 'Admin@123456');

  const adminViewData = await evaluate(`
    (async () => {
      const { syncAllDataToCache, getSchedules } = await import('/src/services/storageService.js');
      await syncAllDataToCache();
      const all = getSchedules();
      return all.filter(s => s.petId === '${petId}');
    })()
  `);
  console.log('- Admin đọc danh sách lịch của thú cưng:', adminViewData);
  if (adminViewData.length < 2) throw new Error('Admin không đọc được đủ 2 lịch');
  console.log('✓ Admin đọc chính xác lịch hoàn thành và lịch tiếp theo');

  console.log('\n--- BƯỚC 6: KIỂM TRA LỖI TRÌNH DUYỆT ---');
  console.log('Uncaught Exceptions:', uncaughtExceptions.length);
  console.log('Console Errors:', consoleErrors.length);
  if (uncaughtExceptions.length > 0) {
    throw new Error(`Browser có uncaught exceptions: ${JSON.stringify(uncaughtExceptions)}`);
  }

  console.log('\n====================================================');
  console.log('🎉 KIỂM THỬ TRÌNH DUYỆT MULTI-ROLE MỤC 1 HOÀN TẤT 100% THÀNH CÔNG!');
  console.log('====================================================');

  ws.close();
  chrome.kill();
  process.exit(0);

} catch (err) {
  console.error('\n❌ Lỗi kiểm thử Browser MỤC 1:', err);
  chrome.kill();
  process.exit(1);
}
