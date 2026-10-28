import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function test() {
  const p = path.resolve('scratch/debug_vet_profile');
  try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9585',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--user-data-dir=' + p,
    'http://127.0.0.1:5173/login'
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const list = await fetch('http://127.0.0.1:9585/json/list').then(r => r.json());
  const pageTarget = list.find(t => t.type === 'page' && !t.url.startsWith('chrome-extension')) || list[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  let id = 1;
  const cbs = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && cbs.has(msg.id)) { cbs.get(msg.id)(msg.result || msg); cbs.delete(msg.id); }
    if (msg.method === 'Page.javascriptDialogOpening') {
      console.log('ALERT OPENED:', msg.params.message);
      ws.send(JSON.stringify({ id: id++, method: 'Page.handleJavaScriptDialog', params: { accept: true } }));
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('CONSOLE:', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
    }
  };
  await new Promise(r => ws.onopen = r);
  function send(method, params = {}) {
    return new Promise(r => {
      const cur = id++;
      cbs.set(cur, r);
      ws.send(JSON.stringify({ id: cur, method, params }));
    });
  }
  await send('Page.enable');
  await send('Runtime.enable');
  
  // Đợi React mount xong form đăng nhập
  let mounted = false;
  for (let i = 0; i < 20; i++) {
    const ready = await send('Runtime.evaluate', {
      expression: `(() => ({ url: window.location.href, hasInput: Boolean(document.querySelector('input')), htmlLen: document.body.innerHTML.length }))()`,
      returnByValue: true
    });
    console.log(`[WAIT REACT ${i}]`, ready.result.value);
    if (ready.result.value.hasInput) {
      mounted = true;
      break;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  if (!mounted) throw new Error('React app did not mount within 10s');

  console.log('Filling login form...');
  await send('Runtime.evaluate', { expression: `
    (() => {
      function setVal(el, val) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const inputs = document.querySelectorAll('input');
      const emailInput = document.querySelector('input[type="email"]') || inputs[0];
      const passwordInput = document.querySelector('input[type="password"]') || inputs[1];
      setVal(emailInput, 'tester@petcare.ai');
      setVal(passwordInput, 'Doctor@123');
      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Đăng Nhập Vào Hệ Thống')) || document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    })()
  ` });

  console.log('Waiting for portal navigation...');
  await new Promise(r => setTimeout(r, 4500));

  const state = await send('Runtime.evaluate', { expression: `
    (() => {
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
      const textareas = document.querySelectorAll('textarea').length;
      return { buttons: buttons.slice(0, 15), textareas, text: document.body.innerText.slice(0, 300) };
    })()
  `, returnByValue: true });
  console.log('STATE AFTER LOGIN:', state.result.value);

  // Click Quản lý Bệnh án (SOAP) tab
  const clickRes = await send('Runtime.evaluate', { expression: `
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const soapTabBtn = buttons.find(b => b.textContent.includes('Quản lý Bệnh án (SOAP)'));
      if (soapTabBtn) {
        soapTabBtn.click();
        return 'clicked: ' + soapTabBtn.textContent.trim();
      }
      return 'not found';
    })()
  `, returnByValue: true });
  console.log('CLICK RES:', clickRes.result.value);
  await new Promise(r => setTimeout(r, 2000));

  const stateAfter = await send('Runtime.evaluate', { expression: `
    (() => {
      const textareas = document.querySelectorAll('textarea').length;
      const inputs = document.querySelectorAll('input').length;
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
      return { textareas, inputs, buttons: buttons.slice(0, 25) };
    })()
  `, returnByValue: true });
  console.log('STATE AFTER CLICK:', stateAfter.result.value);

  ws.close();
  chrome.kill();
}
test().catch(console.error);
