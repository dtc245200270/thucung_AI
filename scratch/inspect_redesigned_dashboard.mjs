import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const debugPort = 9222;
const profileDir = path.resolve('scratch/cdp_test_profile_headed');

async function run() {
  let isAlive = false;
  try {
    const check = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
    if (check.ok) isAlive = true;
  } catch {}

  let chromeProc = null;
  if (!isAlive) {
    console.log('[1] Khởi chạy Chrome với remote debugging port 9222...');
    chromeProc = spawn(chromePath, [
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

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg.result);
      callbacks.delete(msg.id);
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
    return res?.result?.value;
  }

  // Ensure we are on Overview tab
  await evaluate(`
    (() => {
      // Find Overview button or set hash
      const overviewBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Tổng quan'));
      if (overviewBtn) overviewBtn.click();
      window.location.hash = '#overview';
    })()
  `);

  await new Promise(r => setTimeout(r, 1000));

  // Inspect layout details
  const results = await evaluate(`
    (() => {
      // 1. Header inspection
      const h1 = document.querySelector('h1');
      const headerDate = document.querySelector('[data-testid="vn-date-display"]')?.textContent?.trim() || 
                         Array.from(document.querySelectorAll('span, p')).find(el => el.textContent.includes('Tháng') || el.textContent.includes('thứ'))?.textContent?.trim();
      const petSelector = document.querySelector('[data-testid="pet-selector"]');

      // 2. Stat cards inspection (90-100px target)
      const statCards = Array.from(document.querySelectorAll('[data-testid^="stat-card-"]')).map(el => {
        const rect = el.getBoundingClientRect();
        return {
          id: el.getAttribute('data-testid'),
          height: Math.round(rect.height),
          title: el.querySelector('p')?.textContent?.trim(),
          value: el.querySelector('h3')?.textContent?.trim(),
          sub: el.querySelector('p.text-xs, span.text-xs')?.textContent?.trim()
        };
      });

      // 3. Lịch chăm sóc card (Left column)
      const careCard = document.querySelector('[data-testid="care-schedule-card"]');
      const careRect = careCard ? careCard.getBoundingClientRect() : null;
      const weekDays = careCard ? careCard.querySelectorAll('button[data-testid^="day-strip-"]').length : 0;

      // 4. Right column (Upcoming appointments & Quick actions)
      const aptCard = document.querySelector('[data-testid="upcoming-appointments-card"]');
      const aptRect = aptCard ? aptCard.getBoundingClientRect() : null;
      const quickActionCard = document.querySelector('[data-testid="quick-actions-card"]');
      const quickActionButtons = quickActionCard ? Array.from(quickActionCard.querySelectorAll('button')).map(b => b.textContent.trim()) : [];

      // 5. Bottom row cards (Health summary & Monthly expenses)
      const healthCard = document.querySelector('[data-testid="health-summary-card"]');
      const healthRect = healthCard ? healthCard.getBoundingClientRect() : null;
      const expenseCard = document.querySelector('[data-testid="monthly-expenses-card"]');
      const expenseRect = expenseCard ? expenseCard.getBoundingClientRect() : null;

      // 6. Colors and typography
      const h1Computed = h1 ? window.getComputedStyle(h1) : null;
      const bodyComputed = document.body ? window.getComputedStyle(document.body) : null;

      return {
        header: {
          title: h1 ? h1.textContent.trim() : null,
          titleColor: h1Computed ? h1Computed.color : null,
          headerDate: headerDate,
          hasPetSelector: !!petSelector
        },
        statCards,
        columns: {
          careCardWidth: careRect ? Math.round(careRect.width) : null,
          careCardHeight: careRect ? Math.round(careRect.height) : null,
          weekDaysCount: weekDays,
          aptCardWidth: aptRect ? Math.round(aptRect.width) : null,
          quickActionButtonsCount: quickActionButtons.length,
          quickActionButtons
        },
        bottomRow: {
          healthWidth: healthRect ? Math.round(healthRect.width) : null,
          expenseWidth: expenseRect ? Math.round(expenseRect.width) : null
        }
      };
    })()
  `);

  console.log('=== INSPECTION RESULTS ===');
  console.log(JSON.stringify(results, null, 2));

  // Take full desktop screenshot
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scratch/redesigned_owner_dashboard.png', Buffer.from(screenshot.data, 'base64'));
  console.log('Saved scratch/redesigned_owner_dashboard.png');

  // Test mobile viewport
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await new Promise(r => setTimeout(r, 800));

  const mobileScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scratch/redesigned_owner_dashboard_mobile.png', Buffer.from(mobileScreenshot.data, 'base64'));
  console.log('Saved scratch/redesigned_owner_dashboard_mobile.png');

  // Reset emulation
  await send('Emulation.clearDeviceMetricsOverride');

  ws.close();
}

run().catch(console.error);
