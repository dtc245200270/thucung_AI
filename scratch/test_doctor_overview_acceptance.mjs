import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9877;
const TEMP_PROFILE = path.resolve('scratch/cdp_overview_profile');

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
  const interceptedRequests = [];
  const networkResponses = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg.result !== undefined ? msg.result : msg);
      callbacks.delete(msg.id);
    }
    if (msg.method === 'Network.requestWillBeSent') {
      interceptedRequests.push(msg.params);
    }
    if (msg.method === 'Network.responseReceived') {
      networkResponses.push(msg.params);
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
  await send('Network.enable');

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
    await new Promise(r => setTimeout(r, 2000));
  }

  return {
    ws,
    send,
    evaluate,
    screenshot,
    navigate,
    interceptedRequests,
    networkResponses,
    close: () => ws.close()
  };
}

async function runAcceptanceTest() {
  console.log('=== KHỞI ĐỘNG KIỂM THỬ NGHIỆM THU: BÁC SĨ → TỔNG QUAN → XEM BỆNH ÁN ===');
  const cdp = await connectCdp(DEBUG_PORT);

  try {
    // 1. Mở trang chủ / đăng nhập
    console.log('\n--- BƯỚC 1: ĐĂNG NHẬP BÁC SĨ TESTER ---');
    await cdp.navigate('http://localhost:5173');
    await new Promise(r => setTimeout(r, 2000));

    // Đăng nhập Bác sĩ (tester@petcare.ai qua Quick Demo button)
    await cdp.evaluate(`
      (() => {
        const demoToggle = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Chế độ Demo'));
        if (demoToggle) demoToggle.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 800));

    const loginResult = await cdp.evaluate(`
      (() => {
        const vetBtn = document.getElementById('btn-test-clinic-admin');
        if (vetBtn) {
          vetBtn.click();
          return { success: true, method: 'btn-test-clinic-admin' };
        }
        return { success: false, error: 'btn-test-clinic-admin not found' };
      })()
    `);
    console.log('Điền thông tin đăng nhập:', loginResult);

    // Chờ dashboard load
    await new Promise(r => setTimeout(r, 3000));

    // Kiểm tra tab và giao diện
    const initialView = await cdp.evaluate(`
      (() => {
        const bodyText = document.body.innerText;
        const currentTab = localStorage.getItem('petcare_vet_active_tab');
        const hasOverview = bodyText.includes('Tổng quan ca khám') || bodyText.includes('Hàng đợi hôm nay');
        return { hasOverview, currentTab, url: window.location.href };
      })()
    `);
    console.log('Giao diện sau đăng nhập:', initialView);

    // Chuyển sang tab Tổng quan (dashboard) nếu chưa ở đó
    await cdp.evaluate(`
      (() => {
        const dashboardBtn = Array.from(document.querySelectorAll('button, a')).find(el => el.innerText.includes('Tổng quan'));
        if (dashboardBtn) dashboardBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));

    // 2. Kiểm tra hàng 08:30 và 14:00 hiển thị chủ hiện tại Đinh Xuân Mạnh
    console.log('\n--- BƯỚC 2: KIỂM TRA HIỂN THỊ HÀNG ĐỢI VÀ THÔNG TIN CHỦ HIỆN TẠI ---');
    const queueInfo = await cdp.evaluate(`
      (() => {
        const items = Array.from(document.querySelectorAll('.divide-y > div'));
        return items.map(it => {
          const text = it.innerText;
          return {
            has0830: text.includes('08:30'),
            has1400: text.includes('14:00'),
            hasCurrentOwner: text.includes('Đinh Xuân Mạnh'),
            hasHistoricalLabel: text.includes('Liên hệ đặt lịch') && text.includes('Chủ Nuôi Mẫu (Demo Owner)'),
            hasCompletedBadge: text.includes('Hoàn tất') || text.includes('Xem bệnh án'),
            hasError: text.includes('HTTP 400') || text.includes('Lịch hẹn đã hoàn thành'),
            fullSnippet: text.slice(0, 300)
          };
        });
      })()
    `);
    console.log('Thông tin các hàng ca khám trên Tổng quan:', JSON.stringify(queueInfo, null, 2));

    const item0830 = queueInfo.find(q => q.has0830);
    const item1400 = queueInfo.find(q => q.has1400);

    if (!item0830) throw new Error('Không tìm thấy ca khám 08:30 trên Tổng quan');
    if (!item1400) throw new Error('Không tìm thấy ca khám 14:00 trên Tổng quan');

    console.log('Ca 08:30 có chủ hiện tại "Đinh Xuân Mạnh":', item0830.hasCurrentOwner);
    console.log('Ca 08:30 có ghi nhãn snapshot lịch sử "Chủ Nuôi Mẫu (Demo Owner)":', item0830.hasHistoricalLabel);
    console.log('Ca 14:00 có chủ hiện tại "Đinh Xuân Mạnh":', item1400.hasCurrentOwner);

    // 3. Xóa bộ đệm requests để theo dõi chính xác các requests khi bấm Xem bệnh án
    console.log('\n--- BƯỚC 3: BẤM “XEM BỆNH ÁN” CA 08:30 (BK-1793103632301) ---');
    const requestCountBefore0830 = cdp.interceptedRequests.length;

    const click0830Res = await cdp.evaluate(`
      (() => {
        // Tìm nút Xem bệnh án của ca 08:30
        const items = Array.from(document.querySelectorAll('.divide-y > div'));
        const row0830 = items.find(it => it.innerText.includes('08:30'));
        if (!row0830) return { success: false, error: 'Row 08:30 not found' };

        const viewBtn = row0830.querySelector('button[data-btn*="view-record"]') || 
          Array.from(row0830.querySelectorAll('button')).find(b => b.innerText.includes('Xem bệnh án'));
        if (!viewBtn) return { success: false, error: 'View button not found in row 08:30' };

        viewBtn.click();
        return { success: true };
      })()
    `);
    console.log('Kết quả click nút Xem bệnh án ca 08:30:', click0830Res);

    // Chờ modal xuất hiện
    await new Promise(r => setTimeout(r, 1500));

    // Kiểm tra nội dung modal ca 08:30
    const modal0830Info = await cdp.evaluate(`
      (() => {
        const modal = document.querySelector('#medical-record-detail-modal') || document.querySelector('[data-modal="medical-record-detail"]');
        if (!modal) return { open: false };
        const text = modal.innerText;
        return {
          open: true,
          title: text.includes('Hồ sơ bệnh án chi tiết'),
          hasMedRecordId: text.includes('med-1793174255186'),
          hasAppointmentId: text.includes('BK-1793103632301'),
          hasReadOnlyBadge: text.includes('ĐÃ CHỐT (CHỈ ĐỌC)'),
          hasLockNotice: text.includes('Bệnh án đã chốt và công bố chính thức. Toàn bộ thông tin được bảo vệ ở chế độ chỉ đọc.'),
          hasTestMedA: text.includes('THUỐC KIỂM THỬ A – KHÔNG SỬ DỤNG'),
          hasDose: text.includes('1 đơn vị kiểm thử/lần'),
          hasInstructions: text.includes('Dữ liệu kiểm thử phần mềm, không dùng điều trị cho thú cưng.'),
          hasCurrentOwner: text.includes('Đinh Xuân Mạnh'),
          hasHistoricalLabel: text.includes('Liên hệ lúc đặt') && text.includes('Chủ Nuôi Mẫu (Demo Owner)'),
          rawTextSnippet: text.slice(0, 600)
        };
      })()
    `);
    console.log('Nội dung Modal ca 08:30:', modal0830Info);

    if (!modal0830Info.open) throw new Error('Modal ca 08:30 không mở!');
    if (!modal0830Info.hasMedRecordId) throw new Error('Modal ca 08:30 không chứa mã BA med-1793174255186');
    if (!modal0830Info.hasTestMedA) throw new Error('Modal ca 08:30 không chứa THUỐC KIỂM THỬ A – KHÔNG SỬ DỤNG');

    // Chụp ảnh bằng chứng ca 08:30
    await cdp.screenshot('scratch/modal_ca_0830_passed.png');
    console.log('Đã lưu ảnh chụp modal ca 08:30 vào scratch/modal_ca_0830_passed.png');

    // Kiểm tra request trong suốt quá trình mở ca 08:30
    const requestsDuring0830 = cdp.interceptedRequests.slice(requestCountBefore0830);
    const statusChangeRequests0830 = requestsDuring0830.filter(r => 
      (r.request.method === 'PATCH' || r.request.method === 'PUT') && 
      r.request.url.includes('/appointments')
    );
    console.log('Số requests thay đổi trạng thái ca 08:30 (yêu cầu là 0):', statusChangeRequests0830.length);
    if (statusChangeRequests0830.length > 0) {
      throw new Error(`Phát hiện request thay đổi trạng thái trái phép khi chỉ xem ca 08:30: ${JSON.stringify(statusChangeRequests0830)}`);
    }

    // Đóng modal ca 08:30
    await cdp.evaluate(`
      (() => {
        const closeBtn = document.querySelector('button[data-btn="close-modal-btn"]') ||
          Array.from(document.querySelectorAll('button')).find(b => b.innerText === 'Đóng');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));

    // 4. Bấm Xem bệnh án ca 14:00 (BK-1793164543433)
    console.log('\n--- BƯỚC 4: BẤM “XEM BỆNH ÁN” CA 14:00 (BK-1793164543433) ---');
    const requestCountBefore1400 = cdp.interceptedRequests.length;

    const click1400Res = await cdp.evaluate(`
      (() => {
        const items = Array.from(document.querySelectorAll('.divide-y > div'));
        const row1400 = items.find(it => it.innerText.includes('14:00'));
        if (!row1400) return { success: false, error: 'Row 14:00 not found' };

        const viewBtn = row1400.querySelector('button[data-btn*="view-record"]') || 
          Array.from(row1400.querySelectorAll('button')).find(b => b.innerText.includes('Xem bệnh án'));
        if (!viewBtn) return { success: false, error: 'View button not found in row 14:00' };

        viewBtn.click();
        return { success: true };
      })()
    `);
    console.log('Kết quả click nút Xem bệnh án ca 14:00:', click1400Res);

    await new Promise(r => setTimeout(r, 1500));

    // Kiểm tra nội dung modal ca 14:00
    const modal1400Info = await cdp.evaluate(`
      (() => {
        const modal = document.querySelector('#medical-record-detail-modal') || document.querySelector('[data-modal="medical-record-detail"]');
        if (!modal) return { open: false };
        const text = modal.innerText;
        return {
          open: true,
          title: text.includes('Hồ sơ bệnh án chi tiết'),
          hasMedRecordId: text.includes('med-1793170593954'),
          hasAppointmentId: text.includes('BK-1793164543433'),
          hasReadOnlyBadge: text.includes('ĐÃ CHỐT (CHỈ ĐỌC)'),
          hasZeroMedsNotice: text.includes('Ca khám này không kê đơn thuốc kèm theo (0 đơn thuốc)'),
          hasTestMedA: text.includes('THUỐC KIỂM THỬ A'),
          hasCurrentOwner: text.includes('Đinh Xuân Mạnh'),
          rawTextSnippet: text.slice(0, 600)
        };
      })()
    `);
    console.log('Nội dung Modal ca 14:00:', modal1400Info);

    if (!modal1400Info.open) throw new Error('Modal ca 14:00 không mở!');
    if (!modal1400Info.hasMedRecordId) throw new Error('Modal ca 14:00 không chứa mã BA med-1793170593954');
    if (!modal1400Info.hasZeroMedsNotice) throw new Error('Modal ca 14:00 không có thông báo 0 đơn thuốc!');
    if (modal1400Info.hasTestMedA) throw new Error('Lỗi: Modal ca 14:00 bị lẫn đơn thuốc của ca 08:30!');

    // Chụp ảnh bằng chứng ca 14:00
    await cdp.screenshot('scratch/modal_ca_1400_passed.png');
    console.log('Đã lưu ảnh chụp modal ca 14:00 vào scratch/modal_ca_1400_passed.png');

    const requestsDuring1400 = cdp.interceptedRequests.slice(requestCountBefore1400);
    const statusChangeRequests1400 = requestsDuring1400.filter(r => 
      (r.request.method === 'PATCH' || r.request.method === 'PUT') && 
      r.request.url.includes('/appointments')
    );
    console.log('Số requests thay đổi trạng thái ca 14:00 (yêu cầu là 0):', statusChangeRequests1400.length);
    if (statusChangeRequests1400.length > 0) {
      throw new Error(`Phát hiện request thay đổi trạng thái trái phép khi chỉ xem ca 14:00: ${JSON.stringify(statusChangeRequests1400)}`);
    }

    // Đóng modal ca 14:00
    await cdp.evaluate(`
      (() => {
        const closeBtn = document.querySelector('button[data-btn="close-modal-btn"]') ||
          Array.from(document.querySelectorAll('button')).find(b => b.innerText === 'Đóng');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));

    // 5. Kiểm tra lỗi HTTP 400 trên toàn bộ network responses
    console.log('\n--- BƯỚC 5: KIỂM TRA LỖI HTTP 400 TRÊN TOÀN BỘ PHIÊN ---');
    const http400Responses = cdp.networkResponses.filter(res => res.response.status === 400);
    console.log('Số lượng phản hồi HTTP 400 phát hiện:', http400Responses.length);
    if (http400Responses.length > 0) {
      throw new Error(`Phát hiện lỗi HTTP 400 trong phiên: ${JSON.stringify(http400Responses.map(r => r.response.url))}`);
    }

    // 6. F5 Reload trang và kiểm tra trạng thái 2 ca completed được bảo toàn
    console.log('\n--- BƯỚC 6: F5 TẢI LẠI TRANG & KIỂM TRA BẢO TOÀN TRẠNG THÁI COMPLETED ---');
    await cdp.navigate('http://localhost:5173');
    await new Promise(r => setTimeout(r, 3000));

    // Đảm bảo ở tab Tổng quan
    await cdp.evaluate(`
      (() => {
        const dashboardBtn = Array.from(document.querySelectorAll('button, a')).find(el => el.innerText.includes('Tổng quan'));
        if (dashboardBtn) dashboardBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1500));

    const postReloadQueue = await cdp.evaluate(`
      (() => {
        const items = Array.from(document.querySelectorAll('.divide-y > div'));
        return items.map(it => {
          const text = it.innerText;
          return {
            has0830: text.includes('08:30'),
            has1400: text.includes('14:00'),
            isCompleted: text.includes('Hoàn tất') || text.includes('Xem bệnh án'),
            hasCurrentOwner: text.includes('Đinh Xuân Mạnh'),
            textSnippet: text.slice(0, 200)
          };
        });
      })()
    `);
    console.log('Trạng thái hàng đợi sau F5:', JSON.stringify(postReloadQueue, null, 2));

    const post0830 = postReloadQueue.find(q => q.has0830);
    const post1400 = postReloadQueue.find(q => q.has1400);

    if (!post0830 || !post0830.isCompleted) throw new Error('Sau F5, ca 08:30 không còn giữ trạng thái completed');
    if (!post1400 || !post1400.isCompleted) throw new Error('Sau F5, ca 14:00 không còn giữ trạng thái completed');

    console.log('Sau F5: Cả 2 ca 08:30 và 14:00 đều bảo toàn 100% trạng thái hoàn tất!');

    // 7. Kiểm tra dữ liệu JSON trên đĩa không bị thay đổi / ghi đè
    console.log('\n--- BƯỚC 7: KIỂM TRA BẢO TOÀN DỮ LIỆU ĐĨA SERVER/DATA ---');
    const appointmentsOnDisk = JSON.parse(fs.readFileSync('server/data/appointments.json', 'utf8'));
    const ca0830Disk = appointmentsOnDisk.find(a => a.id === 'BK-1793103632301');
    const ca1400Disk = appointmentsOnDisk.find(a => a.id === 'BK-1793164543433');

    console.log('Ca 08:30 trên đĩa status:', ca0830Disk?.status, 'ownerName:', ca0830Disk?.ownerName);
    console.log('Ca 14:00 trên đĩa status:', ca1400Disk?.status, 'ownerName:', ca1400Disk?.ownerName);

    if (ca0830Disk?.status !== 'completed' || ca1400Disk?.status !== 'completed') {
      throw new Error('Dữ liệu trên đĩa appointments.json bị sai trạng thái!');
    }
    if (ca0830Disk?.ownerName !== 'Chủ Nuôi Mẫu (Demo Owner)') {
      throw new Error('Dữ liệu snapshot lịch sử của ca 08:30 bị ghi đè trái phép!');
    }

    console.log('\n>>> TẤT CẢ 7 TIÊU CHÍ NGHIỆM THU ĐÃ VƯỢT QUA 100% THÀNH CÔNG! <<<');
  } finally {
    cdp.close();
    chrome.kill();
  }
}

runAcceptanceTest().catch(err => {
  console.error('\n❌ KIỂM THỬ THẤT BẠI:', err);
  process.exit(1);
});
