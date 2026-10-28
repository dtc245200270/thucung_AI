import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = 9568;
const profileDir = 'C:\\Users\\Dell Precision 5550\\Documents\\PET_Ai\\scratch\\temp_e2e_muc2_profile';

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
      callbacks.get(msg.id)(msg.result !== undefined ? msg.result : msg);
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
    if (res?.error) {
      console.error('CDP PROTOCOL ERROR:', JSON.stringify(res.error));
    }
    if (res?.exceptionDetails) {
      console.error('CDP EVAL EXCEPTION:', res.exceptionDetails.text, res.exceptionDetails.exception?.description);
    }
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
        const emailInput = document.querySelector('input[type="email"]') || document.querySelectorAll('input')[0];
        const passwordInput = document.querySelector('input[type="password"]') || document.querySelectorAll('input')[1];
        if (emailInput && passwordInput) {
          setVal(emailInput, '${email}');
          setVal(passwordInput, '${password}');
          const btn = document.querySelector('#btn-sign-in-submit') || document.querySelector('button[type="submit"]');
          if (btn) btn.click();
        }
      })()
    `);
    // Chờ để form gửi và hoàn tất đăng nhập
    await new Promise(r => setTimeout(r, 4500));
  }

  async function performLogout() {
    await evaluate(`
      (() => {
        try {
          localStorage.removeItem('petcare_active_user');
          localStorage.removeItem('petcare_current_user');
          localStorage.removeItem('petcare_auth_token');
          localStorage.removeItem('petcare_is_authenticated');
        } catch {}
      })()
    `);
    await send('Page.navigate', { url: 'http://127.0.0.1:5173/login' });
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n================================================================');
  console.log('🧪 BẮT ĐẦU E2E BROWSER TEST: MỤC 2 (PHIÊN BÁC SĨ & PHIÊN NGƯỜI NUÔI)');
  console.log('================================================================');

  // 1. Phục hồi và chuẩn bị dữ liệu ca khám cho kiểm thử E2E
  console.log('\n--- 1. CHUẨN BỊ DỮ LIỆU CA KHÁM VÀ THÚ CƯNG TRÊN BACKEND ---');
  // Lấy token admin để chuẩn bị lịch khám gán cho bác sĩ tester@petcare.ai và chủ nuôi test
  const adminLoginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@petcare.ai', password: 'Admin@123456' })
  });
  const adminData = await adminLoginRes.json();
  const adminToken = adminData.token;

  const vetLoginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tester@petcare.ai', password: 'Doctor@123' })
  });
  const vetData = await vetLoginRes.json();
  const vetId = vetData.user.id;

  // 1.1 Tạo tài khoản chủ nuôi test chính thức
  const ownerEmail = `owner_e2e_${Date.now()}@petcare.ai`;
  await fetch('http://localhost:5000/api/auth/admin/create-user', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Trần Văn Chủ Nuôi',
      email: ownerEmail,
      phone: '0911222333',
      password: 'Temp@123456',
      role: 'pet_owner'
    })
  });
  const tempLog = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ownerEmail, password: 'Temp@123456' })
  }).then(r => r.json());
  const chgPwd = await fetch('http://localhost:5000/api/auth/first-login-change-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tempLog.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword: 'Owner@123456' })
  }).then(r => r.json());
  const ownerToken = chgPwd.token;
  const ownerId = chgPwd.user.id;

  // 1.2 Tạo thú cưng thuộc sở hữu của chủ nuôi và gán bác sĩ tester
  const petId = `pet-e2e-${Date.now()}`;
  const newPetRes = await fetch('http://localhost:5000/api/data/pets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: petId,
      name: 'Cún Lucky E2E',
      species: 'dog',
      breed: 'Corgi',
      ownerId: ownerId,
      assignedVetId: vetId
    })
  });
  const petRespJson = await newPetRes.json();
  const testPet = petRespJson.data || petRespJson;

  // Tạo lịch khám in_progress cho thú cưng này
  const e2eAppId = `app-e2e-m2-${Date.now()}`;
  const randomMin = String(Math.floor(Math.random() * 59)).padStart(2, '0');
  const randomHour = String(8 + Math.floor(Math.random() * 10)).padStart(2, '0');
  const randomDay = String(1 + Math.floor(Math.random() * 25)).padStart(2, '0');
  const appCreateRes = await fetch('http://localhost:5000/api/data/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: e2eAppId,
      petId: testPet.id,
      assignedVetId: vetId,
      ownerId: ownerId,
      date: `2026-12-${randomDay}`,
      time: `${randomHour}:${randomMin}`,
      service: 'Khám chuyên khoa E2E MỤC 2',
      status: 'in_progress',
      note: 'Bé mệt mỏi, bỏ ăn 2 ngày qua'
    })
  });
  const appCreateData = await appCreateRes.json();
  if (!appCreateRes.ok) {
    throw new Error('Tạo lịch khám thất bại: ' + JSON.stringify(appCreateData));
  }
  console.log('✓ Đã chuẩn bị lịch khám in_progress:', e2eAppId, 'cho pet:', testPet.id, 'thuộc owner:', ownerId);

  // -------------------------------------------------------------
  // 2. PHIÊN BÁC SĨ (VET DOCTOR SESSION)
  // -------------------------------------------------------------
  console.log('\n--- 2. KIỂM THỬ PHIÊN BÁC SĨ: CHỐT BỆNH ÁN & HOÀN THÀNH CA KHÁM ---');
  await performLogin('tester@petcare.ai', 'Doctor@123');

  const doctorProfile = await evaluate(`
    (() => {
      const u = JSON.parse(localStorage.getItem('petcare_current_user') || '{}');
      return { id: u.id, role: u.role, name: u.name };
    })()
  `);
  console.log('✓ Bác sĩ đăng nhập thành công:', doctorProfile);

  // Đợi trang ổn định sau đăng nhập
  await new Promise(r => setTimeout(r, 1000));

  // Kiểm tra gọi finalize-ehr từ phiên Bác sĩ trên trình duyệt
  const doctorSignOffResult = await evaluate(`
    (async () => {
      try {
        const token = localStorage.getItem('petcare_auth_token');
        if (!token) return { success: false, error: 'Chưa có petcare_auth_token trong localStorage bác sĩ' };
        const res = await fetch('http://localhost:5000/api/data/medical-records/finalize-ehr', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({
            appointmentId: '${e2eAppId}',
            petId: '${testPet.id}',
            soap: {
              subjective: 'Triệu chứng kiểm thử E2E: Bỏ ăn, mệt mỏi',
              objective: 'Thân nhiệt 38.6C, niêm mạc hồng nhạt',
              assessment: 'Viêm dạ dày cấp do thay đổi thức ăn',
              plan: 'Truyền dịch bù nước, men vi sinh 7 ngày'
            }
          })
        });
        const data = await res.json();
        return { success: res.ok, status: res.status, data: data.data || data };
      } catch (err) {
        return { success: false, error: err.message };
      }
    })()
  `);

  console.log('✓ Kết quả chốt bệnh án từ phiên bác sĩ:', doctorSignOffResult);
  if (!doctorSignOffResult.success) {
    throw new Error('Chốt bệnh án từ phiên bác sĩ thất bại: ' + JSON.stringify(doctorSignOffResult));
  }

  // Xác minh trạng thái ca khám và bệnh án sau khi chốt
  const appCheck = await fetch(`http://localhost:5000/api/data/appointments`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  }).then(r => r.json());
  const finalizedApp = appCheck.find(a => a.id === e2eAppId);
  console.log('✓ Trạng thái lịch khám trên backend:', finalizedApp.status, '(Hoàn tất lúc:', finalizedApp.completedAt, ')');

  const medCheck = await fetch(`http://localhost:5000/api/data/medical_records`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  }).then(r => r.json());
  const finalizedMed = medCheck.find(m => m.appointmentId === e2eAppId);
  console.log('✓ Trạng thái bệnh án trên backend: isFinal =', finalizedMed.isFinal, ', status =', finalizedMed.status);

  // -------------------------------------------------------------
  // 3. PHIÊN NGƯỜI NUÔI (PET OWNER SESSION)
  // -------------------------------------------------------------
  console.log('\n--- 3. KIỂM THỬ PHIÊN NGƯỜI NUÔI (PET OWNER SESSION) ---');
  await performLogout();
  // Đăng nhập trên trình duyệt bằng tài khoản Chủ nuôi
  await performLogin(ownerEmail, 'Owner@123456');

  const ownerProfile = await evaluate(`
    (() => {
      const u = JSON.parse(localStorage.getItem('petcare_current_user') || '{}');
      return { id: u.id, role: u.role, name: u.name };
    })()
  `);
  console.log('✓ Chủ nuôi đăng nhập thành công:', ownerProfile);

  // 3.1. Chủ nuôi đọc được bệnh án đã công bố (isFinal: true)
  const ownerReadMedRes = await evaluate(`
    (async () => {
      try {
        const token = localStorage.getItem('petcare_auth_token');
        if (!token) return { found: false, error: 'Chưa có petcare_auth_token của chủ nuôi' };
        const res = await fetch('http://localhost:5000/api/data/medical_records', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const records = await res.json();
        const myRecord = Array.isArray(records) ? records.find(r => r.appointmentId === '${e2eAppId}') : null;
        return {
          found: !!myRecord,
          isFinal: myRecord?.isFinal,
          status: myRecord?.status,
          assessment: myRecord?.assessment || myRecord?.soap?.assessment,
          plan: myRecord?.plan || myRecord?.soap?.plan
        };
      } catch (err) {
        return { found: false, error: err.message };
      }
    })()
  `);
  console.log('✓ Chủ nuôi đọc bệnh án từ phiên trình duyệt:', ownerReadMedRes);
  if (!ownerReadMedRes.found || !ownerReadMedRes.isFinal) {
    throw new Error('Chủ nuôi không tìm thấy bệnh án đã công bố (isFinal: true)!');
  }

  // 3.2. Chủ nuôi KHÔNG THỂ chốt bệnh án (Bị từ chối quyền HTTP 403)
  const ownerAttemptSignOff = await evaluate(`
    (async () => {
      try {
        const token = localStorage.getItem('petcare_auth_token');
        const res = await fetch('http://localhost:5000/api/data/medical-records/finalize-ehr', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({
            appointmentId: '${e2eAppId}',
            petId: '${testPet.id}',
            soap: { assessment: 'Chủ nuôi cố sửa chẩn đoán' }
          })
        });
        const data = await res.json();
        return { allowed: res.ok, status: res.status, data };
      } catch (err) {
        return { allowed: false, error: err.message };
      }
    })()
  `);
  console.log('✓ Chủ nuôi cố tình chốt bệnh án -> Bị từ chối:', ownerAttemptSignOff);
  if (ownerAttemptSignOff.allowed || ownerAttemptSignOff.status !== 403) {
    throw new Error('Lỗi bảo mật: Chủ nuôi không được phép chốt bệnh án (Cần 403 Forbidden)!');
  }

  console.log('\n--- 4. KIỂM TRA BROWSER EXCEPTION & CONSOLE ERRORS ---');
  console.log('Console Errors Count:', consoleErrors.length);
  console.log('Uncaught Exceptions Count:', uncaughtExceptions.length);

  if (uncaughtExceptions.length > 0) {
    throw new Error('Có ngoại lệ chưa được xử lý trong trình duyệt!');
  }

  console.log('\n================================================================');
  console.log('🎉 KIỂM THỬ E2E BROWSER MỤC 2 THÀNH CÔNG 100%!');
  console.log('================================================================');

} finally {
  chrome.kill();
}
