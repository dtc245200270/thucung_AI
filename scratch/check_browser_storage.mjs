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
    const keys = Object.keys(localStorage);
    const raw = localStorage.getItem('petcare_schedules_v1');
    const items = raw ? JSON.parse(raw) : [];
    return {
      allKeys: keys,
      schedulesCount: items.length,
      schedules: items.map(i => ({ id: i.id, title: i.title, type: i.type, petId: i.petId, date: i.date }))
    };
  })()`,
  returnByValue: true
});
console.log('Browser LocalStorage check:');
console.log(JSON.stringify(res.result.value, null, 2));
ws.close();
