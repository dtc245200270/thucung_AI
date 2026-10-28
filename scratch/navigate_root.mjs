const debugPort = 9222;
const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
const listData = await listRes.json();
const targetPage = listData.find(t => t.type === 'page' && t.url.includes('5173'));

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
await send('Page.enable');

// Navigate to /
console.log('Navigating to http://localhost:5173/ ...');
await send('Page.navigate', { url: 'http://localhost:5173/' });
await new Promise(r => setTimeout(r, 2000));

const check = await send('Runtime.evaluate', {
  expression: `(() => {
    return {
      url: window.location.href,
      bodyText: document.body.innerText.slice(0, 300),
      session: localStorage.getItem('petcare_auth_session_v1'),
      remember: localStorage.getItem('petcare_auth_remember_v1'),
      allStorage: { ...localStorage }
    };
  })()`,
  returnByValue: true
});
console.log('Navigated state:', check?.result?.value);
ws.close();
