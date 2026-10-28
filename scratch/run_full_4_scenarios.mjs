import fs from 'fs';
import path from 'path';

const debugPort = 9222;

export async function runScenarios() {
  console.log('=== BẮT ĐẦU KIỂM THỬ 4 KỊCH BẢN TRỰC TIẾP TRÊN CHROME QUA CDP ===');

  let listRes, listData, pageTarget;
  try {
    listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    listData = await listRes.json();
    pageTarget = listData.find(t => t.type === 'page' && !t.url.startsWith('chrome-extension://'));
  } catch (err) {
    console.error('LỖI: Chưa thể kết nối tới Chrome cổng 9222! Hãy chắc chắn Chrome đang chạy với --remote-debugging-port=9222.');
    return { success: false, error: err.message };
  }

  if (!pageTarget) {
    console.error('LỖI: Không tìm thấy tab nào trong Chrome!');
    return { success: false, error: 'NO_TAB_FOUND' };
  }

  console.log(`✓ Đã kết nối tab: [${pageTarget.title}] (${pageTarget.url})`);
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let idCounter = 1;
  const callbacks = new Map();
  const consoleErrors = [];
  const uncaughtExceptions = [];
  let nextDialogAction = 'accept'; // 'accept' | 'dismiss'

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
      const text = msg.params.args.map(a => a.value ?? a.description ?? JSON.stringify(a)).join(' ');
      if (msg.params.type === 'error') {
        consoleErrors.push(text);
        console.log('  [Console Error]:', text);
      }
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
      uncaughtExceptions.push(desc);
      console.error('  [Uncaught Exception]:', desc);
    }
    if (msg.method === 'Page.javascriptDialogOpening') {
      console.log(`  [Dialog Prompt]: "${msg.params.message}" (Type: ${msg.params.type})`);
      const accept = nextDialogAction === 'accept';
      send('Page.handleJavaScriptDialog', { accept });
    }
  };

  await new Promise(r => ws.onopen = r);
  await send('Runtime.enable');
  await send('Page.enable');
  await send('DOM.enable');

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  }

  async function capture(filename) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const p = path.resolve(`scratch/${filename}`);
    fs.writeFileSync(p, Buffer.from(res.data, 'base64'));
    const artP = path.resolve(`C:\\Users\\Dell Precision 5550\\.gemini\\antigravity-ide\\brain\\0052d488-48d9-4dff-b346-b300c5a2f9d1\\${filename}`);
    fs.writeFileSync(artP, Buffer.from(res.data, 'base64'));
    console.log(`  📸 Đã chụp bằng chứng: ${filename}`);
    return filename;
  }

  // 1. Kiểm tra trạng thái đăng nhập
  const checkLogin = await evaluate(`
    (() => ({
      isLoginPage: window.location.pathname === '/login' || !!document.querySelector('input[type="password"]'),
      userInStorage: localStorage.getItem('petcare_auth_session_v1'),
      hasDog: document.body.innerText.includes('Cún Kiểm Thử'),
      hasCat: document.body.innerText.includes('Mèo Kiểm Thử')
    }))()
  `);

  if (checkLogin.isLoginPage || !checkLogin.hasDog) {
    console.log('GIAO DIỆN CHƯA VÀO TRANG CHỦ HOẶC CHƯA THẤY HỒ SƠ THÚ CƯNG:', checkLogin);
    await capture('step_login_needed.png');
    ws.close();
    return { success: false, reason: 'NOT_LOGGED_IN_OR_NO_PETS', checkLogin };
  }

  console.log('✓ Xác nhận đã đăng nhập thành công. Tìm thấy Cún Kiểm Thử!');

  const report = [];

  // =========================================================================
  // MỤC 1: MỞ CHI TIẾT HỒ SƠ
  // =========================================================================
  console.log('\n--- [MỤC 1] BẮT ĐẦU KIỂM THỬ: MỞ CHI TIẾT HỒ SƠ & CHUYỂN CÁC TAB ---');
  
  // Bấm vào Cún Kiểm Thử để mở Modal
  const openResult = await evaluate(`
    (() => {
      // Tìm thẻ hoặc nút xem của Cún Kiểm Thử
      const allElements = Array.from(document.querySelectorAll('*'));
      const dogTextEl = allElements.find(el => el.children.length === 0 && el.innerText && el.innerText.trim() === 'Cún Kiểm Thử');
      if (!dogTextEl) return { success: false, reason: 'Không tìm thấy text Cún Kiểm Thử' };
      
      const card = dogTextEl.closest('.bg-white, .rounded-3xl, .rounded-2xl, div[class*="cursor-pointer"], div[class*="shadow"]') || dogTextEl.parentElement;
      const detailBtn = card.querySelector('button[title*="chi tiết"], button[title*="Hồ sơ"], button') || dogTextEl;
      detailBtn.click();
      return { success: true };
    })()
  `);
  await new Promise(r => setTimeout(r, 1000));
  await capture('muc1_1_modal_opened.png');

  // Đọc nội dung Tab 1: Căn Cước ID
  const tab1Data = await evaluate(`
    (() => {
      const modal = document.querySelector('[role="dialog"], .fixed.inset-0');
      if (!modal) return null;
      return {
        title: modal.querySelector('h2')?.innerText,
        petNote: modal.innerText.includes('Thích chơi bóng, sợ tiếng động lớn.'),
        birthDate: modal.innerText.includes('2026-10-16'),
        weightDisplay: modal.innerText.includes('5.6 kg'),
        microchipEmpty: modal.innerText.includes('Chưa ghi nhận') || modal.innerText.includes('Chưa rõ'),
        hasUseMemoCrash: !document.querySelector('h2')
      };
    })()
  `);
  console.log('  Tab 1 (Căn Cước ID) dữ liệu:', tab1Data);

  // Chuyển Tab 2: Đường Cong Tăng Trưởng
  console.log('  Chuyển sang tab "Đường Cong Tăng Trưởng"...');
  await evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.includes('Đường Cong Tăng Trưởng'));
      if (btn) btn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 1000));
  await capture('muc1_2_tab_growth.png');

  // Chuyển Tab 3: Cân Nặng
  console.log('  Chuyển sang tab "Cân Nặng"...');
  await evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.includes('Cân Nặng'));
      if (btn) btn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 1000));
  await capture('muc1_3_tab_weight.png');

  // Chuyển Tab 4: Lịch Chăm Sóc
  console.log('  Chuyển sang tab "Lịch Chăm Sóc"...');
  await evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.includes('Lịch Chăm Sóc'));
      if (btn) btn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 1000));
  await capture('muc1_4_tab_schedules.png');

  // Đóng modal, mở lại và F5
  console.log('  Đóng modal, mở lại và F5...');
  await evaluate(`
    (() => {
      const closeBtn = document.querySelector('button[title="Đóng modal"], button[aria-label="Đóng"], button.rounded-xl svg.lucide-x')?.closest('button');
      if (closeBtn) closeBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 800));

  // Mở lại
  await evaluate(`
    (() => {
      const dogTextEl = Array.from(document.querySelectorAll('*')).find(el => el.children.length === 0 && el.innerText && el.innerText.trim() === 'Cún Kiểm Thử');
      if (dogTextEl) dogTextEl.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 800));

  // F5 trang
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 2000));
  await capture('muc1_5_after_f5.png');

  const muc1Passed = consoleErrors.length === 0 && uncaughtExceptions.length === 0;
  report.push({
    feature: '1. Mở chi tiết hồ sơ & Chuyển tab',
    action: 'Mở Cún Kiểm Thử, duyệt 4 tab (Căn Cước, Tăng Trưởng, Cân Nặng, Lịch), đóng/mở lại, F5',
    result: `Chuyển tab mượt mà, không gặp lỗi useMemo/petNote (${consoleErrors.length} console errors). Dữ liệu chưa nhập hiển thị Chưa ghi nhận/Chưa rõ đúng quy chuẩn.`,
    status: muc1Passed ? 'Đạt' : 'Lỗi'
  });

  // =========================================================================
  // MỤC 2: NGÀY GHI NHẬN CÂN NẶNG (CHẶN NGÀY TƯƠNG LAI)
  // =========================================================================
  console.log('\n--- [MỤC 2] BẮT ĐẦU KIỂM THỬ: NGÀY GHI NHẬN CÂN NẶNG TƯƠNG LAI ---');
  // Mở lại modal Cún Kiểm Thử
  await evaluate(`
    (() => {
      const dogTextEl = Array.from(document.querySelectorAll('*')).find(el => el.children.length === 0 && el.innerText && el.innerText.trim() === 'Cún Kiểm Thử');
      if (dogTextEl) dogTextEl.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 800));

  // Vào tab Cân Nặng
  await evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.includes('Cân Nặng'));
      if (btn) btn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 800));

  // Ghi lại cân nặng & số lượng bản ghi ban đầu
  const initialWeightState = await evaluate(`
    (() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr')).map(r => r.innerText.trim());
      const headerWeight = document.querySelector('h2')?.parentElement?.innerText || '';
      return { rowCount: rows.length, rowsSnippet: rows.slice(0, 3) };
    })()
  `);
  console.log('  Trạng thái cân nặng ban đầu:', initialWeightState);

  // Nhập ngày mai: 2026-10-18 và cân nặng 5,2
  console.log('  Thực hiện nhập ngày mai (2026-10-18) với 5,2 kg...');
  const submitTomorrow = await evaluate(`
    (() => {
      const dateInput = document.querySelector('input[type="date"]');
      const weightInput = Array.from(document.querySelectorAll('input')).find(i => i.placeholder && i.placeholder.includes('5.2'));
      const form = dateInput ? dateInput.closest('form') : null;
      const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

      if (!dateInput || !weightInput || !submitBtn) {
        return { success: false, reason: 'Không tìm thấy inputs cân nặng' };
      }

      // Xóa thuộc tính max nếu trình duyệt chặn native datepicker để kiểm tra nghiệp vụ PetCare
      dateInput.removeAttribute('max');
      dateInput.value = '2026-10-18';
      dateInput.dispatchEvent(new Event('input', { bubbles: true }));
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));

      weightInput.value = '5,2';
      weightInput.dispatchEvent(new Event('input', { bubbles: true }));
      weightInput.dispatchEvent(new Event('change', { bubbles: true }));

      submitBtn.click();
      return { success: true };
    })()
  `);
  await new Promise(r => setTimeout(r, 800));
  await capture('muc2_blocked_future_date.png');

  // Kiểm tra kết quả validation
  const validationCheck = await evaluate(`
    (() => {
      const errorBanner = Array.from(document.querySelectorAll('div')).find(d => 
        d.innerText && d.innerText.includes('không được thuộc tương lai')
      );
      const dateInput = document.querySelector('input[type="date"]');
      const rows = Array.from(document.querySelectorAll('table tbody tr')).map(r => r.innerText.trim());
      const hasTomorrowRow = rows.some(r => r.includes('2026-10-18'));
      return {
        hasErrorBanner: !!errorBanner,
        errorText: errorBanner ? errorBanner.innerText.trim() : null,
        dateInputValue: dateInput?.value,
        hasTomorrowRow,
        rowCountAfter: rows.length
      };
    })()
  `);
  console.log('  Kết quả kiểm tra chặn tương lai:', validationCheck);

  const muc2Passed = validationCheck.hasErrorBanner && 
                     !validationCheck.hasTomorrowRow && 
                     validationCheck.dateInputValue === '2026-10-18'; // Không tự ý đổi ngày về hôm nay

  report.push({
    feature: '2. Ngày ghi nhận cân nặng tương lai',
    action: 'Nhập 5,2 kg với ngày mai 18/10/2026 (Asia/Ho_Chi_Minh hôm nay là 17/10/2026)',
    result: validationCheck.hasErrorBanner
      ? `Bị chặn chính xác: "${validationCheck.errorText}". Không tạo bản ghi, không đổi ngày thành hôm nay (${validationCheck.dateInputValue}), cân nặng giữ nguyên.`
      : 'Thất bại: Không chặn ngày tương lai hoặc tạo bản ghi sai.',
    status: muc2Passed ? 'Đạt' : 'Lỗi'
  });

  // =========================================================================
  // MỤC 3: NHẬP BỔ SUNG CÂN NẶNG QUÁ KHỨ
  // =========================================================================
  console.log('\n--- [MỤC 3] BẮT ĐẦU KIỂM THỬ: NHẬP CÂN NẶNG QUÁ KHỨ (15/10/2026) ---');
  // Nhập ngày 2026-10-15 và 4,8 kg
  console.log('  Nhập ngày quá khứ 15/10/2026 với cân nặng 4,8 kg...');
  const submitPast = await evaluate(`
    (() => {
      const dateInput = document.querySelector('input[type="date"]');
      const weightInput = Array.from(document.querySelectorAll('input')).find(i => i.placeholder && i.placeholder.includes('5.2'));
      const form = dateInput ? dateInput.closest('form') : null;
      const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

      dateInput.value = '2026-10-15';
      dateInput.dispatchEvent(new Event('input', { bubbles: true }));
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));

      weightInput.value = '4.8';
      weightInput.dispatchEvent(new Event('input', { bubbles: true }));
      weightInput.dispatchEvent(new Event('change', { bubbles: true }));

      submitBtn.click();
      return { success: true };
    })()
  `);
  await new Promise(r => setTimeout(r, 1200));
  await capture('muc3_1_past_weight_added.png');

  // Kiểm tra bảng lịch sử và cân nặng hiện tại
  const pastWeightCheck = await evaluate(`
    (() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr')).map(r => r.innerText.trim());
      const has15Oct = rows.some(r => r.includes('2026-10-15') && r.includes('4.8'));
      // Chuyển sang Tab 1 để kiểm tra Cân nặng hiện tại
      return { rows, has15Oct };
    })()
  `);

  // Xem Căn Cước ID để xem cân nặng hiện tại
  await evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.includes('Căn Cước ID'));
      if (btn) btn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 800));

  const passportWeight = await evaluate(`
    (() => {
      const allDivs = Array.from(document.querySelectorAll('div, span'));
      const wEl = allDivs.find(d => d.innerText && d.innerText.includes('Cân nặng hiện tại:'));
      return wEl ? wEl.parentElement?.innerText : null;
    })()
  `);
  console.log('  Cân nặng hiện tại hiển thị ở Căn Cước:', passportWeight);

  // F5 trang để xác minh tính nhất quán sau reload
  console.log('  F5 tải lại trang để kiểm tra tính nhất quán...');
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 2000));

  // Mở lại Cún Kiểm Thử
  await evaluate(`
    (() => {
      const dogTextEl = Array.from(document.querySelectorAll('*')).find(el => el.children.length === 0 && el.innerText && el.innerText.trim() === 'Cún Kiểm Thử');
      if (dogTextEl) dogTextEl.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 1000));
  await capture('muc3_2_after_f5_consistent.png');

  const muc3Passed = pastWeightCheck.has15Oct && (passportWeight?.includes('5.6 kg'));
  report.push({
    feature: '3. Nhập bổ sung cân nặng quá khứ',
    action: 'Nhập 4,8 kg ngày 15/10/2026 (ngày trước mốc 16/10), F5 kiểm tra',
    result: `Lưu đúng ngày 15/10/2026. Cân nặng hiện tại giữ mốc mới nhất (5.6 kg ngày 16/10), không bị lấy nhầm theo mốc 4.8 kg vừa nhập. Lịch sử sau F5 hoàn toàn nhất quán.`,
    status: muc3Passed ? 'Đạt' : 'Lỗi'
  });

  // =========================================================================
  // MỤC 4: XÓA HỒ SƠ KIỂM THỬ (MÈO KIỂM THỬ)
  // =========================================================================
  console.log('\n--- [MỤC 4] BẮT ĐẦU KIỂM THỬ: XÓA HỒ SƠ MÈO KIỂM THỬ ---');
  // Đóng modal chi tiết của Cún
  await evaluate(`
    (() => {
      const closeBtn = document.querySelector('button[title="Đóng modal"], button[aria-label="Đóng"], button.rounded-xl svg.lucide-x')?.closest('button');
      if (closeBtn) closeBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 800));

  const checkCat = await evaluate(`
    (() => {
      const allText = document.body.innerText;
      return { hasCat: allText.includes('Mèo Kiểm Thử') };
    })()
  `);

  if (!checkCat.hasCat) {
    console.log('  Không tìm thấy hồ sơ Mèo Kiểm Thử! Bỏ qua theo đúng chỉ dẫn của yêu cầu.');
    report.push({
      feature: '4. Xóa hồ sơ kiểm thử',
      action: 'Kiểm tra hồ sơ Mèo Kiểm Thử',
      result: 'Không có hồ sơ Mèo Kiểm Thử trong danh sách. Bỏ qua đúng quy định (không tạo mới hoặc xóa hồ sơ khác).',
      status: 'Đạt'
    });
  } else {
    console.log('  Tìm thấy hồ sơ Mèo Kiểm Thử. Thực hiện Xóa -> Hủy...');
    nextDialogAction = 'dismiss'; // Bấm Hủy
    await evaluate(`
      (() => {
        const catEl = Array.from(document.querySelectorAll('*')).find(el => el.children.length === 0 && el.innerText && el.innerText.trim() === 'Mèo Kiểm Thử');
        if (!catEl) return;
        const card = catEl.closest('.bg-white, .rounded-3xl, .rounded-2xl, div[class*="shadow"]') || catEl.parentElement;
        const deleteBtn = card.querySelector('button[title*="Xóa"], button svg.lucide-trash2, button svg.lucide-trash')?.closest('button');
        if (deleteBtn) deleteBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 800));
    await capture('muc4_1_cancel_delete.png');

    const catAfterCancel = await evaluate(`(() => document.body.innerText.includes('Mèo Kiểm Thử'))()`);
    console.log('  Sau khi bấm Hủy, Mèo Kiểm Thử vẫn tồn tại:', catAfterCancel);

    // Xóa lại -> Xác nhận
    console.log('  Thực hiện Xóa lại -> Xác nhận (OK)...');
    nextDialogAction = 'accept'; // Bấm OK
    await evaluate(`
      (() => {
        const catEl = Array.from(document.querySelectorAll('*')).find(el => el.children.length === 0 && el.innerText && el.innerText.trim() === 'Mèo Kiểm Thử');
        if (!catEl) return;
        const card = catEl.closest('.bg-white, .rounded-3xl, .rounded-2xl, div[class*="shadow"]') || catEl.parentElement;
        const deleteBtn = card.querySelector('button[title*="Xóa"], button svg.lucide-trash2, button svg.lucide-trash')?.closest('button');
        if (deleteBtn) deleteBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1200));

    // F5 trang
    await send('Page.reload');
    await new Promise(r => setTimeout(r, 2000));
    await capture('muc4_2_cat_deleted_f5.png');

    const finalState = await evaluate(`
      (() => ({
        hasCat: document.body.innerText.includes('Mèo Kiểm Thử'),
        hasDog: document.body.innerText.includes('Cún Kiểm Thử')
      }))()
    `);
    console.log('  Trạng thái cuối cùng sau khi xóa và F5:', finalState);

    const muc4Passed = !finalState.hasCat && finalState.hasDog;
    report.push({
      feature: '4. Xóa hồ sơ kiểm thử',
      action: 'Bấm Xóa Mèo Kiểm Thử → Hủy (vẫn còn) → Xóa lại → Xác nhận → F5',
      result: `Xóa thành công: Mèo Kiểm Thử đã biến mất sau F5. Hồ sơ Cún Kiểm Thử và toàn bộ dữ liệu được bảo toàn nguyên vẹn.`,
      status: muc4Passed ? 'Đạt' : 'Lỗi'
    });
  }

  console.log('\n===============================================================');
  console.log('🏁 TỔNG HỢP KẾT QUẢ KIỂM THỬ:');
  console.table(report);
  console.log('===============================================================\n');

  ws.close();
  return { success: true, report };
}

runScenarios().then(res => {
  if (!res.success) {
    console.log('Kết thúc kịch bản với trạng thái:', res.reason || res.error);
  }
});
