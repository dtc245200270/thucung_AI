import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import assert from 'assert';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_FRONTEND = 'http://127.0.0.1:5173';
const BASE_BACKEND = 'http://127.0.0.1:5000/api';

const VET_PORT = 9586;
const OWNER_PORT = 9587;
const VET_PROFILE = path.resolve('scratch/profile_vet_test');
const OWNER_PROFILE = path.resolve('scratch/profile_owner_test');

try { fs.rmSync(VET_PROFILE, { recursive: true, force: true }); } catch {}
try { fs.rmSync(OWNER_PROFILE, { recursive: true, force: true }); } catch {}

async function connectCdp(debugPort) {
  const versionRes = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
  await versionRes.json();

  const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
  const listData = await listRes.json();
  const pageTarget = listData.find(t => t.type === 'page' && !t.url.startsWith('chrome-extension')) || listData[0];

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let idCounter = 1;
  const callbacks = new Map();
  const networkRequests = [];
  const consoleErrors = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg.result !== undefined ? msg.result : msg);
      callbacks.delete(msg.id);
    }
    if (msg.method === 'Network.requestWillBeSent') {
      networkRequests.push({
        url: msg.params.request.url,
        method: msg.params.request.method,
        postData: msg.params.request.postData
      });
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = msg.params.args.map(a => a.value ?? a.description ?? JSON.stringify(a)).join(' ');
      if (msg.params.type === 'error') {
        consoleErrors.push(args);
      }
    }
    if (msg.method === 'Page.javascriptDialogOpening') {
      console.log('AUTO-ACCEPTING DIALOG:', msg.params.message);
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
    networkRequests,
    consoleErrors,
    close: () => ws.close()
  };
}

async function run() {
  console.log('================================================================');
  console.log('🧪 BẮT ĐẦU THỬ NGHIỆM E2E UI VỚI 2 PROFILE ĐỘC LẬP');
  console.log('================================================================');

  // 1. Chuẩn bị dữ liệu backend
  const adminLogin = await fetch(`${BASE_BACKEND}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@petcare.ai', password: 'Admin@123456' })
  }).then(r => r.json());
  const adminToken = adminLogin.token;

  const vetLogin = await fetch(`${BASE_BACKEND}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tester@petcare.ai', password: 'Doctor@123' })
  }).then(r => r.json());
  const vetId = vetLogin.user.id;

  const ownerEmail = `owner_e2e_real_${Date.now()}@petcare.ai`;
  const ownerPassword = 'Owner@123456_Valid';
  await fetch(`${BASE_BACKEND}/auth/admin/create-user`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Trần Văn Chủ Nuôi E2E Thật',
      email: ownerEmail,
      phone: '0912345678',
      password: 'Temp@123456',
      role: 'pet_owner'
    })
  });
  const tempAuth = await fetch(`${BASE_BACKEND}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ownerEmail, password: 'Temp@123456' })
  }).then(r => r.json());
  await fetch(`${BASE_BACKEND}/auth/first-login-change-password`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tempAuth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword: ownerPassword })
  });

  const petId = `pet-ui-${Date.now()}`;
  const petRes = await fetch(`${BASE_BACKEND}/data/pets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: petId,
      name: 'Bé Miu E2E Real',
      species: 'Cat',
      breed: 'Anh Lông Ngắn',
      weight: 4.5,
      ownerId: tempAuth.user.id,
      assignedVetId: vetId
    })
  }).then(r => r.json());
  const petObj = petRes.data || petRes;

  const todayStr = new Date().toISOString().split('T')[0];
  const appId = `app-ui-${Date.now()}`;
  let appPostJson = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const randomHour = String(Math.floor(Math.random() * 12) + 8).padStart(2, '0');
    const randomMin = String(Math.floor(Math.random() * 50) + 10).padStart(2, '0');
    const slotTime = `${randomHour}:${randomMin}`;
    const appPostRes = await fetch(`${BASE_BACKEND}/data/appointments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: appId,
        petId: petObj.id,
        petName: petObj.name,
        assignedVetId: vetId,
        vetId: vetId,
        ownerId: tempAuth.user.id,
        date: todayStr,
        time: slotTime,
        service: 'Khám chuyên khoa hô hấp E2E',
        status: 'in_progress',
        note: 'Miu sốt 39.8 độ và ho khẹc'
      })
    });
    appPostJson = await appPostRes.json();
    if (appPostJson.success) {
      console.log(`✓ Đã chuẩn bị ca khám ${appId} cho ${petObj.name} vào lúc ${slotTime}:`, appPostJson.data?.id);
      break;
    }
  }
  assert(appPostJson?.success, 'Phải tạo thành công ca khám test trên backend: ' + JSON.stringify(appPostJson));

  // 2. Browser Bác sĩ (Context A)
  console.log('\n--- BƯỚC 2: BÁC SĨ THAO TÁC TRÊN GIAO DIỆN THẬT ---');
  const chromeVet = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${VET_PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    `--user-data-dir=${VET_PROFILE}`,
    `${BASE_FRONTEND}/login`
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const vetCdp = await connectCdp(VET_PORT);

  // Đợi form login mount
  for (let i = 0; i < 20; i++) {
    const ready = await vetCdp.evaluate(`Boolean(document.querySelector('input'))`);
    if (ready) break;
    await new Promise(r => setTimeout(r, 500));
  }

  // Điền form đăng nhập
  console.log('-> Bác sĩ nhập tài khoản và mật khẩu...');
  await vetCdp.evaluate(`
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
      setVal(emailInput, 'tester@petcare.ai');
      setVal(passwordInput, 'Doctor@123');
      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Đăng Nhập Vào Hệ Thống')) || document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    })()
  `);

  await new Promise(r => setTimeout(r, 4500));
  console.log('✓ Bác sĩ đã vào hệ thống');

  // Đợi queue nạp dữ liệu
  await new Promise(r => setTimeout(r, 3000));

  const debugDoctorState = await vetCdp.evaluate(`
    (() => ({
      url: window.location.href,
      currentPortal: localStorage.getItem('petcare_current_portal'),
      currentUser: localStorage.getItem('petcare_current_user'),
      appointmentsRaw: localStorage.getItem('petcare_appointments_v1'),
      bodySnippet: document.body.innerText.slice(0, 1500)
    }))()
  `);
  console.log('DEBUG DOCTOR STATE:', debugDoctorState);

  // Bác sĩ click nút "Tất cả" trên bộ lọc ngày để hiện tất cả ca khám
  console.log('-> Bác sĩ chọn bộ lọc "Tất cả" để xem danh sách ca khám...');
  await vetCdp.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const allDateBtn = buttons.find(b => b.textContent.trim() === 'Tất cả');
      if (allDateBtn) allDateBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 1000));

  // Tìm ca khám theo mã ca (appId) để mở đúng ca khám của lượt kiểm thử này
  console.log('-> Bác sĩ tìm đúng ca khám ' + appId + ' và bấm mở khám...');
  const clickedStart = await vetCdp.evaluate(`
    (() => {
      // Tìm container chứa mã ca khám appId
      const rowsAndCards = Array.from(document.querySelectorAll('tr, .backdrop-blur-2xl, .p-5, .p-6, div')).filter(el => 
        el.innerText && el.innerText.includes('${appId}')
      );
      for (const container of rowsAndCards) {
        const btn = Array.from(container.querySelectorAll('button')).find(b => 
          b.textContent.includes('Bệnh án SOAP') || b.textContent.includes('Mở Khám SOAP')
        );
        if (btn) {
          btn.click();
          return 'clicked for ${appId}: ' + btn.textContent.trim();
        }
      }
      // Fallback: tìm theo tên pet
      const petContainers = Array.from(document.querySelectorAll('tr, div')).filter(el => 
        el.innerText && el.innerText.includes('${petObj.name}')
      );
      for (const container of petContainers) {
        const btn = Array.from(container.querySelectorAll('button')).find(b => 
          b.textContent.includes('Bệnh án SOAP') || b.textContent.includes('Mở Khám SOAP')
        );
        if (btn) {
          btn.click();
          return 'clicked for ${petObj.name}: ' + btn.textContent.trim();
        }
      }
      return 'not found';
    })()
  `);
  console.log('✓ Kết quả click ca khám:', clickedStart);
  assert.notStrictEqual(clickedStart, 'not found', 'Phải tìm thấy ca khám trên giao diện để mở khám');
  await new Promise(r => setTimeout(r, 2500));

  const pageSnapshot = await vetCdp.evaluate(`
    (() => ({
      activeTab: Array.from(document.querySelectorAll('button')).find(b => b.className.includes('bg-cyan-500'))?.textContent?.trim(),
      textareas: document.querySelectorAll('textarea').length,
      bodyText: document.body.innerText.slice(0, 800)
    }))()
  `);
  console.log('PAGE SNAPSHOT AFTER CLICK:', pageSnapshot);

  // Nhập nội dung SOAP trên form thật
  console.log('-> Bác sĩ nhập nội dung SOAP trên form thật...');
  const entered = await vetCdp.evaluate(`
    (() => {
      function setFieldVal(el, val) {
        const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // S - Subjective
      const textarea = document.querySelector('textarea');
      if (textarea) {
        setFieldVal(textarea, 'Chó Miu bị sốt 39.8C, ho khẹc liên tục 3 ngày');
      }

      // A - Assessment
      const inputs = Array.from(document.querySelectorAll('input'));
      const assessInput = inputs.find(i => i.placeholder?.includes('Chẩn đoán') || i.className?.includes('font-medium')) || inputs[inputs.length - 1];
      if (assessInput) {
        setFieldVal(assessInput, 'Viêm phế quản truyền nhiễm (Kennel Cough) bội nhiễm');
      }

      return {
        hasTextarea: Boolean(textarea),
        hasAssess: Boolean(assessInput)
      };
    })()
  `);
  console.log('✓ Bác sĩ đã nhập nội dung SOAP:', entered);
  assert(entered.hasTextarea, 'Phải tìm thấy ô nhập Subjective (textarea)');

  // Bác sĩ xác nhận đọc dị ứng (nếu có)
  await vetCdp.evaluate(`
    (() => {
      const ackBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Xác nhận đã đọc'));
      if (ackBtn) ackBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 500));

  // Xóa danh sách network requests để ghi nhận chính xác lúc bấm Chốt bệnh án
  vetCdp.networkRequests.length = 0;

  // Bấm nút "Xác nhận chốt bệnh án" trên giao diện
  console.log('-> Bác sĩ bấm nút "Xác nhận chốt bệnh án" trên giao diện...');
  const openModal = await vetCdp.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.trim().includes('Xác nhận chốt bệnh án') && !b.textContent.includes('Hoàn tất'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    })()
  `);
  assert(openModal, 'Phải click được nút Xác nhận chốt bệnh án');
  await new Promise(r => setTimeout(r, 1200));

  // Trong modal xác nhận, bấm "Xác nhận chốt bệnh án & Hoàn tất ca khám"
  console.log('-> Trong modal, Bác sĩ bấm "Xác nhận chốt bệnh án & Hoàn tất ca khám"...');
  const confirmSignOff = await vetCdp.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const confirmBtn = buttons.find(b => b.textContent.includes('Xác nhận chốt bệnh án & Hoàn tất') || b.textContent.includes('Hoàn tất ca khám'));
      if (confirmBtn) {
        confirmBtn.click();
        return true;
      }
      return false;
    })()
  `);
  assert(confirmSignOff, 'Phải click được nút xác nhận trong modal');

  // Chờ hoàn tất và backend commit
  await new Promise(r => setTimeout(r, 4500));

  // Kiểm tra chỉ có ĐÚNG 1 request finalize, KHÔNG CÓ request lưu rời rạc
  const mutatingReqs = vetCdp.networkRequests.filter(r => r.method === 'POST' || r.method === 'PUT');
  const finalizeReqs = mutatingReqs.filter(r => r.url.includes('/finalize-ehr'));
  const separateAppPuts = mutatingReqs.filter(r => r.url.includes('/appointments') && !r.url.includes('/finalize-ehr'));
  const separateMedMutates = mutatingReqs.filter(r => r.url.includes('/medical_records') && !r.url.includes('/finalize-ehr'));

  console.log('\n--- KẾT QUẢ KIỂM TRA MẠNG CDP (BÁC SĨ) ---');
  console.log(`- Request finalize: ${finalizeReqs.length}`);
  console.log(`- Request lưu riêng rẽ /appointments: ${separateAppPuts.length}`);
  console.log(`- Request lưu riêng rẽ /medical_records: ${separateMedMutates.length}`);

  assert.strictEqual(finalizeReqs.length, 1, 'BẮT BUỘC có đúng 1 request finalize!');
  assert.strictEqual(separateAppPuts.length, 0, 'KHÔNG ĐƯỢC có request PUT /appointments riêng rẽ!');
  assert.strictEqual(separateMedMutates.length, 0, 'KHÔNG ĐƯỢC có request riêng rẽ lưu medical_records!');
  console.log('✅ XÁC NHẬN: Duy nhất 1 request finalize nghiệp vụ nguyên tử, 0 request thừa!');

  vetCdp.close();
  chromeVet.kill();

  // 3. Browser Người nuôi (Context B)
  console.log('\n--- BƯỚC 3: NGƯỜI NUÔI VÀO XEM BỆNH ÁN (CONTEXT OWNER) ---');
  const chromeOwner = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${OWNER_PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    `--user-data-dir=${OWNER_PROFILE}`,
    `${BASE_FRONTEND}/login`
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const ownerCdp = await connectCdp(OWNER_PORT);

  for (let i = 0; i < 20; i++) {
    const ready = await ownerCdp.evaluate(`Boolean(document.querySelector('input'))`);
    if (ready) break;
    await new Promise(r => setTimeout(r, 500));
  }

  // Đăng nhập người nuôi qua form
  console.log('-> Người nuôi đăng nhập qua form giao diện...');
  await ownerCdp.evaluate(`
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

  // Người nuôi reload trang theo yêu cầu nghiệm thu
  console.log('-> Người nuôi reload trang...');
  await ownerCdp.send('Page.reload');
  await new Promise(r => setTimeout(r, 4000));

  // Mở tab Y Tế & Sổ Tiêm (id = 'medical')
  console.log('-> Người nuôi mở tab Y Tế & Sổ Tiêm...');
  const medClickRes = await ownerCdp.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const medBtn = buttons.find(b => b.id === 'medical' || b.textContent.includes('Y Tế & Sổ Tiêm') || b.textContent.includes('Y Tế'));
      if (medBtn) {
        medBtn.click();
        return 'clicked: ' + medBtn.textContent.trim();
      }
      return 'not found';
    })()
  `);
  console.log('✓ Kết quả click tab Y Tế:', medClickRes);
  await new Promise(r => setTimeout(r, 2500));

  // Mở sub-tab Bệnh án SOAP
  console.log('-> Người nuôi mở sub-tab Bệnh án SOAP...');
  const soapClickRes = await ownerCdp.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const soapTab = buttons.find(b => b.textContent.toLowerCase().includes('bệnh án') && b.textContent.includes('SOAP'));
      if (soapTab) {
        soapTab.click();
        return 'clicked: ' + soapTab.textContent.trim();
      }
      return 'not found among: ' + buttons.map(b => b.textContent.trim().slice(0, 30)).join(' | ');
    })()
  `);
  console.log('✓ Kết quả click tab SOAP Người nuôi:', soapClickRes);
  await new Promise(r => setTimeout(r, 2000));

  // Đọc nội dung trên DOM Người nuôi
  const ownerDom = await ownerCdp.evaluate(`
    (() => {
      const text = document.body.innerText;
      return {
        hasFinalBadge: text.includes('BỆNH ÁN ĐÃ CHỐT'),
        hasSubjective: text.includes('Chó Miu bị sốt 39.8C, ho khẹc liên tục 3 ngày'),
        hasAssessment: text.includes('Viêm phế quản truyền nhiễm (Kennel Cough) bội nhiễm'),
        snippet: text.slice(0, 1500)
      };
    })()
  `);

  console.log('✓ Kết quả đọc từ DOM Người nuôi:', {
    hasFinalBadge: ownerDom.hasFinalBadge,
    hasSubjective: ownerDom.hasSubjective,
    hasAssessment: ownerDom.hasAssessment,
    snippet: ownerDom.snippet
  });

  assert(ownerDom.hasFinalBadge, 'DOM Người nuôi PHẢI có badge "✓ BỆNH ÁN ĐÃ CHỐT"');
  assert(ownerDom.hasSubjective, 'DOM Người nuôi PHẢI hiển thị triệu chứng Bác sĩ vừa nhập');
  assert(ownerDom.hasAssessment, 'DOM Người nuôi PHẢI hiển thị chẩn đoán Bác sĩ vừa nhập');

  console.log('\n================================================================');
  console.log('🎉 TOÀN BỘ KIỂM THỬ UI E2E 2 PROFILE ĐÃ HOÀN TẤT VÀ THÀNH CÔNG 100%!');
  console.log('================================================================');

  ownerCdp.close();
  chromeOwner.kill();
}

run().catch(err => {
  console.error('\n❌ E2E TEST FAILED:', err);
  process.exit(1);
});
