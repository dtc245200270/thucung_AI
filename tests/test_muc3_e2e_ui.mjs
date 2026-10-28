import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import assert from 'assert';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_FRONTEND = 'http://127.0.0.1:5173';
const BASE_BACKEND = 'http://127.0.0.1:5000/api';

const VET_PORT = 9590;
const OWNER_PORT = 9591;
const VET_PROFILE = path.resolve('tests/.profile_vet_m3');
const OWNER_PROFILE = path.resolve('tests/.profile_owner_m3');

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

cleanDanglingPorts([VET_PORT, OWNER_PORT]);
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
  console.log('🧪 BẮT ĐẦU E2E UI MỤC 3: KÊ ĐƠN THUỐC, CHỐT VÀ XEM TRÊN 2 PROFILE');
  console.log('================================================================');

  // 1. Chuẩn bị tài khoản và dữ liệu
  const adminLogin = await fetch(`${BASE_BACKEND}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@petcare.ai', password: 'Admin@123456' })
  });
  const adminData = await adminLogin.json();
  const adminToken = adminData.token;

  const doctorLogin = await fetch(`${BASE_BACKEND}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tester@petcare.ai', password: 'Doctor@123' })
  });
  const doctorData = await doctorLogin.json();
  const doctorId = doctorData.user.id;

  const ownerEmail = `owner_m3_e2e_${Date.now()}@petcare.ai`;
  const ownerPassword = 'OwnerM3@123456';
  await fetch(`${BASE_BACKEND}/auth/admin/create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'Chủ Nuôi E2E Mục 3',
      email: ownerEmail,
      phone: '0988776655',
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
  const changePwData = await changePwRes.json();
  const ownerToken = changePwData.token;

  // Tạo Pet và phân công Bác sĩ
  const petId = `pet-m3-e2e-${Date.now()}`;
  const petName = `Bé Miu M3 ${Date.now().toString().slice(-4)}`;
  await fetch(`${BASE_BACKEND}/data/pets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      id: petId,
      name: petName,
      species: 'cat',
      breed: 'Mèo Anh Lông Dài',
      age: 2,
      weight: 3.8
    })
  });

  await fetch(`${BASE_BACKEND}/data/pets/${petId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      assignedVetId: doctorId
    })
  });

  // Tạo Lịch khám vào ngày hôm nay để xuất hiện ngay trong hàng đợi bác sĩ
  const todayStr = new Date().toISOString().split('T')[0];
  const appId = `app-m3-e2e-${Date.now()}`;
  for (let attempt = 0; attempt < 10; attempt++) {
    const randomHour = String(Math.floor(Math.random() * 12) + 8).padStart(2, '0');
    const randomMin = String(Math.floor(Math.random() * 50) + 10).padStart(2, '0');
    const slotTime = `${randomHour}:${randomMin}`;
    const appPostRes = await fetch(`${BASE_BACKEND}/data/appointments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: appId,
        petId: petId,
        petName: petName,
        assignedVetId: doctorId,
        vetId: doctorId,
        ownerId: ownerTempData.user.id,
        date: todayStr,
        time: slotTime,
        service: 'Khám hô hấp & Kê đơn thuốc E2E',
        status: 'confirmed'
      })
    });
    if (appPostRes.status === 200) {
      console.log(`✓ Đã chuẩn bị ca khám ${appId} cho ${petName} vào lúc ${slotTime}`);
      break;
    }
  }

  // --------------------------------------------------------------------------
  // BƯỚC 1: BÁC SĨ MỞ KHÁM, NHẬP THUỐC VÀO FORM THẬT, BẤM NÚT CHỐT THẬT
  // --------------------------------------------------------------------------
  console.log('\n--- BƯỚC 1: BÁC SĨ NHẬP ĐƠN THUỐC TRÊN FORM THẬT (PROFILE VET) ---');
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

  // Đợi trang nạp
  for (let i = 0; i < 20; i++) {
    const ready = await vetCdp.evaluate(`Boolean(document.querySelector('input'))`);
    if (ready) break;
    await new Promise(r => setTimeout(r, 500));
  }

  // Điền form đăng nhập bác sĩ
  console.log('-> Bác sĩ nhập tài khoản và mật khẩu trên form...');
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

  // Chọn bộ lọc "Tất cả"
  await vetCdp.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const allDateBtn = buttons.find(b => b.textContent.trim() === 'Tất cả');
      if (allDateBtn) allDateBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 1500));

  // Mở ca khám SOAP
  console.log('-> Bác sĩ tìm ca khám ' + appId + ' và bấm mở khám...');
  const clickedStart = await vetCdp.evaluate(`
    (() => {
      const rowsAndCards = Array.from(document.querySelectorAll('tr, .backdrop-blur-2xl, .p-5, .p-6, div')).filter(el => 
        el.innerText && el.innerText.includes('${appId}')
      );
      for (const container of rowsAndCards) {
        const btn = Array.from(container.querySelectorAll('button')).find(b => 
          b.textContent.includes('Bệnh án SOAP') || b.textContent.includes('Mở Khám SOAP') || b.textContent.includes('Tiếp nhận ca')
        );
        if (btn) {
          btn.click();
          return 'clicked for ${appId}: ' + btn.textContent.trim();
        }
      }
      const petContainers = Array.from(document.querySelectorAll('tr, div')).filter(el => 
        el.innerText && el.innerText.includes('${petName}')
      );
      for (const container of petContainers) {
        const btn = Array.from(container.querySelectorAll('button')).find(b => 
          b.textContent.includes('Bệnh án SOAP') || b.textContent.includes('Mở Khám SOAP') || b.textContent.includes('Tiếp nhận ca')
        );
        if (btn) {
          btn.click();
          return 'clicked for ${petName}: ' + btn.textContent.trim();
        }
      }
      return 'not found';
    })()
  `);
  console.log('✓ Kết quả click ca khám:', clickedStart);
  assert.notStrictEqual(clickedStart, 'not found', 'Phải tìm thấy ca khám trên giao diện');
  await new Promise(r => setTimeout(r, 2500));

  // Nhập Subjective & Assessment trên form thật
  console.log('-> Bác sĩ nhập triệu chứng và chẩn đoán...');
  await vetCdp.evaluate(`
    (() => {
      function setFieldVal(el, val) {
        const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const textarea = document.querySelector('textarea');
      if (textarea) setFieldVal(textarea, 'Mèo Miu ho khò khè, sốt 39.5C, mệt mỏi');

      const inputs = Array.from(document.querySelectorAll('input'));
      const assessInput = inputs.find(i => i.placeholder?.includes('Chẩn đoán') || i.className?.includes('font-medium')) || inputs[inputs.length - 1];
      if (assessInput) setFieldVal(assessInput, 'Viêm phế quản phổi nhiễm khuẩn');
    })()
  `);

  // Bác sĩ bấm nút "+ Thêm thuốc" trên form thật
  console.log('-> Bác sĩ bấm nút "+ Thêm thuốc" trên giao diện...');
  const addMedBtnClicked = await vetCdp.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const addBtn = buttons.find(b => b.textContent.includes('+ Thêm thuốc') || b.textContent.includes('Thêm thuốc'));
      if (addBtn) {
        addBtn.click();
        return true;
      }
      return false;
    })()
  `);
  assert(addMedBtnClicked, 'Phải tìm thấy và click được nút "+ Thêm thuốc"');
  await new Promise(r => setTimeout(r, 800));

  // Bác sĩ nhập thông tin thuốc vào các input thật vừa xuất hiện
  console.log('-> Bác sĩ nhập chi tiết thuốc (Tên, liều dùng, đường dùng, tần suất, số ngày, hướng dẫn)...');
  const medEntered = await vetCdp.evaluate(`
    (() => {
      function setInput(placeholderText, val) {
        const inputs = Array.from(document.querySelectorAll('input'));
        const target = inputs.find(i => i.placeholder?.toLowerCase().includes(placeholderText.toLowerCase()));
        if (target) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(target, val);
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
      }

      const hasName = setInput('Tên thuốc', 'Clavamox 62.5mg');
      const hasDose = setInput('Liều dùng', '1 viên/lần');
      const hasRoute = setInput('Đường dùng', 'Uống');
      const hasFreq = setInput('Tần suất', '2 lần/ngày');
      const hasDays = setInput('Số ngày', '7');
      const hasInstruct = setInput('Hướng dẫn thêm', 'Uống sau khi ăn 15 phút');

      return { hasName, hasDose, hasRoute, hasFreq, hasDays, hasInstruct };
    })()
  `);
  console.log('✓ Chi tiết thuốc đã điền:', medEntered);
  assert(medEntered.hasName, 'Phải điền được input Tên thuốc');
  assert(medEntered.hasDose, 'Phải điền được input Liều dùng');

  // Xác nhận đọc dị ứng nếu có
  await vetCdp.evaluate(`
    (() => {
      const ackBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Xác nhận đã đọc'));
      if (ackBtn) ackBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 500));

  // Xóa danh sách network requests để bắt đúng lúc chốt
  vetCdp.networkRequests.length = 0;

  // Bác sĩ bấm nút "Xác nhận chốt bệnh án"
  console.log('-> Bác sĩ bấm nút "Xác nhận chốt bệnh án" trên thanh thao tác...');
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

  // Kiểm tra network request: Đúng 1 request finalize, KHÔNG CÓ request lẻ
  const mutatingReqs = vetCdp.networkRequests.filter(r => r.method === 'POST' || r.method === 'PUT');
  const finalizeReqs = mutatingReqs.filter(r => r.url.includes('/finalize-ehr'));
  const separatePresMutates = mutatingReqs.filter(r => r.url.includes('/prescriptions') && !r.url.includes('/finalize-ehr'));

  console.log('\n--- KẾT QUẢ KIỂM TRA MẠNG CDP (BÁC SĨ KÊ ĐƠN) ---');
  console.log(`- Request finalize: ${finalizeReqs.length}`);
  console.log(`- Request lưu lẻ /prescriptions: ${separatePresMutates.length}`);

  assert.strictEqual(finalizeReqs.length, 1, 'BẮT BUỘC có đúng 1 request finalize!');
  assert.strictEqual(separatePresMutates.length, 0, 'KHÔNG ĐƯỢC có request tạo/sửa /prescriptions riêng rẽ!');
  console.log('✅ XÁC NHẬN: Bệnh án và đơn thuốc chốt thành công trong duy nhất 1 giao dịch!');

  vetCdp.close();
  killProcessTree(chromeVet);

  // --------------------------------------------------------------------------
  // BƯỚC 2: NGƯỜI NUÔI ĐĂNG NHẬP, MỞ ĐƠN THUỐC VÀ ĐỌC NỘI DUNG SAU KHI RELOAD
  // --------------------------------------------------------------------------
  console.log('\n--- BƯỚC 2: CHỦ NUÔI ĐĂNG NHẬP VÀ ĐỌC ĐƠN THUỐC (PROFILE OWNER) ---');
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

  // Mở tab Y Tế & Sổ Tiêm
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

  // Mở tab Đơn Thuốc Điều Trị
  console.log('-> Người nuôi mở tab "Đơn Thuốc Điều Trị"...');
  const presTabRes = await ownerCdp.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const presTab = buttons.find(b => b.textContent.includes('Đơn Thuốc') || b.textContent.includes('Đơn thuốc'));
      if (presTab) {
        presTab.click();
        return 'clicked: ' + presTab.textContent.trim();
      }
      return 'not found among: ' + buttons.map(b => b.textContent.trim().slice(0, 30)).join(' | ');
    })()
  `);
  console.log('✓ Kết quả click tab Đơn thuốc:', presTabRes);
  await new Promise(r => setTimeout(r, 2000));

  // Đọc DOM đơn thuốc lần 1
  console.log('-> Người nuôi đọc thông tin đơn thuốc từ DOM...');
  const ownerDom1 = await ownerCdp.evaluate(`
    (() => {
      const text = document.body.innerText;
      return {
        hasDrugName: text.includes('Clavamox 62.5mg'),
        hasDose: text.includes('1 viên/lần') || text.includes('1 viên'),
        hasFreq: text.includes('2 lần/ngày'),
        hasDays: text.includes('7'),
        hasInstruction: text.includes('Uống sau khi ăn 15 phút')
      };
    })()
  `);
  console.log('✓ Kết quả DOM Người nuôi lần 1:', ownerDom1);
  assert(ownerDom1.hasDrugName, 'DOM Người nuôi PHẢI có tên thuốc "Clavamox 62.5mg"');
  assert(ownerDom1.hasDose, 'DOM Người nuôi PHẢI có liều dùng "1 viên/lần"');

  // --------------------------------------------------------------------------
  // BƯỚC 3: NGƯỜI NUÔI RELOAD TRANG VÀ XÁC MINH LẠI ĐƠN THUỐC
  // --------------------------------------------------------------------------
  console.log('\n--- BƯỚC 3: NGƯỜI NUÔI RELOAD TRANG VÀ KIỂM TRA ĐƠN THUỐC VẪN TOÀN VẸN ---');
  await ownerCdp.send('Page.reload');
  await new Promise(r => setTimeout(r, 4500));

  // Sau khi reload, mở lại tab Y Tế & Sổ Tiêm -> Đơn thuốc
  console.log('-> Mở lại tab Y Tế & Sổ Tiêm sau reload...');
  await ownerCdp.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const medBtn = buttons.find(b => b.id === 'medical' || b.textContent.includes('Y Tế & Sổ Tiêm') || b.textContent.includes('Y Tế'));
      if (medBtn) medBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 2500));

  console.log('-> Mở lại tab Đơn thuốc sau reload...');
  await ownerCdp.evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const presTab = buttons.find(b => b.textContent.includes('Đơn Thuốc') || b.textContent.includes('Đơn thuốc'));
      if (presTab) presTab.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 2000));

  const ownerDom2 = await ownerCdp.evaluate(`
    (() => {
      const text = document.body.innerText;
      return {
        hasDrugName: text.includes('Clavamox 62.5mg'),
        hasDose: text.includes('1 viên/lần') || text.includes('1 viên'),
        hasFreq: text.includes('2 lần/ngày'),
        hasDays: text.includes('7'),
        hasInstruction: text.includes('Uống sau khi ăn 15 phút')
      };
    })()
  `);
  console.log('✓ Kết quả DOM Người nuôi sau reload:', ownerDom2);
  assert(ownerDom2.hasDrugName, 'DOM Người nuôi sau reload PHẢI còn nguyên tên thuốc "Clavamox 62.5mg"');
  assert(ownerDom2.hasDose, 'DOM Người nuôi sau reload PHẢI còn nguyên liều dùng');

  console.log('\n================================================================');
  console.log('🎉 E2E UI MỤC 3 HOÀN TẤT VÀ THÀNH CÔNG 100%!');
  console.log('================================================================');

  ownerCdp.close();
  killProcessTree(chromeOwner);
}

run().catch(err => {
  console.error('\n❌ E2E UI MỤC 3 THẤT BẠI:', err);
  cleanDanglingPorts([VET_PORT, OWNER_PORT]);
  process.exit(1);
});
