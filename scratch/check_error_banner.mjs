const listRes = await fetch('http://127.0.0.1:9222/json/list');
const listData = await listRes.json();
const target = listData.find(t => t.type === 'page' && t.url.includes('5173'));
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 1;
function send(method, params) {
  return new Promise(r => {
    const curId = id++;
    const handler = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id === curId) {
        ws.removeEventListener('message', handler);
        r(data.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });
}
const res = await send('Runtime.evaluate', {
  expression: `(() => {
    const errorHeading = Array.from(document.querySelectorAll('h3')).find(h => h.innerText.includes('Không thể tải'));
    return {
      hasErrorBanner: !!errorHeading,
      errorText: errorHeading ? errorHeading.parentElement.innerText : null
    };
  })()`,
  returnByValue: true
});
console.log('Error check:', JSON.stringify(res.result.value, null, 2));
ws.close();
