const debugPort = 9222;
const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
const listData = await listRes.json();
const targetPage = listData.find(t => t.type === 'page' && t.url.includes('5173')) || listData.find(t => t.type === 'page');

const ws = new WebSocket(targetPage.webSocketDebuggerUrl);
let idCounter = 1;
const callbacks = new Map();
function send(method, params = {}) {
  return new Promise(r => {
    const id = idCounter++;
    callbacks.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
ws.onmessage = e => {
  const msg = JSON.parse(e.data);
  if (msg.id && callbacks.has(msg.id)) {
    callbacks.get(msg.id)(msg.result);
    callbacks.delete(msg.id);
  }
};
await new Promise(r => ws.onopen = r);
await send('Runtime.enable');
const res = await send('Runtime.evaluate', {
  expression: `(() => {
    return {
      localStorageKeys: Object.keys(localStorage),
      currentUser: localStorage.getItem('petcare_current_user'),
      petcareUser: localStorage.getItem('petcare_user'),
      token: localStorage.getItem('petcare_token') || localStorage.getItem('token'),
      inputEmail: document.querySelector('input[type="email"]')?.value,
      inputPassword: document.querySelector('input[type="password"]')?.value
    };
  })()`,
  returnByValue: true
});
console.log('Storage & Inputs:', res?.result?.value);
ws.close();
