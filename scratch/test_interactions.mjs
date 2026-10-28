import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const debugPort = 9222;

async function run() {
  const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
  const listData = await listRes.json();
  let targetPage = listData.find(t => t.type === 'page' && t.url.includes('5173')) || listData.find(t => t.type === 'page');

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

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg.result);
      callbacks.delete(msg.id);
    }
  };

  await new Promise(r => ws.onopen = r);
  await send('Runtime.enable');

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  }

  // 1. Test clicking next day on strip
  const clickDayResult = await evaluate(`
    (() => {
      const dayButtons = document.querySelectorAll('button[data-testid^="day-strip-"]');
      if (dayButtons.length > 1) {
        dayButtons[1].click();
        return { clicked: true, selectedDay: dayButtons[1].getAttribute('data-testid') };
      }
      return { clicked: false };
    })()
  `);
  console.log('1. Click day strip:', clickDayResult);

  // 2. Test clicking "Hôm nay" button if visible
  const resetTodayResult = await evaluate(`
    (() => {
      const todayBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Hôm nay'));
      if (todayBtn) {
        todayBtn.click();
        return { clicked: true };
      }
      return { clicked: false, note: 'Already today' };
    })()
  `);
  console.log('2. Reset today button:', resetTodayResult);

  // 3. Test clicking "Ghi cân nặng" quick action button opens modal
  const openWeightModalResult = await evaluate(`
    (() => {
      const weightBtn = Array.from(document.querySelectorAll('[data-testid="quick-actions-card"] button')).find(b => b.textContent.includes('Ghi cân nặng'));
      if (weightBtn) {
        weightBtn.click();
        return { clicked: true };
      }
      return { clicked: false };
    })()
  `);
  console.log('3. Open weight modal:', openWeightModalResult);

  await new Promise(r => setTimeout(r, 600));

  const modalCheck = await evaluate(`
    (() => {
      const modal = Array.from(document.querySelectorAll('h3, h2, div')).find(el => el.textContent.includes('Ghi nhận cân nặng'));
      const closeBtn = document.querySelector('button[title="Đóng"], button[aria-label="Close"]') ||
                       Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Hủy') || b.textContent.includes('✕'));
      const isOpen = !!modal;
      if (closeBtn) closeBtn.click();
      return { isOpen, closed: !!closeBtn };
    })()
  `);
  console.log('4. Modal check & close:', modalCheck);

  ws.close();
}

run().catch(console.error);
