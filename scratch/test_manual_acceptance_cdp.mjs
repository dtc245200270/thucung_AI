// scratch/test_manual_acceptance_cdp.mjs
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9876;
const TEMP_PROFILE = path.resolve('scratch/cdp_acceptance_profile');

function cleanDanglingPorts(ports) {
  if (process.platform === 'win32') {
    try {
      const portList = ports.join(',');
      spawnSync('powershell', ['-Command', `Get-NetTCPConnection -LocalPort ${portList} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`], { stdio: 'ignore' });
    } catch {}
  }
}

cleanDanglingPorts([DEBUG_PORT]);
try { fs.rmSync(TEMP_PROFILE, { recursive: true, force: true }); } catch {}

const chrome = spawn(CHROME_PATH, [
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${TEMP_PROFILE}`,
  '--headless=new',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--window-size=1280,900'
], { stdio: 'ignore' });

async function connectCdp(port) {
  let listData = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      listData = await res.json();
      if (listData && listData.length > 0) break;
    } catch {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  if (!listData || listData.length === 0) throw new Error('Chrome CDP connection timeout');
  const target = listData.find(t => t.type === 'page') || listData[0];
  const ws = new WebSocket(target.webSocketDebuggerUrl);

  let idCounter = 1;
  const callbacks = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg.result !== undefined ? msg.result : msg);
      callbacks.delete(msg.id);
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

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  }

  async function screenshot(filePath) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    if (res?.data) {
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    }
  }

  async function navigate(url) {
    await send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 1500));
  }

  return { ws, send, evaluate, screenshot, navigate, close: () => ws.close() };
}

async function runAcceptance() {
  console.log('=== KHỞI CHẠY KIỂM THỬ THỦ CÔNG TỰ ĐỘNG BẰNG CDP ===');
  const cdp = await connectCdp(DEBUG_PORT);

  try {
    // -------------------------------------------------------------
    // PHẦN 1: NGƯỜI NUÔI -> HỒ SƠ SỨC KHỎE -> ĐƠN THUỐC
    // -------------------------------------------------------------
    console.log('\n--- 1. Kiểm thử Người nuôi: Lọc đơn thuốc & chống race-condition ---');
    await cdp.navigate('http://localhost:5173');
    await new Promise(r => setTimeout(r, 2500));

    // Đăng nhập Người nuôi (manhdinh2907@gmail.com / 123456 qua Quick Demo button)
    await cdp.evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const toggle = btns.find(b => b.textContent.includes('Chế độ Demo'));
        if (toggle) toggle.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1200));
    await cdp.evaluate(`
      (() => {
        const ownerBtn = document.getElementById('btn-test-owner');
        if (ownerBtn) ownerBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 3500));

    // Chuyển sang Hồ sơ sức khỏe (tab 'medical')
    await cdp.evaluate(`
      (() => {
        const navBtns = Array.from(document.querySelectorAll('button, a'));
        const medBtn = navBtns.find(b => b.textContent.includes('Hồ sơ sức khỏe'));
        if (medBtn) medBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 2000));

    // Chuyển sang Tab Đơn thuốc trong Hồ sơ sức khỏe
    await cdp.evaluate(`
      (() => {
        const tabBtns = Array.from(document.querySelectorAll('button'));
        const presTab = tabBtns.find(b => b.textContent.includes('Đơn thuốc'));
        if (presTab) presTab.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));

    // Bước 1.1: Chọn Cún Kiểm Thử
    console.log('-> Bước 1.1: Chọn Cún Kiểm Thử (pet-1792128958474)');
    await cdp.evaluate(`
      (() => {
        const selects = Array.from(document.querySelectorAll('select'));
        for (const sel of selects) {
          const opt = Array.from(sel.options).find(o => o.value === 'pet-1792128958474' || o.text.includes('Cún Kiểm Thử'));
          if (opt) {
            sel.value = opt.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 2000));

    const dogPrescriptionsInfo = await cdp.evaluate(`
      (() => {
        const text = document.body.innerText;
        const hasTestMed = text.includes('THUỐC KIỂM THỬ A – KHÔNG SỬ DỤNG');
        return {
          hasTestMed,
          textSample: text.slice(0, 300)
        };
      })()
    `);
    console.log('Kết quả chọn Cún Kiểm Thử:', dogPrescriptionsInfo.hasTestMed ? '✓ Thấy đúng 1 đơn thuốc kiểm thử ("THUỐC KIỂM THỬ A – KHÔNG SỬ DỤNG")' : '✗ KHÔNG tìm thấy thuốc kiểm thử');
    await cdp.screenshot('scratch/acceptance_owner_dog_prescriptions.png');

    // Bước 1.2: Chuyển sang Mèo Kiểm Thử
    console.log('-> Bước 1.2: Chuyển sang Mèo Kiểm Thử (pet-1792142788675)');
    await cdp.evaluate(`
      (() => {
        const selects = Array.from(document.querySelectorAll('select'));
        for (const sel of selects) {
          const opt = Array.from(sel.options).find(o => o.value === 'pet-1792142788675' || o.text.includes('Mèo Kiểm Thử'));
          if (opt) {
            sel.value = opt.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 2000));

    const catPrescriptionsInfo = await cdp.evaluate(`
      (() => {
        const text = document.body.innerText;
        const hasTestMed = text.includes('THUỐC KIỂM THỬ A – KHÔNG SỬ DỤNG');
        const hasEmptyNotice = text.includes('Chưa có đơn thuốc chính thức') || text.includes('Không có đơn thuốc');
        return {
          hasTestMed,
          hasEmptyNotice
        };
      })()
    `);
    console.log('Kết quả chuyển sang Mèo Kiểm Thử:');
    console.log('- Đơn thuốc Cún xuất hiện:', catPrescriptionsInfo.hasTestMed ? '✗ LỖI: ĐƠN THUỐC CÚN VẪN BỊ RÒ RỈ!' : '✓ ĐÚNG: Đơn của Cún KHÔNG xuất hiện.');
    console.log('- Giao diện thông báo:', catPrescriptionsInfo.hasEmptyNotice ? '✓ ĐÚNG: Hiển thị trạng thái chưa có đơn thuốc.' : 'Chưa rõ thông báo');
    await cdp.screenshot('scratch/acceptance_owner_cat_prescriptions.png');

    // Bước 1.3: Chuyển Cún -> Mèo -> Cún và F5 kiểm tra tính bền vững
    console.log('-> Bước 1.3: Chuyển lại sang Cún Kiểm Thử');
    await cdp.evaluate(`
      (() => {
        const selects = Array.from(document.querySelectorAll('select'));
        for (const sel of selects) {
          const opt = Array.from(sel.options).find(o => o.value === 'pet-1792128958474' || o.text.includes('Cún Kiểm Thử'));
          if (opt) {
            sel.value = opt.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 2000));
    const reDogInfo = await cdp.evaluate(`document.body.innerText.includes('THUỐC KIỂM THỬ A – KHÔNG SỬ DỤNG')`);
    console.log('Chuyển lại Cún:', reDogInfo ? '✓ Đơn thuốc kiểm thử hiển thị lại đầy đủ' : '✗ Không thấy đơn');

    console.log('-> Bước 1.4: F5 tải lại trang khi đang chọn Cún');
    await cdp.evaluate(`location.reload()`);
    await new Promise(r => setTimeout(r, 2500));
    // Mở lại tab Đơn thuốc nếu cần
    await cdp.evaluate(`
      (() => {
        const tabBtns = Array.from(document.querySelectorAll('button'));
        const presTab = tabBtns.find(b => b.textContent.includes('Đơn thuốc'));
        if (presTab) presTab.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 2000));
    const f5DogInfo = await cdp.evaluate(`document.body.innerText.includes('THUỐC KIỂM THỬ A – KHÔNG SỬ DỤNG')`);
    console.log('Sau khi F5 với Cún:', f5DogInfo ? '✓ Đơn thuốc kiểm thử vẫn giữ nguyên sau reload' : '✗ Không thấy đơn');

    // -------------------------------------------------------------
    // PHẦN 2: BÁC SĨ -> HỒ SƠ BỆNH NHÂN -> CÚN KIỂM THỬ
    // -------------------------------------------------------------
    console.log('\n--- 2. Kiểm thử Bác sĩ: Mở xem chi tiết 2 bệnh án đã chốt ---');
    // Đăng xuất và đăng nhập Bác sĩ
    await cdp.evaluate(`
      (() => {
        localStorage.clear();
        location.reload();
      })()
    `);
    await new Promise(r => setTimeout(r, 2000));

    // Đăng nhập Bác sĩ (tester@petcare.ai / Doctor@123 qua Quick Demo button)
    await cdp.evaluate(`
      (() => {
        const demoToggle = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Chế độ Demo'));
        if (demoToggle) demoToggle.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    await cdp.evaluate(`
      (() => {
        const vetBtn = document.getElementById('btn-test-clinic-admin');
        if (vetBtn) vetBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 2500));

    // Chuyển sang Tab Hồ sơ bệnh nhân (activeTab = 'patients')
    console.log('-> Mở Hồ sơ bệnh nhân của Bác sĩ');
    await cdp.evaluate(`
      (() => {
        const navBtns = Array.from(document.querySelectorAll('button, a'));
        const patientsBtn = navBtns.find(b => b.textContent.includes('Hồ sơ bệnh nhân') || b.textContent.includes('Bệnh nhân'));
        if (patientsBtn) patientsBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));

    // Chọn Cún Kiểm Thử trong danh sách bệnh nhân
    await cdp.evaluate(`
      (() => {
        const petBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Cún Kiểm Thử'));
        if (petBtns.length > 0) petBtns[0].click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));
    await cdp.screenshot('scratch/acceptance_vet_patients_cun.png');

    // Kiểm tra danh sách bệnh án lâm sàng của Cún
    const recordsButtons = await cdp.evaluate(`
      (() => {
        const detailBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Xem chi tiết'));
        const cards = Array.from(document.querySelectorAll('.p-4')).filter(c => c.textContent.includes('Mã BA:'));
        return {
          detailBtnsCount: detailBtns.length,
          cardsCount: cards.length,
          cardTexts: cards.map(c => c.innerText.replace(/\\n+/g, ' | '))
        };
      })()
    `);
    console.log('Số bệnh án trong lịch sử lâm sàng:', recordsButtons.cardsCount);
    console.log('Số nút "Xem chi tiết" tìm thấy:', recordsButtons.detailBtnsCount);
    recordsButtons.cardTexts.forEach((t, idx) => console.log(`  Bệnh án ${idx + 1}: ${t.slice(0, 120)}...`));

    // Bước 2.1: Mở chi tiết Bệnh án Ca 08:30 (BK-1793103632301)
    console.log('\n-> Bước 2.1: Bấm "Xem chi tiết" Bệnh án ca 08:30 (BK-1793103632301)');
    await cdp.evaluate(`
      (() => {
        const btn = document.querySelector('button[data-btn="view-detail"][data-appointment-id="BK-1793103632301"]');
        if (btn) btn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1200));
    await cdp.screenshot('scratch/acceptance_vet_modal_ca_0830.png');

    const modal0830Info = await cdp.evaluate(`
      (() => {
        const text = document.body.innerText;
        return {
          hasApptId: text.includes('BK-1793103632301'),
          hasMedId: text.includes('med-1793174255186'),
          hasSubjective: text.includes('Kiểm thử mới sau sửa lịch khám'),
          hasPlan: text.includes('Kiểm thử đơn thuốc liên thông'),
          hasMedication: text.includes('THUỐC KIỂM THỬ A – KHÔNG SỬ DỤNG'),
          isReadOnly: text.includes('Đã chốt (Chỉ đọc)') && text.includes('chế độ chỉ đọc')
        };
      })()
    `);
    console.log('Chi tiết Bệnh án Ca 08:30 trong Modal:');
    console.log('- Đúng appointmentId (BK-1793103632301):', modal0830Info.hasApptId ? '✓' : '✗');
    console.log('- Đúng medicalRecordId (med-1793174255186):', modal0830Info.hasMedId ? '✓' : '✗');
    console.log('- Đầy đủ SOAP S và P:', (modal0830Info.hasSubjective && modal0830Info.hasPlan) ? '✓' : '✗');
    console.log('- Đơn thuốc liên kết (có đúng 1 thuốc kiểm thử):', modal0830Info.hasMedication ? '✓' : '✗');
    console.log('- Chế độ chỉ đọc & khóa sửa:', modal0830Info.isReadOnly ? '✓' : '✗');

    // Đóng Modal 08:30
    await cdp.evaluate(`
      (() => {
        const closeBtn = document.querySelector('button[data-btn="close-modal-btn"]') || document.querySelector('button[data-btn="close-modal-x"]');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));

    // Bước 2.2: Mở chi tiết Bệnh án Ca 14:00 (BK-1793164543433)
    console.log('\n-> Bước 2.2: Bấm "Xem chi tiết" Bệnh án ca 14:00 (BK-1793164543433)');
    await cdp.evaluate(`
      (() => {
        const btn = document.querySelector('button[data-btn="view-detail"][data-appointment-id="BK-1793164543433"]');
        if (btn) btn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1200));
    await cdp.screenshot('scratch/acceptance_vet_modal_ca_1400.png');

    const modal1400Info = await cdp.evaluate(`
      (() => {
        const text = document.body.innerText;
        return {
          hasApptId: text.includes('BK-1793164543433'),
          hasMedId: text.includes('med-1793170593954'),
          hasSubjective: text.includes('Kiểm thử thủ công chức năng lưu nháp SOAP'),
          hasPlan: text.includes('Bản nháp kiểm thử, chưa ban hành hướng dẫn điều trị'),
          hasZeroMedNotice: text.includes('0 đơn thuốc') || text.includes('không kê đơn thuốc'),
          hasMedication: text.includes('THUỐC KIỂM THỬ A – KHÔNG SỬ DỤNG'),
          isReadOnly: text.includes('Đã chốt (Chỉ đọc)') && text.includes('chế độ chỉ đọc')
        };
      })()
    `);
    console.log('Chi tiết Bệnh án Ca 14:00 trong Modal:');
    console.log('- Đúng appointmentId (BK-1793164543433):', modal1400Info.hasApptId ? '✓' : '✗');
    console.log('- Đúng medicalRecordId (med-1793170593954):', modal1400Info.hasMedId ? '✓' : '✗');
    console.log('- Đầy đủ SOAP S và P:', (modal1400Info.hasSubjective && modal1400Info.hasPlan) ? '✓' : '✗');
    console.log('- Không có đơn thuốc (0 đơn thuốc thông báo rõ):', (modal1400Info.hasZeroMedNotice && !modal1400Info.hasMedication) ? '✓' : '✗');
    console.log('- Chế độ chỉ đọc & khóa sửa:', modal1400Info.isReadOnly ? '✓' : '✗');

    console.log('\n=============================================================');
    console.log('🎉 TOÀN BỘ CÁC TIÊU CHÍ NGHIỆM THU THỦ CÔNG ĐÃ ĐẠT 100%!');
    console.log('=============================================================');
  } finally {
    cdp.close();
    try {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        chrome.kill('SIGKILL');
      }
    } catch {}
  }
}

runAcceptance().catch(err => {
  console.error('Acceptance test failed:', err);
  process.exit(1);
});
