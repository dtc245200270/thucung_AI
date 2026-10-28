import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = 9222;
const profileDir = path.resolve('scratch/cdp_test_profile_headed');

async function run() {
  console.log('--- KHỞI TẠO KIỂM THỬ GIAO DIỆN SCHEDULE FORM & FILTER ---');
  let isAlive = false;
  try {
    const check = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
    if (check.ok) isAlive = true;
  } catch {}

  if (!isAlive) {
    spawn(chromePath, [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1366,860',
      'http://localhost:5173'
    ], { detached: false });

    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 600));
      try {
        const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
        if (res.ok) {
          isAlive = true;
          break;
        }
      } catch {}
    }
  }

  const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
  const listData = await listRes.json();
  let targetPage = listData.find(t => t.type === 'page' && t.url.includes('5173')) || listData.find(t => t.type === 'page');

  if (!targetPage) {
    const newTab = await fetch(`http://127.0.0.1:${debugPort}/json/new?http://localhost:5173`);
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

  console.log('[1] Đảm bảo đang ở tab Lịch trình (ScheduleView)...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const scheduleBtn = buttons.find(b => b.textContent.includes('Lịch') && !b.textContent.includes('Đặt lịch'));
        if (scheduleBtn) scheduleBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 1200));

  console.log('[2] Chuyển sang tab Lịch chăm sóc...');
  const switchTabRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const careTabBtn = buttons.find(b => b.textContent.includes('Lịch chăm sóc'));
        if (careTabBtn) {
          careTabBtn.click();
          return 'Đã bấm tab Lịch chăm sóc';
        }
        return 'Không tìm thấy nút tab Lịch chăm sóc';
      })()
    `,
    returnByValue: true
  });
  console.log(switchTabRes.result?.result?.value);
  await new Promise(r => setTimeout(r, 1200));

  // Kiểm tra bộ lọc loại việc trên ScheduleView
  console.log('[3] Kiểm tra dropdown Bộ lọc loại việc...');
  const filterCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const selects = Array.from(document.querySelectorAll('select'));
        const typeSelect = selects.find(s => s.options && Array.from(s.options).some(o => o.text.includes('Tiêm phòng')));
        if (typeSelect) {
          return {
            found: true,
            selectedValue: typeSelect.value,
            options: Array.from(typeSelect.options).map(o => ({ value: o.value, text: o.text.trim() }))
          };
        }
        return { found: false, totalSelects: selects.length };
      })()
    `,
    returnByValue: true
  });
  console.log('Kết quả Bộ lọc loại việc:', JSON.stringify(filterCheck.result?.result?.value, null, 2));

  // Chụp ảnh giao diện danh sách lịch có bộ lọc
  const filterScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  if (filterScreenshot.result?.data) {
    fs.writeFileSync('scratch/schedule_list_filter_verified.png', Buffer.from(filterScreenshot.result.data, 'base64'));
    console.log('✅ Đã lưu ảnh chụp danh sách và bộ lọc: scratch/schedule_list_filter_verified.png');
  }

  // Mở modal Thêm việc chăm sóc
  console.log('[4] Bấm nút "+ Thêm việc chăm sóc"...');
  const openModalRes = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const addBtn = buttons.find(b => b.textContent.includes('Thêm việc chăm sóc') || b.textContent.includes('+ Thêm việc'));
        if (addBtn) {
          addBtn.click();
          return 'Đã bấm nút Thêm việc';
        }
        return 'Không tìm thấy nút Thêm việc';
      })()
    `,
    returnByValue: true
  });
  console.log(openModalRes.result?.result?.value);
  await new Promise(r => setTimeout(r, 1000));

  // Kiểm tra 8 loại sự kiện trong modal
  console.log('[5] Kiểm tra 8 loại sự kiện và các nhãn form trong ScheduleFormModal...');
  const modalInspection = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const typeButtons = Array.from(document.querySelectorAll('button[data-type]')).map(b => ({
          type: b.getAttribute('data-type'),
          text: b.textContent.trim(),
          isSelected: b.classList.contains('ring-2') || b.classList.contains('border-primary') || b.className.includes('primary')
        }));

        const labels = Array.from(document.querySelectorAll('label')).map(l => l.textContent.trim());

        const titleInput = document.querySelector('input[placeholder*="Chải lông"]') || document.querySelector('input[name="title"]');

        return {
          totalTypeButtons: typeButtons.length,
          typeButtons,
          labels,
          placeholder: titleInput ? titleInput.getAttribute('placeholder') : null,
          titleValue: titleInput ? titleInput.value : null
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Chi tiết Modal Form:', JSON.stringify(modalInspection.result?.result?.value, null, 2));

  // Chụp ảnh modal ban đầu
  const initialModalScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  if (initialModalScreenshot.result?.data) {
    fs.writeFileSync('scratch/schedule_modal_initial_verified.png', Buffer.from(initialModalScreenshot.result.data, 'base64'));
    console.log('✅ Đã lưu ảnh chụp Modal ban đầu: scratch/schedule_modal_initial_verified.png');
  }

  // Bấm chọn "Nhắc khám / Tái khám"
  console.log('[6] Bấm chọn loại "Nhắc khám / Tái khám"...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const vetBtn = document.querySelector('button[data-type="vet"]');
        if (vetBtn) vetBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 800));

  const vetNoticeCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const modal = document.querySelector('div[role="dialog"]') || document.body;
        const text = modal.textContent;
        const hasNotice = text.includes('Lời nhắc này chưa phải lịch khám được cơ sở xác nhận.');
        const bookingBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Đặt lịch khám tại cơ sở'));
        const titleInput = document.querySelector('input[placeholder*="Chải lông"]') || document.querySelector('input[name="title"]');
        return {
          hasNotice,
          hasBookingBtn: !!bookingBtn,
          bookingBtnText: bookingBtn ? bookingBtn.textContent.trim() : null,
          titleValueAfterClick: titleInput ? titleInput.value : ''
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Kiểm tra chú thích Nhắc khám:', JSON.stringify(vetNoticeCheck.result?.result?.value, null, 2));

  // Chụp ảnh modal khi chọn Nhắc khám
  const vetModalScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  if (vetModalScreenshot.result?.data) {
    fs.writeFileSync('scratch/schedule_modal_vet_selected.png', Buffer.from(vetModalScreenshot.result.data, 'base64'));
    console.log('✅ Đã lưu ảnh chụp Modal khi chọn Nhắc khám: scratch/schedule_modal_vet_selected.png');
  }

  // Bấm chọn "Tiêm phòng" kiểm tra chú thích kế hoạch cá nhân
  console.log('[7] Bấm chọn loại "Tiêm phòng"...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const vaxBtn = document.querySelector('button[data-type="vaccine"]');
        if (vaxBtn) vaxBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 600));

  const vaxNoticeCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const text = document.body.textContent;
        const hasNotice = text.includes('Kế hoạch chăm sóc cá nhân: Việc đánh dấu hoàn thành chỉ nhằm theo dõi');
        const titleInput = document.querySelector('input[placeholder*="Chải lông"]') || document.querySelector('input[name="title"]');
        return {
          hasNotice,
          titleValueAfterClick: titleInput ? titleInput.value : ''
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Kiểm tra chú thích Tiêm phòng:', JSON.stringify(vaxNoticeCheck.result?.result?.value, null, 2));

  // Bấm chọn lại "Nhắc khám" rồi bấm "Đặt lịch khám tại cơ sở"
  console.log('[8] Bấm lại Nhắc khám và thử bấm nút "Đặt lịch khám tại cơ sở"...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const vetBtn = document.querySelector('button[data-type="vet"]');
        if (vetBtn) vetBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 600));

  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const bookingBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Đặt lịch khám tại cơ sở'));
        if (bookingBtn) bookingBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 1200));

  const bookingModalCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const text = document.body.textContent;
        const isOpen = text.includes('Đặt Lịch Khám Thú Y') || text.includes('Chọn bác sĩ') || text.includes('Cơ sở khám');
        return { isOpen };
      })()
    `,
    returnByValue: true
  });
  console.log('Kiểm tra mở VetBookingModal:', JSON.stringify(bookingModalCheck.result?.result?.value, null, 2));

  const bookingScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  if (bookingScreenshot.result?.data) {
    fs.writeFileSync('scratch/schedule_vet_booking_opened.png', Buffer.from(bookingScreenshot.result.data, 'base64'));
    console.log('✅ Đã lưu ảnh chụp VetBookingModal: scratch/schedule_vet_booking_opened.png');
  }

  ws.close();
  console.log('--- HOÀN TẤT KIỂM THỬ THÀNH CÔNG ---');
}

run().catch(console.error);
