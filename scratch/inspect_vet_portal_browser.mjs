import fs from 'fs';

async function run() {
  console.log('--- KHỞI TẠO KIỂM THỬ TRÌNH DUYỆT BÁC SĨ → LỊCH KHÁM ---');
  const listRes = await fetch('http://127.0.0.1:9222/json/list');
  const listData = await listRes.json();
  let targetPage = listData.find(t => t.type === 'page' && t.url.includes('5173')) || listData.find(t => t.type === 'page');

  if (!targetPage) {
    const newTab = await fetch('http://127.0.0.1:9222/json/new?http://localhost:5173');
    targetPage = await newTab.json();
  }

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

  await new Promise((resolve) => {
    ws.onopen = () => { resolve(); };
    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (callbacks.has(msg.id)) {
        const cb = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        cb(msg);
      }
    };
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');

  console.log('[1] Đăng nhập tài khoản Bác sĩ tester@petcare.ai...');
  // Lấy token thật từ API login
  const loginRes = await fetch('http://127.0.0.1:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tester@petcare.ai', password: 'Doctor@123' })
  });
  const loginData = await loginRes.json();
  const doctorToken = loginData.token;
  const doctorUser = loginData.user;

  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const user = ${JSON.stringify(doctorUser)};
        const token = ${JSON.stringify(doctorToken)};
        localStorage.setItem('pet_auth', JSON.stringify({ token, user }));
        localStorage.setItem('petcare_auth_token', token);
        localStorage.setItem('petcare_token', token);
        localStorage.setItem('petcare_active_user', JSON.stringify(user));
        localStorage.setItem('petcare_current_user', JSON.stringify(user));
        localStorage.setItem('petcare_current_portal', 'CLINIC');
        window.location.reload();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 2500));

  // Kiểm tra giao diện cổng Bác sĩ
  console.log('[2] Chuyển đến tab Lịch khám trong ClinicWorkspaceView...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        // Tìm button hoặc nav link có text "Lịch khám"
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const apptBtn = buttons.find(b => b.textContent.includes('Lịch khám'));
        if (apptBtn) apptBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 1500));

  // 1. Kiểm tra ngày Hôm nay (27/10/2026)
  console.log('[3] Kiểm tra lựa chọn Hôm nay (27/10/2026)...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const todayBtn = buttons.find(b => b.textContent.trim() === 'Hôm nay');
        if (todayBtn) todayBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 800));

  const todayState = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const headerBadge = document.querySelector('h2 span.font-mono')?.textContent.trim();
        const statusButtons = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('trạng thái') || b.textContent.includes('xác nhận') || b.textContent.includes('Đã hủy'));
        const statusBadges = statusButtons.map(b => b.textContent.trim().replace(/\\s+/g, ' '));
        const cards = document.querySelectorAll('.space-y-3 > div').length;
        return { headerBadge, statusBadges, cardsCount: cards };
      })()
    `,
    returnByValue: true
  });
  console.log('Trạng thái Hôm nay:', JSON.stringify(todayState.result?.result?.value, null, 2));

  const snapToday = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scratch/vet_appts_today_verified.png', Buffer.from(snapToday.result.data, 'base64'));

  // 2. Kiểm tra lựa chọn Ngày mai (28/10/2026)
  console.log('[4] Kiểm tra lựa chọn Ngày mai (28/10/2026)...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const tomorrowBtn = buttons.find(b => b.textContent.trim() === 'Ngày mai');
        if (tomorrowBtn) tomorrowBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 800));

  const tomorrowState = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const headerBadge = document.querySelector('h2 span.font-mono')?.textContent.trim();
        const statusButtons = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('trạng thái') || b.textContent.includes('xác nhận') || b.textContent.includes('Đã hủy'));
        const statusBadges = statusButtons.map(b => b.textContent.trim().replace(/\\s+/g, ' '));
        const cardTitles = Array.from(document.querySelectorAll('strong')).map(s => s.textContent.trim());
        return { headerBadge, statusBadges, cardTitles };
      })()
    `,
    returnByValue: true
  });
  console.log('Trạng thái Ngày mai (28/10):', JSON.stringify(tomorrowState.result?.result?.value, null, 2));

  const snapTomorrow = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scratch/vet_appts_tomorrow_verified.png', Buffer.from(snapTomorrow.result.data, 'base64'));

  // 3. Chọn ngày cụ thể 2026-10-29
  console.log('[5] Chọn ngày cụ thể 2026-10-29...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const dateInput = document.querySelector('input[type="date"]');
        if (dateInput) {
          dateInput.value = '2026-10-29';
          dateInput.dispatchEvent(new Event('input', { bubbles: true }));
          dateInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `
  });
  await new Promise(r => setTimeout(r, 800));

  const date29State = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const headerBadge = document.querySelector('h2 span.font-mono')?.textContent.trim();
        const statusButtons = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('trạng thái') || b.textContent.includes('xác nhận') || b.textContent.includes('Đã hủy'));
        const statusBadges = statusButtons.map(b => b.textContent.trim().replace(/\\s+/g, ' '));
        return { headerBadge, statusBadges };
      })()
    `,
    returnByValue: true
  });
  console.log('Trạng thái Ngày 29/10 (Tất cả trạng thái):', JSON.stringify(date29State.result?.result?.value, null, 2));

  // 4. Chọn tab "Đã hủy" ngày 2026-10-29
  console.log('[6] Chọn tab "Đã hủy" ngày 2026-10-29...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const cancelledBtn = buttons.find(b => b.textContent.includes('Đã hủy'));
        if (cancelledBtn) cancelledBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 800));

  const cancelled29State = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const headerBadge = document.querySelector('h2 span.font-mono')?.textContent.trim();
        const cardTexts = Array.from(document.querySelectorAll('.space-y-3 > div')).map(d => d.textContent.trim().replace(/\\s+/g, ' '));
        const actionButtons = Array.from(document.querySelectorAll('.space-y-3 button')).map(b => b.textContent.trim());
        return {
          headerBadge,
          cardTexts,
          actionButtons
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Trạng thái Ngày 29/10 (Tab Đã hủy):', JSON.stringify(cancelled29State.result?.result?.value, null, 2));

  const snapCancelled29 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scratch/vet_appts_cancelled29_verified.png', Buffer.from(snapCancelled29.result.data, 'base64'));

  // 5. Chọn "Tất cả ngày"
  console.log('[7] Chọn nút "Tất cả ngày"...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const allBtn = buttons.find(b => b.textContent.trim() === 'Tất cả ngày');
        if (allBtn) allBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 800));

  const allState = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const headerBadge = document.querySelector('h2 span.font-mono')?.textContent.trim();
        const dateInputVal = document.querySelector('input[type="date"]')?.value;
        const statusButtons = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('trạng thái') || b.textContent.includes('xác nhận') || b.textContent.includes('Đã hủy'));
        const statusBadges = statusButtons.map(b => b.textContent.trim().replace(/\\s+/g, ' '));
        return { headerBadge, dateInputVal, statusBadges };
      })()
    `,
    returnByValue: true
  });
  console.log('Trạng thái Tất cả ngày:', JSON.stringify(allState.result?.result?.value, null, 2));

  const snapAll = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scratch/vet_appts_all_verified.png', Buffer.from(snapAll.result.data, 'base64'));

  ws.close();
  console.log('--- HOÀN TẤT KIỂM THỬ TRÌNH DUYỆT THÀNH CÔNG ---');
}

run().catch(console.error);
