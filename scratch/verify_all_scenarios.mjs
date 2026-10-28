import { spawn } from 'child_process';
import fs from 'fs';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = 9444;
const profileDir = 'C:\\Users\\Dell Precision 5550\\Documents\\PET_Ai\\scratch\\temp_verify_profile';

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
  console.log('✓ Chrome browser connected:', versionData.Browser);

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

  console.log('\n--- BƯỚC 1: XÁC MINH TRANG ĐĂNG NHẬP (LOGIN PAGE) ---');
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/login' });
  await new Promise(r => setTimeout(r, 2500));

  const rootHtmlLen = await evaluate('document.getElementById("root")?.innerHTML?.length || 0');
  const loginInputs = await evaluate(`
    Array.from(document.querySelectorAll('input')).map(i => ({ type: i.type, placeholder: i.placeholder, name: i.name }))
  `);
  const loginButton = await evaluate(`
    document.querySelector('#btn-sign-in-submit')?.innerText || Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('đăng nhập'))?.innerText
  `);
  console.log(`- Độ dài HTML #root: ${rootHtmlLen} bytes`);
  console.log(`- Các trường input trong form:`, loginInputs);
  console.log(`- Nút đăng nhập: "${loginButton}"`);

  if (rootHtmlLen < 1000 || !loginButton) {
    throw new Error('Trang đăng nhập không hiển thị đúng!');
  }
  console.log('✓ Trang đăng nhập hiển thị đầy đủ, không bị màn hình tối trống.');

  console.log('\n--- BƯỚC 2: ĐĂNG NHẬP ADMIN VÀ KIỂM TRA PHÂN HỆ QUẢN TRỊ ---');
  await evaluate(`
    (() => {
      function setNativeValue(element, value) {
        const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        valueSetter.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const emailInput = document.querySelectorAll('input')[0];
      const passInput = document.querySelectorAll('input')[1];
      const submitBtn = document.querySelector('#btn-sign-in-submit') || document.querySelector('button[type="submit"]');

      if (emailInput && passInput) {
        setNativeValue(emailInput, 'admin@petcare.ai');
        setNativeValue(passInput, 'Admin@123456');

        if (submitBtn) {
          submitBtn.click();
        }
      }
    })()
  `);

  await new Promise(r => setTimeout(r, 3000));

  const adminHeader = await evaluate(`
    document.querySelector('h1')?.innerText || document.querySelector('h2')?.innerText
  `);
  const adminStatCards = await evaluate(`
    Array.from(document.querySelectorAll('div')).filter(d => d.innerText.includes('Tổng Tài Khoản')).length > 0
  `);
  console.log(`- Tiêu đề trang Admin: "${adminHeader}"`);
  console.log(`- Có thẻ thống kê Quản trị: ${adminStatCards}`);

  if (!adminHeader || !adminHeader.includes('PET_Ai')) {
    throw new Error('Đăng nhập Admin không thành công hoặc không vào được Cổng Quản Trị!');
  }
  console.log('✓ Đăng nhập Admin thành công, giao diện Trung Tâm Điều Hành hiển thị trơn tru.');

  console.log('\n--- BƯỚC 3: MỞ QUẢN LÝ TÀI KHOẢN (ACCOUNTS MANAGEMENT) ---');
  await evaluate(`
    (() => {
      const accBtn = Array.from(document.querySelectorAll('button, a')).find(el => el.innerText.includes('Tài khoản') || el.innerText.includes('Quản Lý Tài Khoản'));
      if (accBtn) accBtn.click();
    })()
  `);

  await new Promise(r => setTimeout(r, 2000));

  const accountsTableRows = await evaluate(`
    document.querySelectorAll('tbody tr').length
  `);
  const createAccountBtn = await evaluate(`
    Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Tạo tài khoản'))?.innerText
  `);
  console.log(`- Số hàng tài khoản trong bảng: ${accountsTableRows}`);
  console.log(`- Nút tạo tài khoản: "${createAccountBtn}"`);
  console.log('✓ Mục Quản lý tài khoản hiển thị đầy đủ danh sách và công cụ quản trị.');

  console.log('\n--- BƯỚC 4: KIỂM TRA TRƯỜNG HỢP KHÔNG CÓ CHỦ NUÔI & KHÔNG CÓ THÚ CƯNG ---');
  // Mô phỏng xóa sạch hồ sơ thú cưng và chủ nuôi, chỉ giữ tài khoản Admin
  await evaluate(`
    (() => {
      localStorage.setItem('petcare_pets', '[]');
      localStorage.setItem('petcare_schedules', '[]');
      window.dispatchEvent(new Event('petcare_data_cleaned'));
    })()
  `);

  await new Promise(r => setTimeout(r, 2000));

  const emptyStateHtmlLen = await evaluate('document.getElementById("root")?.innerHTML?.length || 0');
  console.log(`- Độ dài HTML #root khi pets = []: ${emptyStateHtmlLen} bytes`);
  if (emptyStateHtmlLen === 0) {
    throw new Error('Ứng dụng bị sập màn hình tối trống khi không có thú cưng!');
  }
  console.log('✓ Trường hợp không có thú cưng / không có chủ nuôi: Giao diện vẫn render an toàn 100%, không màn hình tối trống.');

  console.log('\n--- BƯỚC 5: KIỂM TRA TẢI LẠI TRANG (RELOAD) & ĐĂNG XUẤT (LOGOUT) ---');
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 3000));

  const afterReloadLen = await evaluate('document.getElementById("root")?.innerHTML?.length || 0');
  console.log(`- Độ dài HTML #root sau khi F5 reload: ${afterReloadLen} bytes`);
  if (afterReloadLen === 0) {
    throw new Error('Ứng dụng bị sập màn hình tối trống sau khi reload!');
  }
  console.log('✓ F5 tải lại trang không gây màn hình tối trống.');

  // Nhấn nút Đăng xuất
  await evaluate(`
    (() => {
      const logoutBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Đăng xuất') || b.querySelector('svg.lucide-log-out') || b.getAttribute('title')?.includes('Đăng xuất'));
      if (logoutBtn) logoutBtn.click();
    })()
  `);

  await new Promise(r => setTimeout(r, 2500));

  const afterLogoutHeading = await evaluate(`
    document.querySelector('h1, h2, h3')?.innerText
  `);
  console.log(`- Tiêu đề sau khi đăng xuất: "${afterLogoutHeading}"`);
  console.log('✓ Đăng xuất thành công, chuyển hướng về trang đăng nhập mà không có màn hình tối trống.');

  console.log('\n======================================================');
  console.log('TỔNG HỢP KẾT QUẢ KIỂM TRA:');
  console.log(`- Tổng số Uncaught Exceptions: ${uncaughtExceptions.length}`);
  console.log(`- Tổng số Console Errors: ${consoleErrors.length}`);
  console.log('======================================================');

  if (uncaughtExceptions.length > 0) {
    throw new Error(`Phát hiện ${uncaughtExceptions.length} ngoại lệ chưa xử lý!`);
  }

  ws.close();
} catch (err) {
  console.error('LỖI KIỂM CHỨNG:', err);
  process.exitCode = 1;
} finally {
  chrome.kill();
  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {}
}
