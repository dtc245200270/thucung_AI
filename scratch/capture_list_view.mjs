import fs from 'fs';

async function run() {
  const listRes = await fetch('http://127.0.0.1:9222/json/list');
  const listData = await listRes.json();
  let targetPage = listData.find(t => t.type === 'page' && t.url.includes('5173'));
  if (!targetPage) return;
  const ws = new WebSocket(targetPage.webSocketDebuggerUrl);
  let idCounter = 1;
  const send = (method, params = {}) => new Promise(res => {
    const id = idCounter++;
    const onMsg = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.id === id) {
        ws.removeEventListener('message', onMsg);
        res(msg);
      }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
  await new Promise(r => ws.onopen = r);
  
  // Close any open modal
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Hủy bỏ') || b.textContent.includes('Đóng') || b.querySelector('svg.lucide-x'));
        if (closeBtn) closeBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 600));

  const snap = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scratch/schedule_list_view_verified.png', Buffer.from(snap.result.data, 'base64'));
  console.log('Saved scratch/schedule_list_view_verified.png');
  ws.close();
}
run();
