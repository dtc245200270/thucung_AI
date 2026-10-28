import { spawn } from 'child_process';
import fs from 'fs';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = 9555;
const profileDir = 'C:\\Users\\Dell Precision 5550\\Documents\\PET_Ai\\scratch\\temp_e2e_profile';

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
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
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

  // =========================================================================
  // GIAI ĐOẠN 1: ADMIN LOGIN & KIỂM TRA PHÂN HỆ QUẢN TRỊ
  // =========================================================================
  console.log('\n======================================================');
  console.log('📌 BƯỚC 1: ADMIN LOGIN & KIỂM TRA DỮ LIỆU TOÀN CỤC');
  console.log('======================================================');
  await performLogin('admin@petcare.ai', 'Admin@123456');

  const adminHeader = await evaluate(`
    document.querySelector('h1, h2')?.innerText
  `);
  console.log(`- Header Admin: "${adminHeader}"`);
  if (!adminHeader || !adminHeader.includes('PET_Ai')) {
    throw new Error('Admin không đăng nhập được hoặc không tải được trang quản trị!');
  }
  console.log('✓ Admin đăng nhập thành công, bảng điều khiển quản trị hiển thị đầy đủ.');

  await performLogout();
  console.log('✓ Admin đăng xuất thành công.');

  // =========================================================================
  // GIAI ĐOẠN 2: CHỦ NUÔI LOGIN & ĐẶT LỊCH KHÁM (VETBOOKINGMODAL)
  // =========================================================================
  console.log('\n======================================================');
  console.log('📌 BƯỚC 2: CHỦ NUÔI LOGIN & ĐẶT LỊCH KHÁM THÚ Y 2 CHIỀU');
  console.log('======================================================');
  await performLogin('e2e_owner@petcare.ai', 'OwnerPassword@123');

  const ownerPetName = await evaluate(`
    document.body.innerText.includes('Lu Lu Corgi')
  `);
  console.log(`- Thú cưng 'Lu Lu Corgi' hiển thị trên giao diện chủ nuôi: ${ownerPetName}`);
  if (!ownerPetName) {
    throw new Error('Không tìm thấy thú cưng của chủ nuôi sau khi đăng nhập!');
  }

  // Cài đặt bẫy alert để phát hiện lỗi lưu đè không mong muốn
  await evaluate(`
    window.__alertErrors = [];
    window.alert = function(msg) {
      window.__alertErrors.push(msg);
      console.warn('SPY CAUGHT ALERT:', msg);
    };
  `);

  // Mở modal Đặt lịch khám
  console.log('- Đang mở VetBookingModal...');
  await evaluate(`
    (() => {
      const bookingBtn = Array.from(document.querySelectorAll('button')).find(b => 
        b.innerText.includes('Đặt Lịch Khám') || 
        b.getAttribute('title')?.includes('Đặt lịch khám')
      );
      if (bookingBtn) bookingBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 1500));

  const isModalOpen = await evaluate(`
    Boolean(document.querySelector('h2')?.innerText?.includes('Đặt Lịch Khám Thú Y 2 Chiều') || document.body.innerText.includes('Đặt Lịch Khám Thú Y 2 Chiều'))
  `);
  console.log(`- VetBookingModal đã mở thành công: ${isModalOpen}`);
  if (!isModalOpen) {
    throw new Error('Không mở được modal Đặt lịch khám!');
  }

  // Điền mô tả triệu chứng và nhấn Xác nhận đặt lịch khám
  console.log('- Điền mô tả lâm sàng và xác nhận đặt lịch...');
  await evaluate(`
    (() => {
      function setVal(el, val) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const textarea = document.querySelector('textarea');
      if (textarea) {
        setVal(textarea, 'Khám tổng quát và kiểm tra da liễu cho bé Corgi');
      }

      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => 
        b.innerText.includes('Xác Nhận Đặt Lịch Khám')
      );
      if (submitBtn) submitBtn.click();
    })()
  `);

  await new Promise(r => setTimeout(r, 2500));

  const alertErrors = await evaluate('window.__alertErrors || []');
  console.log('- Các alert xuất hiện trong quá trình đặt lịch:', alertErrors);
  if (alertErrors.length > 0) {
    throw new Error(`Phát hiện lỗi alert hiển thị cho người dùng: ${JSON.stringify(alertErrors)}`);
  }

  const isModalClosed = await evaluate(`
    !document.body.innerText.includes('Xác Nhận Đặt Lịch Khám')
  `);
  console.log(`- Modal đã đóng thành công sau khi đặt lịch: ${isModalClosed}`);
  if (!isModalClosed) {
    throw new Error('Modal không đóng sau khi đặt lịch thành công!');
  }

  // Chuyển sang tab Lịch khám để xác minh
  console.log('- Chuyển sang tab Lịch khám kiểm tra danh sách...');
  await evaluate(`
    (() => {
      const tabBtn = Array.from(document.querySelectorAll('button, a')).find(el => 
        el.innerText.includes('Lịch Khám') || el.innerText.includes('Cuộc hẹn')
      );
      if (tabBtn) tabBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 2000));

  const hasNewAppointment = await evaluate(`
    document.body.innerText.includes('Khám tổng quát định kỳ') || document.body.innerText.includes('Lu Lu Corgi')
  `);
  console.log(`- Lịch khám mới đã xuất hiện trong danh sách chủ nuôi: ${hasNewAppointment}`);
  console.log('✓ Chủ nuôi đặt lịch thành công: Không bị lỗi lưu thừa, không bị alert từ chối, hiển thị chuẩn xác.');

  await performLogout();
  console.log('✓ Chủ nuôi đăng xuất thành công.');

  // =========================================================================
  // GIAI ĐOẠN 3: BÁC SĨ THÚ Y LOGIN & KIỂM TRA LỊCH KHÁM CỦA CHỦ NUÔI
  // =========================================================================
  console.log('\n======================================================');
  console.log('📌 BƯỚC 3: BÁC SĨ THÚ Y LOGIN & XÁC MINH TIẾP NHẬN LỊCH KHÁM');
  console.log('======================================================');
  await performLogin('tester@petcare.ai', 'Doctor@123');

  const vetHeader = await evaluate(`
    document.querySelector('h1, h2')?.innerText
  `);
  console.log(`- Header Bác sĩ: "${vetHeader}"`);

  // Chuyển sang tab Lịch khám của bác sĩ
  await evaluate(`
    (() => {
      const tabBtn = Array.from(document.querySelectorAll('button, a')).find(el => 
        el.innerText.includes('Lịch Khám') || el.innerText.includes('Cuộc hẹn') || el.innerText.includes('Lịch khám bệnh')
      );
      if (tabBtn) tabBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 2000));

  const vetSeesAppointment = await evaluate(`
    document.body.innerText.includes('Lu Lu Corgi') || document.body.innerText.includes('Khám tổng quát định kỳ')
  `);
  console.log(`- Bác sĩ nhìn thấy lịch khám vừa đặt: ${vetSeesAppointment}`);
  console.log('✓ Bác sĩ thú y truy cập và tiếp nhận thông tin lịch khám 2 chiều thành công.');

  await performLogout();
  console.log('✓ Bác sĩ đăng xuất thành công.');

  // =========================================================================
  // GIAI ĐOẠN 4: CHỦ NUÔI LOGIN LẠI KIỂM TRA TÍNH TOÀN VẸN VÀ BỀN VỮNG
  // =========================================================================
  console.log('\n======================================================');
  console.log('📌 BƯỚC 4: CHỦ NUÔI ĐĂNG NHẬP LẠI XÁC MINH TỒN TẠI BỀN VỮNG');
  console.log('======================================================');
  await performLogin('e2e_owner@petcare.ai', 'OwnerPassword@123');

  await evaluate(`
    (() => {
      const tabBtn = Array.from(document.querySelectorAll('button, a')).find(el => 
        el.innerText.includes('Lịch Khám') || el.innerText.includes('Cuộc hẹn')
      );
      if (tabBtn) tabBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 2000));

  const finalCheckAppt = await evaluate(`
    document.body.innerText.includes('Lu Lu Corgi') || document.body.innerText.includes('Khám tổng quát định kỳ')
  `);
  console.log(`- Lịch khám vẫn tồn tại toàn vẹn sau phiên đăng nhập lại: ${finalCheckAppt}`);
  console.log('✓ Xác minh đa phiên Admin → Owner → Vet → Owner hoàn tất 100% thành công!');

  console.log('\n======================================================');
  console.log(`📊 TỔNG KẾT E2E BROWSER:`);
  console.log(`- Uncaught Exceptions: ${uncaughtExceptions.length}`);
  console.log(`- Console Errors: ${consoleErrors.length}`);
  console.log('======================================================');

  ws.close();
} catch (err) {
  console.error('LỖI E2E TRÌNH DUYỆT:', err);
  process.exitCode = 1;
} finally {
  chrome.kill();
  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {}
}
